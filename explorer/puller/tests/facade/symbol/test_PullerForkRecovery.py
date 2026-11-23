# pylint: disable=too-many-lines
import asyncio
import configparser
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing, contextmanager
from copy import deepcopy
from datetime import datetime, timezone
from functools import partial
from hashlib import sha3_256
from queue import Queue
from tempfile import TemporaryDirectory
from unittest.mock import patch
from uuid import uuid4

import psycopg2
import pytest
from aiohttp import web
from aiohttp.test_utils import TestServer
from common.symbol.NativeMosaic import NativeMosaicInfo
from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from common.tests.PostgresTestUtils import drop_symbol_block_tables_if_present
from psycopg2 import errorcodes
from psycopg2 import sql as pg_sql
from symbolchain import sc
from symbolchain.CryptoTypes import PublicKey
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.sc import BlockType, NormalBlockV1, ReceiptType, TransactionType
from symbolchain.symbol.Network import Network
from symbollightapi.model.Exceptions import CorruptDataException, HttpException, NodeException
from zenlog import log

from puller.db.SymbolDatabase import RollbackRefreshEntries, SymbolDatabase
from puller.facade.ForkReconciliation import EvidenceChanged, ReconciliationBudget, RecoveryStopped
from puller.facade.SymbolPuller import SymbolRollbackError
from puller.facade.SymbolPullerConnector import SymbolPullerConnector
from puller.model.symbol.Block import create_block_row
from puller.model.symbol.ForkRecoveryStopReason import ForkRecoveryStopReason
from puller.model.symbol.Lock import create_hash_lock_row
from puller.model.symbol.Receipt import create_receipt_rows
from puller.model.symbol.ReceiptCommitment import calculate_receipts_hash
from puller.model.symbol.Transaction import TRANSACTION_TYPE_LABELS, create_transaction_row
from puller.workflows.migrate_fork_recovery import main as migrate_fork_recovery
from puller.workflows.symbol import main as run_symbol_command
from tests.test.SymbolBlockCommitmentTestUtils import commit_node_block, seal_replacement_blocks
from tests.test.SymbolLockTestUtils import create_secret_lock_item
from tests.test.SymbolMosaicTestUtils import create_mosaic_item
from tests.test.SymbolTestConstants import BENEFICIARY_ADDRESS, RECIPIENT_ADDRESS, SIGNER_ADDRESS, SIGNER_PUBLIC_KEY
from tests.test.SymbolTransactionCommitmentTestUtils import seal_block_transactions
from tests.test.SymbolTransactionTestUtils import create_transaction_entry

from .adaptive_batch_test_utils import create_adaptive_batch_fixture
from .puller_test_utils import (
	NATIVE_MOSAIC_ID,
	ChainInfoOverrideConnector,
	DelegatingSymbolDatabase,
	SymbolPullerTestBase,
	create_account_item,
	create_amount_statement_item,
	create_complete_aggregate_pair,
	create_db_config,
	create_embedded_node_transaction,
	create_network_properties,
	create_node_block,
	create_node_transaction,
	create_resolution_statement,
	create_symbol_puller,
	create_sync_state,
	create_transaction_page,
	resolution_path,
	set_symbol_connector,
	statement_path,
	transaction_path
)

HASH_LOCK_AMOUNT = 10_000_000


def _hash(height, fork_height, branch_offset=100_000):
	return f'{height + (branch_offset if height >= fork_height else 0):064X}'


def _chain(height, fork_height=100_000, branch_offset=100_000, *, seal_from=None):
	blocks = [
		create_node_block(
			block_height, _hash(block_height, fork_height, branch_offset), _hash(block_height - 1, fork_height, branch_offset))
		for block_height in range(1, height + 1)
	]
	if seal_from is not None:
		if seal_from <= fork_height <= height:
			blocks[fork_height - 1]['block']['stateHash'] = f'{branch_offset:064X}'

		seal_replacement_blocks(blocks[seal_from - 1:])

	return blocks


def _set_block_transactions(block, transactions):
	"""Commits the fixture transactions to their block."""

	seal_block_transactions(block, transactions)


def _create_replay_aggregate(block, version, messages, *, should_include_lock=False):
	height = int(block['block']['height'])
	parent = create_node_transaction(height, type=TransactionType.AGGREGATE_COMPLETE.value, version=version, cosignatures=[])
	del parent['transaction']['mosaics'], parent['transaction']['recipientAddress']
	children = [
		create_embedded_node_transaction(height, parent['meta']['hash'], index, message=message)
		for index, message in enumerate(messages)
	]
	if should_include_lock:
		lock = children[-1]['transaction']
		del lock['mosaics'], lock['recipientAddress'], lock['message']
		lock.update(
			type=TransactionType.HASH_LOCK.value, hash='CD' * 32, mosaicId=NATIVE_MOSAIC_ID, amount=str(HASH_LOCK_AMOUNT), duration='7')

	items = [parent, *children]
	_set_block_transactions(block, items)
	return items


def _set_v1_invalid_merkle_root(block, items):
	# Catapult b3222548d6c8 InvalidMerkleHashBuilder folds [A, B, C] into [H(A+B), H(B+B)].
	# Build the two leaves with the SDK's independent Catbuffer serializer.
	leaves = []
	for item in items[1:3]:
		body = item['transaction']
		child = sc.EmbeddedTransferTransactionV1()
		child.network = sc.NetworkType.TESTNET
		child.signer_public_key = sc.PublicKey(body['signerPublicKey'])
		child.recipient_address = sc.UnresolvedAddress(body['recipientAddress'])
		child.message = bytes.fromhex(body['message'])
		mosaic = sc.UnresolvedMosaic()
		mosaic.mosaic_id = sc.UnresolvedMosaicId(int(body['mosaics'][0]['id'], 16))
		mosaic.amount = sc.Amount(int(body['mosaics'][0]['amount']))
		child.mosaics = [mosaic]
		leaves.append(sha3_256(child.serialize()).digest())

	first, second = leaves[0], leaves[1]
	root = sha3_256(sha3_256(first + second).digest() + sha3_256(second * 2).digest()).digest()
	_set_v1_aggregate_root(block, items, root)


def _set_v1_aggregate_root(block, items, root):
	parent = items[0]['transaction']
	aggregate = sc.AggregateCompleteTransactionV1()
	aggregate.network = sc.NetworkType.TESTNET
	aggregate.signature = sc.Signature(parent['signature'])
	aggregate.signer_public_key = sc.PublicKey(parent['signerPublicKey'])
	aggregate.fee = sc.Amount(int(parent['maxFee']))
	aggregate.deadline = sc.Timestamp(int(parent['deadline']))
	aggregate.transactions_hash = sc.Hash256(root)
	entity_hash = str(SymbolFacade(Network.TESTNET).hash_transaction(aggregate))
	parent['transactionsHash'] = str(aggregate.transactions_hash)
	items[0]['meta'].update(hash=entity_hash, merkleComponentHash=entity_hash)
	for child in items[1:]:
		child['meta']['aggregateHash'] = entity_hash

	block['block']['transactionsHash'] = entity_hash


def _expected_bonded_rollback_addresses(owner_address, *, should_write_completion, reuse_height=None):
	accounts = [Network.TESTNET.address_class(bytes.fromhex(address)) for address in (SIGNER_ADDRESS, RECIPIENT_ADDRESS)]
	if should_write_completion:
		accounts.append(owner_address)

	if reuse_height:
		accounts.append(Network.TESTNET.public_key_to_address(PublicKey('34' * 32)))

	accounts.sort(key=lambda account: account.bytes)
	if not should_write_completion:
		accounts.append(owner_address)

	return [str(account) for account in accounts]


def _recovery_block(block):
	fields = block['block']
	roots = {}
	if 0 == block['meta'].get('totalTransactionsCount') and fields.get('transactionsHash') == '5' * 64:
		roots['transactionsHash'] = '0' * 64

	if fields.get('receiptsHash') == '6' * 64:
		roots['receiptsHash'] = '0' * 64

	return {**block, 'block': {**fields, **roots}} if roots else block


def _commit_recovery_suffix(blocks, start_height=7, *, statements=(), mosaics_by_height=None):
	"""Builds coherent headers after the replay payload is arranged."""

	bodies_by_height = {}
	for item in statements:
		statement = item['statement']
		bodies_by_height.setdefault(int(statement['height']), []).append(statement)

	for height in bodies_by_height.keys() | (mosaics_by_height or {}).keys():
		bodies = bodies_by_height.get(height, [])
		mosaics = [item['statement'] for item in (mosaics_by_height or {}).get(height, [])]
		blocks[height - 1]['block']['receiptsHash'] = calculate_receipts_hash(bodies, [], mosaics).hex().upper()

	for index in range(start_height - 1, len(blocks)):
		block = _recovery_block(blocks[index])
		fields = {
			**block['block'], 'type': BlockType.NORMAL.value, 'size': NormalBlockV1().size,
			'previousBlockHash': blocks[index - 1]['meta']['hash']
		}
		blocks[index] = commit_node_block({**block, 'block': fields, 'meta': {**block['meta']}})


def _alternate_finalized_hash(blocks, height):
	alternate = deepcopy(blocks)
	alternate[height - 1]['block']['timestamp'] = f'{height}001'
	_commit_recovery_suffix(alternate, height)
	return alternate[height - 1]['meta']['hash']


class RecoveryConnector(ChainInfoOverrideConnector):  # pylint: disable=too-many-instance-attributes
	"""Returns paginated blocks at any valid offset and can fail one external account page."""

	def __init__(  # pylint: disable=too-many-arguments,too-many-positional-arguments
		self, blocks, finalized_height, *, fail_account_page=False, chain_info_error=None, unavailable_page=None,
		evidence_by_height=None, hash_lock_responses=None, secret_lock_responses=None, **kwargs
	):
		blocks = [_recovery_block(block) for block in blocks]
		properties = create_network_properties()
		if any(block['block']['receiptsHash'] != '0' * 64 for block in blocks):
			properties['chain']['enableVerifiableReceipts'] = 'true'

		super().__init__(len(blocks), {}, finalized_height=finalized_height, **{'network_properties': properties, **kwargs})
		self.blocks = blocks
		self.lifecycle = []
		self.fail_account_page = fail_account_page
		self.chain_info_error = chain_info_error
		self.unavailable_page = unavailable_page
		self.evidence_by_height = evidence_by_height or {}
		self._hash_lock_responses = hash_lock_responses or {}
		self._secret_lock_responses = secret_lock_responses or {}

	def hash_lock_response(self, path):
		return self._hash_lock_responses[path]

	async def open(self):
		self.lifecycle.append('open')

	async def close(self):
		self.lifecycle.append('close')

	async def get(self, url_path, *args):
		if url_path.startswith('blocks?pageSize=100&offset='):
			self.paths.append(url_path)
			offset = int(url_path.split('offset=')[1].split('&')[0])
			if offset == self.unavailable_page:
				raise NodeException('block evidence page unavailable')

			return {'data': self.blocks[offset:offset + 100]}

		if url_path.startswith('blocks/'):
			self.paths.append(url_path)
			height = int(url_path.removeprefix('blocks/'))
			evidence = self.evidence_by_height.get(height, self.blocks[height - 1])
			if isinstance(evidence, Exception):
				raise evidence

			return evidence

		if url_path == 'chain/info' and self.chain_info_error is not None:
			self.paths.append(url_path)
			raise self.chain_info_error

		if url_path.startswith('lock/secret?'):
			self.paths.append(url_path)
			return self._secret_lock_responses.get(url_path, {'data': []})

		if url_path.startswith('lock/hash/'):
			self.paths.append(url_path)
			response = self._hash_lock_responses.get(url_path, {'code': 'ResourceNotFound', 'message': 'Lock not found'})
			if isinstance(response, Exception):
				raise response

			return response

		if self.fail_account_page and url_path.startswith('accounts?pageSize=100&pageNumber=2'):
			self.paths.append(url_path)
			raise NodeException('account page failed')

		response = await super().get(url_path, *args)
		if 'chain/info' == url_path and not self.finalized_fields.keys() & {'height', 'hash'} and 0 < self.finalized_height <= len(self.blocks):
			finalized = response['latestFinalizedBlock']
			if isinstance(finalized, dict) and 'hash' in finalized:
				finalized['hash'] = self.blocks[self.finalized_height - 1]['meta']['hash']

		return response


class LockRepairForkChangeConnector(RecoveryConnector):
	"""Switches the latest block during the rollback Hash Lock lookup."""

	async def get(self, url_path, *args):
		response = await super().get(url_path, *args)
		if url_path.startswith('lock/hash/'):
			height = len(self.blocks)
			block = self.blocks[-1]
			self.evidence_by_height[height] = {**block, 'meta': {**block['meta'], 'hash': 'AC' * 32}}

		return response


class LockRepairCommonBlockChangeConnector(RecoveryConnector):
	"""Changes the shared block at the first fresh chain-info read without moving tip or finality."""

	def __init__(self, blocks, finalized_height, field_path, *, common_height=None, replacement='AC' * 32, **kwargs):
		super().__init__(blocks, finalized_height, **kwargs)
		self._common_height = common_height or len(blocks)
		self._field_path = field_path
		self._replacement = replacement

	async def get(self, url_path, *args):
		if url_path == 'chain/info' and self.paths.count('chain/info') == 1:
			height = self._common_height
			block = self.blocks[height - 1]
			section, field = self._field_path
			self.evidence_by_height[height] = {**block, section: {**block[section], field: self._replacement}}

		return await super().get(url_path, *args)


class LockRepairTipChangeConnector(RecoveryConnector):
	"""Lowers the reported chain tip at a selected read while keeping block evidence available."""

	def __init__(self, blocks, finalized_height, *, shorten_on_read, **kwargs):
		super().__init__(blocks, finalized_height, **kwargs)
		self._shorten_on_read = shorten_on_read
		self.reported_heights = []

	async def get(self, url_path, *args):
		is_chain_info = 'chain/info' == url_path
		if is_chain_info and len(self.reported_heights) + 1 == self._shorten_on_read:
			self.chain_height -= 1

		response = await super().get(url_path, *args)
		if is_chain_info:
			self.reported_heights.append(int(response['height']))

		return response


class FailingPrerequisiteConnector(RecoveryConnector):
	"""Fails a sync prerequisite after reporting the node's finality."""

	def __init__(self, blocks, finalized_height, failure_path, failure, **kwargs):
		super().__init__(blocks, finalized_height, **kwargs)
		self._failure_path = failure_path
		self._failure = failure

	async def get(self, url_path, *args):
		if url_path == self._failure_path:
			self.paths.append(url_path)
			raise self._failure

		return await super().get(url_path, *args)


class MalformedNativeMosaicConnector(RecoveryConnector):
	"""Returns an invalid native mosaic response for recovery preflight."""

	async def get(self, url_path, *args):
		if url_path == f'mosaics/{NATIVE_MOSAIC_ID}':
			self.paths.append(url_path)
			return {}

		return await super().get(url_path, *args)


class HttpBlockEvidenceConnector(RecoveryConnector):
	"""Uses the actual HTTP connector for individual block evidence requests."""

	def __init__(self, blocks, finalized_height, block_connector):
		super().__init__(blocks, finalized_height)
		self._block_connector = block_connector

	async def get(self, url_path, *args):
		if url_path.startswith('blocks/'):
			self.paths.append(url_path)
			return await self._block_connector.get(url_path, *args)

		return await super().get(url_path, *args)


class LockRepairTipGrowthConnector(RecoveryConnector):
	"""Reports a higher tip after the rollback fetched the lock and pinned the old range."""

	def __init__(self, *args, grow_on_read=2, **kwargs):
		super().__init__(*args, **kwargs)
		self._grow_on_read = grow_on_read

	async def get(self, url_path, *args):
		if url_path == 'chain/info' and self.paths.count('chain/info') + 1 == self._grow_on_read:
			self.chain_height += 1

		return await super().get(url_path, *args)


class LockRepairDelayedPageConnector(RecoveryConnector):
	"""Advances the manual clock after receiving a selected reconciliation page."""

	def __init__(self, blocks, finalized_height, clock, delayed_path):
		super().__init__(blocks, finalized_height)
		self._clock = clock
		self._delayed_path = delayed_path

	async def get(self, url_path, *args):
		response = await super().get(url_path, *args)
		if url_path == self._delayed_path:
			self._clock.seconds = 30

		return response


class FailingWriteDatabase(DelegatingSymbolDatabase):
	"""Injects a failure after write intent and before the first resumed block write."""

	def upsert_blocks(self, blocks, *, expected_checkpoint=None):  # pylint: disable=unused-argument,no-self-use
		raise RuntimeError('resumed write failed')


class CaptureRepairCutDatabase(FailingWriteDatabase):
	"""Snapshots the committed cut and fails if replay attempts a block write."""

	def __init__(self, database, capture_state):
		super().__init__(database)
		self._capture_state = capture_state
		self.cut = None

	def repair_rollback_from_height(self, height, sync_state, refresh_entries):
		recovery = self.database.repair_rollback_from_height(height, sync_state, refresh_entries)
		self.cut = self._capture_state()
		return recovery


class UnexpectedRepairDatabase(DelegatingSymbolDatabase):
	"""Fails when validation lets an unproven rollback reach the repair transaction."""

	def repair_rollback_from_height(self, height, sync_state, refresh_entries):  # pylint: disable=unused-argument,no-self-use
		raise AssertionError('unexpected rollback repair')


class ObserveRepairCutDatabase(DelegatingSymbolDatabase):
	"""Observes committed rollback state before the first replay request."""

	def __init__(self, database, capture_state, *, after_cut=None):
		super().__init__(database)
		self._capture_state = capture_state
		self._after_cut = after_cut
		self.cut = None

	def repair_rollback_from_height(self, height, sync_state, refresh_entries):
		recovery = self.database.repair_rollback_from_height(height, sync_state, refresh_entries)
		self.cut = self._capture_state()
		if self._after_cut is not None:
			self._after_cut()

		return recovery


class FailingHashLockWriteDatabase(DelegatingSymbolDatabase):
	"""Interrupts a real batch after its block, transactions and receipts have committed."""

	def upsert_hash_lock(self, hash_lock_row):  # pylint: disable=unused-argument,no-self-use
		raise RuntimeError('hash lock write interrupted')


class FailingBondedReceiptWriteDatabase(DelegatingSymbolDatabase):
	"""Leaves the aggregate transaction written before the completion receipt can commit."""

	def upsert_receipts_for_height(self, height, receipts, block_reward):  # pylint: disable=unused-argument,no-self-use
		raise RuntimeError('bonded aggregate receipt write interrupted')


class DirtyIntentOnEvidenceFailureConnector(RecoveryConnector):
	"""Commits an independent writer's intent after the comparison pin."""

	def __init__(self, blocks, external_database):
		super().__init__(blocks, 2, unavailable_page=1)
		self._external_database = external_database

	async def get(self, url_path, *args):
		if url_path == 'blocks?pageSize=100&offset=1&orderBy=height' and url_path not in self.paths:
			self._external_database.mark_sync_write_intent(3)

		return await super().get(url_path, *args)


def _hold_symbol_blocks_lock(database):
	with database.connection.cursor() as cursor:
		# Release the lock independently if a regression omits the shorter statement timeout.
		cursor.execute('SET LOCAL idle_in_transaction_session_timeout = 2000')
		cursor.execute('LOCK TABLE symbol_blocks IN ACCESS EXCLUSIVE MODE NOWAIT')


class LockedAdminEvidencePageDatabase(DelegatingSymbolDatabase):
	"""Exhausts the real SQL comparison budget after an earlier evidence page completed."""

	def __init__(self, database, blocker, clock):
		super().__init__(database)
		self._blocker = blocker
		self._clock = clock

	def get_block_chain_evidence(self, start_height, end_height):
		if 102 == start_height:
			_hold_symbol_blocks_lock(self._blocker)
			self._clock.seconds = 29.9

		return self.database.get_block_chain_evidence(start_height, end_height)


class LockedFinalityReadConnector(RecoveryConnector):
	"""Blocks the SQL hash read when post-comparison verification requests the finalized block."""

	def __init__(self, blocks, blocking_database, clock, elapsed_seconds):
		super().__init__(blocks, finalized_height=2)
		self._blocking_database = blocking_database
		self._clock = clock
		self._elapsed_seconds = elapsed_seconds

	async def get(self, url_path, *args):
		response = await super().get(url_path, *args)
		if 'blocks/2' == url_path:
			_hold_symbol_blocks_lock(self._blocking_database)
			self._clock.seconds += self._elapsed_seconds

		return response


class LockedContiguousInspectionDatabase(DelegatingSymbolDatabase):
	"""Blocks the real SQL scan of the complete retained prefix."""

	def __init__(self, database, blocking_database):
		super().__init__(database)
		self._blocking_database = blocking_database

	def get_contiguous_block_tip(self):
		_hold_symbol_blocks_lock(self._blocking_database)
		return self.database.get_contiguous_block_tip()


class LockedCheckpointHashDatabase(DelegatingSymbolDatabase):
	"""Blocks the real no-new-block checkpoint hash read after the branch match."""

	def __init__(self, database, blocking_database):
		super().__init__(database)
		self._blocking_database = blocking_database
		self._tip_reads = 0

	def get_block_hash(self, height):
		if 3 == height:
			self._tip_reads += 1
			if 2 == self._tip_reads:
				_hold_symbol_blocks_lock(self._blocking_database)

		return self.database.get_block_hash(height)


class CommitFailingConnection:
	"""Delegates PostgreSQL operations and raises at commit."""

	def __init__(self, connection):
		self._connection = connection

	def commit(self):  # pylint: disable=no-self-use
		raise RuntimeError('checkpoint commit failed')

	def __getattr__(self, name):
		return getattr(self._connection, name)


@contextmanager
def _fail_commit(database):
	connection = database.connection
	database.connection = CommitFailingConnection(connection)
	try:
		yield
	finally:
		database.connection = connection


class FailingCheckpointDatabase(DelegatingSymbolDatabase):
	"""Rejects the PostgreSQL commit of the selected checkpoint transaction."""

	def __init__(self, database, failed_checkpoint_number=1):
		super().__init__(database)
		self._failed_checkpoint_number = failed_checkpoint_number
		self.checkpoint_count = 0

	def checkpoint_sync_state(self, sync_state):
		self.checkpoint_count += 1
		if self.checkpoint_count == self._failed_checkpoint_number:
			with _fail_commit(self.database):
				self.database.checkpoint_sync_state(sync_state)

		return self.database.checkpoint_sync_state(sync_state)


class FailingReopenDatabase(DelegatingSymbolDatabase):
	"""Rolls back the terminal gate update after executing its real SQL."""

	def reopen_fork_reconciliation(self, expected, stop_reason, proof):
		with _fail_commit(self.database):
			self.database.reopen_fork_reconciliation(expected, stop_reason, proof)


class FailingTransientComparisonCommitDatabase(DelegatingSymbolDatabase):
	"""Fails the actual commit after clean comparison progress has been cleared."""

	def discard_transient_fork_progress(self, expected, progress):
		with _fail_commit(self.database):
			return self.database.discard_transient_fork_progress(expected, progress)


class StaleTerminalSnapshotDatabase(DelegatingSymbolDatabase):
	"""Supplies a stale invalidation count to the real conditional release transaction."""

	def reopen_fork_reconciliation(self, expected, stop_reason, proof):
		self.database.reopen_fork_reconciliation({**expected, 'invalidations': expected['invalidations'] - 1}, stop_reason, proof)


class FailingRestorationDatabase(DelegatingSymbolDatabase):
	"""Fails rollback preflight before attempting any history mutation."""

	def get_rollback_account_addresses(self, height):  # pylint: disable=unused-argument,no-self-use
		raise RuntimeError('restoration evidence unavailable')


class FailingSavedRangeDatabase(DelegatingSymbolDatabase):
	"""Fails the read of the highest saved block during prerequisite error classification."""

	def get_max_block_height(self):  # pylint: disable=no-self-use
		raise psycopg2.Error('saved range unavailable')


class FailingRepairCommitAndStopDatabase(DelegatingSymbolDatabase):
	"""Fails both the real repair commit and the subsequent failure-state report."""

	def repair_rollback_from_height(self, height, sync_state, refresh_entries):
		with _fail_commit(self.database):
			return self.database.repair_rollback_from_height(height, sync_state, refresh_entries)

	def stop_fork_recovery(self, reason):  # pylint: disable=unused-argument,no-self-use
		raise RuntimeError('recovery stop write failed')


class NewerWriteIntentDatabase(DelegatingSymbolDatabase):
	"""Writes a newer intent before a no-new-block checkpoint reaches the database."""

	def checkpoint_sync_state(self, sync_state):
		self.database.mark_sync_write_intent(sync_state['last_synced_height'] + 1)
		return self.database.checkpoint_sync_state(sync_state)


class ManualReconciliationClock:
	"""Advances elapsed comparison time without slowing PostgreSQL tests."""

	def __init__(self):
		self.seconds = 0

	def __call__(self):
		return self.seconds


class DelayedEvidenceDatabase(DelegatingSymbolDatabase):
	"""Charges deterministic elapsed time after real database page reads."""

	def __init__(self, database, clock):
		super().__init__(database)
		self._clock = clock
		self._elapsed = iter((29, 2))

	def get_block_chain_evidence(self, start_height, end_height):
		evidence = self.database.get_block_chain_evidence(start_height, end_height)
		self._clock.seconds += next(self._elapsed)
		return evidence


class ExpiringBlockReadDatabase(DelegatingSymbolDatabase):
	"""Consumes the full elapsed budget while retrieving the known parent hash."""

	def __init__(self, database, clock):
		super().__init__(database)
		self._clock = clock

	def get_block_hash(self, height):
		block_hash = self.database.get_block_hash(height)
		if 2 == height:
			self._clock.seconds = 30

		return block_hash


class DelayedContiguousInspectionDatabase(DelegatingSymbolDatabase):
	"""Charges deterministic elapsed time to the independent retained-prefix inspection."""

	def __init__(self, database, clock):
		super().__init__(database)
		self._clock = clock

	def get_contiguous_block_tip(self):
		block_tip = self.database.get_contiguous_block_tip()
		self._clock.seconds += 35
		return block_tip


class ChangingEvidenceDatabase(DelegatingSymbolDatabase):
	"""Changes compared history after the real database has returned a page."""

	def __init__(self, database, replacement):
		super().__init__(database)
		self._replacement = replacement

	def get_block_chain_evidence(self, start_height, end_height):
		rows = self.database.get_block_chain_evidence(start_height, end_height)
		if start_height == 2:
			self.database.upsert_blocks([self._replacement])

		return rows


class ChangedPredecessorConnector(RecoveryConnector):
	"""Reports a changed predecessor on the direct check before repair commits."""

	async def get(self, url_path, *args):
		response = await super().get(url_path, *args)
		if url_path == 'blocks/5':
			return {**response, 'meta': {**response['meta'], 'hash': 'AB' * 32}}

		return response


class FinalityChangingBeforeCommitConnector(RecoveryConnector):
	"""Changes the node's view once the proof pages and repair restoration have completed."""

	def __init__(self, blocks, finalized_height, latest_height, *, changed_block=None, change_at='blocks/102'):
		super().__init__(blocks, finalized_height, mosaics_by_id={NATIVE_MOSAIC_ID: create_mosaic_item(NATIVE_MOSAIC_ID)})
		self._latest_height = latest_height
		self._changed_block = changed_block
		self._change_at = change_at
		self.minimum_chain_info_reads = 1
		self.has_changed = False

	async def get(self, url_path, *args):
		has_read_chain = self.paths.count('chain/info') >= self.minimum_chain_info_reads
		if url_path == self._change_at and has_read_chain and any(path.startswith('blocks?') for path in self.paths) and not self.has_changed:
			self.finalized_fields.update(height=str(self._latest_height), hash=self.blocks[self._latest_height - 1]['meta']['hash'])
			if self._changed_block is not None:
				self.evidence_by_height[self.finalized_height] = self._changed_block

			self.has_changed = True

		return await super().get(url_path, *args)


class SwitchingRepairViewConnector(RecoveryConnector):
	"""Changes the node's history on a selected fresh chain-info read."""

	def __init__(self, blocks, finalized_height, refreshed_blocks, *, switch_on_read=2):
		super().__init__(blocks, finalized_height, mosaics_by_id={NATIVE_MOSAIC_ID: create_mosaic_item(NATIVE_MOSAIC_ID)})
		self._refreshed_blocks = refreshed_blocks
		self._switch_on_read = switch_on_read
		self.chain_views = []

	async def get(self, url_path, *args):
		is_chain_info = 'chain/info' == url_path
		if is_chain_info and len(self.chain_views) + 1 == self._switch_on_read:
			self.blocks = self._refreshed_blocks
			self.chain_height = len(self.blocks)
			self.finalized_fields['hash'] = self.blocks[self.finalized_height - 1]['meta']['hash']

		response = await super().get(url_path, *args)
		if is_chain_info:
			self.chain_views.append((int(response['height']), response['latestFinalizedBlock']['hash']))

		return response


class ClosingFinalityConnector(RecoveryConnector):
	"""Reports the new finality point on each chain-info read after the initial observation."""

	def __init__(self, blocks, finalized_height, *, closing_height, should_conflict=False, **kwargs):
		super().__init__(blocks, finalized_height, **kwargs)
		self.closing_height = closing_height
		self.closing_hash = _alternate_finalized_hash(self.blocks, closing_height) if should_conflict else (
			self.blocks[closing_height - 1]['meta']['hash'])
		self.reported_finality = []

	async def get(self, url_path, *args):
		response = await super().get(url_path, *args)
		if 'chain/info' == url_path:
			finalized = response['latestFinalizedBlock']
			if self.reported_finality:
				finalized.update(height=str(self.closing_height), hash=self.closing_hash)

			self.reported_finality.append((int(finalized['height']), finalized['hash']))

		return response


class RetryingCommitChainInfoConnector(RecoveryConnector):
	"""Fails the first fresh chain-info request after the repair boundary has been checked."""

	async def get(self, url_path, *args):
		if 'chain/info' == url_path and self.paths.count(url_path) == 1:
			self.paths.append(url_path)
			raise NodeException('temporary chain info failure')

		return await super().get(url_path, *args)


def _delete_ancestor(database, height=2):
	with database.connection:
		with database.connection.cursor() as cursor:
			cursor.execute('DELETE FROM symbol_blocks WHERE height = %s', (height,))
			assert 1 == cursor.rowcount


class DeleteAncestorOnForwardPageConnector(RecoveryConnector):
	"""Deletes a verified ancestor through a different PostgreSQL session during the forward fetch."""

	def __init__(self, blocks, external_database):
		super().__init__(blocks, 6)
		self._external_database = external_database

	async def get(self, url_path, *args):
		if url_path == 'blocks?pageSize=100&offset=5&orderBy=height':
			assert 'blocks/5' in self.paths
			_delete_ancestor(self._external_database)

		return await super().get(url_path, *args)


class DeleteAncestorAfterFinalHashDatabase(DelegatingSymbolDatabase):
	"""Deletes an ancestor after the saved finality check has returned its hash."""

	def __init__(self, database, external_database, connector):
		super().__init__(database)
		self._external_database = external_database
		self._connector = connector
		self.has_deleted = False

	def get_block_hash(self, height):
		block_hash = self.database.get_block_hash(height)
		if height == 4 and 'blocks/4' in self._connector.paths and not self.has_deleted:
			_delete_ancestor(self._external_database)
			self.has_deleted = True

		return block_hash


class DeleteAncestorAfterWriteIntentDatabase(DelegatingSymbolDatabase):
	"""Commits an unrelated history edit after write intent but before the first block write."""

	def __init__(self, database, external_database):
		super().__init__(database)
		self._external_database = external_database

	def mark_sync_write_intent(self, height, *, expected_checkpoint=None):
		self.database.mark_sync_write_intent(height, expected_checkpoint=expected_checkpoint)
		_delete_ancestor(self._external_database)


class DeleteAncestorAfterBlockWriteDatabase(DelegatingSymbolDatabase):
	"""Commits a different revision between the replacement block write and its checkpoint."""

	def __init__(self, database, external_database):
		super().__init__(database)
		self._external_database = external_database

	def upsert_blocks(self, blocks, *, expected_checkpoint=None):
		revision = self.database.upsert_blocks(blocks, expected_checkpoint=expected_checkpoint)
		_delete_ancestor(self._external_database)
		return revision


class DeleteAncestorAfterCheckpointDatabase(DelegatingSymbolDatabase):
	"""Edits block history after a batch checkpoint commits and before its caller continues."""

	def __init__(self, database, external_database):
		super().__init__(database)
		self._external_database = external_database
		self.committed_recovery = None

	def checkpoint_sync_state(self, sync_state):
		recovery = self.database.checkpoint_sync_state(sync_state)
		if sync_state['last_synced_height'] == 6:
			self.committed_recovery = recovery
			_delete_ancestor(self._external_database)

		return recovery


class SymbolPullerForkRecoveryTest(SymbolPullerTestBase):  # pylint: disable=too-many-public-methods
	def _seed_legacy(self, blocks, public_height, saved_height, dirty=None):
		self._seed_pre_migration_history(blocks, public_height, saved_height, dirty)
		migrate_fork_recovery(['--db-config', str(self.config_ini)])

	def _simulate_previous_lock_history_migration(self):
		# The original migration recorded legacy_lock_history without its upper bound.
		database = self.puller.symbol_db
		with database.connection, database.connection.cursor() as cursor:
			cursor.execute('ALTER TABLE symbol_fork_recovery DROP COLUMN legacy_history_height')

		migrate_fork_recovery(['--db-config', str(self.config_ini)])

	def _seed_legacy_with_unknown_lock_history(self, blocks, public_height, saved_height):
		self._seed_legacy(blocks, public_height, saved_height)
		self._simulate_previous_lock_history_migration()

	def _seed_pre_migration_history(self, blocks, public_height, saved_height, dirty=None):
		database = self.puller.symbol_db
		database.upsert_blocks([create_block_row(block, 100, Network.TESTNET) for block in blocks])
		database.upsert_sync_state(create_sync_state(
			chain_height=len(blocks),
			finalized_height=public_height,
			finalized_hash=bytes.fromhex(blocks[public_height - 1]['meta']['hash']),
			last_synced_height=saved_height,
			last_synced_block_hash=bytes.fromhex(blocks[saved_height - 1]['meta']['hash']),
			dirty_state_from_height=dirty))
		# Simulate the pre-upgrade schema while retaining all populated legacy rows.
		with database.connection:
			with database.connection.cursor() as cursor:
				cursor.execute('DROP TRIGGER IF EXISTS symbol_record_block_revision ON symbol_blocks')
				cursor.execute('DROP TABLE symbol_fork_recovery')
				cursor.execute('DROP FUNCTION IF EXISTS symbol_record_block_revision()')
				cursor.execute('DROP TYPE symbol_fork_recovery_stop_reason')

	@contextmanager
	def _use_database(self, replacement):
		original = self.puller.symbol_db
		self.puller.symbol_db = replacement
		try:
			yield
		finally:
			self.puller.symbol_db = original

	def _recovery(self):
		return self.puller.symbol_db.try_get_fork_recovery_state()

	def _pause_at_pinned_comparison(self, connector):
		puller = self.puller
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 1))
		try:
			with self.puller.symbol_db:
				with self.assertRaisesRegex(SymbolRollbackError, '^Symbol branch reconciliation request budget exhausted$'):
					self._sync_with_connector(connector)
		finally:
			self.puller = puller

	def _assert_refresh_skipped_twice(self, connector, reason):
		# Arrange:
		before = self._capture_preserved_state()
		recovery_before = self._recovery()
		self.assertEqual(reason, recovery_before['stop_reason'])
		previous_requests = list(connector.paths)
		set_symbol_connector(self.puller, connector)

		for _ in range(2):
			# Act:
			refreshed = asyncio.run(self.puller.refresh_accounts())

			# Assert:
			self.assertFalse(refreshed)
			self._assert_preserved_state(before, before.sync_state)
			self.assertEqual(recovery_before, self._recovery())
			self.assertEqual(previous_requests, connector.paths)

	def test_sync_recovers_legacy_dirty_public_fork_and_reopens_account_refresh(self):
		# Arrange: both 6 and 7 are orphaned and only 6 was checkpointed by the old writer.
		legacy = _chain(7, 6)
		self._seed_legacy(legacy, public_height=6, saved_height=6, dirty=7)
		database = self.puller.symbol_db
		database.upsert_transactions_for_height(7, [create_transaction_entry(
			7, 'orphaned', signer_address=bytes.fromhex(SIGNER_ADDRESS))])
		orphaned_receipt = create_amount_statement_item(
			6, 987, receipt_type=ReceiptType.HARVEST_FEE.value, targetAddress=BENEFICIARY_ADDRESS)
		database.upsert_receipts_for_height(6, create_receipt_rows(orphaned_receipt), 0)
		blocks = _chain(7)
		transaction = create_node_transaction(6)
		statement = create_amount_statement_item(7, 123)
		seal_replacement_blocks(blocks[5:], transactions=[transaction], statements=[statement])
		transactions = {transaction_path(6, 7): create_transaction_page([transaction])}
		receipts = {statement_path(6, 7): {'data': [statement]}}
		connector = RecoveryConnector(blocks, 7, transactions_by_path=transactions, statement_pages=receipts)

		self._assert_refresh_skipped_twice(connector, 'migration_pending')

		# Act:
		heights, state = self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(list(range(1, 8)), heights)
		self.assertEqual(('healthy', 7, 7, None), (
			state['status'], state['last_synced_height'], state['finalized_height'], state['dirty_state_from_height']))
		self.assertEqual((7, bytes.fromhex(blocks[6]['meta']['hash']), None, None), (
			self._recovery()['verified_height'], self._recovery()['verified_hash'],
			self._recovery()['resume_height'], self._recovery()['stop_reason']))
		self.assertEqual(bytes.fromhex(blocks[5]['meta']['hash']), bytes(self.puller.symbol_db.get_block_hash(6)))
		with self.puller.symbol_db.connection.cursor() as cursor:
			cursor.execute('SELECT height, encode(hash, %s) FROM symbol_transactions ORDER BY height', ('hex',))
			self.assertEqual([(6, transaction['meta']['hash'].lower())], cursor.fetchall())
			cursor.execute('SELECT height, amount FROM symbol_receipts ORDER BY height')
			self.assertEqual([(7, 123)], cursor.fetchall())

		# Act:
		set_symbol_connector(self.puller, RecoveryConnector(blocks, 7, account_pages={1: [create_account_item()]}))
		refreshed = asyncio.run(self.puller.refresh_accounts())

		# Assert:
		self.assertTrue(refreshed)
		self.assertEqual('healthy', self.puller.symbol_db.get_account_refresh_state()['status'])

	def test_sync_preserves_legacy_public_history_when_fork_is_above_node_finality(self):
		for fork_height in (107, 115):
			with self.subTest(fork_height=fork_height):
				# Arrange:
				drop_symbol_block_tables_if_present(self.puller.symbol_db)
				self.puller.symbol_db.create_tables()
				legacy = _chain(120, fork_height)
				self._seed_legacy(legacy, public_height=120, saved_height=120)
				before = self._capture_preserved_state()
				connector = RecoveryConnector(_chain(110), 105)

				# Act:
				with self.assertRaisesRegex(SymbolRollbackError, 'Node finalization cannot justify changing the legacy public checkpoint'):
					self._sync_with_connector(connector)

				# Assert:
				self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
				self.assertIsNone(self._recovery()['verified_height'])
				self._assert_refresh_skipped_twice(connector, 'legacy_node_behind_public')

	def test_sync_repairs_below_legacy_public_height_when_fork_is_finalized(self):
		# Arrange:
		self._seed_legacy(_chain(120, 103), public_height=120, saved_height=120)

		blocks = _chain(110, seal_from=103)

		# Act:
		heights, state = self._sync_with_connector(RecoveryConnector(blocks, 105))

		# Assert:
		self.assertEqual(list(range(1, 111)), heights)
		self.assertEqual((105, 110, 4, 5), (
			state['finalized_height'], state['last_synced_height'], state['finalized_epoch'], state['finalized_point']))
		self.assertEqual(105, self._recovery()['verified_height'])
		self.assertEqual(bytes.fromhex(blocks[102]['meta']['hash']), bytes(self.puller.symbol_db.get_block_hash(103)))

	def test_sync_preserves_legacy_public_history_when_the_only_difference_is_a_missing_row(self):
		# Arrange: retain real generations and history above the currently reachable node tip.
		blocks = _chain(120)
		connector = RecoveryConnector(blocks, 120, account_pages={1: [create_account_item()]})
		self._sync_with_connector(connector)
		for _ in range(2):
			self.assertTrue(asyncio.run(self.puller.refresh_accounts()))

		self._seed_legacy(blocks, public_height=120, saved_height=120)
		database = self.puller.symbol_db
		database.upsert_transactions_for_height(115, [{**create_transaction_entry(15, 'legacy-transaction'), 'height': 115}])
		database.upsert_receipts_for_height(116, create_receipt_rows(create_amount_statement_item(116, 117)), 0)
		with database.connection:
			with database.connection.cursor() as cursor:
				cursor.execute('DELETE FROM symbol_blocks WHERE height = %s', (103,))

		before = self._capture_preserved_state()
		node = RecoveryConnector(blocks[:110], 105)

		# Check fresh evidence and an older progress representation.
		for is_old_progress in (False, True):
			with self.subTest(is_old_progress=is_old_progress):
				# Act:
				with self.assertRaisesRegex(SymbolRollbackError, '^Node finalization does not establish the legacy rollback boundary$'):
					self._sync_with_connector(node)

				# Assert:
				self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
				recovery = self._recovery()
				self.assertEqual((None, 'legacy_fork_unproven', 103, 'missing'), (
					recovery['verified_height'], recovery['stop_reason'], recovery['progress']['fork_height'], recovery['progress']['fork_difference']))
				self.assertEqual([], [path for path in node.paths if path.startswith('transactions/confirmed?')])

				# Arrange: use the legacy progress format on the next attempt.
				if not is_old_progress:
					old_progress = recovery['progress']
					del old_progress['fork_difference']
					database.update_fork_reconciliation(old_progress, 0, ForkRecoveryStopReason.LEGACY_FORK_UNPROVEN)

		self.assertEqual([height for height in range(1, 121) if 103 != height], self._fetch_block_heights(database))

	def test_sync_keeps_verified_checkpoint_when_local_gap_is_below_its_unchanged_hash(self):
		# Arrange:
		blocks = _chain(5)
		self._sync_with_connector(RecoveryConnector(blocks, 4))
		database = self.puller.symbol_db
		with database.connection:
			with database.connection.cursor() as cursor:
				cursor.execute('DELETE FROM symbol_blocks WHERE height = %s', (2,))

		before = self._capture_preserved_state()
		recovery_before = self._recovery()
		node = RecoveryConnector(blocks, 4)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Local contiguous Symbol history does not reach the verified finalized height$'):
			self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual({**recovery_before, 'stop_reason': 'verified_anchor_conflict'}, self._recovery())
		self.assertEqual([], [path for path in node.paths if path.startswith('blocks')])

	def test_sync_rejects_legacy_repair_when_uncommitted_rows_move_the_cut_before_the_proven_fork(self):
		# Arrange: actual mismatch at 103 is finalized, but replay would have to start at 101.
		self._seed_legacy(_chain(120, 103), public_height=120, saved_height=100)
		before = self._capture_preserved_state()
		node = RecoveryConnector(_chain(110), 105)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Node finalization does not establish the legacy rollback boundary'):
			self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual((103, 'hash_mismatch'), (
			self._recovery()['progress']['fork_height'], self._recovery()['progress']['fork_difference']))
		self.assertEqual([], [path for path in node.paths if path.startswith('transactions/confirmed?')])

	def _prepare_failed_resume(self, finalized_height=1, failure_database=FailingCheckpointDatabase, fork_height=4, *, seal_from=None):
		seal_from = seal_from or fork_height
		self._sync_with_connector(RecoveryConnector(_chain(5, fork_height, seal_from=seal_from), finalized_height))
		blocks = _chain(10, seal_from=seal_from)
		with self._use_database(failure_database(self.puller.symbol_db)):
			with self.assertRaisesRegex(RuntimeError, 'checkpoint commit failed|resumed write failed'):
				self._sync_with_connector(RecoveryConnector(blocks[:5], finalized_height))

		state = self.puller.symbol_db.get_sync_state()
		self.assertEqual((fork_height - 1, finalized_height, fork_height, fork_height), (
			state['last_synced_height'], state['finalized_height'], state['dirty_state_from_height'], self._recovery()['resume_height']))
		return blocks

	def test_sync_checks_continuity_before_resume_fast_path_when_a_verified_ancestor_is_missing(self):
		# Arrange: the failed replacement left only the retained prefix, so the fast path would normally be eligible.
		blocks = self._prepare_failed_resume(finalized_height=2, failure_database=FailingWriteDatabase)
		database = self.puller.symbol_db
		with database.connection:
			with database.connection.cursor() as cursor:
				cursor.execute('DELETE FROM symbol_blocks WHERE height = 1')

		before = self._capture_preserved_state()
		recovery_before = self._recovery()
		node = RecoveryConnector(blocks, 2)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Local contiguous Symbol history does not reach the verified finalized height$'):
			self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual({**recovery_before, 'stop_reason': 'verified_anchor_conflict'}, self._recovery())
		self.assertEqual([], [path for path in node.paths if path.startswith('blocks')])

	def test_sync_repairs_a_gap_above_verified_history_without_using_resume_fast_path(self):
		# Arrange: the original resume boundary still looks complete at the endpoint, but height two is missing.
		blocks = self._prepare_failed_resume(failure_database=FailingWriteDatabase, fork_height=5, seal_from=2)
		database = self.puller.symbol_db
		with database.connection:
			with database.connection.cursor() as cursor:
				cursor.execute('DELETE FROM symbol_blocks WHERE height = 2')

		node = RecoveryConnector(blocks[:5], 1)

		# Act:
		heights, state = self._sync_with_connector(node)

		# Assert: replacement starts at the actual missing block, keeping the verified boundary intact.
		self.assertEqual([1, 2, 3, 4, 5], heights)
		self.assertEqual((5, 1, None, None), (
			state['last_synced_height'], self._recovery()['verified_height'], state['dirty_state_from_height'], self._recovery()['resume_height']))
		self.assertEqual([transaction_path(2, 5)], [path for path in node.paths if path.startswith('transactions/confirmed?')])

	def test_capped_resume_retries_blocks_without_promoting_finality_or_expiring_locks(self):
		# Arrange: a prior repair awaits replay at four, and its retained lock ends above the last verified block.
		blocks = self._prepare_failed_resume()
		database = self.puller.symbol_db
		lock_hash = 'AA' * 32
		lock_entry = {'lock': {
			'hash': lock_hash, 'ownerAddress': SIGNER_ADDRESS, 'mosaicId': NATIVE_MOSAIC_ID,
			'amount': '1234', 'endHeight': '3', 'status': 0
		}, 'id': 'retained-lock'}
		database.upsert_hash_lock(create_hash_lock_row(lock_entry, 1))
		before_locks = self._fetch_table_state(('symbol_hash_locks',))
		capped = RecoveryConnector(blocks, 10)

		# Act:
		heights, state = self._sync_with_connector(capped, max_height=5)

		# Assert: replacing the dirty rows through five does not certify an ancestor below the cap.
		self.assertEqual(list(range(1, 6)), heights)
		self.assertEqual((5, 1, None), (state['last_synced_height'], state['finalized_height'], state['dirty_state_from_height']))
		self.assertEqual((1, None), (self._recovery()['verified_height'], self._recovery()['resume_height']))
		self.assertEqual(before_locks, self._fetch_table_state(('symbol_hash_locks',)))
		self.assertEqual([], [path for path in capped.paths if path.startswith('lock/hash/')])

		# Arrange:
		uncapped = RecoveryConnector(blocks, 10)

		# Act:
		_, state = self._sync_with_connector(uncapped)

		# Assert:
		self.assertEqual((10, 10, 10), (state['last_synced_height'], state['finalized_height'], self._recovery()['verified_height']))
		self.assertEqual({'symbol_hash_locks': []}, self._fetch_table_state(('symbol_hash_locks',)))
		self.assertEqual([f'lock/hash/{lock_hash}'], [path for path in uncapped.paths if path.startswith('lock/hash/')])

	def test_sync_rejects_cap_below_verified_height_without_touching_stored_state(self):
		# Arrange:
		connector = RecoveryConnector(_chain(120), 110, account_pages={1: [create_account_item()]})
		_, state = self._sync_with_connector(connector)
		self.assertTrue(asyncio.run(self.puller.refresh_accounts()))
		self.puller.symbol_db.upsert_sync_state({
			**state, 'finalized_height': 100, 'finalized_hash': bytes.fromhex(_hash(100, 100_000))})
		before = self._capture_preserved_state()
		recovery_before = self._recovery()
		previous_requests = list(connector.paths)

		# Act:
		with self.assertRaisesRegex(ValueError, 'max_height is below the recorded finalized height'):
			self._sync_with_connector(connector, max_height=105)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(recovery_before, self._recovery())
		self.assertEqual(previous_requests, connector.paths)

	def test_sync_reuses_committed_tip_after_repeated_lower_caps(self):
		# Arrange:
		blocks = _chain(12)
		self._sync_with_connector(RecoveryConnector(blocks, 7))

		for cap in (10, 9, 9):
			# Act:
			heights, state = self._sync_with_connector(RecoveryConnector(blocks, 7), max_height=cap)

			# Assert:
			self.assertEqual(list(range(1, 13)), heights)
			self.assertEqual((cap, 12), (state['last_synced_height'], self._recovery()['reusable_height']))

		# Arrange:
		connector = RecoveryConnector(blocks, 7)

		# Act:
		heights, state = self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(list(range(1, 13)), heights)
		self.assertEqual(12, state['last_synced_height'])
		self.assertIsNone(self._recovery()['reusable_height'])
		self.assertEqual(['blocks/12', 'blocks/7'], [path for path in connector.paths if path.startswith('blocks')])

	def test_sync_rewrites_physical_tail_after_failed_second_account_page(self):
		# Arrange:
		blocks = _chain(12)
		self._sync_with_connector(RecoveryConnector(blocks, 7))
		refresh = RecoveryConnector(blocks, 7, account_pages={1: [create_account_item()]})
		set_symbol_connector(self.puller, refresh)
		self.assertTrue(asyncio.run(self.puller.refresh_accounts()))
		published = self.puller.symbol_db.get_account_refresh_state()['last_successful_run_id']
		self._sync_with_connector(RecoveryConnector(blocks, 7), max_height=9)
		accounts = [
			create_account_item(Network.TESTNET.public_key_to_address(PublicKey(f'{index:064X}')).bytes.hex(), str(index))
			for index in range(1, 101)
		]
		failing_refresh = RecoveryConnector(blocks, 7, fail_account_page=True, account_pages={1: accounts})
		set_symbol_connector(self.puller, failing_refresh)

		# Act:
		with self.assertRaisesRegex(NodeException, 'account page failed'):
			asyncio.run(self.puller.refresh_accounts())

		# Assert:
		refresh_state = self.puller.symbol_db.get_account_refresh_state()
		self.assertEqual((published, 1, None), (
			refresh_state['last_successful_run_id'], refresh_state['last_scanned_page'], self._recovery()['reusable_height']))
		with self.puller.symbol_db.connection.cursor() as cursor:
			cursor.execute('SELECT COUNT(*) FROM symbol_account_refresh_accounts WHERE refresh_run_id != %s', (published,))
			self.assertEqual((100,), cursor.fetchone())

		# Arrange:
		connector = RecoveryConnector(blocks, 7)

		# Act:
		_, state = self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(12, state['last_synced_height'])
		self.assertEqual([transaction_path(10, 12)], [path for path in connector.paths if path.startswith('transactions/confirmed?')])

	def test_sync_preserves_resume_boundary_until_replacement_batch_commits(self):
		# These retries share one recovery contract: the committed resume boundary lasts until replay is checkpointed.
		# Arrange:
		self._seed_legacy(_chain(110, 107), public_height=106, saved_height=110)
		database = self.puller.symbol_db
		blocks = _chain(110, seal_from=107)

		# Act: the successful repair and failed forward write have separate commits.
		with self._use_database(FailingWriteDatabase(database)):
			with self.assertRaisesRegex(RuntimeError, 'resumed write failed'):
				self._sync_with_connector(RecoveryConnector(blocks, 106))

		# Assert:
		self._assert_resume_at_107(106)

		for tip, cap in ((105, None), (106, None), (110, 106)):
			with self.subTest(tip=tip, cap=cap):
				connector = RecoveryConnector(blocks[:tip], min(tip, 106))
				# Act:
				with self.assertRaisesRegex(SymbolRollbackError, 'Symbol repair awaits block 107'):
					self._sync_with_connector(connector, max_height=cap)

				# Assert:
				self._assert_resume_at_107(106)
				self._assert_refresh_skipped_twice(connector, 'resume_wait')

		# Arrange:
		conflicting_blocks = deepcopy(blocks)
		conflicting_blocks[106]['block']['previousBlockHash'] = 'F' * 64
		bad_parent = RecoveryConnector(conflicting_blocks, 106)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Node Symbol replay block commitments changed before repair'):
			self._sync_with_connector(bad_parent)

		# Assert:
		self._assert_resume_at_107(106)
		self.assertEqual(1, self._recovery()['invalidations'])
		# Reconciliation restarts at the verified parent (height 106), even though the replacement itself never writes.
		self.assertEqual(
			['blocks?pageSize=100&offset=105&orderBy=height'],
			[path for path in bad_parent.paths if path.startswith('blocks?')])
		self.assertEqual([], [path for path in bad_parent.paths if path.startswith('transactions/confirmed?')])

		bad_hash = RecoveryConnector(blocks[:107], 107, finalized_fields={'hash': 'F' * 64})

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Node finalized block hash does not match chain info'):
			self._sync_with_connector(bad_hash)

		# Assert:
		self._assert_resume_at_107(106)

		# Act:
		with self._use_database(FailingCheckpointDatabase(database)):
			with self.assertRaisesRegex(RuntimeError, 'checkpoint commit failed'):
				self._sync_with_connector(RecoveryConnector(blocks[:107], 107))

		# Assert:
		self._assert_resume_at_107(107)

		# Act:
		heights, state = self._sync_with_connector(RecoveryConnector(blocks, 107))

		# Assert:
		self.assertEqual(list(range(1, 111)), heights)
		self.assertEqual((107, 110, None, None, None), (
			state['finalized_height'], state['last_synced_height'], state['dirty_state_from_height'],
			self._recovery()['resume_height'], self._recovery()['stop_reason']))

	def _assert_resume_at_107(self, physical_tip):
		state = self.puller.symbol_db.get_sync_state()
		self.assertEqual((106, 106, 107, 107, physical_tip), (
			state['last_synced_height'], state['finalized_height'], state['dirty_state_from_height'],
			self._recovery()['resume_height'], self.puller.symbol_db.get_max_block_height()))

	def test_sync_resumes_a_budgeted_comparison_at_persisted_page_boundaries(self):
		# Arrange:
		blocks = _chain(701)
		self._seed_legacy(blocks, public_height=1, saved_height=701)
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 5))
		self.exit_stack.enter_context(self.puller.symbol_db)

		for expected_height in (301, 501):
			connector = RecoveryConnector(blocks, 1)

			# Act:
			with self.assertRaisesRegex(SymbolRollbackError, 'Symbol branch reconciliation request budget exhausted'):
				self._sync_with_connector(connector)

			# Assert:
			self.assertEqual(expected_height, self._recovery()['progress']['checked_height'])
			self.assertEqual(5, len([path for path in connector.paths if path.startswith('blocks')]))
			self._assert_refresh_skipped_twice(connector, 'reconciliation_wait')

			# Arrange: use the older progress format on the next attempt.
			if expected_height == 301:
				old_progress = self._recovery()['progress']
				del old_progress['fork_difference']
				self.puller.symbol_db.update_fork_reconciliation(old_progress, 0, ForkRecoveryStopReason.RECONCILIATION_WAIT)

		# Arrange:
		connector = RecoveryConnector(blocks, 1)

		# Act:
		_, state = self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(701, state['last_synced_height'])
		self.assertEqual((None, None), (self._recovery()['progress'], self._recovery()['stop_reason']))
		self.assertEqual(
			['blocks?pageSize=100&offset=501&orderBy=height', 'blocks?pageSize=100&offset=601&orderBy=height'],
			[path for path in connector.paths if path.startswith('blocks?')])

	def test_sync_holds_legacy_migration_when_the_cap_cannot_reach_finality(self):
		# Arrange: an ancestor can be linked to raw F=7, but the cap prevents registering any new V.
		blocks = _chain(7)
		self._seed_legacy(blocks[:3], public_height=2, saved_height=3)
		connector = RecoveryConnector(blocks, 7)
		before = self._capture_preserved_state()

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^max_height prevents verification of the legacy finalized checkpoint$'):
			self._sync_with_connector(connector, max_height=3)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual((None, 'migration_pending'), (self._recovery()['verified_height'], self._recovery()['stop_reason']))
		self.assertEqual([], [path for path in connector.paths if path.startswith('transactions/confirmed?')])

	def test_sync_keeps_fresh_capped_publication_empty_when_finality_is_outside_the_cap(self):
		# Arrange:
		properties = create_network_properties()
		del properties['chain']['votingSetGrouping']
		blocks = _chain(7)
		connector = RecoveryConnector(blocks, 7, network_properties=properties)

		# Act:
		_, state = self._sync_with_connector(connector, max_height=3)

		# Assert:
		self.assertEqual((3, 3, None, None, None, None), (
			state['chain_height'], state['last_synced_height'], state['finalized_height'],
			state['finalized_hash'], state['finalized_epoch'], state['finalized_point']))
		self.assertEqual((0, bytes(32)), (self._recovery()['verified_height'], self._recovery()['verified_hash']))

		# Act: run with a cap that reaches F.
		_, state = self._sync_with_connector(RecoveryConnector(blocks, 7), max_height=7)

		# Assert:
		self.assertEqual((7, 4, 5), (state['finalized_height'], state['finalized_epoch'], state['finalized_point']))

	def test_sync_publishes_node_epoch_and_point_at_finality_zero_after_a_block_commits(self):
		# Arrange:
		connector = RecoveryConnector(_chain(3), 0)

		# Act:
		_, state = self._sync_with_connector(connector, max_height=2)

		# Assert:
		self.assertEqual((2, 0, bytes(32), 4, 5), (
			state['last_synced_height'], state['finalized_height'], bytes(state['finalized_hash']),
			state['finalized_epoch'], state['finalized_point']))

	def test_refresh_accounts_publishes_after_an_ordinary_unhealthy_sync(self):
		# Arrange:
		blocks = _chain(2)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		failing_sync = RecoveryConnector(blocks, 1, chain_fields={'height': 'malformed'})

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Malformed Symbol finalized block in chain info'):
			self._sync_with_connector(failing_sync)

		# Assert:
		self.assertEqual(('unhealthy', None), (self.puller.symbol_db.get_sync_state()['status'], self._recovery()['stop_reason']))

		# Arrange:
		refresh = RecoveryConnector(blocks, 1, account_pages={1: [create_account_item()]})
		set_symbol_connector(self.puller, refresh)

		# Act:
		refreshed = asyncio.run(self.puller.refresh_accounts())

		# Assert:
		self.assertTrue(refreshed)
		state = self.puller.symbol_db.get_account_refresh_state()
		self.assertEqual(('healthy', 2), (state['status'], state['last_completed_height']))

	def test_sync_keeps_locks_when_no_new_block_promotion_commit_fails(self):
		# Arrange:
		blocks = _chain(2)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		lock_hash = 'AA' * 32
		lock_entry = {'lock': {
			'hash': lock_hash, 'ownerAddress': SIGNER_ADDRESS, 'mosaicId': NATIVE_MOSAIC_ID,
			'amount': '1234', 'endHeight': '2', 'status': 0
		}, 'id': 'hash-lock'}
		database = self.puller.symbol_db
		database.upsert_hash_lock(create_hash_lock_row(lock_entry, 1))
		before = self._capture_preserved_state()

		# Act: make the database roll back the transaction that would publish F=2.
		promotion = RecoveryConnector(blocks, 2)
		with self._use_database(FailingCheckpointDatabase(database)):
			with self.assertRaisesRegex(RuntimeError, 'checkpoint commit failed'):
				self._sync_with_connector(promotion)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(1, self._recovery()['verified_height'])
		self.assertEqual(['blocks/2'], [path for path in promotion.paths if path.startswith(('blocks', 'lock/hash'))])

		# Arrange:
		promotion = RecoveryConnector(blocks, 2)

		# Act:
		_, state = self._sync_with_connector(promotion)

		# Assert:
		self.assertEqual((2, 2), (state['finalized_height'], self._recovery()['verified_height']))
		self.assertEqual([f'lock/hash/{lock_hash}'], [path for path in promotion.paths if path.startswith('lock/hash')])
		with database.connection.cursor() as cursor:
			cursor.execute('SELECT end_height FROM symbol_hash_locks')
			self.assertEqual([], cursor.fetchall())

	def test_sync_rechecks_pinned_history_and_stops_after_three_invalidations(self):
		# Arrange:
		blocks = _chain(301)
		self._seed_legacy(blocks, public_height=1, saved_height=301)
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 3))
		database = self.exit_stack.enter_context(self.puller.symbol_db)

		for iteration in range(1, 4):
			connector = RecoveryConnector(blocks, 1)

			# Act:
			with self.assertRaisesRegex(SymbolRollbackError, 'Symbol branch reconciliation request budget exhausted'):
				self._sync_with_connector(connector)

			# Assert:
			self.assertEqual(101, self._recovery()['progress']['checked_height'])

			# Arrange:
			replacement = create_node_block(201, f'{201 + iteration * 10_000:064X}')
			database.upsert_blocks([create_block_row(replacement, 100, Network.TESTNET)])
			expected = (
				'Pinned Symbol reconciliation evidence changed' if iteration < 3
				else 'Symbol reconciliation evidence changed too many consecutive times')

			# Act:
			with self.assertRaisesRegex(SymbolRollbackError, expected):
				self._sync_with_connector(RecoveryConnector(blocks, 1))

			# Assert:
			self.assertEqual((iteration, None, None), (
				self._recovery()['invalidations'], self._recovery()['progress'], self._recovery()['verified_height']))

		self._assert_refresh_skipped_twice(connector, 'evidence_invalidated')

	def test_sync_restarts_twice_from_a_completed_prefix_without_scanning_it(self):
		# Arrange:
		transaction_ranges = [(1, 2), (3, 4), (5, 6)]
		blocks, pages, statements = create_adaptive_batch_fixture([1] * 6, transaction_ranges)
		self.puller = create_symbol_puller(self.config_ini, 'testnet', max_transactions_per_batch=2)
		self.exit_stack.enter_context(self.puller.symbol_db)

		# Fail one later transaction fetch in each of the first two runs.
		for index, (stable_height, previous_height) in enumerate(((2, None), (4, 2)), start=1):
			failed_transactions = {
				**pages, transaction_path(*transaction_ranges[index]): RuntimeError('catch-up fetch interrupted')
			}
			connector = RecoveryConnector(blocks, 6, transactions_by_path=failed_transactions, statement_pages=statements)

			# Act:
			with self.assertRaisesRegex(RuntimeError, 'catch-up fetch interrupted'):
				self._sync_with_connector(connector)

			# Assert:
			state = self.puller.symbol_db.get_sync_state()
			self.assertEqual((stable_height, stable_height, None, None, 0), (
				state['last_synced_height'], self.puller.symbol_db.get_max_block_height(),
				state['dirty_state_from_height'], state['finalized_height'], self._recovery()['verified_height']))
			expected = [f'blocks/{previous_height}'] if previous_height else []
			self.assertEqual(
				expected + [f'blocks?pageSize=100&offset={previous_height or 0}&orderBy=height'],
				[path for path in connector.paths if path.startswith('blocks')])

		# Arrange:
		connector = RecoveryConnector(blocks, 6, transactions_by_path=pages, statement_pages=statements)

		# Act:
		_, state = self._sync_with_connector(connector)

		# Assert:
		self.assertEqual((6, 6), (state['last_synced_height'], state['finalized_height']))
		self.assertEqual(
			['blocks/4', 'blocks?pageSize=100&offset=4&orderBy=height'],
			[path for path in connector.paths if path.startswith('blocks')])

	def test_sync_promotes_verified_finality_in_an_intermediate_batch_and_publishes_at_completion(self):
		# Arrange: publish height one, then plan two batches with F=3 in the first.
		blocks, pages, statements = create_adaptive_batch_fixture([0, 1, 1, 1, 1], [(2, 3), (4, 5)])
		for height, transaction in enumerate(pages[transaction_path(4, 5)]['data'], 4):
			_set_block_transactions(blocks[height - 1], [transaction])

		_commit_recovery_suffix(blocks, 4)
		self.puller = create_symbol_puller(self.config_ini, 'testnet', max_transactions_per_batch=2)
		database = self.exit_stack.enter_context(self.puller.symbol_db)
		self._sync_with_connector(RecoveryConnector(blocks[:1], 1, finalized_fields={'finalizationEpoch': 9, 'finalizationPoint': 2}))
		node_responses = {
			'finalized_fields': {'finalizationEpoch': 10, 'finalizationPoint': 3},
			'transactions_by_path': pages,
			'statement_pages': statements
		}
		failing_database = FailingCheckpointDatabase(database, failed_checkpoint_number=2)

		# Act: let both batches write, then fail the terminal checkpoint commit.
		with self._use_database(failing_database):
			with self.assertRaisesRegex(RuntimeError, '^checkpoint commit failed$'):
				self._sync_with_connector(RecoveryConnector(blocks, 3, **node_responses))

		# Assert: height three is verified, while REST still reads the published tuple at one.
		state = database.get_sync_state()
		recovery = self._recovery()
		self.assertEqual(2, failing_database.checkpoint_count)
		self.assertEqual(('unhealthy', 5, 3, 4), (
			state['status'], database.get_max_block_height(), state['last_synced_height'], state['dirty_state_from_height']))
		self.assertEqual((3, bytes.fromhex(_hash(3, 100_000)), 10, 3), (
			recovery['verified_height'], recovery['verified_hash'], recovery['verified_epoch'], recovery['verified_point']))
		self.assertEqual((1, bytes.fromhex(_hash(1, 100_000)), 9, 2), (
			state['finalized_height'], bytes(state['finalized_hash']), state['finalized_epoch'], state['finalized_point']))

		# Arrange: the retry has the same evidence and complete transaction pages.
		connector = RecoveryConnector(blocks, 3, **node_responses)

		# Act:
		heights, state = self._sync_with_connector(connector)

		# Assert: the terminal checkpoint publishes the verified tuple.
		self.assertEqual(list(range(1, 6)), heights)
		self.assertEqual(('healthy', 5, None, None), (
			state['status'], state['last_synced_height'], state['dirty_state_from_height'], self._recovery()['resume_height']))
		self.assertEqual((3, bytes.fromhex(_hash(3, 100_000)), 10, 3), (
			state['finalized_height'], bytes(state['finalized_hash']), state['finalized_epoch'], state['finalized_point']))
		self.assertEqual([transaction_path(4, 5)], [path for path in connector.paths if path.startswith('transactions/confirmed?')])

	def test_sync_replaces_orphaned_current_state_and_preserves_prefork_generations(self):
		# Arrange:
		self._set_retention_time_budget(0)
		orphan = Network.TESTNET.public_key_to_address(PublicKey('CC' * 32))
		old_blocks = _chain(12, 11, seal_from=10)
		old_blocks[10]['block']['beneficiaryAddress'] = orphan.bytes.hex().upper()
		_commit_recovery_suffix(old_blocks, 11)
		self._sync_with_connector(RecoveryConnector(old_blocks, 7))

		blocks = _chain(12, seal_from=10)
		for _ in range(3):
			set_symbol_connector(self.puller, RecoveryConnector(blocks[:10], 7, account_pages={1: [create_account_item()]}))
			self.assertTrue(asyncio.run(self.puller.refresh_accounts()))

		generation_state = self.puller.symbol_db.get_account_refresh_state()
		generation_tables = ('symbol_account_refresh_accounts', 'symbol_account_refresh_mosaics', 'symbol_account_list_ranks')
		generations = self._fetch_table_state(generation_tables)
		self.assertEqual(3, len(generations['symbol_account_refresh_accounts']))
		self._sync_with_connector(RecoveryConnector(old_blocks, 7), max_height=9)
		self.assertEqual(12, self._recovery()['reusable_height'])

		# Act:
		replacement = RecoveryConnector(blocks, 7, account_by_address={str(orphan): None})
		heights, state = self._sync_with_connector(replacement)

		# Assert:
		self.assertEqual(list(range(1, 13)), heights)
		self.assertEqual((12, 7), (state['last_synced_height'], state['finalized_height']))
		self.assertEqual(generation_state, self.puller.symbol_db.get_account_refresh_state())
		self.assertEqual(generations, self._fetch_table_state(generation_tables))
		with self.puller.symbol_db.connection.cursor() as cursor:
			cursor.execute('SELECT count(*) FROM symbol_accounts WHERE address = %s', (orphan.bytes,))
			self.assertEqual((0,), cursor.fetchone())

	def test_sync_keeps_the_terminal_stop_when_the_node_matches_the_saved_checkpoint(self):
		# Arrange: a healthy committed checkpoint can ordinarily use one short range.
		blocks = _chain(12)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 2))
		self.exit_stack.enter_context(self.puller.symbol_db)

		for iteration in range(1, 4):
			changed_branch = RecoveryConnector(_chain(12, 11), 1)

			# Act:
			with self.assertRaisesRegex(SymbolRollbackError, 'Symbol branch reconciliation request budget exhausted'):
				self._sync_with_connector(changed_branch)

			# Assert:
			self.assertIsNotNone(self._recovery()['progress'])

			# Arrange:
			expected = (
				'Pinned Symbol reconciliation evidence changed' if iteration < 3
				else 'Symbol reconciliation evidence changed too many consecutive times')

			# Act:
			with self.assertRaisesRegex(SymbolRollbackError, expected):
				self._sync_with_connector(RecoveryConnector(blocks, 1))

			# Assert:
			self.assertEqual((iteration, None), (self._recovery()['invalidations'], self._recovery()['progress']))

		# Arrange: the node once again agrees with the saved checkpoint.
		connector = RecoveryConnector(blocks, 1)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Symbol reconciliation evidence changed too many consecutive times'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual((3, 12, 1), (
			self._recovery()['invalidations'], self.puller.symbol_db.get_sync_state()['last_synced_height'],
			self._recovery()['verified_height']))
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks')])
		self._assert_refresh_skipped_twice(connector, 'evidence_invalidated')

	def _set_terminal_stop(self):
		database = self.puller.symbol_db
		database.update_fork_reconciliation(None, 3, ForkRecoveryStopReason.EVIDENCE_INVALIDATED)
		database.stop_fork_recovery(ForkRecoveryStopReason.EVIDENCE_INVALIDATED)

	def _recover_fork(self, connector, height, block_hash):
		set_symbol_connector(self.puller, connector)
		asyncio.run(self.puller.recover_fork(height, block_hash))

	def test_recover_fork_refuses_wrong_candidate_and_unlinked_finalized_evidence_without_changes(self):
		# Arrange: retain an actual generation and stop a verified branch at the terminal gate.
		blocks = _chain(4)
		connector = RecoveryConnector(blocks, 1, account_pages={1: [create_account_item()]})
		self._sync_with_connector(connector)
		self.assertTrue(asyncio.run(self.puller.refresh_accounts()))
		self._set_terminal_stop()
		before = self._capture_preserved_state()
		recovery_before = self._recovery()
		changed_anchor = _chain(4, 1)
		changed_candidate = _chain(4, 3)

		cases = (
			(0, '0' * 64, RecoveryConnector(blocks, 4), 'outside the retained finalized range'),
			(3, 'AB' * 32, RecoveryConnector(blocks, 4), 'candidate hash does not match the retained block'),
			(3, blocks[2]['meta']['hash'], RecoveryConnector(changed_anchor, 4, evidence_by_height={3: blocks[2]},
				finalized_fields={'hash': changed_anchor[-1]['meta']['hash']}),
				'No Symbol common block within the reconciliation search limit'),
			(3, blocks[2]['meta']['hash'], RecoveryConnector(
				changed_candidate, 4, finalized_fields={'hash': changed_candidate[-1]['meta']['hash']}),
				'candidate hash does not match the node block'),
			(3, blocks[2]['meta']['hash'], RecoveryConnector(changed_candidate, 4, evidence_by_height={3: blocks[2]},
				finalized_fields={'hash': changed_candidate[-1]['meta']['hash']}), 'candidate is not on the retained node branch'),
			(3, blocks[2]['meta']['hash'], RecoveryConnector(blocks, 4, finalized_fields={'hash': 'AB' * 32}),
				'Node finalized block hash does not match chain info')
		)
		for height, block_hash, node, error in cases:
			with self.subTest(error=error):
				# Act:
				with self.assertRaisesRegex(SymbolRollbackError, error):
					self._recover_fork(node, height, block_hash)

				# Assert:
				self._assert_preserved_state(before, before.sync_state)
				self.assertEqual(recovery_before, self._recovery())
				self.assertEqual([], [path for path in node.paths if path.startswith('transactions/confirmed?')])

	def test_recover_fork_resumes_completed_admin_proof_pages_without_reopening_early(self):
		# Arrange: an intentionally small request budget requires multiple invocations for the same proof.
		blocks = _chain(360)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		self._set_terminal_stop()
		before = self._capture_preserved_state()
		terminal = self._recovery()
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 6))
		self.exit_stack.enter_context(self.puller.symbol_db)
		candidate = [150, blocks[149]['meta']['hash']]

		# Act: exhaust the first invocation after a completed page.
		node = RecoveryConnector(blocks, 360)
		with self.assertRaisesRegex(SymbolRollbackError, 'Symbol branch reconciliation request budget exhausted'):
			self._recover_fork(node, *candidate)

		# Assert: completed pages are stored separately, without releasing the terminal stop.
		recovery = self._recovery()
		self.assertEqual({**terminal, 'admin_progress': recovery['admin_progress']}, recovery)
		self.assertEqual((candidate, 301), (recovery['admin_progress']['candidate'], recovery['admin_progress']['proof']['checked_height']))
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual([f'blocks?pageSize=100&offset={offset}&orderBy=height' for offset in (0, 1, 101, 201)], [
			path for path in node.paths if path.startswith('blocks?')])

		# Act: try a wrong hash while the original candidate has a retained proof.
		paused = self._recovery()
		with self.assertRaisesRegex(SymbolRollbackError, 'candidate hash does not match the retained block'):
			self._recover_fork(RecoveryConnector(blocks, 360), 150, 'AB' * 32)

		# Assert:
		self.assertEqual(paused, self._recovery())
		self._assert_refresh_skipped_twice(node, 'evidence_invalidated')

		# Act:
		node = RecoveryConnector(blocks, 360)
		with self.assertRaisesRegex(SymbolRollbackError, 'Symbol branch reconciliation request budget exhausted'):
			self._recover_fork(node, *candidate)

		# Assert: the final page and first fresh chain-info read consume this invocation's budget.
		self.assertEqual(['blocks?pageSize=100&offset=301&orderBy=height'], [path for path in node.paths if path.startswith('blocks?')])
		self.assertEqual(2, node.paths.count('chain/info'))
		self.assertEqual(360, self._recovery()['admin_progress']['proof']['checked_height'])
		self._assert_refresh_skipped_twice(node, 'evidence_invalidated')
		self._assert_preserved_state(before, before.sync_state)

		# Act:
		node = RecoveryConnector(blocks, 360)
		self._recover_fork(node, *candidate)

		# Assert:
		self.assertEqual(['chain/info', 'blocks/360', 'chain/info'], node.paths[-3:])
		self.assertEqual([], [path for path in node.paths if path.startswith('blocks?')])
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual({**terminal, 'admin_progress': None, 'invalidations': 0, 'stop_reason': None}, self._recovery())

	def test_recover_fork_discards_stale_admin_proof_when_fixed_finality_changes(self):
		# Arrange: pin a paused proof at raw F=3.
		blocks = _chain(4)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		self._set_terminal_stop()
		before = self._capture_preserved_state()
		terminal = self._recovery()
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 2))
		self.exit_stack.enter_context(self.puller.symbol_db)
		candidate = (2, blocks[1]['meta']['hash'])
		with self.assertRaisesRegex(SymbolRollbackError, 'Symbol branch reconciliation request budget exhausted'):
			self._recover_fork(RecoveryConnector(blocks, 3), *candidate)

		self.assertEqual([3, blocks[2]['meta']['hash'], 4, 5], self._recovery()['admin_progress']['proof']['finalized'])

		# Act: advancing raw finality does not authorize the pinned proof for another finalized block.
		with self.assertRaisesRegex(SymbolRollbackError, 'Pinned Symbol reconciliation evidence changed'):
			self._recover_fork(RecoveryConnector(blocks, 4), *candidate)

		# Assert: only the obsolete separate proof is removed. The original terminal state remains.
		self.assertEqual(terminal, self._recovery())
		self._assert_preserved_state(before, before.sync_state)

	def test_recover_fork_saves_admin_progress_when_postgresql_times_out_on_a_later_page(self):
		# Arrange: leave a clean terminal stop on a branch with multiple evidence pages.
		blocks = _chain(230)
		clock = ManualReconciliationClock()
		self.puller = create_symbol_puller(
			self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, time_source=clock))
		database = self.exit_stack.enter_context(self.puller.symbol_db)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		self._set_terminal_stop()
		before = self._capture_preserved_state()
		terminal = self._recovery()
		candidate = (150, blocks[149]['meta']['hash'])

		# Act: use another real connection to block SQL when the next page reaches the database.
		with SymbolDatabase(database.db_config) as blocker:
			with self._use_database(LockedAdminEvidencePageDatabase(database, blocker, clock)):
				with self.assertRaisesRegex(SymbolRollbackError, '^Unable to verify saved block range$') as failure:
					self._recover_fork(RecoveryConnector(blocks, 230), *candidate)

		# Assert: SQL cancellation preserves only the completed proof, not the blocked page or an early release.
		self.assertEqual(errorcodes.QUERY_CANCELED, failure.exception.__cause__.pgcode)
		recovery = self._recovery()
		self.assertEqual(101, recovery['admin_progress']['proof']['checked_height'])
		self.assertEqual({**terminal, 'admin_progress': recovery['admin_progress']}, recovery)
		self._assert_preserved_state(before, before.sync_state)

		# Act:
		retry = RecoveryConnector(blocks, 230)
		self._recover_fork(retry, *candidate)

		# Assert:
		self.assertEqual(['blocks?pageSize=100&offset=101&orderBy=height', 'blocks?pageSize=100&offset=201&orderBy=height'], [
			path for path in retry.paths if path.startswith('blocks?')])
		self.assertEqual((None, None), (self._recovery()['admin_progress'], self._recovery()['stop_reason']))
		self._assert_preserved_state(before, before.sync_state)

	def test_recover_fork_rejects_a_negative_candidate_before_reading_the_node(self):
		# Arrange:
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		self._set_terminal_stop()
		before = self._capture_preserved_state()
		recovery = self._recovery()
		node = RecoveryConnector(blocks, 3)

		# Act:
		with self.assertRaisesRegex(ValueError, '^candidate_height must be a nonnegative block height$'):
			self._recover_fork(node, -1, '00' * 32)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(recovery, self._recovery())
		self.assertEqual([], node.paths)

	def test_recover_fork_preserves_a_nonterminal_checkpoint_without_reading_the_node(self):
		# Arrange:
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		before = self._capture_preserved_state()
		recovery = self._recovery()
		node = RecoveryConnector(blocks, 3)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Symbol recovery is not stopped by consecutive evidence invalidations$'):
			self._recover_fork(node, 1, blocks[0]['meta']['hash'])

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(recovery, self._recovery())
		self.assertEqual([], node.paths)

	def _run_recover_cli(self, node, height, block_hash):
		arguments = [
			'recover-fork', '--symbol-node', 'http://node.test:3000', '--db-config', str(self.config_ini), '--network', 'testnet',
			'--candidate-height', str(height), '--candidate-hash', block_hash
		]

		def create_puller(_node_url, config_path, network, _node_config):
			return create_symbol_puller(config_path, network, connector=node)

		asyncio.run(run_symbol_command(arguments, create_puller, {'SYMBOL_NODE_ALLOWED_HOSTS': 'node.test:3000'}))

	def test_recover_fork_cli_keeps_the_terminal_gate_when_another_writer_holds_the_lock(self):
		# Arrange:
		blocks = _chain(4)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		self._set_terminal_stop()
		before = self._capture_preserved_state()
		recovery = self._recovery()
		node = RecoveryConnector(blocks, 4)

		# Act:
		with self.puller.symbol_db.workflow_lock():
			with self.assertRaisesRegex(RuntimeError, 'Another Symbol workflow is running'):
				self._run_recover_cli(node, 3, blocks[2]['meta']['hash'])

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(recovery, self._recovery())
		self.assertEqual([], node.paths)
		self.assertEqual(['open', 'close'], node.lifecycle)

	def test_recover_fork_cli_reopens_a_clean_terminal_gate_for_refresh_and_sync(self):
		# Arrange: use the real dispatcher and a test node on the same PostgreSQL database.
		blocks = _chain(4)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		self._set_terminal_stop()
		before = self._capture_preserved_state()
		node = RecoveryConnector(blocks, 4, account_pages={1: [create_account_item()]})

		# Act:
		self._run_recover_cli(node, 3, blocks[2]['meta']['hash'])

		# Assert: gate release alone leaves publication unchanged.
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(['open', 'close'], node.lifecycle)
		self.assertEqual((0, None, 1), (self._recovery()['invalidations'], self._recovery()['stop_reason'], self._recovery()['verified_height']))

		# Act:
		set_symbol_connector(self.puller, node)
		refreshed = asyncio.run(self.puller.refresh_accounts())

		# Assert:
		self.assertTrue(refreshed)
		self.assertIsNotNone(self.puller.symbol_db.get_account_refresh_state()['valid_run_id'])

		# Act:
		_, state = self._sync_with_connector(node)

		# Assert:
		self.assertEqual((4, 4), (state['finalized_height'], self._recovery()['verified_height']))

	def test_recover_fork_keeps_terminal_state_when_restoration_or_gate_commit_fails(self):
		# Arrange: a replacement fork needs the normal restoration checks.
		blocks = _chain(5, seal_from=4)
		self._sync_with_connector(RecoveryConnector(_chain(5, 4), 1))
		self._set_terminal_stop()
		before = self._capture_preserved_state()
		recovery_before = self._recovery()

		for database_factory, error_type, error in (
			(FailingRestorationDatabase, RuntimeError, 'restoration evidence unavailable'),
			(FailingReopenDatabase, RuntimeError, 'checkpoint commit failed'),
			(StaleTerminalSnapshotDatabase, ValueError, 'Terminal Symbol recovery stop changed before commit')
		):
			with self.subTest(error=error):
				# Act:
				with self._use_database(database_factory(self.puller.symbol_db)):
					with self.assertRaisesRegex(error_type, error):
						self._recover_fork(RecoveryConnector(blocks, 5), 3, blocks[2]['meta']['hash'])

				# Assert:
				self._assert_preserved_state(before, before.sync_state)
				self.assertEqual(recovery_before, self._recovery())

	def test_recover_fork_keeps_resume_and_dirty_markers_until_ordinary_sync_finishes(self):
		# Arrange:
		blocks = self._prepare_failed_resume()
		self._set_terminal_stop()
		before = self._capture_preserved_state()
		proof = self._recovery()['progress']['replacement_proof']
		node = RecoveryConnector(blocks[:5], 5, account_pages={1: [create_account_item()]})

		# Act:
		self._recover_fork(node, 3, blocks[2]['meta']['hash'])

		# Assert: an administrative proof cannot clear either marker or enable refresh early.
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual((0, 4, 'resume_wait'), (
			self._recovery()['invalidations'], self._recovery()['resume_height'], self._recovery()['stop_reason']))
		self.assertEqual(proof, self._recovery()['progress']['replacement_proof'])
		self._assert_refresh_skipped_twice(node, 'resume_wait')

		# Act:
		_, state = self._sync_with_connector(node)

		# Assert:
		self.assertEqual((5, None, None), (state['last_synced_height'], state['dirty_state_from_height'], self._recovery()['resume_height']))
		self.assertIsNone(self._recovery()['progress'])

		# Act:
		refreshed = asyncio.run(self.puller.refresh_accounts())

		# Assert:
		self.assertTrue(refreshed)

	def test_recover_fork_can_prove_genesis_when_no_positive_checkpoint_was_written(self):
		# Arrange: a failed first checkpoint has a known genesis anchor and unreconciled block one.
		blocks = _chain(2, seal_from=1)
		with self._use_database(FailingCheckpointDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(RuntimeError, 'checkpoint commit failed'):
				self._sync_with_connector(RecoveryConnector(blocks, 2))

		self._set_terminal_stop()
		before = self._capture_preserved_state()
		self.assertEqual((None, 1), (before.sync_state['last_synced_height'], before.sync_state['dirty_state_from_height']))
		node = RecoveryConnector(blocks, 2)

		# Act:
		self._recover_fork(node, 0, '0' * 64)

		# Assert: genesis authorizes replay but does not publish the uncheckpointed writes.
		self._assert_preserved_state(before, before.sync_state)
		self._assert_refresh_skipped_twice(node, 'reconciliation_wait')

		# Act:
		heights, state = self._sync_with_connector(node)

		# Assert:
		self.assertEqual([1, 2], heights)
		self.assertEqual((2, 2, None), (state['last_synced_height'], state['finalized_height'], state['dirty_state_from_height']))

	def test_recover_fork_preserves_terminal_state_when_comparison_transport_fails(self):
		# Arrange: the proven candidate is readable, but the comparison tip is temporarily unavailable.
		blocks = _chain(5)
		self._sync_with_published_account_generation(blocks, 1)
		self._set_terminal_stop()
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()
		failure = NodeException('temporary comparison tip read failure')
		node = RecoveryConnector(blocks, 5, evidence_by_height={5: failure})

		# Act:
		with self.assertRaises(NodeException) as raised:
			self._recover_fork(node, 3, blocks[2]['meta']['hash'])

		# Assert:
		self.assertIs(failure, raised.exception)
		self.assertEqual(['blocks/5'] * 3, [path for path in node.paths if path == 'blocks/5'])
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(recovery, self._recovery())
		self.assertEqual(generations, self._read_generation_rows())

	def test_recover_fork_preserves_terminal_state_when_current_mosaic_response_is_malformed(self):
		# Arrange: use a fresh worker so restoration must fetch the native mosaic.
		self._sync_with_published_account_generation(_chain(5, 4), 1)
		self._set_terminal_stop()
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()
		blocks = _chain(5, seal_from=4)
		mosaic_path = f'mosaics/{NATIVE_MOSAIC_ID}'
		node = MalformedNativeMosaicConnector(blocks, 5)
		self.puller = create_symbol_puller(self.config_ini, 'testnet')
		self.exit_stack.enter_context(self.puller.symbol_db)

		# Act:
		with self.assertRaisesRegex(ValueError, '^Mosaic response is missing required fields$'):
			self._recover_fork(node, 3, blocks[2]['meta']['hash'])

		# Assert:
		self.assertEqual([mosaic_path], [path for path in node.paths if path.startswith('mosaics/')])
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(recovery, self._recovery())
		self.assertEqual(generations, self._read_generation_rows())

	def test_sync_repairs_first_dirty_height_without_a_saved_comparison_tip(self):
		# Arrange: the initial write intent was committed, but no block made it to disk.
		database = self.puller.symbol_db
		database.initialize_fork_recovery()
		database.mark_sync_write_intent(1)
		blocks = _chain(2, seal_from=1)
		node = RecoveryConnector(blocks, 0, finalized_fields={'hash': '0' * 64})

		# Act:
		heights, state = self._sync_with_connector(node)

		# Assert:
		self.assertEqual(([1, 2], 2, 'healthy', None, None, None), (
			heights, state['last_synced_height'], state['status'], state['dirty_state_from_height'],
			self._recovery()['resume_height'], self._recovery()['stop_reason']))
		self.assertEqual([], [path for path in node.paths if path == 'blocks/0'])

	def test_recover_fork_does_not_skip_legacy_migration_after_valid_additional_proof(self):
		# Arrange:
		blocks = _chain(5, seal_from=4)
		self._seed_legacy(_chain(5, 4), public_height=4, saved_height=5)
		self._set_terminal_stop()
		before = self._capture_preserved_state()
		node = RecoveryConnector(blocks, 5)

		# Act:
		self._recover_fork(node, 3, blocks[2]['meta']['hash'])

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self._assert_refresh_skipped_twice(node, 'migration_pending')

		# Act:
		_, state = self._sync_with_connector(node)

		# Assert:
		self.assertEqual((5, 5, None), (state['finalized_height'], self._recovery()['verified_height'], self._recovery()['stop_reason']))

	def test_recover_fork_hands_deep_divergence_proof_to_the_next_normal_sync(self):
		# Arrange: the common block at one is below the ordinary search floor from L=10002.
		tip = 10_002
		original = _chain(tip)
		self._sync_with_connector(RecoveryConnector(original[:1], 1))
		database = self.puller.symbol_db
		checkpoint = self._capture_conditional_checkpoint()
		database.upsert_blocks([create_block_row(block, 100, Network.TESTNET) for block in original[1:]])
		checkpoint.update(chain_height=tip, last_synced_height=tip, last_synced_block_hash=bytes.fromhex(original[-1]['meta']['hash']))
		checkpoint['fork_recovery'].update(expected_revision=self._recovery()['block_revision'], continuity_height=tip)
		database.checkpoint_sync_state(checkpoint)
		self._set_terminal_stop()
		replacement = _chain(tip, 2, seal_from=2)
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 240))
		self.exit_stack.enter_context(self.puller.symbol_db)

		# Act: prepare the administrative proof.
		self._recover_fork(RecoveryConnector(replacement, 1), 1, original[0]['meta']['hash'])

		# Assert: history is preserved until ordinary sync.
		recovery = self._recovery()
		self.assertEqual((tip, 'reconciliation_wait', 1, 2), (
			database.get_max_block_height(), recovery['stop_reason'], recovery['progress']['common_height'], recovery['progress']['fork_height']))

		# Act: ordinary sync consumes the proof and reaches forward replay.
		with self.assertRaisesRegex(NodeException, 'block evidence page unavailable'):
			self._sync_with_connector(RecoveryConnector(replacement, 1, unavailable_page=1))

		# Assert:
		state = database.get_sync_state()
		self.assertEqual((1, 2, 2), (state['last_synced_height'], state['dirty_state_from_height'], self._recovery()['resume_height']))

		# Act:
		heights, state = self._sync_with_connector(RecoveryConnector(replacement, 1), max_height=3)

		# Assert:
		self.assertEqual([1, 2, 3], heights)
		self.assertEqual((3, 1, None), (state['last_synced_height'], self._recovery()['verified_height'], self._recovery()['stop_reason']))

	def test_sync_holds_common_point_more_than_ten_thousand_heights_below_the_start(self):
		# Arrange: the only common block is 10,001 heights below the candidate.
		tip = 10_002
		legacy = _chain(tip, 3)
		self._seed_legacy(legacy, public_height=tip, saved_height=tip)
		before = self._capture_preserved_state()
		blocks = _chain(tip, 2, 200_000)
		finalized_fields = {'hash': blocks[-1]['meta']['hash']}

		# Act: exhaust the HTTP budget before reaching the depth limit.
		with self.assertRaisesRegex(SymbolRollbackError, 'Symbol branch reconciliation request budget exhausted'):
			self._sync_with_connector(RecoveryConnector(blocks, tip, finalized_fields=finalized_fields))

		# Assert:
		progress = self._recovery()['progress']
		self.assertEqual((tip, 2, 102), (progress['search_start'], progress['search_floor'], progress['search_next']))
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})

		# The same pinned evidence reaches the fixed depth limit, then reuses that result.
		for expected_offsets in ((2, 1), ()):
			connector = RecoveryConnector(blocks, tip, finalized_fields=finalized_fields)
			# Act:
			with self.assertRaisesRegex(SymbolRollbackError, 'No Symbol common block within the reconciliation search limit'):
				self._sync_with_connector(connector)

			# Assert:
			self.assertEqual(
				[f'blocks?pageSize=100&offset={offset}&orderBy=height' for offset in expected_offsets],
				[path for path in connector.paths if path.startswith('blocks?')])
			self.assertEqual('common_point_limit', self._recovery()['stop_reason'])
			self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})

		# Arrange: a different pinned branch shares height two, exactly
		# 10,000 heights below the start. It is eligible for the forward proof.
		boundary_chain = _chain(tip)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Pinned Symbol reconciliation evidence changed'):
			self._sync_with_connector(RecoveryConnector(boundary_chain, tip))

		# Assert:
		self.assertIsNone(self._recovery()['progress'])
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})

		for expected_common in (None, 2):
			# Act:
			with self.assertRaisesRegex(SymbolRollbackError, 'Symbol branch reconciliation request budget exhausted'):
				self._sync_with_connector(RecoveryConnector(boundary_chain, tip))

			# Assert:
			progress = self._recovery()['progress']
			self.assertEqual((2, expected_common), (progress['search_floor'], progress['common_height']))
			self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})

	def test_sync_rebases_a_deep_common_point_stop_with_a_legal_cap(self):
		# Exercise the documented deep-fork recovery procedure from search exhaustion to a successful bounded replay.
		# Arrange: local history differs after P=V=1 and the ordinary search starts at 10002.
		tip = 10_002
		original = _chain(tip)
		replacement = _chain(tip, 2, seal_from=2)
		self._sync_with_connector(RecoveryConnector(original[:1], 1))
		database = self.puller.symbol_db
		checkpoint = self._capture_conditional_checkpoint()
		database.upsert_blocks([create_block_row(block, 100, Network.TESTNET) for block in original[1:]])
		checkpoint.update(chain_height=tip, last_synced_height=tip, last_synced_block_hash=bytes.fromhex(original[-1]['meta']['hash']))
		checkpoint['fork_recovery'].update(expected_revision=self._recovery()['block_revision'], continuity_height=tip)
		database.checkpoint_sync_state(checkpoint)
		before = self._capture_preserved_state()

		# Act: first persist the search, then continue to the common-point limit.
		with self.assertRaisesRegex(SymbolRollbackError, 'request budget exhausted'):
			self._sync_with_connector(RecoveryConnector(replacement, 1))

		# Assert:
		self.assertEqual((tip, 2), (self._recovery()['progress']['search_start'], self._recovery()['progress']['search_floor']))
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'No Symbol common block within the reconciliation search limit'):
			self._sync_with_connector(RecoveryConnector(replacement, 1))

		# Assert:
		stopped = self._recovery()
		self.assertEqual('common_point_limit', stopped['stop_reason'])
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})

		# Act: this reason cannot be reopened by the terminal invalidation command.
		with self.assertRaisesRegex(SymbolRollbackError, 'not stopped by consecutive evidence invalidations'):
			self._recover_fork(RecoveryConnector(replacement, 1), 1, original[0]['meta']['hash'])

		# Assert:
		self.assertEqual(stopped, self._recovery())
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})

		# Act: a cap at P=V=1 makes the previous range unsuitable.
		with self.assertRaisesRegex(SymbolRollbackError, 'Pinned Symbol reconciliation evidence changed'):
			self._sync_with_connector(RecoveryConnector(replacement, 1), max_height=1)

		# Assert:
		self.assertEqual((None, 1), (self._recovery()['progress'], self._recovery()['invalidations']))
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})

		# Act: re-run with the same legal cap to establish the new comparison start.
		heights, sync = self._sync_with_connector(RecoveryConnector(replacement, 1), max_height=1)

		# Assert: the bounded checkpoint leaves the physical tail and published finality intact.
		self.assertEqual(list(range(1, tip + 1)), heights)
		self.assertEqual(('healthy', 1, 1, 1, None), (
			sync['status'], sync['last_synced_height'], sync['finalized_height'], self._recovery()['verified_height'],
			self._recovery()['stop_reason']))

		# Act: ordinary uncapped reconciliation can now prove the fork and reach replay.
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 240))
		self.exit_stack.enter_context(self.puller.symbol_db)
		with self._use_database(FailingWriteDatabase(database)):
			with self.assertRaisesRegex(RuntimeError, 'resumed write failed'):
				self._sync_with_connector(RecoveryConnector(replacement, 1))

		# Assert:
		self.assertEqual((1, 2), (database.get_max_block_height(), self._recovery()['resume_height']))

		# Act:
		heights, sync = self._sync_with_connector(RecoveryConnector(replacement, 1), max_height=3)

		# Assert:
		self.assertEqual([1, 2, 3], heights)
		self.assertEqual(('healthy', 3, 1, 1, None), (
			sync['status'], sync['last_synced_height'], sync['finalized_height'], self._recovery()['verified_height'],
			self._recovery()['stop_reason']))

	def test_sync_charges_page_retries_and_preserves_unfinished_comparison(self):
		# Arrange:
		blocks = _chain(3)
		self._seed_legacy(blocks, public_height=1, saved_height=3)
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 3))
		self.exit_stack.enter_context(self.puller.symbol_db)
		connector = RecoveryConnector(blocks, 1, unavailable_page=0)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Symbol branch reconciliation request budget exhausted'):
			self._sync_with_connector(connector)

		# Assert:
		page = 'blocks?pageSize=100&offset=0&orderBy=height'
		self.assertEqual(['blocks/3', page, page], [path for path in connector.paths if path.startswith('blocks')])
		progress = self._recovery()['progress']
		self.assertEqual((1, None, None), (progress['search_next'], progress['checked_height'], progress['common_height']))
		self.assertEqual([], [path for path in connector.paths if path.startswith('transactions/confirmed?')])

	def test_sync_stops_before_comparison_when_time_budget_has_elapsed(self):
		# Arrange:
		blocks = _chain(3)
		self._seed_legacy(blocks, public_height=1, saved_height=3)
		before = self._capture_preserved_state()
		self.puller = create_symbol_puller(
			self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, time_limit=0))
		self.exit_stack.enter_context(self.puller.symbol_db)
		connector = RecoveryConnector(blocks, 1)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Symbol branch reconciliation request budget exhausted'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks')])
		self.assertEqual(('reconciliation_wait', None), (self._recovery()['stop_reason'], self._recovery()['progress']))
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})

	def test_sync_guards_legacy_orphan_lock_above_node_finality(self):
		# Arrange: the fork starts below F=7, but the old lock event is above
		# both F and the public height. The legacy cleanup ceiling is unknown.
		self._seed_legacy(_chain(8, 6), public_height=6, saved_height=6, dirty=7)
		database = self.puller.symbol_db
		database.upsert_transactions_for_height(8, [create_transaction_entry(
			8, 'legacy-orphan-lock', type=TransactionType.HASH_LOCK.value,
			type_name=TRANSACTION_TYPE_LABELS[TransactionType.HASH_LOCK.value], signer_address=bytes.fromhex(SIGNER_ADDRESS))])
		before = self._capture_preserved_state()
		connector = RecoveryConnector(_chain(8), 7)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'contains lock events whose pruned state cannot be reconstructed safely'):
			self._sync_with_connector(connector)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertIsNone(self._recovery()['verified_height'])
		self._assert_refresh_skipped_twice(connector, 'restoration_evidence_missing')

	def _sync_with_published_account_generation(self, blocks, finalized_height, **overrides):
		address = str(Network.TESTNET.address_class(bytes.fromhex(BENEFICIARY_ADDRESS)))
		account = create_account_item(addressHeight='1', importanceHeight='1')
		self._sync_with_connector(RecoveryConnector(
			blocks, finalized_height, account_by_address={address: account}, account_pages={1: [account]}, **overrides))
		self.assertTrue(asyncio.run(self.puller.refresh_accounts()))
		return address

	@contextmanager
	def _open_recovery_test_database(self, name):
		with TemporaryDirectory() as config_dir:
			puller, config = self.puller, self.config_ini
			self.config_ini = create_db_config(config_dir, self.db_config._replace(database=name))
			self.puller = create_symbol_puller(self.config_ini, 'testnet')
			try:
				with self.puller.symbol_db:
					yield
			finally:
				self.puller, self.config_ini = puller, config

	@contextmanager
	def _create_recovery_test_database(self, template='template0'):
		# The session fixture already owns a database on the dedicated test server.
		# Create side databases there without replacing or disconnecting the fixture's database.
		name = f'explorer_lock_recovery_{uuid4().hex}'
		with closing(psycopg2.connect(**self.db_config._asdict())) as connection, connection.cursor() as cursor:
			connection.autocommit = True
			cursor.execute(pg_sql.SQL('CREATE DATABASE {} TEMPLATE {}').format(pg_sql.Identifier(name), pg_sql.Identifier(template)))
			try:
				cursor.execute(pg_sql.SQL("ALTER DATABASE {} SET timezone = 'UTC'").format(pg_sql.Identifier(name)))
				yield name
			finally:
				cursor.execute(pg_sql.SQL('DROP DATABASE {}').format(pg_sql.Identifier(name)))

	def _assert_unproven_lock_event_preserves_interrupted_database(self, interrupted, canonical, retained_hash):
		# Act: interrupt the normal writer after history and current-state writes.
		with self._use_database(FailingCheckpointDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(RuntimeError, '^checkpoint commit failed$'):
				self._sync_with_connector(interrupted)

		# Assert:
		before = self._capture_preserved_state()
		self.assertEqual((6, 7), (before.sync_state['last_synced_height'], before.sync_state['dirty_state_from_height']))
		self.assertEqual([5, 7], [row[0] for row in self._fetch_receipts(self.puller.symbol_db)])
		self.assertTrue(before.tables['symbol_hash_locks'] or before.tables['symbol_secret_locks'])

		# Act: normal repair must preserve the interrupted snapshot with unproven lock events.
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(
				SymbolRollbackError, '^Finalized rollback contains lock events whose pruned state cannot be reconstructed safely$'
			):
				self._sync_with_connector(canonical)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		recovery = self._recovery()
		self.assertEqual(('restoration_evidence_missing', 6, None), (
			recovery['stop_reason'], recovery['verified_height'], recovery['resume_height']))
		self.assertEqual([], [path for path in canonical.paths if path.startswith('lock/')])
		self._assert_refresh_skipped_twice(canonical, 'restoration_evidence_missing')

		# Act: the existing CLI cannot release this guard.
		with self.assertRaisesRegex(SymbolRollbackError, '^Symbol recovery is not stopped by consecutive evidence invalidations$'):
			self._recover_fork(canonical, 6, retained_hash)

		# Assert:
		self.assertEqual(recovery, self._recovery())
		self._assert_preserved_state(before, before.sync_state)
		return before, recovery

	def _assert_verified_backup_recovers_unproven_lock_event(self, checkpoint, interrupted, canonical):
		# Arrange: retain a migrated checkpoint with a published account generation.
		with self._create_recovery_test_database() as backup:
			with self._open_recovery_test_database(backup):
				self.puller.symbol_db.create_tables()
				self._seed_legacy([*checkpoint.blocks, interrupted.blocks[6]], public_height=3, saved_height=4)
				# Restore the retained prefix while preserving the migration's recorded upper bound.
				self.puller.symbol_db.delete_blocks_from_height(5)
				self._sync_with_connector(checkpoint)
				self.assertTrue(asyncio.run(self.puller.refresh_accounts()))
				snapshot = self._capture_preserved_state()
				generations = self._read_generation_rows()
				recovery = self._recovery()
				self.assertEqual(('healthy', 6, 6, None, None, True, 7), (
					snapshot.sync_state['status'], snapshot.sync_state['last_synced_height'], recovery['verified_height'],
					snapshot.sync_state['dirty_state_from_height'], recovery['resume_height'], recovery['legacy_lock_history'],
					recovery['legacy_history_height']))
				self.assertEqual(6, snapshot.sync_state['finalized_height'])
				self.assertEqual(bytes.fromhex(checkpoint.blocks[-1]['meta']['hash']), recovery['verified_hash'])
				self.assertIsNotNone(snapshot.refresh_state['valid_run_id'])
				self.assertTrue(generations['symbol_account_refresh_accounts'])
				self.assertEqual(1, sum(len(snapshot.tables[table]) for table in ('symbol_hash_locks', 'symbol_secret_locks')))

			with self._create_recovery_test_database(backup) as stopped_database:
				with self._open_recovery_test_database(stopped_database):
					stopped, stop_recovery = self._assert_unproven_lock_event_preserves_interrupted_database(
						interrupted, canonical, checkpoint.blocks[-1]['meta']['hash'])

				# Act: restore and replay from the verified checkpoint in a separate database.
				with self._create_recovery_test_database(backup) as restored_database, self._open_recovery_test_database(restored_database):
					self._assert_preserved_state(snapshot, snapshot.sync_state)
					self.assertEqual(generations, self._read_generation_rows())
					self.assertEqual(recovery, self._recovery())
					heights, state = self._sync_with_connector(canonical)

					# Assert:
					self.assertEqual(list(range(1, 9)), heights)
					self.assertEqual(('healthy', 8, canonical.finalized_height, None), (
						state['status'], state['last_synced_height'], state['finalized_height'], state['dirty_state_from_height']))
					recovery = self._recovery()
					self.assertEqual((canonical.finalized_height, None, None), (
						recovery['verified_height'], recovery['resume_height'], recovery['stop_reason']))
					self.assertEqual(generations, self._read_generation_rows())
					restored = self._capture_preserved_state()

				with self._open_recovery_test_database(stopped_database):
					self._assert_preserved_state(stopped, stopped.sync_state)
					self.assertEqual(stop_recovery, self._recovery())

		return restored

	def _prepare_interrupted_secret_lock(self, height, *, should_migrate_after_write=False):
		start = height - 1
		blocks = _chain(8)
		secret = 'AB' * 32
		lock = create_node_transaction(
			height, type=TransactionType.SECRET_LOCK.value, secret=secret, hashAlgorithm=1,
			mosaicId=NATIVE_MOSAIC_ID, amount='1234', duration='7')
		del lock['transaction']['mosaics']
		_set_block_transactions(blocks[height - 1], [lock])
		_commit_recovery_suffix(blocks, height)
		transactions = {transaction_path(height, end): create_transaction_page([lock]) for end in (height, 8)}
		owner = Network.TESTNET.address_class(bytes.fromhex(SIGNER_ADDRESS))
		path = f'lock/secret?address={owner}&secret={secret}&pageSize=100&pageNumber=1'
		responses = {path: {'data': [create_secret_lock_item(
			composite_hash=sha3_256(bytes.fromhex(secret + RECIPIENT_ADDRESS)).hexdigest().upper(),
			owner_address=SIGNER_ADDRESS, recipient_address=RECIPIENT_ADDRESS, secret=secret,
			end_height=str(height + 7), status=0)]}}
		if not should_migrate_after_write:
			self._seed_legacy(blocks[:start], public_height=start, saved_height=start)

		self._sync_with_published_account_generation(blocks[:start], start)
		interrupted = RecoveryConnector(blocks[:height], start, transactions_by_path=transactions, secret_lock_responses=responses)
		self._sync_until_interrupted_checkpoint(interrupted)
		if should_migrate_after_write:
			self._seed_legacy(blocks[:height], public_height=start, saved_height=start, dirty=height)

		return RecoveryConnector(blocks, start, transactions_by_path=transactions, secret_lock_responses=responses)

	def test_migrated_sync_repairs_interrupted_secret_lock_above_legacy_history_height(self):
		# Arrange: the migration records H6 before the new writer reaches the Secret Lock at H7.
		node = self._prepare_interrupted_secret_lock(7)
		before = self._capture_preserved_state()
		self.assertEqual((6, 6, 7), (
			self._recovery()['legacy_history_height'], before.sync_state['last_synced_height'], before.sync_state['dirty_state_from_height']))
		[(original,)] = before.tables['symbol_secret_locks']

		# Act:
		heights, state = self._sync_with_connector(node)

		# Assert:
		recovery = self._recovery()
		self.assertEqual((list(range(1, 9)), 'healthy', 8, None, 6, None, None), (
			heights, state['status'], state['last_synced_height'], state['dirty_state_from_height'],
			recovery['legacy_history_height'], recovery['resume_height'], recovery['stop_reason']))
		self.assertEqual([({**original, 'updated_at_height': 8},)], self._fetch_table_state(('symbol_secret_locks',))['symbol_secret_locks'])

	def _assert_legacy_secret_lock_blocks_repair(self, node, legacy_height):
		# Arrange: the interrupted lock has current state and history that must survive.
		saved = self._capture_repair_state_with_generation()
		before, _, _ = saved
		self.assertEqual(legacy_height, self._recovery()['legacy_history_height'])
		self.assertEqual(1, len(before.tables['symbol_secret_locks']))

		# Act:
		self._sync_expecting_rejection_before_repair(node, 'contains lock events whose pruned state cannot be reconstructed safely')

		# Assert:
		self._assert_repair_state_with_generation_preserved(saved)
		self.assertEqual('restoration_evidence_missing', self._recovery()['stop_reason'])
		self.assertEqual([], [path for path in node.paths if path.startswith('lock/')])

	def test_migrated_sync_preserves_interrupted_secret_lock_at_legacy_history_height(self):
		# Arrange: H6 and its lock already exist when the migration records T=6.
		node = self._prepare_interrupted_secret_lock(6, should_migrate_after_write=True)

		self._assert_legacy_secret_lock_blocks_repair(node, 6)

	def test_migrated_sync_preserves_interrupted_secret_lock_when_legacy_history_height_is_unknown(self):
		# Arrange: simulate the originally deployed schema, which kept no history upper bound.
		node = self._prepare_interrupted_secret_lock(7)
		self._simulate_previous_lock_history_migration()

		self._assert_legacy_secret_lock_blocks_repair(node, None)

	def test_migrated_secret_lock_stop_recovers_from_verified_checkpoint_backup(self):  # pylint: disable=too-many-locals
		# Arrange: a retained Secret Lock at H5 and another written by the interrupted H7 batch.
		blocks = _chain(8)
		for height in (5, 7):
			blocks[height - 1]['meta'].update(transactionsCount=1, totalTransactionsCount=1)

		transactions, statements, responses = {}, {}, {}
		for height, end, secret in ((5, 12, 'AB' * 32), (7, 14, 'CD' * 32)):
			transaction = create_node_transaction(
				height, type=TransactionType.SECRET_LOCK.value, secret=secret, hashAlgorithm=1,
				mosaicId=NATIVE_MOSAIC_ID, amount='1234', duration='7')
			transaction['transaction'].pop('mosaics')
			receipt = create_amount_statement_item(
				height, 1234, receipt_type=ReceiptType.LOCK_SECRET_CREATED.value, targetAddress=SIGNER_ADDRESS)
			receipt['statement']['source']['primaryId'] = 1
			transactions[transaction_path(height, height + 1)] = create_transaction_page([transaction])
			statements[statement_path(height, height + 1)] = {'data': [receipt]}
			owner = Network.TESTNET.address_class(bytes.fromhex(SIGNER_ADDRESS))
			path = f'lock/secret?address={owner}&secret={secret}&pageSize=100&pageNumber=1'
			composite_hash = sha3_256(bytes.fromhex(secret + RECIPIENT_ADDRESS)).hexdigest().upper()
			responses[path] = {'data': [create_secret_lock_item(
				composite_hash=composite_hash, owner_address=SIGNER_ADDRESS, recipient_address=RECIPIENT_ADDRESS,
				secret=secret, mosaic_id=NATIVE_MOSAIC_ID, end_height=str(end), status=0)]}

		account = create_account_item(addressHeight='1', importanceHeight='1')
		checkpoint = RecoveryConnector(
			blocks[:6], 6, transactions_by_path=transactions, statement_pages=statements, secret_lock_responses=responses,
			account_pages={1: [account]})
		interrupted = RecoveryConnector(
			blocks, 6, transactions_by_path=transactions, statement_pages=statements, secret_lock_responses=responses)
		canonical = RecoveryConnector(
			blocks, 6, transactions_by_path=transactions, statement_pages=statements, secret_lock_responses=responses)

		# Act:
		restored = self._assert_verified_backup_recovers_unproven_lock_event(checkpoint, interrupted, canonical)

		# Assert:
		self.assertEqual([(5, 'lockSecretCreated'), (7, 'lockSecretCreated')], sorted(
			(row['height'], row['receipt_type']) for (row,) in restored.tables['symbol_receipts']))
		self.assertEqual([
			('AB' * 32, 12, 'unused', NATIVE_MOSAIC_ID, 1234, SIGNER_ADDRESS, RECIPIENT_ADDRESS),
			('CD' * 32, 14, 'unused', NATIVE_MOSAIC_ID, 1234, SIGNER_ADDRESS, RECIPIENT_ADDRESS)
		], sorted((
			row['secret'][2:].upper(), row['end_height'], row['status'], row['mosaic_id'], row['amount'],
			row['owner_address'][2:].upper(), row['recipient_address'][2:].upper()
		) for (row,) in restored.tables['symbol_secret_locks']))

	def test_migrated_hash_lock_expiry_stop_recovers_from_verified_checkpoint_backup(self):
		# Arrange: the old checkpoint has a Hash Lock expiring at H7, above its verified H6.
		blocks = _chain(8)
		item = {'lock': {
			'hash': 'AB' * 32, 'ownerAddress': SIGNER_ADDRESS, 'mosaicId': NATIVE_MOSAIC_ID,
			'amount': str(HASH_LOCK_AMOUNT), 'endHeight': '7', 'status': 0
		}, 'id': 'expiring-lock'}
		transaction, created = self._create_bonded_lock_origin(5, SIGNER_PUBLIC_KEY, item['lock'])
		_set_block_transactions(blocks[4], [transaction])
		expired = create_amount_statement_item(
			7, HASH_LOCK_AMOUNT, receipt_type=ReceiptType.LOCK_HASH_EXPIRED.value, targetAddress=BENEFICIARY_ADDRESS)
		account = create_account_item(addressHeight='1', importanceHeight='1')
		checkpoint = RecoveryConnector(
			blocks[:6], 6, transactions_by_path={transaction_path(5, 6): create_transaction_page([transaction])},
			statement_pages={statement_path(5, 6): {'data': [created]}},
			hash_lock_responses={f"lock/hash/{item['lock']['hash']}": item}, account_pages={1: [account]})
		receipts = {statement_path(7, 8): {'data': [expired]}}
		interrupted = RecoveryConnector(blocks, 6, statement_pages=receipts)
		canonical = RecoveryConnector(blocks, 7, statement_pages=receipts)

		# Act:
		restored = self._assert_verified_backup_recovers_unproven_lock_event(checkpoint, interrupted, canonical)

		# Assert: ordinary replay retains the canonical expiration receipt, then finalized cleanup removes the lock.
		self.assertEqual([(5, 'lockHashCreated'), (7, 'lockHashExpired')], sorted(
			(row['height'], row['receipt_type']) for (row,) in restored.tables['symbol_receipts']))
		self.assertEqual([], restored.tables['symbol_hash_locks'])

	def _interrupt_migrated_hash_lock_batch(self, *, should_publish_accounts=False, mosaic_alias=None, receiptless=False):
		# Arrange: migrate six retained blocks, then fetch a real Hash Lock and its creation receipt at seven.
		blocks = [_recovery_block(block) for block in _chain(8)]
		if receiptless:
			for block in blocks:
				del block['meta']['statementsCount']

		self._seed_legacy_with_unknown_lock_history(blocks[:6], public_height=3, saved_height=6)
		properties = create_network_properties()
		properties['chain']['enableVerifiableReceipts'] = 'false' if receiptless else 'true'
		if should_publish_accounts:
			self._sync_with_published_account_generation(blocks[:6], 6, network_properties=properties)
		else:
			self._sync_with_connector(RecoveryConnector(blocks[:6], 6, network_properties=properties))

		self.assertEqual((6, None, True), (
			self._recovery()['verified_height'], self._recovery()['legacy_tip'], self._recovery()['legacy_lock_history']))
		lock_hash = 'AB' * 32
		lock_path = f'lock/hash/{lock_hash}'
		lock = {
			'hash': lock_hash, 'ownerAddress': SIGNER_ADDRESS, 'mosaicId': NATIVE_MOSAIC_ID,
			'amount': str(HASH_LOCK_AMOUNT), 'endHeight': '12', 'status': 0
		}
		transaction, receipt = self._create_bonded_lock_origin(7, SIGNER_PUBLIC_KEY, lock, mosaic_alias=mosaic_alias)
		_set_block_transactions(blocks[6], [transaction])
		statements = [] if receiptless else [receipt]
		mosaic_resolutions = {7: [self._hash_lock_mosaic_resolution(mosaic_alias)]} if mosaic_alias else {}
		_commit_recovery_suffix(blocks, statements=statements, mosaics_by_height=mosaic_resolutions)
		node = RecoveryConnector(
			blocks, 6, transactions_by_path={transaction_path(7, 8): create_transaction_page([transaction])},
			statement_pages={statement_path(7, 8): {'data': statements}}, mosaic_resolutions_by_height=mosaic_resolutions,
			hash_lock_responses={lock_path: {'lock': lock, 'id': 'hash-lock'}})
		# Act: interrupt the current-state write after the ordinary synchronizer stored the lock events.
		with self._use_database(FailingHashLockWriteDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(RuntimeError, '^hash lock write interrupted$'):
				self._sync_with_connector(node)

		# Assert: the lock cannot be recovered from the current table.
		self._assert_interrupted_hash_lock_batch(lock_hash, receiptless=receiptless)
		return node, lock_path, lock_hash

	def _assert_interrupted_hash_lock_batch(self, lock_hash, *, receiptless):
		interrupted = self._capture_preserved_state()
		[(lock_transaction,)] = interrupted.tables['symbol_transactions']
		self.assertEqual((lock_hash, lock_hash), (lock_transaction['body']['hash'], lock_transaction['raw_payload']['transaction']['hash']))
		self.assertEqual([] if receiptless else [(1, 0)], [
			(row['source_primary_id'], row['source_secondary_id']) for (row,) in interrupted.tables['symbol_receipts']
		])
		self.assertEqual([], interrupted.tables['symbol_hash_locks'])
		self.assertEqual((6, 6, 7), (
			interrupted.sync_state['last_synced_height'], interrupted.sync_state['finalized_height'],
			interrupted.sync_state['dirty_state_from_height']))

	@staticmethod
	def _hash_lock_mosaic_resolution(alias_id, resolved=NATIVE_MOSAIC_ID):
		return create_resolution_statement(7, alias_id, [
			{'source': {'primaryId': 1, 'secondaryId': 0}, 'resolved': resolved},
			{'source': {'primaryId': 2, 'secondaryId': 0}, 'resolved': '72C0212E67A08BCF'}
		])

	def test_migrated_sync_discards_an_orphan_lock_when_the_capped_tip_has_no_replacement_blocks(self):
		# Arrange: the unfinished lock was created above the node tip, within the permitted repair window.
		interrupted, lock_path, _ = self._interrupt_migrated_hash_lock_batch()
		node = RecoveryConnector(interrupted.blocks[:6], 6, network_properties=interrupted.network_properties)
		database = ObserveRepairCutDatabase(self.puller.symbol_db, self._recovery)

		# Act:
		with self._use_database(database):
			heights, state = self._sync_with_connector(node, max_height=8)

		# Assert: proof of the orphaned lock authorizes the cut without creating a replacement replay.
		self.assertEqual([lock_path], [path for path in node.paths if path.startswith('lock/hash/')])
		self.assertEqual([], [path for path in node.paths if path.startswith(('transactions/confirmed?', 'statements/transaction?'))])
		self.assertIsNone(database.cut['progress'])
		self.assertEqual((list(range(1, 7)), 6, 6, 'healthy', None, None), (
			heights, state['last_synced_height'], state['finalized_height'], state['status'],
			state['dirty_state_from_height'], self._recovery()['resume_height']))
		tables = ('symbol_hash_locks', 'symbol_transactions', 'symbol_receipts')
		self.assertEqual({table: [] for table in tables}, self._fetch_table_state(tables))

	def test_migrated_sync_recovers_direct_hash_lock_with_receipts_disabled(self):
		# Arrange: the node has a zero receipt root and returns no statements.
		node, path, key = self._interrupt_migrated_hash_lock_batch(receiptless=True, should_publish_accounts=True)
		node.paths.clear()

		# Act:
		heights, state = self._sync_with_connector(node)

		# Assert: no receipt was fabricated and the exact live lock matches the verified creation.
		self.assertEqual((list(range(1, 9)), 'healthy', None, None), (
			heights, state['status'], state['dirty_state_from_height'], self._recovery()['resume_height']))
		stored = self._fetch_table_state(('symbol_hash_locks', 'symbol_receipts'))
		self.assertEqual([], stored['symbol_receipts'])
		[(row,)] = stored['symbol_hash_locks']
		self.assertEqual((key, SIGNER_ADDRESS, NATIVE_MOSAIC_ID, HASH_LOCK_AMOUNT, 'unused', 12), (
			row['hash'][2:].upper(), row['owner_address'][2:].upper(), row['mosaic_id'], row['amount'], row['status'], row['end_height']))
		statement = statement_path(7, 8)
		self.assertEqual([statement, path, statement], [
			request for request in node.paths if request.startswith(('lock/hash/', 'statements/transaction?'))
		])

	def _assert_migrated_sync_preserves_receiptless_lock(self, node, message):
		# Arrange:
		before, generations = self._capture_preserved_state(), self._read_generation_rows()
		database = self.puller.symbol_db
		node.paths.clear()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(database)):
			with self.assertRaisesRegex(SymbolRollbackError, message):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual('restoration_evidence_missing', self._recovery()['stop_reason'])

	def test_migrated_sync_rejects_receiptless_creation_without_a_live_lock(self):
		# Arrange:
		initial, path, _ = self._interrupt_migrated_hash_lock_batch(receiptless=True, should_publish_accounts=True)
		node = RecoveryConnector(initial.blocks, 6, transactions_by_path=initial.transactions_by_path)

		# Act / Assert:
		self._assert_migrated_sync_preserves_receiptless_lock(node, '^Symbol Hash Lock absence is not supported by the shared branch$')
		self.assertEqual([path], [request for request in node.paths if request.startswith('lock/hash/')])

	def test_migrated_sync_rejects_receiptless_creation_with_invalid_statement_page(self):
		# Arrange: only a successful response with an empty array can support receiptless proof.
		node, _, _ = self._interrupt_migrated_hash_lock_batch(receiptless=True, should_publish_accounts=True)
		node.statement_pages[statement_path(7, 8)] = {'data': {}}

		# Act / Assert:
		self._assert_migrated_sync_preserves_receiptless_lock(node, 'Malformed Symbol statement page response')
		self.assertEqual([], [request for request in node.paths if request.startswith('lock/hash/')])

	def test_migrated_sync_preserves_history_when_receiptless_lock_has_expired(self):
		# Arrange:
		initial, path, _ = self._interrupt_migrated_hash_lock_batch(receiptless=True, should_publish_accounts=True)
		blocks = [*initial.blocks, *_chain(12)[8:]]
		_commit_recovery_suffix(blocks, 9)
		node = RecoveryConnector(
			blocks, 6, transactions_by_path={transaction_path(7, 12): initial.transactions_by_path[transaction_path(7, 8)]},
			hash_lock_responses={path: initial.hash_lock_response(path)})

		# Act / Assert:
		self._assert_migrated_sync_preserves_receiptless_lock(node, '^Receiptless Symbol Hash Lock has reached its end height$')
		self.assertEqual([], [request for request in node.paths if request.startswith('lock/hash/')])

	def test_migrated_sync_rejects_receiptless_creation_missing_from_branch(self):
		# Arrange: the stored transaction identity differs from the freshly authenticated H7 transaction.
		node, _, _ = self._interrupt_migrated_hash_lock_batch(receiptless=True, should_publish_accounts=True)
		database = self.puller.symbol_db
		with database.connection, database.connection.cursor() as cursor:
			cursor.execute('''
				UPDATE symbol_transactions
				SET hash = %s, raw_payload = jsonb_set(raw_payload, '{meta,hash}', to_jsonb(%s::text))
				WHERE height = 7
			''', (bytes.fromhex('20' * 32), '20' * 32))

		# Act / Assert:
		self._assert_migrated_sync_preserves_receiptless_lock(
			node, '^Receiptless Symbol Hash Lock creation is missing from the verified replacement branch$')
		self.assertEqual([], [request for request in node.paths if request.startswith('lock/hash/')])

	def test_migrated_sync_does_not_publish_a_later_batch_with_receipts_disabled_and_an_extra_statement(self):
		# Arrange: the H7 creation fills the first batch and only the later H9 request returns inflation.
		initial, lock_path, _ = self._interrupt_migrated_hash_lock_batch(receiptless=True, should_publish_accounts=True)
		blocks = [*initial.blocks, create_node_block(9)]
		[origin] = initial.transactions_by_path[transaction_path(7, 8)]['data']
		transfer = create_node_transaction(9, deadline='31000')
		_set_block_transactions(blocks[8], [transfer])
		_commit_recovery_suffix(blocks, 9)
		later_statements = statement_path(9, 9)
		node = RecoveryConnector(
			blocks, 6, transactions_by_path={
				**initial.transactions_by_path, transaction_path(7, 9): create_transaction_page([origin, transfer]),
				transaction_path(9, 9): create_transaction_page([transfer])
			}, statement_pages={later_statements: {'data': [create_amount_statement_item(9, 999)]}},
			hash_lock_responses={lock_path: initial.hash_lock_response(lock_path)})
		self.puller = create_symbol_puller(self.config_ini, 'testnet', max_transactions_per_batch=1)
		self.exit_stack.enter_context(self.puller.symbol_db)
		generations = self._read_generation_rows()

		# Act:
		with self.assertRaisesRegex(EvidenceChanged, 'unexpectedly returned statements'):
			self._sync_with_connector(node)

		# Assert:
		after = self._capture_preserved_state()
		recovery = self._recovery()
		self.assertEqual((6, 6, 6, 7, 7, 'reconciliation_wait', 'unhealthy'), (
			after.sync_state['last_synced_height'], after.sync_state['finalized_height'], recovery['verified_height'],
			after.sync_state['dirty_state_from_height'], recovery['resume_height'], recovery['stop_reason'], after.sync_state['status']))
		self.assertEqual(list(range(1, 9)), self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(([], [], [7]), (
			after.tables['symbol_receipts'], after.tables['symbol_hash_locks'],
			[row['height'] for (row,) in after.tables['symbol_transactions']]))
		self.assertEqual([(7, 0), (8, 0)], sorted(
			(row['height'], row['block_reward']) for (row,) in after.tables['symbol_blocks'] if row['height'] >= 7))
		self.assertEqual(generations, self._read_generation_rows())
		expected = [statement_path(7, 9), statement_path(7, 8), later_statements]
		self.assertEqual(expected, [path for path in node.paths if path.startswith('statements/transaction?')])

		# Act: an independent invocation receives a canonical empty response.
		node.statement_pages[later_statements] = {'data': []}
		node.paths.clear()
		heights, sync = self._sync_with_connector(node)

		# Assert:
		self.assertEqual((list(range(1, 10)), 'healthy', 9, None, None), (
			heights, sync['status'], sync['last_synced_height'], sync['dirty_state_from_height'], self._recovery()['resume_height']))
		rows = self._fetch_table_state(('symbol_blocks', 'symbol_receipts'))
		self.assertEqual([], rows['symbol_receipts'])
		self.assertEqual([(7, 0), (8, 0), (9, 0)], sorted(
			(row['height'], row['block_reward']) for (row,) in rows['symbol_blocks'] if row['height'] >= 7))

	def test_migrated_sync_preserves_resume_gate_when_receiptless_replay_returns_statements(self):
		# Arrange: the node provides a statement after the repair cut.
		statement = statement_path(7, 8)

		class ReceiptAppearsConnector(RecoveryConnector):
			"""Changes the response during replacement-batch retrieval."""

			async def get(self, url_path, *args):
				response = await super().get(url_path, *args)
				if url_path == statement and self.paths.count(statement) == 2:
					return {'data': [create_amount_statement_item(7, HASH_LOCK_AMOUNT)]}

				return response

		initial, path, _ = self._interrupt_migrated_hash_lock_batch(receiptless=True, should_publish_accounts=True)
		node = ReceiptAppearsConnector(
			initial.blocks, 6, transactions_by_path=initial.transactions_by_path,
			hash_lock_responses={path: initial.hash_lock_response(path)})
		database = self.puller.symbol_db
		generations = self._read_generation_rows()

		# Act:
		with self.assertRaisesRegex(EvidenceChanged, '^Receiptless Symbol Hash Lock replay unexpectedly returned statements$'):
			self._sync_with_connector(node)

		# Assert: the replacement batch has not committed anything after the cut.
		sync, recovery = database.get_sync_state(), self._recovery()
		self.assertEqual((6, 6, 7, 7, 'reconciliation_wait'), (
			sync['last_synced_height'], recovery['verified_height'], sync['dirty_state_from_height'],
			recovery['resume_height'], recovery['stop_reason']))
		self.assertEqual(list(range(1, 7)), self._fetch_block_heights(database))
		self.assertEqual(
			{'symbol_transactions': [], 'symbol_receipts': [], 'symbol_hash_locks': []},
			self._fetch_table_state(('symbol_transactions', 'symbol_receipts', 'symbol_hash_locks')))
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual([statement, path, statement], [
			request for request in node.paths if request.startswith(('lock/hash/', 'statements/transaction?'))])

		# Act: a fresh invocation receives the original empty statement response.
		heights, sync = self._sync_with_connector(initial)

		# Assert:
		self.assertEqual((8, 'healthy', None, None), (
			heights[-1], sync['status'], sync['dirty_state_from_height'], self._recovery()['resume_height']))
		stored = self._fetch_table_state(('symbol_hash_locks', 'symbol_receipts'))
		[(row,)] = stored['symbol_hash_locks']
		self.assertEqual(('unused', 12), (row['status'], row['end_height']))
		self.assertEqual([], stored['symbol_receipts'])

	def test_migrated_sync_rejects_an_alias_in_a_receiptless_hash_lock_proof(self):
		# Arrange: H7 proves a direct mosaic creation. At H9 a second lock would need an uncommitted resolution.
		initial, lock_path, _ = self._interrupt_migrated_hash_lock_batch(receiptless=True)
		[origin] = initial.transactions_by_path[transaction_path(7, 8)]['data']
		alias = 'E74B99BA41F4AFEE'
		lock = {'hash': 'CD' * 32, 'ownerAddress': SIGNER_ADDRESS, 'amount': str(HASH_LOCK_AMOUNT), 'endHeight': '16'}
		transaction, _ = self._create_bonded_lock_origin(9, SIGNER_PUBLIC_KEY, lock, mosaic_alias=alias)
		blocks = [*initial.blocks, create_node_block(9)]
		_set_block_transactions(blocks[-1], [transaction])
		_commit_recovery_suffix(blocks, 9)
		transactions_request = transaction_path(7, 9)
		node = RecoveryConnector(
			blocks, 6, transactions_by_path={transactions_request: create_transaction_page([origin, transaction])},
			hash_lock_responses={lock_path: initial.hash_lock_response(lock_path)})
		before = self._capture_preserved_state()

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Canonical receiptless Symbol Hash Lock requires a direct mosaic'):
			with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual('restoration_evidence_missing', self._recovery()['stop_reason'])
		self.assertEqual([transactions_request, statement_path(7, 9)], [
			path for path in node.paths if path.startswith(('transactions/', 'statements/', 'lock/hash/'))])

	def test_migrated_sync_preserves_receiptless_lock_with_incomplete_retained_history(self):
		# Arrange: the retained H2 header advertises a transaction without a corresponding row.
		node, _, _ = self._interrupt_migrated_hash_lock_batch(receiptless=True, should_publish_accounts=True)
		database = self.puller.symbol_db
		with database.connection, database.connection.cursor() as cursor:
			cursor.execute('UPDATE symbol_blocks SET transactions_count = 1, total_transactions_count = 1 WHERE height = 2')

		# Act / Assert:
		self._assert_migrated_sync_preserves_receiptless_lock(node, '^Retained Symbol history cannot prove receiptless Hash Lock creation$')
		self.assertEqual([], [request for request in node.paths if request.startswith('lock/hash/')])

	def test_migrated_sync_replays_hash_lock_with_a_committed_mosaic_alias_resolution(self):
		# Arrange: the ordinary writer stored the resolved relation before the current lock write failed.
		alias_id = 'E74B99BA41F4AFEE'
		node, lock_path, key = self._interrupt_migrated_hash_lock_batch(mosaic_alias=alias_id)
		before = self._capture_preserved_state()
		[(mosaic,)] = before.tables['symbol_transaction_mosaics']
		self.assertEqual(NATIVE_MOSAIC_ID, mosaic['mosaic_id'])
		node.paths.clear()

		# Act:
		heights, state = self._sync_with_connector(node)

		# Assert:
		self.assertEqual((list(range(1, 9)), 'healthy', None, None), (
			heights, state['status'], state['dirty_state_from_height'], self._recovery()['resume_height']))
		after = self._capture_preserved_state()
		[(transaction,)] = after.tables['symbol_transactions']
		[(mosaic,)] = after.tables['symbol_transaction_mosaics']
		[(lock,)] = after.tables['symbol_hash_locks']
		self.assertEqual(alias_id, transaction['raw_payload']['transaction']['mosaicId'])
		self.assertEqual((key, NATIVE_MOSAIC_ID, NATIVE_MOSAIC_ID, 'unused', 12), (
			lock['hash'][2:].upper(), mosaic['mosaic_id'], lock['mosaic_id'], lock['status'], lock['end_height']))
		resolutions = [resolution_path('address', 7), resolution_path('mosaic', 7)]
		self.assertEqual([*resolutions, lock_path, *resolutions], [request for request in node.paths if request.startswith(
			('statements/resolutions/', 'lock/hash/'))])

	def test_migrated_sync_preserves_history_when_hash_lock_mosaic_resolution_is_missing(self):
		# Arrange: a previously resolved relation is no substitute for the node statement during preflight.
		node, _, _ = self._interrupt_migrated_hash_lock_batch(should_publish_accounts=True, mosaic_alias='E74B99BA41F4AFEE')
		node.mosaic_resolutions_by_height.clear()
		node.paths.clear()
		before = self._capture_preserved_state()
		generations = self._read_generation_rows()
		database = self.puller.symbol_db

		# Act:
		with self._use_database(UnexpectedRepairDatabase(database)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Symbol receipts Merkle root does not match block at height 7'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual(('restoration_evidence_missing', None), (self._recovery()['stop_reason'], self._recovery()['resume_height']))
		self.assertEqual([resolution_path('address', 7), resolution_path('mosaic', 7)], [path for path in node.paths if path.startswith(
			('statements/resolutions/', 'lock/hash/'))])

	def test_migrated_sync_rejects_hash_lock_mosaic_resolution_from_another_height(self):
		# Arrange: the alias source and resolved ID agree, but the response is from H8 instead of H7.
		node, _, _ = self._interrupt_migrated_hash_lock_batch(mosaic_alias='E74B99BA41F4AFEE')
		node.mosaic_resolutions_by_height[7][0]['statement']['height'] = '8'
		before = self._capture_preserved_state()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, 'resolution at height 8 does not match requested height 7'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual('restoration_evidence_missing', self._recovery()['stop_reason'])

	def test_migrated_sync_preserves_repair_cut_when_replay_mosaic_resolution_changes(self):
		# Arrange: change only the resolution when the forward batch repeats the preflight request.
		path = resolution_path('mosaic', 7)
		alias_id = 'E74B99BA41F4AFEE'
		changed = self._hash_lock_mosaic_resolution(alias_id, '1234567890ABCDEF')

		class ChangedMosaicConnector(RecoveryConnector):
			"""Returns a different resolution to the post-repair writer."""

			async def get(self, url_path, *args):
				response = await super().get(url_path, *args)
				if path == url_path and self.paths.count(path) == 2:
					return {'data': [changed]}

				return response

		interrupted, lock_path, _ = self._interrupt_migrated_hash_lock_batch(mosaic_alias=alias_id)
		node = ChangedMosaicConnector(
			interrupted.blocks, 6, transactions_by_path=interrupted.transactions_by_path, statement_pages=interrupted.statement_pages,
			mosaic_resolutions_by_height=interrupted.mosaic_resolutions_by_height,
			hash_lock_responses={lock_path: interrupted.hash_lock_response(lock_path)})

		# Act:
		with self._use_database(FailingWriteDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Symbol receipts Merkle root does not match block at height 7'):
				self._sync_with_connector(node)

		# Assert:
		self.assertEqual(list(range(1, 7)), self._fetch_block_heights(self.puller.symbol_db))
		after = self._capture_preserved_state()
		self.assertEqual(([], [], [], []), tuple(after.tables[name] for name in (
			'symbol_transactions', 'symbol_receipts', 'symbol_transaction_mosaics', 'symbol_hash_locks')))
		self.assertEqual((6, 7, 7, 'reconciliation_wait'), (
			after.sync_state['last_synced_height'], after.sync_state['dirty_state_from_height'],
			self._recovery()['resume_height'], self._recovery()['stop_reason']))
		self.assertNotEqual('healthy', after.sync_state['status'])

	def test_migrated_sync_invalidates_changed_saved_mosaic_resolution(self):
		# Arrange: preflight resolved the alias and saved its evidence before the lock lookup failed.
		alias_id = 'E74B99BA41F4AFEE'
		interrupted, lock_path, _ = self._interrupt_migrated_hash_lock_batch(mosaic_alias=alias_id)
		database = self.puller.symbol_db
		node = RecoveryConnector(
			interrupted.blocks, 6, transactions_by_path=interrupted.transactions_by_path, statement_pages=interrupted.statement_pages,
			mosaic_resolutions_by_height=interrupted.mosaic_resolutions_by_height,
			hash_lock_responses={lock_path: NodeException('lock lookup unavailable')})
		with self._use_database(UnexpectedRepairDatabase(database)):
			with self.assertRaisesRegex(NodeException, 'lock lookup unavailable'):
				self._sync_with_connector(node)

		before = self._capture_preserved_state()
		resolution = self._hash_lock_mosaic_resolution(alias_id)['statement']
		self.assertEqual({'7': {'address': [], 'mosaic': [resolution]}}, self._recovery()['progress']['hash_lock_scan']['resolutions'])
		node.paths.clear()
		node.mosaic_resolutions_by_height[7] = [self._hash_lock_mosaic_resolution(alias_id, '1234567890ABCDEF')]
		_commit_recovery_suffix(
			node.blocks, statements=node.statement_pages[statement_path(7, 8)]['data'],
			mosaics_by_height=node.mosaic_resolutions_by_height)

		# Act:
		with self._use_database(UnexpectedRepairDatabase(database)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Pinned Symbol reconciliation evidence changed'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		recovery = self._recovery()
		self.assertEqual((None, 1, 'reconciliation_wait'), (recovery['progress'], recovery['invalidations'], recovery['stop_reason']))
		self.assertEqual([], [path for path in node.paths if path.startswith(
			('statements/', 'transactions/confirmed?', 'lock/hash/'))])

	def _assert_migrated_sync_invalidates_saved_empty_statement_page(self, changed_items, diagnostic):
		# Arrange: the empty statement page was verified before a temporary lock lookup failure.
		interrupted, lock_path, _ = self._interrupt_migrated_hash_lock_batch(receiptless=True, should_publish_accounts=True)
		node = RecoveryConnector(
			interrupted.blocks, 6, transactions_by_path=interrupted.transactions_by_path, statement_pages=interrupted.statement_pages,
			hash_lock_responses={lock_path: NodeException('lock lookup unavailable')})
		with self.assertRaisesRegex(NodeException, 'lock lookup unavailable'):
			self._sync_with_connector(node)

		page = statement_path(7, 8)
		node.statement_pages[page] = {'data': changed_items}
		node.paths.clear()
		before, generations = self._capture_preserved_state(), self._read_generation_rows()
		self.puller = create_symbol_puller(self.config_ini, 'testnet')
		database = self.exit_stack.enter_context(self.puller.symbol_db)

		# Act:
		with self._use_database(UnexpectedRepairDatabase(database)):
			with self.assertRaisesRegex(EvidenceChanged, diagnostic):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual((None, 1, 'reconciliation_wait'), (
			self._recovery()['progress'], self._recovery()['invalidations'], self._recovery()['stop_reason']))
		self.assertEqual([page], [request for request in node.paths if request.startswith(('statements/', 'lock/hash/'))])

	def test_migrated_sync_invalidates_receiptless_proof_when_a_statement_appears_on_retry(self):
		self._assert_migrated_sync_invalidates_saved_empty_statement_page(
			[create_amount_statement_item(7, 999)], 'Previously scanned Symbol receipts changed with verifiable receipts disabled')

	def test_migrated_sync_invalidates_receiptless_proof_when_the_statement_page_is_malformed_on_retry(self):
		self._assert_migrated_sync_invalidates_saved_empty_statement_page(
			{}, 'Invalid Symbol transaction statements while rechecking saved replacement proof')

	def _prepare_interrupted_hash_lock_with_later_transfer(
		self, connector_type=RecoveryConnector, *, should_publish_accounts=False, tip_height=9
	):
		interrupted, lock_path, _ = self._interrupt_migrated_hash_lock_batch(should_publish_accounts=should_publish_accounts)
		blocks = [*interrupted.blocks, *_chain(tip_height)[8:]]
		lock = interrupted.transactions_by_path[transaction_path(7, 8)]['data'][0]
		transfer = create_node_transaction(9, deadline='30000')
		_set_block_transactions(blocks[8], [transfer])
		_commit_recovery_suffix(blocks, 9)
		node = connector_type(
			blocks, 6,
			transactions_by_path={
				**interrupted.transactions_by_path,
				transaction_path(7, tip_height): create_transaction_page([lock, transfer]),
				transaction_path(9, 9): create_transaction_page([transfer])
			},
			statement_pages={
				**interrupted.statement_pages, statement_path(7, tip_height): interrupted.statement_pages[statement_path(7, 8)]
			},
			hash_lock_responses={lock_path: interrupted.hash_lock_response(lock_path)})
		return node, lock_path

	def test_migrated_sync_resumes_to_cap_before_unrelated_hash_lock(self):
		# Arrange: a repair at H7 was interrupted before writing the H7–8 batch.
		interrupted, path, key = self._interrupt_migrated_hash_lock_batch()
		with self._use_database(FailingWriteDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(RuntimeError, '^resumed write failed$'):
				self._sync_with_connector(interrupted)

		self.assertEqual(7, self._recovery()['resume_height'])
		blocks = [*interrupted.blocks, create_node_block(9)]
		future_key = 'CC' * 32
		future = {
			'hash': future_key, 'ownerAddress': SIGNER_ADDRESS, 'mosaicId': NATIVE_MOSAIC_ID,
			'amount': str(HASH_LOCK_AMOUNT), 'endHeight': '14', 'status': 0
		}
		transaction, receipt = self._create_bonded_lock_origin(9, SIGNER_PUBLIC_KEY, future)
		_set_block_transactions(blocks[-1], [transaction])
		_commit_recovery_suffix(blocks, 9, statements=[receipt])
		[origin] = interrupted.transactions_by_path[transaction_path(7, 8)]['data']
		[created] = interrupted.statement_pages[statement_path(7, 8)]['data']
		node = RecoveryConnector(
			blocks, 6,
			transactions_by_path={**interrupted.transactions_by_path, transaction_path(7, 9): create_transaction_page([origin, transaction])},
			statement_pages={**interrupted.statement_pages, statement_path(7, 9): {'data': [created, receipt]}},
			hash_lock_responses={path: interrupted.hash_lock_response(path)})

		# Act:
		heights, sync = self._sync_with_connector(node, max_height=8)

		# Assert:
		self.assertEqual((list(range(1, 9)), 'healthy', 8, 6, None, None), (
			heights, sync['status'], sync['last_synced_height'], sync['finalized_height'], sync['dirty_state_from_height'],
			self._recovery()['resume_height']))
		[(lock,)] = self._fetch_table_state(('symbol_hash_locks',))['symbol_hash_locks']
		self.assertEqual(('\\x' + key.lower(), 'unused', 12), (lock['hash'], lock['status'], lock['end_height']))
		self.assertEqual([path], [request for request in node.paths if request.startswith('lock/hash/')])

	def test_migrated_sync_replays_canonically_pruned_hash_lock(self):
		# Arrange: the replacement extends past the proven H12 expiration and finalization.
		interrupted, path, _ = self._interrupt_migrated_hash_lock_batch()
		[origin] = interrupted.transactions_by_path[transaction_path(7, 8)]['data']
		[created] = interrupted.statement_pages[statement_path(7, 8)]['data']
		expired = create_amount_statement_item(
			12, HASH_LOCK_AMOUNT, receipt_type=ReceiptType.LOCK_HASH_EXPIRED.value, targetAddress=BENEFICIARY_ADDRESS)
		blocks = [*interrupted.blocks, *_chain(13)[8:]]
		_commit_recovery_suffix(blocks, 9, statements=[expired])
		node = RecoveryConnector(
			blocks, 12, finalized_fields={'hash': blocks[11]['meta']['hash']},
			transactions_by_path={transaction_path(7, 13): create_transaction_page([origin])},
			statement_pages={statement_path(7, 13): {'data': [created, expired]}})

		# Act:
		heights, sync = self._sync_with_connector(node)

		# Assert:
		self.assertEqual((list(range(1, 14)), 'healthy', 13, 12, None, None), (
			heights, sync['status'], sync['last_synced_height'], sync['finalized_height'], sync['dirty_state_from_height'],
			self._recovery()['resume_height']))
		stored = self._fetch_table_state(('symbol_hash_locks', 'symbol_receipts'))
		self.assertEqual([], stored['symbol_hash_locks'])
		self.assertEqual([(7, 'lockHashCreated'), (12, 'lockHashExpired')], sorted(
			(row['height'], row['receipt_type']) for (row,) in stored['symbol_receipts']))
		self.assertEqual([path], [request for request in node.paths if request.startswith('lock/hash/')])

	def test_rest_preserves_committed_reads_during_transient_finality_ahead_of_tip(self):
		# Arrange: publish a checkpoint before the node reports an internally inconsistent sample.
		blocks = _chain(4)
		address = self._sync_with_published_account_generation(blocks[:3], 1)
		before, recovery = self._capture_preserved_state(), self._recovery()
		generations = self._read_generation_rows()
		client = self._create_symbol_rest_client()
		paths = ('/api/symbol/blocks?limit=1', f'/api/symbol/account?address={address}')
		self.assertEqual([200, 200], [client.get(path).status_code for path in paths])
		node = RecoveryConnector(blocks[:3], 4)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalized height exceeds node chain height$'):
			self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual((recovery, generations), (self._recovery(), self._read_generation_rows()))
		self.assertEqual([200, 200], [client.get(path).status_code for path in paths])
		self.assertEqual(['chain/info'], node.paths)

		# Act:
		heights, sync = self._sync_with_connector(RecoveryConnector(blocks, 1))

		# Assert:
		self.assertEqual((list(range(1, 5)), 'healthy', 4, 1), (
			heights, sync['status'], sync['last_synced_height'], sync['finalized_height']))

	def test_migrated_sync_rejects_changed_transaction_body_before_repair(self):
		# Arrange: mutate the transfer while retaining its original hash and Merkle component.
		node, _ = self._prepare_interrupted_hash_lock_with_later_transfer(should_publish_accounts=True)
		page = transaction_path(7, 9)
		_, transfer = node.transactions_by_path[page]['data']
		transfer['transaction']['deadline'] = '30001'
		before, generations = self._capture_preserved_state(), self._read_generation_rows()
		recovery = self._recovery()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Symbol transaction hash does not match reconstructed body'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		after = self._recovery()
		self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'restoration_evidence_missing'}, after)
		self.assertEqual([page], [request for request in node.paths if request.startswith(('transactions/', 'lock/hash/'))])

	def test_migrated_sync_rejects_changed_block_root_before_repair(self):
		# Arrange: the block still reports its original hash, but its transaction root changes during the lock lookup.
		class ChangedRootConnector(RecoveryConnector):
			"""Changes the scanned block returned by the final individual lookup."""
			async def get(self, url_path, *args):
				response = await super().get(url_path, *args)
				if url_path.startswith('lock/hash/'):
					block = self.blocks[8]
					self.evidence_by_height[9] = {**block, 'block': {**block['block'], 'transactionsHash': 'EF' * 32}}

				return response

		node, lock_path = self._prepare_interrupted_hash_lock_with_later_transfer(ChangedRootConnector, should_publish_accounts=True)
		before, generations = self._capture_preserved_state(), self._read_generation_rows()
		recovery = self._recovery()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(EvidenceChanged, 'Symbol replay block commitments changed'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual({**recovery, 'progress': None, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'}, self._recovery())
		self.assertEqual(['blocks/9'], [path for path in node.paths[node.paths.index(lock_path) + 1:] if path == 'blocks/9'])

	def test_migrated_sync_rejects_changed_transaction_counts_on_the_authenticated_tip_before_repair(self):
		# Arrange: the direct H9 response disagrees with the scanned counts but has the same nonzero root.
		node, _ = self._prepare_interrupted_hash_lock_with_later_transfer(should_publish_accounts=True)
		original = node.blocks[8]
		node.evidence_by_height[9] = {**original, 'meta': {**original['meta'], 'transactionsCount': 2, 'totalTransactionsCount': 2}}
		before, generations = self._capture_preserved_state(), self._read_generation_rows()
		recovery = self._recovery()

		# Act:
		self._sync_expecting_rejection_before_repair(node, '^Node Symbol replay block commitments changed before repair$')

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual({**recovery, 'progress': None, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'}, self._recovery())
		self.assertEqual(['blocks/9'], [path for path in node.paths if path == 'blocks/9'])

	def test_migrated_sync_rejects_changed_parent_of_the_retained_hash_lock_boundary(self):
		# Arrange: H6 stays below the replacement range, but its reported link to H5 changes after the lock lookup.
		node, lock_path, _, _ = self._interrupt_migrated_aggregate_bonded_batch(should_write_completion=True)
		before, generations = self._capture_preserved_state(), self._read_generation_rows()
		recovery = self._recovery()
		get_original = node.get

		async def change_parent_after_lookup(path, *args):
			response = await get_original(path, *args)
			if path == lock_path:
				block = node.blocks[5]
				node.evidence_by_height[6] = {**block, 'block': {**block['block'], 'previousBlockHash': 'AC' * 32}}

			return response

		# Act:
		with patch.object(node, 'get', new=change_parent_after_lookup):
			self._sync_expecting_rejection_before_repair(node, '^Pinned Symbol reconciliation evidence changed$')

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual({**recovery, 'progress': None, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'}, self._recovery())
		self.assertEqual(['blocks/6', 'blocks/7', 'blocks/5', 'blocks/6'], [
			path for path in node.paths[node.paths.index(lock_path) + 1:] if path.startswith('blocks/')])

	def test_migrated_sync_rejects_duplicate_mosaic_resolution_statements(self):
		# Arrange: two independent statements report resolutions for the same alias at H7.
		node, _, _ = self._interrupt_migrated_hash_lock_batch(mosaic_alias='E74B99BA41F4AFEE', should_publish_accounts=True)
		[original] = node.mosaic_resolutions_by_height[7]
		node.mosaic_resolutions_by_height[7] = [{**original, 'id': 'duplicate-resolution'}, original]
		node.paths.clear()
		before, generations = self._capture_preserved_state(), self._read_generation_rows()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Duplicate Symbol mosaic resolution statement'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual('restoration_evidence_missing', self._recovery()['stop_reason'])
		self.assertEqual([resolution_path('address', 7), resolution_path('mosaic', 7)], [path for path in node.paths if path.startswith(
			('statements/resolutions/', 'lock/hash/'))])

	def test_migrated_sync_rejects_changed_mosaic_proof_after_restart(self):
		# Arrange: the repair committed with the original alias resolution, then failed before forward writes.
		alias = 'E74B99BA41F4AFEE'
		node, lock_path, _ = self._interrupt_migrated_hash_lock_batch(mosaic_alias=alias)
		with self._use_database(FailingWriteDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(RuntimeError, '^resumed write failed$'):
				self._sync_with_connector(node)

		before = self._capture_preserved_state()
		recovery = self._recovery()
		self.assertEqual((7, 'resume_wait'), (recovery['resume_height'], recovery['stop_reason']))
		self.assertTrue(recovery['progress']['replay_hash_lock_proof']['blocks'])
		changed_mosaic = '1234567890ABCDEF'
		node.mosaic_resolutions_by_height[7] = [self._hash_lock_mosaic_resolution(alias, changed_mosaic)]
		[statement] = node.statement_pages[statement_path(7, 8)]['data']
		[receipt] = statement['statement']['receipts']
		receipt['mosaicId'] = changed_mosaic
		node.hash_lock_response(lock_path)['lock']['mosaicId'] = changed_mosaic
		_commit_recovery_suffix(
			node.blocks, statements=node.statement_pages[statement_path(7, 8)]['data'],
			mosaics_by_height=node.mosaic_resolutions_by_height)
		node.paths.clear()
		self.puller = create_symbol_puller(self.config_ini, 'testnet')
		database = self.exit_stack.enter_context(self.puller.symbol_db)

		# Act:
		with self._use_database(UnexpectedRepairDatabase(database)):
			with self.assertRaisesRegex(EvidenceChanged, 'Symbol Hash Lock restoration evidence changed after repair'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		after = self._recovery()
		self.assertEqual((
			recovery['progress']['replay_hash_lock_proof'], 7, 1, 'reconciliation_wait'
		), (after['progress']['replay_hash_lock_proof'], after['resume_height'], after['invalidations'], after['stop_reason']))
		self.assertEqual([], [path for path in node.paths if path.startswith('lock/hash/')])

	def test_migrated_sync_preserves_repair_marker_when_replay_harvest_receipt_changes(self):
		# Arrange:
		def change(response):
			origin, harvest = response['data']
			statement = harvest['statement']
			[receipt] = statement['receipts']
			altered = {**statement, 'receipts': [{**receipt, 'amount': '777777'}]}
			return {**response, 'data': [origin, {**harvest, 'statement': altered}]}

		def prepare(node):
			page = statement_path(7, 9)
			[origin] = node.statement_pages[page]['data']
			harvest = create_amount_statement_item(
				9, HASH_LOCK_AMOUNT, receipt_type=ReceiptType.HARVEST_FEE.value, targetAddress=BENEFICIARY_ADDRESS)
			node.statement_pages[page] = {'data': [origin, harvest]}
			for item in (origin, harvest):
				statement = item['statement']
				block = node.blocks[int(statement['height']) - 1]
				block['block']['receiptsHash'] = calculate_receipts_hash([statement], [], []).hex().upper()

			_commit_recovery_suffix(node.blocks)
			node.network_properties['chain']['enableVerifiableReceipts'] = True
			self.puller = create_symbol_puller(self.config_ini, 'testnet')
			self.exit_stack.enter_context(self.puller.symbol_db)

		self._assert_migrated_sync_preserves_repair_marker_after_changed_replay(
			statement_path(7, 9), change, 'Symbol receipts Merkle root does not match block at height 9', prepare=prepare)

	def _prepare_many_migrated_hash_locks(self, *, use_alias):
		alias = 'E74B99BA41F4AFEE' if use_alias else None
		interrupted, path, _ = self._interrupt_migrated_hash_lock_batch(mosaic_alias=alias)
		blocks = [*interrupted.blocks, *_chain(30)[8:]]
		transactions = list(interrupted.transactions_by_path[transaction_path(7, 8)]['data'])
		receipts = list(interrupted.statement_pages[statement_path(7, 8)]['data'])
		responses = {path: interrupted.hash_lock_response(path)}
		resolutions = dict(interrupted.mosaic_resolutions_by_height)
		for index in range(22):
			key = f'{9009 + index:064X}'
			lock = {
				'hash': key, 'ownerAddress': SIGNER_ADDRESS, 'mosaicId': NATIVE_MOSAIC_ID,
				'amount': str(HASH_LOCK_AMOUNT), 'endHeight': str(21 + index), 'status': 0
			}
			transaction, receipt = self._create_bonded_lock_origin(9, SIGNER_PUBLIC_KEY, lock, block_index=index, mosaic_alias=alias)
			transactions.append(transaction)
			receipts.append(receipt)
			responses[f'lock/hash/{key}'] = {'id': f'lock-{9 + index}', 'lock': lock}

		_set_block_transactions(blocks[8], transactions[1:])
		if alias:
			resolutions[9] = [create_resolution_statement(9, alias, [
				{'source': {'primaryId': 1, 'secondaryId': 0}, 'resolved': NATIVE_MOSAIC_ID}
			])]

		_commit_recovery_suffix(blocks, 9, statements=receipts, mosaics_by_height=resolutions)
		return RecoveryConnector(
			blocks, 6, transactions_by_path={transaction_path(7, 30): create_transaction_page(transactions)},
			statement_pages={statement_path(7, 30): {'data': receipts}}, mosaic_resolutions_by_height=resolutions, hash_lock_responses=responses)

	@staticmethod
	def _extend_budget_lock_branch(node, transactions=(), receipts=()):
		height = len(node.blocks) + 1
		block = create_node_block(height)
		_set_block_transactions(block, transactions)
		node.blocks.append(block)
		_commit_recovery_suffix(node.blocks, height, statements=receipts)
		node.chain_height = height
		node.transactions_by_path[transaction_path(height, height)] = create_transaction_page(transactions)
		node.statement_pages[statement_path(height, height)] = {'data': list(receipts)}
		prior_transactions = node.transactions_by_path[transaction_path(7, height - 1)]['data']
		prior_receipts = node.statement_pages[statement_path(7, height - 1)]['data']
		node.transactions_by_path[transaction_path(7, height)] = create_transaction_page([*prior_transactions, *transactions])
		node.statement_pages[statement_path(7, height)] = {'data': [*prior_receipts, *receipts]}

	def _use_replay_budget(self):
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 24))
		return self.exit_stack.enter_context(self.puller.symbol_db)

	@staticmethod
	def _budget_lock_paths():
		return [*(f'lock/hash/{9000 + height:064X}' for height in range(9, 31)), 'lock/hash/' + 'AB' * 32]

	def _assert_migrated_sync_resumes_budgeted_lock_evidence(  # pylint: disable=too-many-locals
		self, *, use_alias, progress_key, should_extend=False
	):
		# Arrange: a 24-block suffix has more required lookups than can finish in the first invocation.
		node = self._prepare_many_migrated_hash_locks(use_alias=use_alias)
		before = self._capture_preserved_state()
		counts, fetched, recheck = [], set(), None
		paths = self._budget_lock_paths()
		for attempt in range(1, 8):
			if attempt > 1 and should_extend:
				self._extend_budget_lock_branch(node)

			if recheck is None and fetched:
				recheck = fetched.copy()

			missing = [path for path in paths if path not in fetched]
			pending = [path for path in paths if path in (recheck or ())]
			expected = missing + pending if should_extend else sorted(missing + pending)
			node.paths.clear()

			# Act:
			database = self._use_replay_budget()
			try:
				heights, state = self._sync_with_connector(node)
			except SymbolRollbackError as exception:
				# Assert: no history or lock write occurs before the evidence is ready.
				self.assertRegex(str(exception), '^Symbol branch reconciliation request budget exhausted$')
				self._assert_preserved_state(before, before.sync_state)
				recovery = self._recovery()
				progress = recovery['progress']['hash_lock_scan']
				counts.append(len(progress.get(progress_key, {})))
				self.assertEqual((node.chain_height, 'reconciliation_wait'), (progress['height'], recovery['stop_reason']))
				requested = [path for path in node.paths if path.startswith('lock/hash/')]
				self.assertEqual(expected[:len(requested)], requested)
				fetched.update(requested)
				self.assertEqual({path.rsplit('/', 1)[-1].lower() for path in fetched}, set(progress.get('lock_responses', {})))
				if recheck is not None:
					recheck.difference_update(requested)

				continue

			# Assert: the remaining requests completed proof and the final checkpoint.
			self.assertEqual(expected, [path for path in node.paths if path.startswith('lock/hash/')])
			break
		else:
			self.fail('Hash Lock reconciliation did not converge within seven invocations')

		self.assertGreater(attempt, 1)
		self.assertGreater(counts[0], 0)
		self.assertLess(counts[0], 23)
		self.assertEqual((list(range(1, node.chain_height + 1)), 'healthy', None, None), (
			heights, state['status'], state['dirty_state_from_height'], self._recovery()['resume_height']))
		self.assertEqual(23, len(self._fetch_table_state(('symbol_hash_locks',))['symbol_hash_locks']))
		self.assertEqual(node.chain_height, database.get_sync_state()['last_synced_height'])

	def _assert_migrated_sync_refetches_replay_progress(self, update_scan):
		# Arrange: preserve a complete scan in a format from before the current checks.
		node = self._prepare_many_migrated_hash_locks(use_alias=False)
		database = self._use_replay_budget()
		with self.assertRaisesRegex(SymbolRollbackError, '^Symbol branch reconciliation request budget exhausted$'):
			self._sync_with_connector(node)

		progress = self._recovery()['progress']
		update_scan(progress['hash_lock_scan'])
		database.update_fork_reconciliation(progress, 0, ForkRecoveryStopReason.RECONCILIATION_WAIT)
		node.paths.clear()
		self.puller = create_symbol_puller(self.config_ini, 'testnet')
		self.exit_stack.enter_context(self.puller.symbol_db)

		# Act:
		heights, state = self._sync_with_connector(node)

		# Assert: both the proof and the replacement batch used a freshly downloaded range.
		self.assertEqual((30, 'healthy', None), (heights[-1], state['status'], self._recovery()['resume_height']))
		lookups = self._budget_lock_paths()
		expected = [transaction_path(7, 30), *lookups, transaction_path(7, 30)]
		self.assertEqual(expected, [
			request for request in node.paths if request.startswith(('transactions/confirmed?', 'lock/hash/'))
		])

	def test_migrated_sync_refetches_replay_progress_without_validated_headers(self):
		self._assert_migrated_sync_refetches_replay_progress(lambda scan: scan.pop('header_version'))

	def test_migrated_sync_refetches_replay_progress_before_embedded_lock_absence_validation(self):
		# Version 2 authenticated headers and accepted all non-lock rows from unbound V1 payloads.
		self._assert_migrated_sync_refetches_replay_progress(lambda scan: scan.update(header_version=2))

	def test_migrated_sync_preserves_hash_lock_lookup_progress_at_request_budget(self):
		self._assert_migrated_sync_resumes_budgeted_lock_evidence(use_alias=False, progress_key='lock_responses')

	def test_migrated_sync_preserves_mosaic_resolution_progress_at_request_budget(self):
		self._assert_migrated_sync_resumes_budgeted_lock_evidence(use_alias=True, progress_key='resolutions')

	def test_migrated_sync_resumes_budgeted_lock_lookups_while_node_tip_grows(self):
		self._assert_migrated_sync_resumes_budgeted_lock_evidence(use_alias=False, progress_key='lock_responses', should_extend=True)

	def test_migrated_sync_rechecks_key_reused_after_saved_lock_lookup(self):
		# Arrange: the first lock has ended by H30 but a response for it is saved during the first pass.
		node = self._prepare_many_migrated_hash_locks(use_alias=False)
		self._use_replay_budget()
		with self.assertRaisesRegex(SymbolRollbackError, '^Symbol branch reconciliation request budget exhausted$'):
			self._sync_with_connector(node)

		paths = self._budget_lock_paths()
		cached = self._recovery()['progress']['hash_lock_scan']['lock_responses']
		path = paths[0]
		self.assertIn(path.rsplit('/', 1)[-1].lower(), cached)
		self.assertLess(len(cached), len(paths))
		owner_key = '34' * 32
		owner = Network.TESTNET.public_key_to_address(PublicKey(owner_key)).bytes.hex().upper()
		lock = node.hash_lock_response(path)['lock']
		lock.update(ownerAddress=owner, endHeight='43')
		transaction, receipt = self._create_bonded_lock_origin(31, owner_key, lock)
		self._extend_budget_lock_branch(node, [transaction], [receipt])
		node.paths.clear()

		# Act:
		self.puller = create_symbol_puller(self.config_ini, 'testnet')
		self.exit_stack.enter_context(self.puller.symbol_db)
		heights, state = self._sync_with_connector(node)

		# Assert: the reused key becomes pending immediately, ahead of the earlier unrelated lookups.
		missing = [request for request in paths if request.rsplit('/', 1)[-1].lower() not in cached]
		pending = [request for request in paths if request != path and request.rsplit('/', 1)[-1].lower() in cached]
		self.assertEqual([path, *missing, *pending], [request for request in node.paths if request.startswith('lock/hash/')])
		self.assertEqual((31, 'healthy', None, None), (
			heights[-1], state['status'], state['dirty_state_from_height'], self._recovery()['resume_height']))
		[saved] = [
			row for (row,) in self._fetch_table_state(('symbol_hash_locks',))['symbol_hash_locks']
			if row['hash'][2:].upper() == lock['hash']
		]
		self.assertEqual((owner, 43, 'unused'), (saved['owner_address'][2:].upper(), saved['end_height'], saved['status']))

	def test_migrated_sync_rechecks_lock_when_finality_reaches_its_end_height(self):
		# Arrange: a lock response saved at F6 ceases to be sufficient when the chain finalizes its end.
		node = self._prepare_many_migrated_hash_locks(use_alias=False)
		self._use_replay_budget()
		with self.assertRaisesRegex(SymbolRollbackError, '^Symbol branch reconciliation request budget exhausted$'):
			self._sync_with_connector(node)

		paths = self._budget_lock_paths()
		cached = self._recovery()['progress']['hash_lock_scan']['lock_responses']
		closing_path = paths[0]
		self.assertIn(closing_path.rsplit('/', 1)[-1].lower(), cached)
		self._extend_budget_lock_branch(node)
		extended = RecoveryConnector(
			node.blocks, 21, transactions_by_path=node.transactions_by_path, statement_pages=node.statement_pages,
			hash_lock_responses={path: node.hash_lock_response(path) for path in paths[1:-1]},
			finalized_fields={'hash': node.blocks[20]['meta']['hash']})

		# Act:
		self.puller = create_symbol_puller(self.config_ini, 'testnet')
		self.exit_stack.enter_context(self.puller.symbol_db)
		heights, state = self._sync_with_connector(extended)

		# Assert: the now-prunable key is fetched first and its previous row is absent.
		missing = [path for path in paths if path.rsplit('/', 1)[-1].lower() not in cached]
		pending = [path for path in paths if path not in missing and path != closing_path]
		self.assertEqual([closing_path, *missing, *pending], [path for path in extended.paths if path.startswith('lock/hash/')])
		self.assertEqual((31, 'healthy', 21, None), (
			heights[-1], state['status'], state['finalized_height'], self._recovery()['resume_height']))
		self.assertEqual({path.rsplit('/', 1)[-1] for path in paths[1:-1]}, {
			row['hash'][2:].upper() for (row,) in self._fetch_table_state(('symbol_hash_locks',))['symbol_hash_locks']
		})

	def test_migrated_sync_invalidates_saved_suffix_with_conflicting_new_finality(self):
		# Arrange: the authenticated H21 was downloaded while the comparison was pinned to F6.
		node = self._prepare_many_migrated_hash_locks(use_alias=False)
		database = self._use_replay_budget()
		with self.assertRaisesRegex(SymbolRollbackError, '^Symbol branch reconciliation request budget exhausted$'):
			self._sync_with_connector(node)

		candidate = node.blocks[20]
		conflicting = commit_node_block({
			**candidate, 'meta': {**candidate['meta']}, 'block': {**candidate['block'], 'timestamp': '21001'}
		})
		node.finalized_height = 21
		node.finalized_fields = {'hash': conflicting['meta']['hash']}
		node.evidence_by_height[21] = conflicting
		node.paths.clear()
		before, generations = self._capture_preserved_state(), self._read_generation_rows()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(database)):
			with self.assertRaisesRegex(EvidenceChanged, '^Symbol Hash Lock replay disagrees with the finalized checkpoint$'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual((None, 1, 'reconciliation_wait'), (
			self._recovery()['progress'], self._recovery()['invalidations'], self._recovery()['stop_reason']))
		self.assertEqual([], [path for path in node.paths if path.startswith('lock/hash/')])

	def test_migrated_sync_resumes_a_large_mosaic_resolution_at_the_saved_page(self):
		# Arrange: the mosaic search has 25 pages at one height and cannot finish with the initial proof requests.
		node, path, _ = self._interrupt_migrated_hash_lock_batch(mosaic_alias='E74B99BA41F4AFEE')
		node.mosaic_resolutions_by_height[7].extend(
			create_resolution_statement(7, f'{(1 << 63) + index:016X}', [
				{'source': {'primaryId': 1, 'secondaryId': 0}, 'resolved': NATIVE_MOSAIC_ID}
			]) for index in range(2400))
		_commit_recovery_suffix(
			node.blocks, statements=node.statement_pages[statement_path(7, 8)]['data'],
			mosaics_by_height=node.mosaic_resolutions_by_height)
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 26))
		self.exit_stack.enter_context(self.puller.symbol_db)
		node.paths.clear()
		before = self._capture_preserved_state()

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'reconciliation request budget exhausted'):
			self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		download = self._recovery()['progress']['hash_lock_scan']['download']['resolutions']['7']['resolution_downloads']['mosaic:7']
		next_page = download['page']
		self.assertGreater(next_page, 1)
		self.assertLess(next_page, 25)
		self.assertEqual((next_page - 1) * 100, len(download['bodies']))
		self.assertEqual([resolution_path('mosaic', 7, page) for page in range(1, next_page)], [
			request for request in node.paths if request.startswith('statements/resolutions/mosaic?')])

		# Act:
		node.paths.clear()
		heights, sync = self._sync_with_connector(node)

		# Assert:
		self.assertEqual((8, 'healthy', None, None), (
			heights[-1], sync['status'], sync['dirty_state_from_height'], self._recovery()['resume_height']))
		self.assertEqual([resolution_path('mosaic', 7, page) for page in range(next_page, 26)], [
			request for request in node.paths[:node.paths.index(path)] if request.startswith('statements/resolutions/mosaic?')])

	def test_migrated_sync_rechecks_persisted_lock_lookup_after_request_budget(self):
		# Arrange: a bounded run stores part of a consistent lock proof.
		node = self._prepare_many_migrated_hash_locks(use_alias=False)
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 24))
		self.exit_stack.enter_context(self.puller.symbol_db)
		with self.assertRaisesRegex(SymbolRollbackError, 'reconciliation request budget exhausted'):
			self._sync_with_connector(node)

		before = self._capture_preserved_state()
		responses = self._recovery()['progress']['hash_lock_scan']['lock_responses']
		path = f'lock/hash/{min(responses).upper()}'
		node.hash_lock_response(path)['lock']['status'] = 1
		node.paths.clear()
		self.puller = create_symbol_puller(self.config_ini, 'testnet')
		database = self.exit_stack.enter_context(self.puller.symbol_db)

		# Act:
		with self._use_database(UnexpectedRepairDatabase(database)):
			with self.assertRaisesRegex(SymbolRollbackError, 'does not match a proven creation'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual('restoration_evidence_missing', self._recovery()['stop_reason'])
		self.assertEqual([path], [request for request in node.paths if request.startswith('lock/hash/')])

	def test_migrated_sync_resumes_lock_evidence_after_a_postgres_statement_timeout(self):
		# Arrange: PostgreSQL cancels one progress write after a previously committed lock lookup.
		class InterruptedProofDatabase(DelegatingSymbolDatabase):
			"""Times out during a progress update in the dedicated test database."""

			def update_fork_reconciliation(self, progress, invalidations, stop_reason, *, recheck_legacy_tip=False):
				if progress and len(progress.get('hash_lock_scan', {}).get('lock_responses', {})) == 2:
					connection = self.database.connection
					with self.database.independent_reconciliation(), connection, connection.cursor() as cursor:
						cursor.execute("SET LOCAL statement_timeout = '5ms'")
						cursor.execute('SELECT pg_sleep(0.1)')

				self.database.update_fork_reconciliation(progress, invalidations, stop_reason, recheck_legacy_tip=recheck_legacy_tip)

		node = self._prepare_many_migrated_hash_locks(use_alias=False)
		before = self._capture_preserved_state()
		database = self.puller.symbol_db

		# Act:
		with self._use_database(InterruptedProofDatabase(database)):
			with self.assertRaisesRegex(SymbolRollbackError, '^Unable to verify saved block range$') as raised:
				self._sync_with_connector(node)

		# Assert:
		self.assertEqual(errorcodes.QUERY_CANCELED, raised.exception.__cause__.pgcode)
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(1, len(self._recovery()['progress']['hash_lock_scan']['lock_responses']))

		# Act:
		heights, sync = self._sync_with_connector(node)

		# Assert:
		self.assertEqual((30, 'healthy', None, None), (
			heights[-1], sync['status'], sync['dirty_state_from_height'], self._recovery()['resume_height']))
		self.assertEqual(2, node.paths.count(transaction_path(7, 30)))
		self.assertEqual(23, len(self._fetch_table_state(('symbol_hash_locks',))['symbol_hash_locks']))

	def test_sync_holds_publication_when_finality_ahead_of_tip_also_conflicts_with_saved_block(self):
		# Arrange: the node's internally inconsistent sample additionally contradicts saved H4.
		blocks = _chain(4)
		self._sync_with_published_account_generation(blocks, 1)
		before, recovery = self._capture_preserved_state(), self._recovery()
		node = RecoveryConnector(blocks[:3], 4, finalized_fields={'hash': 'AC' * 32})

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalized height exceeds node chain height$'):
			self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual(recovery, self._recovery())
		self.assertEqual(['chain/info'], node.paths)

	def test_sync_preserves_fork_on_rollback_current_lock_transport_failure(self):
		# Arrange: a confirmed fork requires fetching an affected current row before deleting any history.
		self._sync_with_published_account_generation(_chain(8, 7), 6)
		database = self.puller.symbol_db
		lock_hash = 'AB' * 32
		item = {'lock': {
			'hash': lock_hash, 'ownerAddress': SIGNER_ADDRESS, 'mosaicId': NATIVE_MOSAIC_ID,
			'amount': str(HASH_LOCK_AMOUNT), 'endHeight': '12', 'status': 0
		}, 'id': 'current-lock'}
		database.upsert_hash_lock(create_hash_lock_row(item, 8))
		path = f'lock/hash/{lock_hash}'
		failure = NodeException('rollback lock lookup unavailable')
		node = FailingPrerequisiteConnector(_chain(8, seal_from=7), 6, path, failure)
		before, generations = self._capture_preserved_state(), self._read_generation_rows()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(database)):
			with self.assertRaisesRegex(NodeException, '^rollback lock lookup unavailable$') as raised:
				self._sync_with_connector(node)

		# Assert:
		self.assertIs(failure, raised.exception)
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual('reconciliation_wait', self._recovery()['stop_reason'])
		self.assertEqual([path] * 3, [request for request in node.paths if request.startswith('lock/')])

	def test_sync_keeps_dirty_intent_when_finality_is_ahead_of_tip(self):
		# Arrange: the node sample cannot be used to resume a dirty range.
		blocks = _chain(4)
		self._sync_with_published_account_generation(blocks[:3], 1)
		self.puller.symbol_db.mark_sync_write_intent(4)
		before = self._capture_preserved_state()
		node = RecoveryConnector(blocks[:3], 4)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalized height exceeds node chain height$'):
			self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual(4, self.puller.symbol_db.get_sync_state()['dirty_state_from_height'])
		self.assertEqual(['chain/info'], node.paths)

	def test_sync_keeps_resume_gate_when_finality_is_ahead_of_tip(self):
		# Arrange: an interrupted repair still has its dedicated marker if the dirty marker is missing.
		node, _, _ = self._interrupt_migrated_hash_lock_batch()
		database = self.puller.symbol_db
		with self._use_database(FailingWriteDatabase(database)):
			with self.assertRaisesRegex(RuntimeError, '^resumed write failed$'):
				self._sync_with_connector(node)

		database.upsert_sync_state({**database.get_sync_state(), 'status': 'healthy', 'dirty_state_from_height': None})
		before, recovery = self._capture_preserved_state(), self._recovery()
		self.assertEqual(7, recovery['resume_height'])
		sample = RecoveryConnector(node.blocks[:6], 8)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalized height exceeds node chain height$'):
			self._sync_with_connector(sample)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual(recovery, self._recovery())

	def test_migrated_sync_preserves_repair_marker_when_uncommitted_lock_receipt_changes(self):
		def change(response):
			[origin] = response['data']
			statement = origin['statement']
			[receipt] = statement['receipts']
			altered = {**statement, 'receipts': [{**receipt, 'amount': str(HASH_LOCK_AMOUNT + 1)}]}
			return {**response, 'data': [{**origin, 'statement': altered}]}

		self._assert_migrated_sync_preserves_repair_marker_after_changed_replay(
			statement_path(7, 9), change, 'Symbol Hash Lock replay events changed after repair')

	def test_migrated_sync_preserves_history_with_unrecognized_receipt_configuration(self):
		# Arrange: the node cannot establish the receipt policy for the replacement chain.
		node, _ = self._prepare_interrupted_hash_lock_with_later_transfer()
		del node.network_properties['chain']['enableVerifiableReceipts']
		self.puller = create_symbol_puller(self.config_ini, 'testnet')
		database = self.exit_stack.enter_context(self.puller.symbol_db)
		before = self._capture_preserved_state()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(database)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Unable to determine Symbol verifiable receipt configuration'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual('restoration_evidence_missing', self._recovery()['stop_reason'])
		self.assertEqual([], [path for path in node.paths if path.startswith(('transactions/', 'statements/', 'lock/hash/'))])

	def test_migrated_sync_preserves_history_when_receipt_configuration_changes_during_scan(self):
		# Arrange: receipt mode was initially corroborated by the node while only part of the proof was persisted.
		node = self._prepare_many_migrated_hash_locks(use_alias=False)
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 24))
		self.exit_stack.enter_context(self.puller.symbol_db)
		with self.assertRaisesRegex(SymbolRollbackError, 'reconciliation request budget exhausted'):
			self._sync_with_connector(node)

		before = self._capture_preserved_state()
		node.network_properties['chain']['enableVerifiableReceipts'] = 'false'
		node.paths.clear()
		self.puller = create_symbol_puller(self.config_ini, 'testnet')
		database = self.exit_stack.enter_context(self.puller.symbol_db)

		# Act:
		with self._use_database(UnexpectedRepairDatabase(database)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Symbol verifiable receipt configuration changed during replay proof'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual((None, 1, 'reconciliation_wait'), (
			self._recovery()['progress'], self._recovery()['invalidations'], self._recovery()['stop_reason']))
		self.assertEqual([], [request for request in node.paths if request.startswith(('statements/', 'lock/hash/'))])

	def test_migrated_sync_preserves_history_with_nonzero_receipt_root_when_receipts_are_disabled(self):
		# Arrange: the node advertises a root that is inconsistent with the network receipt mode.
		node, _, _ = self._interrupt_migrated_hash_lock_batch(receiptless=True)
		node.blocks[7]['block']['receiptsHash'] = 'AC' * 32
		_commit_recovery_suffix(node.blocks, 8)
		node.paths.clear()
		before = self._capture_preserved_state()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Nonzero Symbol receipts root with verifiable receipts disabled'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual('restoration_evidence_missing', self._recovery()['stop_reason'])
		self.assertEqual([transaction_path(7, 8)], [
			path for path in node.paths if path.startswith(('transactions/', 'statements/', 'lock/hash/'))])

	def test_migrated_sync_preserves_history_when_verified_statement_falls_outside_requested_range(self):
		# Arrange: the H7 block has the right receipt root, but REST attributes its statement to H6.
		node, _, _ = self._interrupt_migrated_hash_lock_batch()
		[created] = node.statement_pages[statement_path(7, 8)]['data']
		database = self.puller.symbol_db
		created['statement']['height'] = '6'
		node.paths.clear()
		before = self._capture_preserved_state()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(database)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Symbol transaction statement height 6 is outside requested range'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual('restoration_evidence_missing', self._recovery()['stop_reason'])
		self.assertEqual([statement_path(7, 8)], [path for path in node.paths if path.startswith(('statements/', 'lock/hash/'))])

	def test_migrated_sync_replays_interrupted_hash_lock_with_later_transfer(self):
		# Arrange: the old dirty batch matches the node, followed by an unrelated confirmed transfer.
		node, lock_path = self._prepare_interrupted_hash_lock_with_later_transfer()

		# Act:
		heights, sync = self._sync_with_connector(node)

		# Assert:
		self.assertEqual(list(range(1, 10)), heights)
		self.assertEqual(('healthy', 9, None, None), (
			sync['status'], sync['last_synced_height'], sync['dirty_state_from_height'], self._recovery()['stop_reason']))
		[(lock,)] = self._fetch_table_state(('symbol_hash_locks',))['symbol_hash_locks']
		self.assertEqual(('unused', 12, HASH_LOCK_AMOUNT), (lock['status'], lock['end_height'], lock['amount']))
		self.assertEqual([transaction_path(7, 9), statement_path(7, 9), lock_path, transaction_path(7, 9), statement_path(7, 9)], [
			path for path in node.paths if path.startswith(('transactions/confirmed?', 'statements/transaction?', 'lock/hash/'))])

	def test_migrated_sync_rejects_uncommitted_transfer_before_repair(self):
		# Arrange: the node reports one H9 transfer, but the block commits to a different leaf.
		node, lock_path = self._prepare_interrupted_hash_lock_with_later_transfer(should_publish_accounts=True)
		database = self.puller.symbol_db
		database.upsert_hash_lock(create_hash_lock_row(node.hash_lock_response(lock_path), 8))
		page = transaction_path(7, 9)
		origin, _ = node.transactions_by_path[page]['data']
		substitute = create_node_transaction(9, deadline='30001')
		_set_block_transactions(create_node_block(9), [substitute])
		node.transactions_by_path[page] = create_transaction_page([origin, substitute])
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()
		self.assertIsNotNone(before.refresh_state['valid_run_id'])
		self.assertTrue(generations['symbol_account_refresh_accounts'])
		self.assertEqual(1, len(before.tables['symbol_hash_locks']))

		# Act:
		with self._use_database(UnexpectedRepairDatabase(database)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Symbol transaction Merkle root does not match block at height 9'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		after = self._recovery()
		self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'restoration_evidence_missing'}, after)
		self.assertEqual([page], [
			path for path in node.paths if path.startswith(('transactions/confirmed?', 'statements/transaction?', 'lock/hash/'))])

	def _prepare_forged_interior_block(self, node):
		honest = node.blocks[8]
		forged = deepcopy(honest)
		foreign = create_node_transaction(9, deadline='49152')
		_set_block_transactions(forged, [foreign])
		origin, transfer = node.transactions_by_path[transaction_path(7, 10)]['data']
		self.assertEqual(honest['meta']['hash'], forged['meta']['hash'])
		self.assertEqual(honest['meta']['hash'], node.blocks[9]['block']['previousBlockHash'])
		self.assertNotEqual(honest['block']['transactionsHash'], forged['block']['transactionsHash'])
		node.evidence_by_height[9] = honest
		return forged, create_transaction_page([origin, foreign]), transfer

	def _prepare_fork_with_transfer(self, connector_type=RecoveryConnector, **transaction_fields):
		self._sync_with_published_account_generation(_chain(6, 4), 1)
		blocks = _chain(10)
		transfer = create_node_transaction(9, deadline='31000', **transaction_fields)
		_set_block_transactions(blocks[8], [transfer])
		_commit_recovery_suffix(blocks, 4)
		request = transaction_path(4, 10)
		node = connector_type(blocks, 1, transactions_by_path={request: create_transaction_page([transfer])})
		forged = deepcopy(blocks[8])
		foreign = create_node_transaction(9, deadline='31001')
		_set_block_transactions(forged, [foreign])
		node.evidence_by_height[9] = blocks[8]
		return node, forged, create_transaction_page([foreign]), transfer

	def _interrupt_matching_dirty_tail(self, blocks):
		self._sync_with_published_account_generation(blocks[:6], 1)
		self._sync_until_interrupted_checkpoint(RecoveryConnector(blocks[:8], 1))
		database = self.puller.symbol_db
		state = database.get_sync_state()
		self.assertEqual((6, 1, 7, None, False), (
			state['last_synced_height'], state['finalized_height'], state['dirty_state_from_height'],
			self._recovery()['resume_height'], self._recovery()['legacy_lock_history']))
		self.assertEqual(list(range(1, 9)), self._fetch_block_heights(database))
		self.assertEqual(bytes.fromhex(blocks[7]['meta']['hash']), bytes(database.get_block_hash(8)))

	def _capture_repair_state_with_generation(self):
		before, generations = self._capture_preserved_state(), self._read_generation_rows()
		recovery = self._recovery()
		self.assertIsNone(recovery['resume_height'])
		self.assertTrue(generations['symbol_account_refresh_accounts'])
		return before, generations, recovery

	def _sync_expecting_rejection_before_repair(self, node, error, *, max_height=None):
		with self.assertRaisesRegex(SymbolRollbackError, error):
			with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
				self._sync_with_connector(node, max_height=max_height)

	def _assert_repair_state_with_generation_preserved(self, saved):
		before, generations, recovery = saved
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual(generations, self._read_generation_rows())
		actual = self._recovery()
		self.assertEqual((recovery['verified_height'], recovery['verified_hash'], None), (
			actual['verified_height'], actual['verified_hash'], actual['resume_height']))

	def _aggregate_transaction_rows(self):
		with self.puller.symbol_db.connection.cursor() as cursor:
			cursor.execute("""
				SELECT to_jsonb(t) - 'id' - 'created_at' - 'updated_at' FROM symbol_transactions AS t WHERE height = 9
				ORDER BY is_embedded, embedded_index
			""")
			return cursor.fetchall()

	def _assert_dirty_replay_matches_forward_aggregate(self, blocks, items):
		database = self.puller.symbol_db
		with self._create_recovery_test_database() as name, self._open_recovery_test_database(name):
			self.puller.symbol_db.create_tables()
			self._sync_with_connector(RecoveryConnector(blocks, 1, transactions_by_path={transaction_path(1, 10): create_transaction_page(items)}))
			expected_rows = self._aggregate_transaction_rows()
			self.assertEqual(len(items), len(expected_rows))

		self._interrupt_matching_dirty_tail(blocks)
		node = RecoveryConnector(blocks, 1, transactions_by_path={transaction_path(7, 10): create_transaction_page(items)})

		# Act:
		heights, state = self._sync_with_connector(node)

		# Assert:
		recovery = database.try_get_fork_recovery_state()
		self.assertEqual((list(range(1, 11)), 'healthy', 10, None, None, None), (
			heights, state['status'], state['last_synced_height'], state['dirty_state_from_height'],
			recovery['resume_height'], recovery['stop_reason']))
		self.assertEqual(expected_rows, self._aggregate_transaction_rows())

	def test_sync_replays_pre_v3_aggregate_with_ambiguous_embedded_count(self):
		for version, messages in (
			(1, ('0041', '0042', '0043')),
			(2, ('0041', '0042', '0043')),
			(2, ('0041', '0042', '0043', '0043'))
		):
			with self.subTest(version=version, embedded_count=len(messages)):
				# Arrange:
				drop_symbol_block_tables_if_present(self.puller.symbol_db)
				self.puller.symbol_db.create_tables()
				blocks = _chain(10)
				items = _create_replay_aggregate(blocks[8], version, messages)
				_commit_recovery_suffix(blocks)

				self._assert_dirty_replay_matches_forward_aggregate(blocks, items)

	def test_sync_replays_v1_aggregate_with_historical_invalid_merkle_root(self):
		# Arrange:
		blocks = _chain(10)
		items = _create_replay_aggregate(blocks[8], 1, ('0041', '0042', '0043'))
		normal_root = items[0]['transaction']['transactionsHash']
		_set_v1_invalid_merkle_root(blocks[8], items)
		self.assertNotEqual(normal_root, items[0]['transaction']['transactionsHash'])
		_commit_recovery_suffix(blocks)

		self._assert_dirty_replay_matches_forward_aggregate(blocks, items)

	def test_sync_keeps_dirty_replay_when_v3_embedded_body_changes_and_recovers_on_retry(self):
		# Arrange: the forged child has the same size and source, and only its body differs.
		blocks = _chain(10)
		items = _create_replay_aggregate(blocks[8], 3, ('0041', '0042', '0043'))
		_commit_recovery_suffix(blocks)
		self._interrupt_matching_dirty_tail(blocks)
		forged = deepcopy(items)
		forged[-1]['transaction']['message'] = '0044'
		path = transaction_path(7, 10)
		node = RecoveryConnector(blocks, 1, transactions_by_path={path: create_transaction_page(forged)})
		wrapper = CaptureRepairCutDatabase(self.puller.symbol_db, self._capture_preserved_state)

		# Act:
		with self._use_database(wrapper), self.assertRaisesRegex(
			EvidenceChanged, '^Symbol transaction commitment failed at height 9: Symbol aggregate transaction Merkle root'
		):
			self._sync_with_connector(node)

		# Assert:
		cut = wrapper.cut
		self.assertIsNotNone(cut)
		self._assert_preserved_state(cut, {**cut.sync_state, 'status': 'unhealthy'})
		self.assertEqual((6, 7, 7, 'reconciliation_wait'), (
			cut.sync_state['last_synced_height'], cut.sync_state['dirty_state_from_height'],
			self._recovery()['resume_height'], self._recovery()['stop_reason']))

		# Act: the next ordinary sync can use the authenticated block and original transaction.
		heights, state = self._sync_with_connector(RecoveryConnector(blocks, 1, transactions_by_path={path: create_transaction_page(items)}))

		# Assert:
		self.assertEqual((list(range(1, 11)), 'healthy', 10, None, None, None), (
			heights, state['status'], state['last_synced_height'], state['dirty_state_from_height'],
			self._recovery()['resume_height'], self._recovery()['stop_reason']))
		self.assertEqual(4, len(self._aggregate_transaction_rows()))

	def _prepare_migrated_ambiguous_aggregate(self, *, should_include_lock):
		node, _ = self._prepare_interrupted_hash_lock_with_later_transfer(should_publish_accounts=True)
		path = transaction_path(7, 9)
		origin = node.transactions_by_path[path]['data'][0]
		items = _create_replay_aggregate(node.blocks[8], 2, ('0041', '0042', '0043'), should_include_lock=should_include_lock)
		_commit_recovery_suffix(node.blocks, 9)
		node.transactions_by_path[path] = create_transaction_page([origin, *items])
		return node

	def test_migrated_sync_preserves_history_when_ambiguous_aggregate_contains_embedded_hash_lock(self):
		# Arrange:
		node = self._prepare_migrated_ambiguous_aggregate(should_include_lock=True)
		before, generations = self._capture_preserved_state(), self._read_generation_rows()
		recovery = self._recovery()

		# Act:
		self._sync_expecting_rejection_before_repair(node, 'Unbound Symbol legacy aggregate contains embedded lock evidence at height 9')

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		after = self._recovery()
		self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'restoration_evidence_missing'}, after)

	def test_migrated_sync_replays_ambiguous_aggregate_without_embedded_lock_evidence(self):
		# Arrange:
		node = self._prepare_migrated_ambiguous_aggregate(should_include_lock=False)

		# Act:
		heights, state = self._sync_with_connector(node)

		# Assert:
		self.assertEqual((list(range(1, 10)), 'healthy', 9, None, None, None), (
			heights, state['status'], state['last_synced_height'], state['dirty_state_from_height'],
			self._recovery()['resume_height'], self._recovery()['stop_reason']))
		self.assertEqual(4, len(self._aggregate_transaction_rows()))

	def _assert_migrated_sync_rejects_unbound_v1_without_embedded_locks(self, set_root, reason):
		# Arrange: the old history extends through H9, and the dirty range begins at H7.
		node, _ = self._prepare_interrupted_hash_lock_with_later_transfer(should_publish_accounts=True)
		path = transaction_path(7, 9)
		origin = node.transactions_by_path[path]['data'][0]
		block = node.blocks[8]
		items = _create_replay_aggregate(block, 1, ('0041', '0042', '0043'))
		set_root(block, items)
		_commit_recovery_suffix(node.blocks, 9)
		node.transactions_by_path[path] = create_transaction_page([origin, *items])
		self._seed_legacy(node.blocks, public_height=6, saved_height=6, dirty=7)
		saved = self._capture_repair_state_with_generation()
		before, _, recovery = saved
		self.assertEqual((True, 9, 7), (
			recovery['legacy_lock_history'], recovery['legacy_history_height'], before.sync_state['dirty_state_from_height']))

		# Act:
		self._sync_expecting_rejection_before_repair(
			node, rf'Unbound Symbol legacy aggregate cannot prove absence of embedded lock evidence at height 9 \({reason}\)$')

		# Assert:
		self._assert_repair_state_with_generation_preserved(saved)
		after = self._recovery()
		self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'restoration_evidence_missing'}, after)
		self.assertEqual([path], [
			request for request in node.paths if request.startswith(('transactions/confirmed?', 'statements/', 'lock/'))])
		self.assertEqual([], node.post_requests)

	def test_migrated_sync_rejects_v1_with_invalid_merkle_builder_before_repair(self):
		self._assert_migrated_sync_rejects_unbound_v1_without_embedded_locks(_set_v1_invalid_merkle_root, 'invalid_merkle_builder')

	def test_migrated_sync_rejects_v1_with_unmatched_root_before_repair(self):
		self._assert_migrated_sync_rejects_unbound_v1_without_embedded_locks(
			partial(_set_v1_aggregate_root, root=bytes(32)), 'unmatched_v1_root')

	def test_sync_preserves_matching_dirty_tail_when_a_later_header_has_a_forged_transaction_root(self):
		# Arrange: H7 and H8 match the persisted dirty tail. Only H9's listing contains a forged root under its original hash.
		blocks = _chain(10)
		honest = create_node_transaction(9, deadline='31000')
		_set_block_transactions(blocks[8], [honest])
		_commit_recovery_suffix(blocks, 7)
		self._interrupt_matching_dirty_tail(blocks)
		forged = deepcopy(blocks[8])
		foreign = create_node_transaction(9, deadline='31001')
		_set_block_transactions(forged, [foreign])
		self.assertEqual(blocks[8]['meta']['hash'], forged['meta']['hash'])
		self.assertNotEqual(blocks[8]['block']['transactionsHash'], forged['block']['transactionsHash'])
		node = RecoveryConnector(
			[*blocks[:8], forged, blocks[9]], 1, evidence_by_height={9: blocks[8]},
			transactions_by_path={transaction_path(7, 10): create_transaction_page([foreign])})
		saved = self._capture_repair_state_with_generation()

		# Act:
		self._sync_expecting_rejection_before_repair(node, 'Symbol block hash does not match reconstructed header')

		# Assert:
		self._assert_repair_state_with_generation_preserved(saved)
		self.assertEqual([], [path for path in node.paths if path.startswith('transactions/confirmed?')])

	def test_sync_preserves_matching_dirty_tail_when_a_receiptless_range_reports_a_statement(self):
		# Arrange: both branches agree through H8, but a receiptless H9 listing advertises an uncommitted statement.
		blocks = _chain(10)
		_commit_recovery_suffix(blocks, 7)
		self._interrupt_matching_dirty_tail(blocks)
		request = statement_path(7, 10)
		node = RecoveryConnector(blocks, 1, statement_pages={request: {'data': [create_amount_statement_item(9, 999)]}})
		self.assertEqual('false', node.network_properties['chain']['enableVerifiableReceipts'])
		self.assertEqual('0' * 64, blocks[8]['block']['receiptsHash'])
		saved = self._capture_repair_state_with_generation()

		# Act:
		self._sync_expecting_rejection_before_repair(node, 'unexpectedly returned statements with verifiable receipts disabled')

		# Assert:
		self._assert_repair_state_with_generation_preserved(saved)
		self.assertEqual([request], [path for path in node.paths if path.startswith('statements/transaction?')])

		# Act: the next invocation receives the original empty response.
		heights, state = self._sync_with_connector(RecoveryConnector(blocks, 1))

		# Assert:
		self.assertEqual((list(range(1, 11)), 'healthy', 10, 1, None, None), (
			heights, state['status'], state['last_synced_height'], state['finalized_height'],
			state['dirty_state_from_height'], self._recovery()['resume_height']))
		self.assertEqual([], self._fetch_table_state(('symbol_receipts',))['symbol_receipts'])

	def test_sync_keeps_matching_dirty_repair_unpublished_when_receipts_change_after_the_cut(self):
		# Arrange: the first response is empty, and only the post-cut response advertises a receipt.
		blocks = _chain(10)
		_commit_recovery_suffix(blocks, 7)
		self._interrupt_matching_dirty_tail(blocks)
		node = RecoveryConnector(blocks, 1)
		request = statement_path(7, 10)
		generations = self._read_generation_rows()

		def change_statement_page():
			node.statement_pages[request] = {'data': [create_amount_statement_item(9, 999)]}

		database = self.puller.symbol_db
		wrapper = ObserveRepairCutDatabase(database, self._capture_preserved_state, after_cut=change_statement_page)

		# Act:
		with self.assertRaisesRegex(EvidenceChanged, '^Receiptless Symbol replacement replay unexpectedly returned statements$'):
			with self._use_database(wrapper):
				self._sync_with_connector(node)

		# Assert: the failed batch wrote no rows and left both markers at the committed cut.
		cut = wrapper.cut
		self.assertIsNotNone(cut)
		self._assert_preserved_state(cut, {**cut.sync_state, 'status': 'unhealthy'})
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual((list(range(1, 7)), 6, 1, 7, 7), (
			self._fetch_block_heights(database), cut.sync_state['last_synced_height'], cut.sync_state['finalized_height'],
			cut.sync_state['dirty_state_from_height'], self._recovery()['resume_height']))
		self.assertEqual([request, request], [path for path in node.paths if path.startswith('statements/transaction?')])

	def test_sync_preserves_orphan_history_when_zero_transaction_counts_contradict_an_authenticated_root(self):
		# Arrange: only metadata claims H9 is empty. The nonzero root is still in the authenticated block header.
		node, _, _, _ = self._prepare_fork_with_transfer()
		node.blocks[8]['meta'].update(transactionsCount=0, totalTransactionsCount=0)
		node.transactions_by_path.pop(transaction_path(4, 10))
		self.assertNotEqual('0' * 64, node.blocks[8]['block']['transactionsHash'])
		saved = self._capture_repair_state_with_generation()

		# Act:
		self._sync_expecting_rejection_before_repair(node, 'Symbol transaction counts contradict block transaction root at height 9')

		# Assert:
		self._assert_repair_state_with_generation_preserved(saved)
		self.assertEqual([], [path for path in node.paths if path.startswith('transactions/confirmed?')])

	def test_sync_preserves_orphan_history_when_closing_finality_conflicts_with_replacement(self):
		# Arrange: F=1 was pinned initially. The closing read advances to a contradictory hash at interior H8.
		node, _, _, _ = self._prepare_fork_with_transfer(partial(ClosingFinalityConnector, closing_height=8, should_conflict=True))
		self.assertNotEqual(node.blocks[7]['meta']['hash'], node.closing_hash)
		saved = self._capture_repair_state_with_generation()

		# Act:
		self._sync_expecting_rejection_before_repair(node, '^Node advanced finalized hash does not match verified Symbol history$')

		# Assert:
		self._assert_repair_state_with_generation_preserved(saved)
		self.assertEqual([(1, node.blocks[0]['meta']['hash']), (8, node.closing_hash)], node.reported_finality[:2])

	def test_sync_preserves_recovery_checkpoint_when_finality_conflicts_after_the_cut(self):
		# Arrange: delay the contradictory F=8 until the cut has committed and keep the replay payload canonical.
		node, _, _, honest = self._prepare_fork_with_transfer()
		contrary = _alternate_finalized_hash(node.blocks, 8)
		self.assertNotEqual(node.blocks[7]['meta']['hash'], contrary)
		database = self.puller.symbol_db
		generations = self._read_generation_rows()

		def advance_finality_after_cut():
			node.paths.clear()
			node.finalized_height = 8
			node.finalized_fields['hash'] = contrary

		wrapper = ObserveRepairCutDatabase(database, self._capture_preserved_state, after_cut=advance_finality_after_cut)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node advanced finalized hash does not match verified Symbol history$'):
			with self._use_database(wrapper):
				self._sync_with_connector(node)

		# Assert: authenticated rows may be durable. The checkpoint, markers and account generation still describe the cut.
		cut, after = wrapper.cut, self._capture_preserved_state()
		self.assertIsNotNone(cut)
		self.assertEqual({**cut.sync_state, 'status': 'unhealthy'}, after.sync_state)
		self.assertEqual(cut.refresh_state, after.refresh_state)
		self.assertEqual((3, 1, 4, 4, 1), (
			after.sync_state['last_synced_height'], after.sync_state['finalized_height'], after.sync_state['dirty_state_from_height'],
			self._recovery()['resume_height'], self._recovery()['verified_height']))
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual(['chain/info'], [path for path in node.paths if path == 'chain/info'])

		# Act: restart against the genuine finality hash and original replay payload.
		self.puller = create_symbol_puller(self.config_ini, 'testnet')
		self.exit_stack.enter_context(self.puller.symbol_db)
		retry = RecoveryConnector(node.blocks, 8, transactions_by_path=node.transactions_by_path)
		heights, state = self._sync_with_connector(retry)

		# Assert:
		self.assertEqual((list(range(1, 11)), 'healthy', 10, 8, None, None), (
			heights, state['status'], state['last_synced_height'], state['finalized_height'],
			state['dirty_state_from_height'], self._recovery()['resume_height']))
		self.assertEqual(bytes.fromhex(node.blocks[7]['meta']['hash']), bytes(state['finalized_hash']))
		rows = self._fetch_table_state(('symbol_transactions',))['symbol_transactions']
		self.assertEqual([(9, '\\x' + honest['meta']['hash'].lower())], [(row['height'], row['hash']) for (row,) in rows])

	def test_sync_publishes_replacement_when_matching_finality_advances_after_the_cut(self):
		# Arrange: F=8 advances after the cut and agrees with the authenticated replacement.
		node, _, _, _ = self._prepare_fork_with_transfer()
		advanced = bytes.fromhex(node.blocks[7]['meta']['hash'])

		def advance_finality_after_cut():
			node.paths.clear()
			node.finalized_height = 8

		wrapper = ObserveRepairCutDatabase(self.puller.symbol_db, self._capture_preserved_state, after_cut=advance_finality_after_cut)

		# Act:
		with self._use_database(wrapper):
			heights, state = self._sync_with_connector(node)

		# Assert: the original checkpoint can commit after reconciling the fresh observation.
		self.assertIsNotNone(wrapper.cut)
		self.assertEqual((list(range(1, 11)), 'healthy', 10, 1, None, None), (
			heights, state['status'], state['last_synced_height'], state['finalized_height'],
			state['dirty_state_from_height'], self._recovery()['resume_height']))
		self.assertEqual(['chain/info'], [path for path in node.paths if path == 'chain/info'])

		# Act: an ordinary invocation now starts with F=8.
		_, state = self._sync_with_connector(RecoveryConnector(node.blocks, 8))

		# Assert:
		self.assertEqual((10, 8, advanced, 8, advanced), (
			state['last_synced_height'], state['finalized_height'], bytes(state['finalized_hash']),
			self._recovery()['verified_height'], self._recovery()['verified_hash']))

	def _assert_replacement_publication_is_deferred(self, change_after_cut, message):
		# Arrange: the change appears after the repair transaction commits.
		node, _, _, _ = self._prepare_fork_with_transfer()
		database = self.puller.symbol_db
		generations = self._read_generation_rows()

		wrapper = ObserveRepairCutDatabase(database, self._capture_preserved_state, after_cut=partial(change_after_cut, node))

		# Act:
		with self.assertRaisesRegex(RecoveryStopped, message):
			with self._use_database(wrapper):
				self._sync_with_connector(node)

		# Assert:
		cut = wrapper.cut
		after = self._capture_preserved_state()
		self.assertEqual({**cut.sync_state, 'status': 'unhealthy'}, after.sync_state)
		self.assertEqual(cut.refresh_state, after.refresh_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual((4, 4, 1, 'reconciliation_wait'), (
			after.sync_state['dirty_state_from_height'], self._recovery()['resume_height'],
			self._recovery()['verified_height'], self._recovery()['stop_reason']))
		self.assertEqual(10, database.get_max_block_height())

	def test_sync_defers_replacement_publication_when_finality_exceeds_the_verified_range(self):
		def advance_finality_after_cut(node):
			higher_block = create_node_block(11, previous_hash=node.blocks[-1]['meta']['hash'])
			extended = [*node.blocks, higher_block]
			_commit_recovery_suffix(extended, 11)
			node.blocks.append(extended[-1])
			node.chain_height = 11
			node.finalized_height = 11

		self._assert_replacement_publication_is_deferred(advance_finality_after_cut, '^Node advanced finality exceeds verified Symbol history$')

	def test_sync_defers_replacement_publication_when_finality_regresses_after_the_cut(self):
		def regress_finality_after_cut(node):
			node.finalized_height = 0

		self._assert_replacement_publication_is_deferred(
			regress_finality_after_cut, '^Node finalized checkpoint changed before Symbol recovery commit$')

	def test_sync_defers_replacement_publication_when_the_tip_falls_below_the_replacement_range(self):
		def lower_tip_after_cut(node):
			node.chain_height = 8

		self._assert_replacement_publication_is_deferred(
			lower_tip_after_cut, '^Node chain tip fell below the authenticated Symbol replacement range$')

	def test_sync_rejects_a_forged_interior_header_before_repairing_a_fork_without_locks(self):
		# Arrange: the H9 listing substitutes both body and root under the original reported hash.
		node, forged, foreign_page, _ = self._prepare_fork_with_transfer()
		node.blocks[8] = forged
		node.transactions_by_path[transaction_path(4, 10)] = foreign_page
		before, generations = self._capture_preserved_state(), self._read_generation_rows()
		self.assertEqual((False, 6), (self._recovery()['legacy_lock_history'], before.sync_state['last_synced_height']))
		self.assertIsNotNone(before.refresh_state['valid_run_id'])

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Symbol block hash does not match reconstructed header'):
			self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual(generations, self._read_generation_rows())
		self.assertIsNone(self._recovery()['resume_height'])
		self.assertEqual([], [path for path in node.paths if path.startswith(('transactions/', 'statements/', 'lock/hash/'))])

	def test_sync_preserves_the_repair_cut_when_a_lock_free_fork_refetches_a_forged_header(self):
		# Arrange: substitute the interior header only after the H4 repair transaction commits.
		node, forged, foreign_page, honest = self._prepare_fork_with_transfer()
		request = transaction_path(4, 10)

		def replace_interior_block():
			node.blocks[8] = forged
			node.transactions_by_path[request] = foreign_page

		database = self.puller.symbol_db
		wrapper = ObserveRepairCutDatabase(database, self._capture_preserved_state, after_cut=replace_interior_block)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Symbol block hash does not match reconstructed header'):
			with self._use_database(wrapper):
				self._sync_with_connector(node)

		# Assert:
		cut = wrapper.cut
		self.assertIsNotNone(cut)
		self._assert_preserved_state(cut, {**cut.sync_state, 'status': 'unhealthy'})
		self.assertEqual(list(range(1, 4)), self._fetch_block_heights(database))
		self.assertEqual((3, 4, 4), (
			cut.sync_state['last_synced_height'], cut.sync_state['dirty_state_from_height'], self._recovery()['resume_height']))

		# Act:
		node.blocks[8] = node.evidence_by_height[9]
		node.transactions_by_path[request] = create_transaction_page([honest])
		self.puller = create_symbol_puller(self.config_ini, 'testnet')
		self.exit_stack.enter_context(self.puller.symbol_db)
		heights, sync = self._sync_with_connector(node)

		# Assert:
		self.assertEqual((list(range(1, 11)), 'healthy', 10, None, None), (
			heights, sync['status'], sync['last_synced_height'], sync['dirty_state_from_height'], self._recovery()['resume_height']))
		rows = self._fetch_table_state(('symbol_transactions',))['symbol_transactions']
		self.assertEqual([(9, '\\x' + honest['meta']['hash'].lower())], [(row['height'], row['hash']) for (row,) in rows])

	def test_sync_preserves_history_when_a_receiptless_fork_reports_a_statement_during_preflight(self):
		# Arrange: a valid zero-root replacement is advertised with a nonempty transaction statement page.
		node, _, _, _ = self._prepare_fork_with_transfer()
		request = statement_path(4, 10)
		node.statement_pages[request] = {'data': [create_amount_statement_item(9, 999)]}
		before, generations = self._capture_preserved_state(), self._read_generation_rows()

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'unexpectedly returned statements with verifiable receipts disabled'):
			with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual([request], [path for path in node.paths if path.startswith(('transactions/', 'statements/'))])

	def test_sync_keeps_the_cut_when_a_receiptless_replacement_refetches_a_malformed_statement_page(self):
		# Arrange: preflight receives an empty statement page. After the cut, the same request returns a non-array.
		node, _, _, _ = self._prepare_fork_with_transfer()
		request = statement_path(4, 10)

		def change_statement_page():
			node.statement_pages[request] = {'data': None}

		wrapper = ObserveRepairCutDatabase(self.puller.symbol_db, self._capture_preserved_state, after_cut=change_statement_page)

		# Act:
		with self.assertRaisesRegex(EvidenceChanged, '^Malformed Symbol statement page response$'):
			with self._use_database(wrapper):
				self._sync_with_connector(node)

		# Assert:
		cut = wrapper.cut
		self.assertIsNotNone(cut)
		self._assert_preserved_state(cut, {**cut.sync_state, 'status': 'unhealthy'})
		self.assertEqual((4, 4), (cut.sync_state['dirty_state_from_height'], self._recovery()['resume_height']))
		self.assertEqual([request, request], [path for path in node.paths if path.startswith('statements/transaction?')])

	def test_sync_keeps_dirty_repair_pending_when_the_node_returns_a_different_parent_at_the_cut(self):
		# Arrange: stored history ends at H3, but H4's individual response does not link to it.
		blocks = _chain(4, seal_from=4)
		self._sync_with_connector(RecoveryConnector(blocks[:3], 1))
		database = self.puller.symbol_db
		database.mark_sync_write_intent(4)
		before = self._capture_preserved_state()
		block = deepcopy(blocks[3])
		block['block']['previousBlockHash'] = 'AC' * 32
		block = commit_node_block(block)
		node = RecoveryConnector(blocks, 1, evidence_by_height={4: block})

		# Act:
		with self.assertRaisesRegex(EvidenceChanged, '^Pinned Symbol reconciliation evidence changed$'):
			with self._use_database(UnexpectedRepairDatabase(database)):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual((1, None), (self._recovery()['invalidations'], self._recovery()['resume_height']))
		self.assertEqual(['blocks/3', 'blocks/4'], node.paths[-2:])

	def test_sync_rejects_replacement_headers_disagreeing_with_the_comparison_tip(self):
		# Arrange: H6 was pinned by comparison. A second valid listing changes H6 and its descendants.
		page = 'blocks?pageSize=100&offset=3&orderBy=height'

		class AlternateProofPageConnector(RecoveryConnector):
			"""Switches to an otherwise coherent page after fork comparison."""

			async def get(self, url_path, *args):
				response = await super().get(url_path, *args)
				if url_path == page and self.paths.count(page) == 2:
					return {'data': alternate[3:]}

				return response

		node, _, _, _ = self._prepare_fork_with_transfer(AlternateProofPageConnector)
		alternate = deepcopy(node.blocks)
		alternate[5]['block']['timestamp'] = '6001'
		_commit_recovery_suffix(alternate, 6)
		before = self._capture_preserved_state()

		# Act:
		with self.assertRaisesRegex(EvidenceChanged, '^Authenticated Symbol replacement disagrees with a reconciliation boundary$'):
			with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual((1, None), (self._recovery()['invalidations'], self._recovery()['resume_height']))
		self.assertEqual([page, page], [path for path in node.paths if path == page])

	def test_sync_defers_repair_when_the_latest_tip_is_inside_the_authenticated_replacement(self):
		# Arrange: the tip retreats to H9, so it still reaches the H4 fork while excluding a proven header.
		initial, _, _, _ = self._prepare_fork_with_transfer()
		node = SwitchingRepairViewConnector(initial.blocks, 1, initial.blocks[:9])
		before, generations = self._capture_preserved_state(), self._read_generation_rows()

		# Act:
		with self.assertRaisesRegex(EvidenceChanged, '^Node chain tip fell below the authenticated Symbol replacement range$'):
			with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual([10, 9], [height for height, _ in node.chain_views])

	def test_sync_rejects_an_uncommitted_mosaic_resolution_in_a_receiptless_replacement(self):
		# Arrange: the transfer is committed, but its resolution has no authenticated receipt root.
		alias = 'E74B99BA41F4AFEE'
		node, _, _, _ = self._prepare_fork_with_transfer(mosaics=[{'id': alias, 'amount': '20'}])
		node.mosaic_resolutions_by_height[9] = [create_resolution_statement(9, alias, [
			{'source': {'primaryId': 1, 'secondaryId': 0}, 'resolved': NATIVE_MOSAIC_ID}
		])]
		wrapper = ObserveRepairCutDatabase(self.puller.symbol_db, self._capture_preserved_state)

		# Act:
		with self.assertRaisesRegex(ValueError, 'Missing Symbol mosaic resolution'):
			with self._use_database(wrapper):
				self._sync_with_connector(node)

		# Assert:
		cut = wrapper.cut
		self.assertIsNotNone(cut)
		self._assert_preserved_state(cut, {**cut.sync_state, 'status': 'unhealthy'})
		self.assertEqual((3, 4, 4), (
			cut.sync_state['last_synced_height'], cut.sync_state['dirty_state_from_height'], self._recovery()['resume_height']))
		self.assertEqual([], [request for request in node.paths if request.startswith('statements/resolutions/')])

	def test_sync_rejects_changed_replacement_proof_when_retrying_a_committed_cut_with_a_cap(self):  # pylint: disable=too-many-locals
		# Arrange: H4's cut is committed, and the original proof covers the uncapped range through H10.
		node, _, _, honest = self._prepare_fork_with_transfer()
		database = self.puller.symbol_db
		with self.assertRaisesRegex(RuntimeError, '^resumed write failed$'):
			with self._use_database(FailingWriteDatabase(database)):
				self._sync_with_connector(node)

		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()
		committed = deepcopy(recovery['progress']['replacement_proof'])
		self.assertEqual((3, 4, 4), (
			before.sync_state['last_synced_height'], before.sync_state['dirty_state_from_height'], recovery['resume_height']))
		self.assertEqual(10, committed['height'])
		changed_blocks = deepcopy(node.blocks)
		changed_blocks[7]['block']['timestamp'] = '8001'
		_commit_recovery_suffix(changed_blocks, 8)

		# Act: the cap misses the committed resume point entirely.
		with self.assertRaisesRegex(SymbolRollbackError, '^Symbol repair awaits block 4$'):
			with self._use_database(UnexpectedRepairDatabase(database)):
				self._sync_with_connector(RecoveryConnector(changed_blocks, 1), max_height=3)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		after = self._recovery()
		self.assertEqual((4, 0, 'resume_wait', committed), (
			after['resume_height'], after['invalidations'], after['stop_reason'], (after['progress'] or {}).get('replacement_proof')))
		self.assertEqual(generations, self._read_generation_rows())

		# Act: this capped cut has matching evidence, but its subsequent write still fails.
		with self.assertRaisesRegex(RuntimeError, '^resumed write failed$'):
			with self._use_database(FailingWriteDatabase(database)):
				self._sync_with_connector(RecoveryConnector(node.blocks, 1), max_height=7)

		# Assert: the failed narrower write did not replace the original H10 pin.
		before = before._replace(sync_state={**before.sync_state, 'chain_height': 7})
		self._assert_preserved_state(before, before.sync_state)
		after = self._recovery()
		self.assertEqual((4, 0, committed), (
			after['resume_height'], after['invalidations'], after['progress']['replacement_proof']))
		self.assertEqual(generations, self._read_generation_rows())

		for invalidations, cap in enumerate((9, 8), start=1):
			with self.subTest(cap=cap):
				# Arrange: reopen the Puller so each narrower attempt uses only the durable proof.
				self.puller = create_symbol_puller(self.config_ini, 'testnet')
				self.exit_stack.enter_context(self.puller.symbol_db)
				changed = RecoveryConnector(
					changed_blocks, 1, transactions_by_path={transaction_path(4, 9): create_transaction_page([honest])})

				# Act: H8's valid new hash conflicts with the committed proof in both requested ranges.
				with self.assertRaisesRegex(EvidenceChanged, '^Authenticated Symbol replacement evidence changed after repair$'):
					with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
						self._sync_with_connector(changed, max_height=cap)

				# Assert:
				self._assert_preserved_state(before, before.sync_state)
				after = self._recovery()
				self.assertEqual((4, invalidations, 'reconciliation_wait', {'replacement_proof': committed}), (
					after['resume_height'], after['invalidations'], after['stop_reason'], after['progress']))
				self.assertEqual(generations, self._read_generation_rows())

		# Act: the original authenticated branch can still complete after both invalidations.
		retry = RecoveryConnector(node.blocks, 1, transactions_by_path=node.transactions_by_path)
		heights, state = self._sync_with_connector(retry)

		# Assert:
		self.assertEqual((list(range(1, 11)), 'healthy', 10, 1, None), (
			heights, state['status'], state['last_synced_height'], state['finalized_height'], state['dirty_state_from_height']))
		after = self._recovery()
		self.assertEqual((None, 0, None, None), (after['resume_height'], after['invalidations'], after['stop_reason'], after['progress']))
		rows = self._fetch_table_state(('symbol_transactions',))['symbol_transactions']
		self.assertEqual([(9, '\\x' + honest['meta']['hash'].lower())], [(row['height'], row['hash']) for (row,) in rows])

	def test_migrated_sync_rejects_forged_interior_block_commitment_before_repair(self):
		# Arrange: block 9's page root matches a foreign transfer, under the same hash and honest successor.
		node, _ = self._prepare_interrupted_hash_lock_with_later_transfer(should_publish_accounts=True, tip_height=10)
		forged, page, _ = self._prepare_forged_interior_block(node)
		node.blocks[8] = forged
		node.transactions_by_path[transaction_path(7, 10)] = page
		before, generations = self._capture_preserved_state(), self._read_generation_rows()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Symbol block hash does not match reconstructed header'):
				self._sync_with_connector(node)

		# Assert: a page header fails authentication before any dependent requests or durable repair.
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual(('restoration_evidence_missing', None), (self._recovery()['stop_reason'], self._recovery()['resume_height']))
		self.assertEqual([], [
			path for path in node.paths if path == 'blocks/9' or path.startswith(('transactions/', 'statements/', 'lock/hash/'))])

	def test_migrated_sync_rejects_zero_transaction_counts_for_nonempty_transaction_root(self):
		# Arrange: H9 keeps its authenticated root, but the metadata and the transaction page omit its transfer.
		node, _ = self._prepare_interrupted_hash_lock_with_later_transfer(should_publish_accounts=True)
		request = transaction_path(7, 9)
		origin, _ = node.transactions_by_path[request]['data']
		node.transactions_by_path[request] = create_transaction_page([origin])
		node.blocks[8]['meta'].update(transactionsCount=0, totalTransactionsCount=0)
		before, generations = self._capture_preserved_state(), self._read_generation_rows()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Symbol transaction counts contradict block transaction root at height 9'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual(('restoration_evidence_missing', None), (self._recovery()['stop_reason'], self._recovery()['resume_height']))
		self.assertEqual([], [
			path for path in node.paths if path.startswith(('transactions/', 'statements/', 'lock/hash/'))])

	def test_migrated_sync_rejects_forged_interior_block_commitment_during_forward_replay(self):  # pylint: disable=too-many-locals
		# Arrange: preflight sees the honest branch. After repair, the writer is offered the forged block and transfer.
		block_path = 'blocks?pageSize=100&offset=6&orderBy=height'
		transactions_path = transaction_path(7, 10)

		class ForgedReplayConnector(RecoveryConnector):
			"""Returns the forged evidence only for the initial forward replay."""

			async def get(self, url_path, *args):
				response = await super().get(url_path, *args)
				if url_path == block_path and self.paths.count(block_path) == 3:
					items = list(response['data'])
					items[2] = forged
					return {**response, 'data': items}

				if url_path == transactions_path and self.paths.count(block_path) == 3:
					return foreign_page

				return response

		node, lock_path = self._prepare_interrupted_hash_lock_with_later_transfer(ForgedReplayConnector, tip_height=10)
		forged, foreign_page, transfer = self._prepare_forged_interior_block(node)
		wrapper = CaptureRepairCutDatabase(self.puller.symbol_db, self._capture_preserved_state)

		# Act:
		with self._use_database(wrapper):
			with self.assertRaisesRegex(EvidenceChanged, 'Symbol block hash does not match reconstructed header'):
				self._sync_with_connector(node)

		# Assert: the committed repair cut survives without any forward artifacts or checkpoint publication.
		cut = wrapper.cut
		self.assertIsNotNone(cut)
		self._assert_preserved_state(cut, {**cut.sync_state, 'status': 'unhealthy'})
		self.assertEqual(list(range(1, 7)), self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual((6, 7, 7, 'reconciliation_wait'), (
			cut.sync_state['last_synced_height'], cut.sync_state['dirty_state_from_height'],
			self._recovery()['resume_height'], self._recovery()['stop_reason']))
		self.assertEqual([transactions_path, statement_path(7, 10), resolution_path('address', 7), resolution_path('mosaic', 7), lock_path], [
			path for path in node.paths if path.startswith(('transactions/', 'statements/', 'lock/hash/'))])

		# Act: a later run receives the honest forward header and original transfer.
		heights, sync = self._sync_with_connector(node)

		# Assert:
		self.assertEqual((list(range(1, 11)), 'healthy', None, None), (
			heights, sync['status'], sync['dirty_state_from_height'], self._recovery()['resume_height']))
		rows = self._fetch_table_state(('symbol_transactions',))['symbol_transactions']
		self.assertEqual(['\\x' + transfer['meta']['hash'].lower()], [row['hash'] for (row,) in rows if row['height'] == 9])

	def _interrupt_migrated_hash_lock_transaction_download(self):
		# Arrange: 101 H9 transfers arrive in descending index order across two transaction pages.
		node, lock_path = self._prepare_interrupted_hash_lock_with_later_transfer()
		lock = node.transactions_by_path[transaction_path(7, 8)]['data'][0]
		transfers = [create_node_transaction(9, block_index=index, deadline=str(30000 + index)) for index in range(101)]
		_set_block_transactions(node.blocks[-1], transfers)
		_commit_recovery_suffix(node.blocks, 9)
		items = [lock, *reversed(transfers)]
		first, second = transaction_path(7, 9), transaction_path(7, 9, 2)
		node.transactions_by_path[first] = create_transaction_page(items[:100])
		node.transactions_by_path[second] = NodeException('second lock proof transaction page unavailable')
		before = self._capture_preserved_state()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(NodeException, 'second lock proof transaction page unavailable'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		download = self._recovery()['progress']['hash_lock_scan']['download']
		self.assertEqual((9, 100), (download['end'], len(download['transactions'])))
		self.assertEqual([first, second, second, second], [
			path for path in node.paths if path.startswith(('transactions/confirmed?', 'lock/hash/'))])

		return node, lock_path, items

	def test_migrated_sync_resumes_an_interrupted_transaction_page_during_lock_proof(self):
		# Arrange:
		node, lock_path, items = self._interrupt_migrated_hash_lock_transaction_download()
		first, second = transaction_path(7, 9), transaction_path(7, 9, 2)

		# Act:
		node.paths.clear()
		node.transactions_by_path[second] = create_transaction_page(items[100:], page_number=2)
		heights, state = self._sync_with_connector(node)

		# Assert: the restart reads page two for proof, and both pages once for the actual replay.
		self.assertEqual([second, lock_path, first, second], [
			path for path in node.paths if path.startswith(('transactions/confirmed?', 'lock/hash/'))])
		self.assertEqual((9, 'healthy', None), (heights[-1], state['status'], self._recovery()['stop_reason']))

	def test_migrated_sync_rejects_cached_transaction_page_when_an_interior_root_changes(self):
		# Arrange: keep all block hashes and the pending page endpoint intact, but substitute H7's root.
		node, _, _ = self._interrupt_migrated_hash_lock_transaction_download()
		before = self._capture_preserved_state()
		node.blocks[6]['block']['transactionsHash'] = 'AC' * 32
		node.paths.clear()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Pinned Symbol reconciliation evidence changed'):
				self._sync_with_connector(node)

		# Assert: the stale transaction page cannot be reused to authorize repair.
		self._assert_preserved_state(before, before.sync_state)
		recovery = self._recovery()
		self.assertEqual((None, 1, 'reconciliation_wait'), (recovery['progress'], recovery['invalidations'], recovery['stop_reason']))
		self.assertEqual([], [path for path in node.paths if path.startswith(('transactions/confirmed?', 'lock/hash/'))])

	def test_migrated_sync_invalidates_cached_transaction_page_when_reported_count_changes(self):
		# Arrange: a retry sees the same authenticated headers but a new uncommitted H9 transaction count.
		node, _, _ = self._interrupt_migrated_hash_lock_transaction_download()
		node.blocks[8]['meta'].update(transactionsCount=102, totalTransactionsCount=102)
		node.paths.clear()
		before = self._capture_preserved_state()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Pinned Symbol reconciliation evidence changed'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		recovery = self._recovery()
		self.assertEqual((None, 1, 'reconciliation_wait'), (recovery['progress'], recovery['invalidations'], recovery['stop_reason']))
		self.assertEqual([], [path for path in node.paths if path.startswith(('transactions/confirmed?', 'lock/hash/'))])

	def test_migrated_sync_resumes_an_interrupted_statement_page_during_lock_proof(self):
		# Arrange: a creation receipt and the following block rewards span the statement page boundary.
		class InterruptedStatementConnector(RecoveryConnector):
			"""Fails the later statement page while the first has already been fetched."""

			def __init__(self, *args, **kwargs):
				super().__init__(*args, **kwargs)
				self.second_page_available = False

			async def get(self, url_path, *args):
				if url_path == statement_path(7, 106, 2) and not self.second_page_available:
					self.paths.append(url_path)
					raise NodeException('second lock proof statement page unavailable')

				return await super().get(url_path, *args)

		interrupted, lock_path, _ = self._interrupt_migrated_hash_lock_batch()
		blocks = [*interrupted.blocks, *_chain(106)[8:]]
		first, second = statement_path(7, 106), statement_path(7, 106, 2)
		created = interrupted.statement_pages[statement_path(7, 8)]['data'][0]
		statements = [created, *[create_amount_statement_item(height, 1) for height in range(8, 107)]]
		_commit_recovery_suffix(blocks, 8, statements=statements[1:])
		node = InterruptedStatementConnector(
			blocks, 6, statement_pages={first: {'data': statements}},
			transactions_by_path={transaction_path(7, 106): interrupted.transactions_by_path[transaction_path(7, 8)]},
			hash_lock_responses={lock_path: interrupted.hash_lock_response(lock_path)})
		before = self._capture_preserved_state()
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 250))
		self.exit_stack.enter_context(self.puller.symbol_db)

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(NodeException, 'second lock proof statement page unavailable'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		download = self._recovery()['progress']['hash_lock_scan']['download']
		self.assertEqual((106, 100), (download['end'], len(download['statements'])))
		self.assertEqual([first, second, second, second], [
			path for path in node.paths if path.startswith(('statements/transaction?', 'lock/hash/'))])

		# Act:
		node.paths.clear()
		node.second_page_available = True
		heights, state = self._sync_with_connector(node)

		# Assert:
		self.assertEqual([second, lock_path, first, second], [
			path for path in node.paths if path.startswith(('statements/transaction?', 'lock/hash/'))])
		self.assertEqual((106, 'healthy', None), (heights[-1], state['status'], self._recovery()['stop_reason']))

	def test_migrated_sync_keeps_replay_unpublished_between_write_batches(self):
		# Arrange: the lock creation fits in the first write batch; the following transfer is fetched separately.
		class InterruptedReplayConnector(RecoveryConnector):
			"""Fails only the second replay batch after preflight and the first successful write."""

			async def get(self, url_path, *args):
				if url_path == transaction_path(9, 9):
					self.paths.append(url_path)
					raise NodeException('second replay batch unavailable')

				return await super().get(url_path, *args)

		node, lock_path = self._prepare_interrupted_hash_lock_with_later_transfer(InterruptedReplayConnector)
		self.puller = create_symbol_puller(self.config_ini, 'testnet', max_transactions_per_batch=1)
		database = self.exit_stack.enter_context(self.puller.symbol_db)

		# Act:
		with self.assertRaisesRegex(NodeException, 'second replay batch unavailable'):
			self._sync_with_connector(node)

		# Assert: writing H7–8 did not change the public checkpoint or release the replay gate.
		self.assertEqual(list(range(1, 9)), self._fetch_block_heights(database))
		state, recovery = database.get_sync_state(), self._recovery()
		self.assertEqual((6, 7, 7), (state['last_synced_height'], state['dirty_state_from_height'], recovery['resume_height']))
		self.assertNotEqual('healthy', state['status'])
		self.assertEqual([], self._fetch_table_state(('symbol_hash_locks',))['symbol_hash_locks'])

		# Act: begin again from the retained cut and commit both replay batches.
		resumed = RecoveryConnector(
			node.blocks, 6, transactions_by_path=node.transactions_by_path, statement_pages=node.statement_pages,
			hash_lock_responses={lock_path: node.hash_lock_response(lock_path)})
		heights, state = self._sync_with_connector(resumed)

		# Assert:
		self.assertEqual((9, 'healthy', None, None), (
			heights[-1], state['status'], state['dirty_state_from_height'], self._recovery()['resume_height']))
		[(lock,)] = self._fetch_table_state(('symbol_hash_locks',))['symbol_hash_locks']
		self.assertEqual(('unused', 12, 9), (lock['status'], lock['end_height'], lock['updated_at_height']))

	def _assert_migrated_sync_preserves_repair_marker_after_changed_replay(self, path, change, message, *, occurrence=2, prepare=None):
		# Arrange: the node changes one response after the preflight has already used it.
		class ChangedReplayConnector(RecoveryConnector):
			"""Replaces the preflight response only when the forward writer refetches it."""

			async def get(self, url_path, *args):
				result = await super().get(url_path, *args)
				if url_path == path and self.paths.count(path) == occurrence:
					return change(result)

				return result

		node, lock_path = self._prepare_interrupted_hash_lock_with_later_transfer(ChangedReplayConnector)
		if prepare:
			prepare(node)

		database = self.puller.symbol_db
		wrapper = CaptureRepairCutDatabase(database, self._capture_preserved_state)

		# Act:
		with self._use_database(wrapper):
			with self.assertRaisesRegex(EvidenceChanged, message):
				self._sync_with_connector(node)

		# Assert: all batch tables and checkpoints remain at the committed cut.
		cut = wrapper.cut
		self.assertIsNotNone(cut)
		self._assert_preserved_state(cut, {**cut.sync_state, 'status': 'unhealthy'})
		self.assertEqual(list(range(1, 7)), self._fetch_block_heights(database))
		self.assertEqual([], cut.tables['symbol_hash_locks'])
		recovery = self._recovery()
		self.assertEqual((6, 7, 7, 'reconciliation_wait'), (
			cut.sync_state['last_synced_height'], cut.sync_state['dirty_state_from_height'], recovery['resume_height'], recovery['stop_reason']))
		self.assertEqual(occurrence, node.paths.count(path))
		expected = [transaction_path(7, 9), statement_path(7, 9), lock_path]
		if path.startswith('statements/transaction?'):
			expected.extend((transaction_path(7, 9), statement_path(7, 9)))
		elif path.startswith('transactions/confirmed?'):
			expected.append(transaction_path(7, 9))

		self.assertEqual(expected, [
			request for request in node.paths if request.startswith(('transactions/confirmed?', 'statements/transaction?', 'lock/hash/'))])

	def test_migrated_sync_preserves_repair_marker_when_replay_lock_events_change(self):
		def change(response):
			origin, *other = response['data']
			updated = {**origin, 'transaction': {**origin['transaction'], 'duration': '6'}}
			return {**response, 'data': [updated, *other]}

		self._assert_migrated_sync_preserves_repair_marker_after_changed_replay(
			transaction_path(7, 9), change, 'Symbol transaction hash does not match reconstructed body')

	def test_migrated_sync_preserves_repair_marker_when_replay_transfer_changes(self):
		def change(response):
			origin, transfer = response['data']
			updated = {**transfer, 'transaction': {**transfer['transaction'], 'deadline': '30001'}}
			return {**response, 'data': [origin, updated]}

		self._assert_migrated_sync_preserves_repair_marker_after_changed_replay(
			transaction_path(7, 9), change, 'Symbol transaction hash does not match reconstructed body')

	def test_migrated_sync_preserves_repair_marker_when_replay_intermediate_root_changes(self):
		def change(response):
			first, *later = response['data']
			updated = {**first, 'block': {**first['block'], 'transactionsHash': 'EF' * 32}}
			return {**response, 'data': [updated, *later]}

		self._assert_migrated_sync_preserves_repair_marker_after_changed_replay(
			'blocks?pageSize=100&offset=6&orderBy=height', change,
			'Symbol block hash does not match reconstructed header', occurrence=3)

	def test_migrated_sync_preserves_repair_marker_when_replay_target_hash_changes(self):
		def change(response):
			*other, last = response['data']
			updated = {**last, 'meta': {**last['meta']}, 'block': {**last['block'], 'signature': 'AC' * 64}}
			return {**response, 'data': [*other, commit_node_block(updated)]}

		self._assert_migrated_sync_preserves_repair_marker_after_changed_replay(
			'blocks?pageSize=100&offset=6&orderBy=height', change, 'Symbol Hash Lock replay reached a different checkpoint block', occurrence=3)

	def _prepare_replay_with_later_hash_lock_completion(self):
		first_node, lock_path, owner, restored = self._interrupt_migrated_aggregate_bonded_batch(should_write_completion=True)
		later = create_node_block(9)
		completions, receipts = self._create_bonded_lock_completion(owner.bytes.hex().upper(), False, height=9)
		_set_block_transactions(later, completions)
		blocks = [*first_node.blocks, later]
		_commit_recovery_suffix(blocks, 9, statements=receipts)
		node = RecoveryConnector(
			blocks, 6,
			transactions_by_path={transaction_path(7, 9): create_transaction_page(completions)},
			statement_pages={statement_path(7, 9): {'data': receipts}},
			hash_lock_responses={lock_path: {**restored, 'lock': {**restored['lock'], 'status': 1}}})

		return node

	def test_migrated_sync_replays_canonical_completion_after_restoring_prior_hash_lock(self):
		# Arrange: the replacement branch completes the retained lock at H9.
		node = self._prepare_replay_with_later_hash_lock_completion()

		# Act: stop after repair commits, before replay writes the completion.
		with self._use_database(FailingWriteDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(RuntimeError, '^resumed write failed$'):
				self._sync_with_connector(node)

		# Assert: the repair did not publish the future use observed by the node.
		[(retained,)] = self._fetch_table_state(('symbol_hash_locks',))['symbol_hash_locks']
		self.assertEqual(('unused', 12, 6), (retained['status'], retained['end_height'], retained['updated_at_height']))
		self.assertEqual((7, 'resume_wait'), (self._recovery()['resume_height'], self._recovery()['stop_reason']))

		# Act:
		heights, sync = self._sync_with_connector(node)

		# Assert:
		self.assertEqual((list(range(1, 10)), 'healthy', None), (heights, sync['status'], self._recovery()['resume_height']))
		[(completed,)] = self._fetch_table_state(('symbol_hash_locks',))['symbol_hash_locks']
		self.assertEqual(('used', 12, 9, retained['owner_address']), (
			completed['status'], completed['end_height'], completed['updated_at_height'], completed['owner_address']))

	def test_migrated_sync_accepts_pruned_used_hash_lock_without_an_expiry_receipt(self):
		# Arrange: H9 completes the retained lock and finalization reaches its end height H12.
		replacement = self._prepare_replay_with_later_hash_lock_completion()
		blocks = [*replacement.blocks, *_chain(13)[9:]]
		_commit_recovery_suffix(blocks, 10)
		node = RecoveryConnector(
			blocks, 12, finalized_fields={'hash': blocks[11]['meta']['hash']},
			transactions_by_path={transaction_path(7, 13): replacement.transactions_by_path[transaction_path(7, 9)]},
			statement_pages={statement_path(7, 13): replacement.statement_pages[statement_path(7, 9)]})
		completion, _ = replacement.transactions_by_path[transaction_path(7, 9)]['data']
		lock_path = f"lock/hash/{completion['meta']['hash']}"

		# Act:
		heights, sync = self._sync_with_connector(node)

		# Assert:
		self.assertEqual((13, 'healthy', 12, None, None), (
			heights[-1], sync['status'], sync['finalized_height'], sync['dirty_state_from_height'], self._recovery()['resume_height']))
		stored = self._fetch_table_state(('symbol_hash_locks', 'symbol_receipts'))
		self.assertEqual([], stored['symbol_hash_locks'])
		self.assertEqual([(5, 'lockHashCreated'), (9, 'lockHashCompleted')], sorted(
			(row['height'], row['receipt_type']) for (row,) in stored['symbol_receipts']))
		self.assertEqual([lock_path], [request for request in node.paths if request.startswith('lock/hash/')])

	def test_migrated_sync_preserves_hash_lock_repair_when_cap_excludes_completion(self):
		# Arrange: the repair committed its H6 baseline and must still replay a completion at H9.
		node = self._prepare_replay_with_later_hash_lock_completion()
		database = self.puller.symbol_db
		with self._use_database(FailingWriteDatabase(database)):
			with self.assertRaisesRegex(RuntimeError, '^resumed write failed$'):
				self._sync_with_connector(node)

		before = self._capture_preserved_state()
		self.assertEqual(7, self._recovery()['resume_height'])

		# Act:
		with self._use_database(UnexpectedRepairDatabase(database)):
			with self.assertRaisesRegex(SymbolRollbackError, 'max_height excludes a verified Symbol Hash Lock replay event'):
				self._sync_with_connector(node, max_height=8)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual((7, 'cap_blocks_dirty_repair'), (self._recovery()['resume_height'], self._recovery()['stop_reason']))

	def test_migrated_sync_rejects_invalid_lock_proof_transaction_sources(self):
		cases = (
			(0, 'Duplicate Symbol transaction source in Hash Lock replay'),
			(2, 'Non-contiguous Symbol transaction sources at height 9'),
			('1', 'Invalid Symbol transaction source at height 9'),
			(True, 'Invalid Symbol transaction source at height 9')
		)
		for index, message in cases:
			with self.subTest(index=index):
				# Arrange: retain the two committed leaves but change the index of the second transaction.
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				node, _ = self._prepare_interrupted_hash_lock_with_later_transfer()
				page = transaction_path(7, 9)
				origin, transfer = node.transactions_by_path[page]['data']
				second = create_node_transaction(9, block_index=1, deadline='30001')
				_set_block_transactions(node.blocks[-1], [transfer, second])
				_commit_recovery_suffix(node.blocks, 9)
				invalid = {**second, 'meta': {**second['meta'], 'index': index}}
				node.transactions_by_path[page] = create_transaction_page([origin, transfer, invalid])
				before = self._capture_preserved_state()

				# Act:
				with self._use_database(UnexpectedRepairDatabase(database)):
					with self.assertRaisesRegex(SymbolRollbackError, 'unverified transaction range on the replacement branch') as caught:
						self._sync_with_connector(node)

				# Assert:
				self.assertEqual(message, str(caught.exception.__cause__))
				self.assertEqual([page], [
					request for request in node.paths if request.startswith(('transactions/confirmed?', 'statements/transaction?', 'lock/hash/'))])
				self._assert_preserved_state(before, before.sync_state)
				self.assertEqual('restoration_evidence_missing', self._recovery()['stop_reason'])

	def test_migrated_sync_resumes_lock_proof_when_node_adds_transfer_during_repair(self):
		# Arrange: the fresh chain info first advertises H9 after the H8 proof and lock lookup.
		node, lock_path = self._prepare_interrupted_hash_lock_with_later_transfer(LockRepairTipGrowthConnector)
		node.chain_height = 8
		before = self._capture_preserved_state()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Node chain grew beyond the verified Symbol Hash Lock state range'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(0, self._recovery()['invalidations'])
		self.assertEqual(8, self._recovery()['progress']['hash_lock_scan']['height'])

		# Act:
		self._sync_with_connector(node)

		# Assert: verification resumes with H9, while write replay covers the entire dirty range.
		self.assertEqual([transaction_path(7, 8), lock_path, transaction_path(9, 9), lock_path, transaction_path(7, 9)], [
			path for path in node.paths if path.startswith(('transactions/confirmed?', 'lock/hash/'))])
		self.assertIsNone(self._recovery()['stop_reason'])
		self.assertEqual(('healthy', 9), tuple(self.puller.symbol_db.get_sync_state()[key] for key in ('status', 'last_synced_height')))

	@staticmethod
	def _create_bonded_lock_origin(height, owner_public_key, lock, block_index=0, *, mosaic_alias=None):
		transaction = create_node_transaction(
			height, block_index=block_index, type=TransactionType.HASH_LOCK.value, signerPublicKey=owner_public_key, deadline='30000',
			hash=lock['hash'], mosaicId=mosaic_alias or lock['mosaicId'], amount=lock['amount'], duration=str(int(lock['endHeight']) - height))
		transaction['transaction'].pop('recipientAddress')
		transaction['transaction'].pop('mosaics')
		receipt = create_amount_statement_item(
			height, int(lock['amount']), receipt_type=ReceiptType.LOCK_HASH_CREATED.value, targetAddress=lock['ownerAddress'])
		receipt['statement']['source']['primaryId'] = block_index + 1
		return transaction, receipt

	def _create_bonded_lock_reuse(self, height, block_index, lock):
		public_key = '34' * 32
		owner = Network.TESTNET.public_key_to_address(PublicKey(public_key)).bytes.hex().upper()
		item = {'lock': {**lock, 'ownerAddress': owner, 'endHeight': '17', 'status': 0}, 'id': 'reused-lock'}
		transaction, receipt = self._create_bonded_lock_origin(height, public_key, item['lock'], block_index)
		return item, transaction, receipt

	@staticmethod
	def _create_bonded_lock_completion(owner_hex, should_use_decimal_receipt_types, *, height=7):
		aggregate = create_node_transaction(
			height, type=TransactionType.AGGREGATE_BONDED.value, deadline='30000', version=3, cosignatures=[])
		aggregate['transaction'].pop('recipientAddress')
		aggregate['transaction'].pop('mosaics')
		embedded = create_embedded_node_transaction(
			height, aggregate['meta']['hash'], 0, mosaics=[{'id': NATIVE_MOSAIC_ID, 'amount': '1000'}])
		transactions = [aggregate, embedded]
		_set_block_transactions(create_node_block(height), transactions)
		completed = create_amount_statement_item(
			height, HASH_LOCK_AMOUNT, receipt_type=ReceiptType.LOCK_HASH_COMPLETED.value, targetAddress=owner_hex)
		completed['statement']['source']['primaryId'] = 1
		if should_use_decimal_receipt_types:
			completed['statement']['receipts'][0]['type'] = str(ReceiptType.LOCK_HASH_COMPLETED.value)

		return transactions, [completed]

	def _create_expired_bonded_lock(self, block, lock):
		earlier = {**lock, 'ownerAddress': SIGNER_ADDRESS, 'endHeight': '4', 'status': 0}
		prior, created = self._create_bonded_lock_origin(3, SIGNER_PUBLIC_KEY, earlier)
		_set_block_transactions(block, [prior])
		expired = create_amount_statement_item(
			4, HASH_LOCK_AMOUNT, receipt_type=ReceiptType.LOCK_HASH_EXPIRED.value, targetAddress=BENEFICIARY_ADDRESS)
		return prior, created, expired

	def _interrupt_migrated_aggregate_bonded_batch(
		self, should_write_completion, *, reuse_height=None, should_replay_shared_branch=False, should_use_decimal_receipt_types=False,
		should_keep_expired_lifetime=False, retained_finality=6
	):  # pylint: disable=too-many-arguments,too-many-locals,too-many-statements
		# The node's latest state observes completion while the Puller is still capped at six.
		original = _chain(8, 7)
		properties = create_network_properties()
		properties['chain']['enableVerifiableReceipts'] = 'true'
		owner_public_key = '12' * 32
		owner_address = Network.TESTNET.public_key_to_address(PublicKey(owner_public_key))
		owner_hex = owner_address.bytes.hex().upper()
		transactions, receipts = self._create_bonded_lock_completion(owner_hex, should_use_decimal_receipt_types)
		lock_hash = transactions[0]['meta']['hash']
		lock_path = f'lock/hash/{lock_hash}'
		lock_item = {'lock': {
			'hash': lock_hash, 'ownerAddress': owner_hex, 'mosaicId': NATIVE_MOSAIC_ID,
			'amount': str(HASH_LOCK_AMOUNT), 'endHeight': '12', 'status': 1
		}, 'id': 'retained-lock'}
		creation, created = self._create_bonded_lock_origin(5, owner_public_key, lock_item['lock'])
		_set_block_transactions(original[4], [creation])
		if should_use_decimal_receipt_types:
			created['statement']['receipts'][0]['type'] = f' +0{ReceiptType.LOCK_HASH_CREATED.value:_} '

		retained_transactions, retained_receipts = [creation], [created]
		if should_keep_expired_lifetime:
			prior, prior_created, prior_expired = self._create_expired_bonded_lock(original[2], lock_item['lock'])
			retained_transactions.insert(0, prior)
			retained_receipts[:0] = [prior_created, prior_expired]

		self._sync_with_connector(RecoveryConnector(
			original, 3, transactions_by_path={transaction_path(1, 6): create_transaction_page(retained_transactions)},
			statement_pages={statement_path(1, 6): {'data': retained_receipts}}, hash_lock_responses={lock_path: lock_item},
			network_properties=properties), max_height=6)
		self._seed_legacy_with_unknown_lock_history(original[:6], public_height=3, saved_height=6)
		self._sync_with_published_account_generation(original[:6], retained_finality)
		recovery = self._recovery()
		self.assertEqual((retained_finality, None, True), (recovery['verified_height'], recovery['legacy_tip'], recovery['legacy_lock_history']))

		current_item = lock_item
		if reuse_height is not None:
			block_index = 1 if reuse_height == 7 else 0
			current_item, later_creation, later_created = self._create_bonded_lock_reuse(reuse_height, block_index, lock_item['lock'])
			transactions.append(later_creation)
			receipts.append(later_created)

		for height in (7, 8):
			_set_block_transactions(original[height - 1], [item for item in transactions if int(item['meta']['height']) == height])

		header_statements = deepcopy(receipts)
		for item in header_statements:
			for receipt in item['statement']['receipts']:
				receipt['type'] = int(receipt['type'])

		_commit_recovery_suffix(original, statements=header_statements)
		orphan = RecoveryConnector(
			original, retained_finality, transactions_by_path={transaction_path(7, 8): create_transaction_page(transactions)},
			statement_pages={statement_path(7, 8): {'data': receipts}}, hash_lock_responses={lock_path: current_item})
		if should_write_completion:
			self._sync_until_interrupted_checkpoint(orphan)
		else:
			with self._use_database(FailingBondedReceiptWriteDatabase(self.puller.symbol_db)):
				with self.assertRaisesRegex(RuntimeError, '^bonded aggregate receipt write interrupted$'):
					self._sync_with_connector(orphan)

		before = self._capture_preserved_state()
		self.assertEqual((6, retained_finality, 7), (
			before.sync_state['last_synced_height'], before.sync_state['finalized_height'], before.sync_state['dirty_state_from_height']))
		self.assertIsNotNone(before.refresh_state['valid_run_id'])
		[(old_lock,)] = before.tables['symbol_hash_locks']
		self.assertEqual(('unused' if reuse_height is not None else 'used', current_item), (old_lock['status'], old_lock['raw_payload']))
		self.assertEqual(
			[(int(receipt['statement']['height']), receipt['statement']['source']['primaryId'])
				for receipt in [*retained_receipts, *(receipts if should_write_completion else [])]],
			sorted((row[0]['height'], row[0]['source_primary_id']) for row in before.tables['symbol_receipts']))
		self.assertFalse(any(
			row[0]['address'] == '\\x' + owner_hex.lower() for row in before.tables['symbol_transaction_addresses'] if row[0]['height'] == 7))

		if should_replay_shared_branch:
			orphan.paths.clear()
			orphan.post_requests.clear()
			return orphan, lock_path, owner_address, current_item

		restored = {**lock_item, 'lock': {**lock_item['lock'], 'status': 0}}
		account = create_account_item(owner_hex, addressHeight='5', mosaics=[{'id': NATIVE_MOSAIC_ID, 'amount': '8765'}])
		# The canonical node has a different block at seven and both replacement blocks are transaction-free.
		canonical = _chain(8)
		canonical[:6] = original[:6]
		_commit_recovery_suffix(canonical)

		node = RecoveryConnector(
			canonical, retained_finality, hash_lock_responses={lock_path: restored}, account_by_address={str(owner_address): account},
			network_properties=properties)
		return node, lock_path, owner_address, restored

	def _interrupt_migrated_lock_reuse(self, *, retained_end_height, should_complete):  # pylint: disable=too-many-locals
		original = _chain(8, 7)
		properties = create_network_properties()
		properties['chain']['enableVerifiableReceipts'] = 'true'
		public_key = '12' * 32
		owner = Network.TESTNET.public_key_to_address(PublicKey(public_key)).bytes.hex().upper()
		completed_transactions, completion_receipts = self._create_bonded_lock_completion(owner, False, height=6)
		lock_hash = completed_transactions[0]['meta']['hash']
		lock_path = f'lock/hash/{lock_hash}'
		retained = {'lock': {
			'hash': lock_hash, 'ownerAddress': owner, 'mosaicId': NATIVE_MOSAIC_ID,
			'amount': str(HASH_LOCK_AMOUNT), 'endHeight': str(retained_end_height), 'status': int(should_complete)
		}, 'id': 'retained-lock'}
		creation, created = self._create_bonded_lock_origin(5, public_key, retained['lock'])
		transactions = [creation]
		receipts = [created]
		_set_block_transactions(original[4], transactions)
		if should_complete:
			transactions.extend(completed_transactions)
			receipts.extend(completion_receipts)
			_set_block_transactions(original[5], completed_transactions)
		else:
			receipts.append(create_amount_statement_item(
				6, HASH_LOCK_AMOUNT, receipt_type=ReceiptType.LOCK_HASH_EXPIRED.value, targetAddress=BENEFICIARY_ADDRESS))

		self._sync_with_connector(RecoveryConnector(
			original[:6], 3, transactions_by_path={transaction_path(1, 6): create_transaction_page(transactions)},
			statement_pages={statement_path(1, 6): {'data': receipts}}, hash_lock_responses={lock_path: retained}, network_properties=properties))
		self._seed_legacy_with_unknown_lock_history(original[:6], public_height=3, saved_height=6)
		self._sync_with_published_account_generation(original[:6], 6)
		reused, transaction, receipt = self._create_bonded_lock_reuse(7, 0, retained['lock'])
		_set_block_transactions(original[6], [transaction])
		_commit_recovery_suffix(original, statements=[receipt])
		self._sync_until_interrupted_checkpoint(RecoveryConnector(
			original, 6, transactions_by_path={transaction_path(7, 8): create_transaction_page([transaction])},
			statement_pages={statement_path(7, 8): {'data': [receipt]}}, hash_lock_responses={lock_path: reused}))
		canonical = _chain(8)
		canonical[:6] = original[:6]
		_commit_recovery_suffix(canonical)

		return canonical, lock_path, retained, reused

	def _assert_migrated_sync_restores_bonded_lock(
		self, should_write_completion, *, reuse_height=None, should_use_decimal_receipt_types=False
	):
		# Arrange:
		node, lock_path, owner_address, restored = self._interrupt_migrated_aggregate_bonded_batch(
			should_write_completion, reuse_height=reuse_height, should_use_decimal_receipt_types=should_use_decimal_receipt_types)
		before = self._capture_preserved_state()
		generations = self._read_generation_rows()
		self.assertTrue(generations['symbol_account_refresh_accounts'])

		# Act: the repair commits, then the first replacement block write is interrupted.
		with self._use_database(FailingWriteDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(RuntimeError, '^resumed write failed$'):
				self._sync_with_connector(node)

		# Assert: the orphaned history and the prefetch replacement changed in the same repair.
		self.assertEqual(list(range(1, 7)), self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual([lock_path, transaction_path(7, 8)], [
			path for path in node.paths if path.startswith(('lock/hash/', 'transactions/confirmed?'))])
		self.assertEqual(
			_expected_bonded_rollback_addresses(owner_address, should_write_completion=should_write_completion, reuse_height=reuse_height),
			node.post_requests[0][1]['addresses'])
		after = self._capture_preserved_state()
		self.assertEqual([5], [row[0]['height'] for row in after.tables['symbol_transactions']])
		self.assertEqual([5], [row[0]['height'] for row in after.tables['symbol_receipts']])
		[(lock_row,)] = after.tables['symbol_hash_locks']
		self.assertEqual({
			**create_hash_lock_row(restored, 6),
			'hash': '\\x' + restored['lock']['hash'].lower(), 'owner_address': '\\x' + owner_address.bytes.hex()
		}, lock_row)
		self.assertEqual([(NATIVE_MOSAIC_ID, 8765, 6)], [
			(row['mosaic_id'], row['amount'], row['updated_at_height'])
			for (row,) in after.tables['symbol_account_mosaics'] if row['address'] == '\\x' + owner_address.bytes.hex()])
		recovery = self._recovery()
		self.assertEqual((6, 7, 'resume_wait', True), (
			recovery['verified_height'], recovery['resume_height'], recovery['stop_reason'], recovery['legacy_lock_history']))
		self.assertEqual(before.refresh_state, after.refresh_state)
		self.assertEqual(generations, self._read_generation_rows())

		# Act: normal sync resumes at seven after the interruption.
		heights, sync = self._sync_with_connector(node)

		# Assert:
		self.assertEqual(list(range(1, 9)), heights)
		self.assertEqual(('healthy', 8, 6, None), (
			sync['status'], sync['last_synced_height'], sync['finalized_height'], sync['dirty_state_from_height']))
		self.assertEqual(bytes.fromhex(node.blocks[6]['meta']['hash']), self._fetch_block_hash(self.puller.symbol_db, 7))
		self.assertEqual((6, None, None), (
			self._recovery()['verified_height'], self._recovery()['resume_height'], self._recovery()['stop_reason']))
		self.assertEqual([({**lock_row, 'updated_at_height': 8},)], self._fetch_table_state(('symbol_hash_locks',))['symbol_hash_locks'])

	def test_migrated_sync_restores_bonded_lock_after_transaction_only_batch(self):
		self._assert_migrated_sync_restores_bonded_lock(should_write_completion=False)

	def test_migrated_sync_restores_bonded_lock_after_completion_receipt(self):
		self._assert_migrated_sync_restores_bonded_lock(should_write_completion=True)

	def test_migrated_sync_restores_latest_bonded_lock_after_an_older_lifetime_expired(self):
		# Arrange: H3's lock expires at H4, H5 reuses its key and orphan H7 completes the new lifetime.
		node, lock_path, owner, restored = self._interrupt_migrated_aggregate_bonded_batch(
			should_write_completion=True, should_keep_expired_lifetime=True)

		# Act:
		heights, sync = self._sync_with_connector(node)

		# Assert: both retained lifetimes survive, while the current row and refunded owner belong to H5.
		self.assertEqual((list(range(1, 9)), 'healthy', None), (heights, sync['status'], self._recovery()['resume_height']))
		tables = self._fetch_table_state(('symbol_transactions', 'symbol_receipts', 'symbol_hash_locks'))
		self.assertEqual([3, 5], sorted(row['height'] for (row,) in tables['symbol_transactions']))
		self.assertEqual([(3, 'lockHashCreated'), (4, 'lockHashExpired'), (5, 'lockHashCreated')], sorted(
			(row['height'], row['receipt_type']) for (row,) in tables['symbol_receipts']))
		[(lock,)] = tables['symbol_hash_locks']
		self.assertEqual((restored, 'unused', 12), (lock['raw_payload'], lock['status'], lock['end_height']))
		self.assertEqual(
			_expected_bonded_rollback_addresses(owner, should_write_completion=True), node.post_requests[0][1]['addresses'])
		self.assertEqual([lock_path], [path for path in node.paths if path.startswith('lock/hash/')])

	def test_migrated_sync_restores_bonded_lock_after_its_key_is_reused_on_the_orphan_branch(self):
		self._assert_migrated_sync_restores_bonded_lock(should_write_completion=True, reuse_height=8)

	def test_migrated_sync_restores_bonded_lock_after_its_key_is_reused_in_the_same_block(self):
		self._assert_migrated_sync_restores_bonded_lock(should_write_completion=True, reuse_height=7)

	def test_migrated_sync_restores_bonded_lock_with_decimal_receipt_types(self):
		self._assert_migrated_sync_restores_bonded_lock(should_write_completion=True, should_use_decimal_receipt_types=True)

	def _assert_hash_lock_uses_retained_state_until_replay_commits(self, node, lock_path, retained, newest):
		# Act: stop after repair commits but before replay can write any artifacts.
		with self._use_database(FailingWriteDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(RuntimeError, '^resumed write failed$'):
				self._sync_with_connector(node)

		# Assert: the historic H6 row is durable, but neither H7 completion nor H8 reuse has been published.
		[(staged,)] = self._fetch_table_state(('symbol_hash_locks',))['symbol_hash_locks']
		self.assertEqual(({'lock': retained}, 6, 'unused', 12), (
			staged['raw_payload'], staged['updated_at_height'], staged['status'], staged['end_height']))
		self.assertEqual(list(range(1, 7)), self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual([transaction_path(7, 8), statement_path(7, 8), lock_path, transaction_path(7, 8), statement_path(7, 8)], [
			path for path in node.paths if path.startswith(('lock/', 'transactions/confirmed?', 'statements/transaction?'))])
		self.assertEqual((6, 7, 'resume_wait'), (
			self._recovery()['verified_height'], self._recovery()['resume_height'], self._recovery()['stop_reason']))

		# Act:
		heights, sync = self._sync_with_connector(node)

		# Assert: publication and the lock's canonical state advance together.
		self.assertEqual(list(range(1, 9)), heights)
		self.assertEqual(('healthy', 8, 6, None), (
			sync['status'], sync['last_synced_height'], sync['finalized_height'], sync['dirty_state_from_height']))
		self.assertEqual((None, None), (self._recovery()['resume_height'], self._recovery()['stop_reason']))
		[(actual,)] = self._fetch_table_state(('symbol_hash_locks',))['symbol_hash_locks']
		self.assertEqual((newest, 8), (actual['raw_payload'], actual['updated_at_height']))

	def test_migrated_sync_replays_latest_matched_hash_lock_creation(self):
		# Arrange: the original H5 creation and H7 completion are followed by same-key creation at H8.
		node, lock_path, first_owner, newest = self._interrupt_migrated_aggregate_bonded_batch(
			should_write_completion=True, reuse_height=8, should_replay_shared_branch=True)
		retained = {
			**newest['lock'], 'ownerAddress': first_owner.bytes.hex().upper(), 'amount': str(HASH_LOCK_AMOUNT), 'endHeight': '12', 'status': 0
		}

		self._assert_hash_lock_uses_retained_state_until_replay_commits(node, lock_path, retained, newest)

	def test_migrated_sync_rejects_hash_lock_response_matching_an_older_shared_creation(self):
		# Arrange: both creations are on the matched branch, but the response reports the H5 creation consumed at H7.
		node, lock_path, first_owner, newest = self._interrupt_migrated_aggregate_bonded_batch(
			should_write_completion=True, reuse_height=8, should_replay_shared_branch=True)
		older = {'lock': {
			**newest['lock'], 'ownerAddress': first_owner.bytes.hex().upper(), 'amount': str(HASH_LOCK_AMOUNT), 'endHeight': '12', 'status': 1
		}, 'id': 'retained-lock'}
		connector = RecoveryConnector(
			node.blocks, 6, hash_lock_responses={lock_path: older}, transactions_by_path=node.transactions_by_path,
			statement_pages=node.statement_pages)
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, 'does not match a proven creation on the shared branch'):
				self._sync_with_connector(connector)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		after = self._recovery()
		self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'restoration_evidence_missing'}, after)
		self.assertEqual((8, None), (after['progress']['compare_end'], after['progress']['fork_height']))
		self.assertEqual([transaction_path(7, 8), statement_path(7, 8), lock_path], [
			path for path in connector.paths if path.startswith(('lock/', 'transactions/confirmed?', 'statements/transaction?'))])

	def test_migrated_sync_rechecks_replayed_hash_lock_creation_before_repair(self):
		# Arrange: H8 is initially on the shared branch and is the only proven creation matching the node row.
		node, lock_path, _, newest = self._interrupt_migrated_aggregate_bonded_batch(
			should_write_completion=True, reuse_height=8, should_replay_shared_branch=True)
		node = LockRepairForkChangeConnector(
			node.blocks, 6, hash_lock_responses={lock_path: newest}, transactions_by_path=node.transactions_by_path,
			statement_pages=node.statement_pages)
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()

		# Act: the H8 hash changes after the latest state lookup.
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, '^Pinned Symbol reconciliation evidence changed$'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual({**recovery, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'}, self._recovery())
		self.assertEqual([transaction_path(7, 8), statement_path(7, 8), lock_path], [
			path for path in node.paths if path.startswith(('lock/', 'transactions/confirmed?', 'statements/transaction?'))])

	def test_migrated_sync_rejects_replayed_lock_when_fresh_chain_info_supersedes_the_common_block(self):
		for section, field, replacement, error in (
			('meta', 'hash', 'AC' * 32, 'Pinned Symbol reconciliation evidence changed'),
			('block', 'previousBlockHash', 'AC' * 32, 'Node Symbol replay block commitments changed before repair'),
			('meta', 'transactionsCount', 0, 'Node Symbol replay block commitments changed before repair')
		):
			with self.subTest(field=field):
				# Arrange: H8 proves the latest creation until the fresh chain-info read changes its evidence.
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				node, lock_path, _, newest = self._interrupt_migrated_aggregate_bonded_batch(
					should_write_completion=True, reuse_height=8, should_replay_shared_branch=True)
				connector = LockRepairCommonBlockChangeConnector(
					node.blocks, 6, (section, field), replacement=replacement, hash_lock_responses={lock_path: newest},
					transactions_by_path=node.transactions_by_path, statement_pages=node.statement_pages)
				before = self._capture_preserved_state()
				recovery = self._recovery()
				generations = self._read_generation_rows()

				# Act:
				with self._use_database(UnexpectedRepairDatabase(database)):
					with self.assertRaisesRegex(SymbolRollbackError, f'^{error}$'):
						self._sync_with_connector(connector)

				# Assert: the second H8 read follows the fresh chain info and catches the change before repair.
				self.assertEqual([transaction_path(7, 8), statement_path(7, 8), lock_path], [
					path for path in connector.paths if path.startswith(('lock/', 'transactions/confirmed?', 'statements/transaction?'))])
				self.assertEqual([lock_path, 'blocks/8', 'chain/info', 'blocks/8'], [
					path for path in connector.paths[connector.paths.index(lock_path):] if path in (lock_path, 'blocks/8', 'chain/info')])
				self._assert_preserved_state(before, before.sync_state)
				self.assertEqual(generations, self._read_generation_rows())
				self.assertEqual({**recovery, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'}, self._recovery())

	def test_migrated_sync_rejects_changed_retained_common_block_above_finality(self):
		# Arrange: H6 is retained above F5, and differs after the first fresh chain-info read.
		node, lock_path, _, restored = self._interrupt_migrated_aggregate_bonded_batch(
			should_write_completion=True, retained_finality=5)
		connector = LockRepairCommonBlockChangeConnector(
			node.blocks, 5, ('block', 'previousBlockHash'), common_height=6, hash_lock_responses={lock_path: restored})
		before, generations = self._capture_preserved_state(), self._read_generation_rows()
		recovery = self._recovery()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, '^Node Hash Lock recovery block evidence changed before Symbol repair$'):
				self._sync_with_connector(connector)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual({**recovery, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'}, self._recovery())
		self.assertEqual(['blocks/6', 'blocks/6', 'chain/info', 'blocks/6'], [
			path for path in connector.paths[connector.paths.index(lock_path):] if path in ('blocks/6', 'chain/info')])

	def test_migrated_sync_preserves_replayed_lock_history_when_node_tip_falls_below_the_common_block(self):
		for shorten_on_read, expected_heights in ((2, [8, 7]), (3, [8, 8, 7])):
			with self.subTest(shorten_on_read=shorten_on_read):
				# Arrange: the H8 creation matches the lock response and its block remains readable after the reported tip shrinks.
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				node, lock_path, _, newest = self._interrupt_migrated_aggregate_bonded_batch(
					should_write_completion=True, reuse_height=8, should_replay_shared_branch=True)
				connector = LockRepairTipChangeConnector(
					node.blocks, 6, shorten_on_read=shorten_on_read, hash_lock_responses={lock_path: newest},
					transactions_by_path=node.transactions_by_path, statement_pages=node.statement_pages)
				before = self._capture_preserved_state()
				recovery = self._recovery()
				generations = self._read_generation_rows()

				# Act: the fresh or closing chain-info read reports H7 after the H8 block reread.
				with self._use_database(UnexpectedRepairDatabase(database)):
					with self.assertRaisesRegex(
						SymbolRollbackError, '^Node chain tip fell below the common block for replayed Symbol Hash Lock creations$'
					):
						self._sync_with_connector(connector)

				# Assert:
				self.assertEqual(expected_heights, connector.reported_heights)
				self.assertEqual(['blocks/8'] * (shorten_on_read - 1), [
					path for path in connector.paths[connector.paths.index(lock_path) + 1:] if path == 'blocks/8'])
				self.assertEqual([transaction_path(7, 8), statement_path(7, 8), lock_path], [
					path for path in connector.paths if path.startswith(('lock/', 'transactions/confirmed?', 'statements/transaction?'))])
				self._assert_preserved_state(before, before.sync_state)
				self.assertEqual(generations, self._read_generation_rows())
				self.assertEqual({**recovery, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'}, self._recovery())

	def test_migrated_sync_preserves_history_when_hash_lock_response_disagrees_with_creation(self):
		# Arrange: the replacement branch has no creation for the lock owned by the retained H5 signer.
		node, lock_path, _, restored = self._interrupt_migrated_aggregate_bonded_batch(should_write_completion=True)
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()
		cases = (
			{'ownerAddress': SIGNER_ADDRESS}, {'mosaicId': '1234567890ABCDEF'}, {'amount': '2468'},
			{'ownerAddress': SIGNER_ADDRESS, 'amount': '2468'}
		)
		for conflicting_fields in cases:
			with self.subTest(conflicting_fields=conflicting_fields):
				response = {**restored, 'lock': {**restored['lock'], **conflicting_fields}}
				connector = RecoveryConnector(node.blocks, 6, hash_lock_responses={lock_path: response})

				# Act:
				with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
					with self.assertRaisesRegex(SymbolRollbackError, 'does not match a proven creation on the shared branch'):
						self._sync_with_connector(connector)

				# Assert:
				self._assert_preserved_state(before, before.sync_state)
				self.assertEqual(generations, self._read_generation_rows())
				after = self._recovery()
				self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'restoration_evidence_missing'}, after)
				self.assertEqual((8, 7), (after['progress']['compare_end'], after['progress']['fork_height']))
				expected = [lock_path] if conflicting_fields != cases[0] else [statement_path(7, 8), lock_path]
				self.assertEqual(expected, [
					path for path in connector.paths if path.startswith(('lock/', 'transactions/confirmed?', 'statements/transaction?'))])

	def _assert_migrated_sync_rejects_hash_lock_state(self, response_fields, expected_error):
		# Arrange: the canonical branch retains the H5 duration-7 lock and lacks the orphan H7 completion.
		node, lock_path, _, restored = self._interrupt_migrated_aggregate_bonded_batch(should_write_completion=True)
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()
		[(current,)] = before.tables['symbol_hash_locks']
		self.assertEqual((12, 'used'), (current['end_height'], current['status']))
		self.assertEqual([5, 7], sorted(row['height'] for (row,) in before.tables['symbol_receipts']))
		self.assertIsNotNone(before.refresh_state['valid_run_id'])
		self.assertTrue(generations['symbol_account_refresh_accounts'])
		response = {'code': 'ResourceNotFound', 'message': 'Lock not found'} if response_fields is None else {
			**restored, 'lock': {**restored['lock'], **response_fields}}
		connector = RecoveryConnector(node.blocks, 6, hash_lock_responses={lock_path: response}, account_by_address=node.account_by_address)

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, expected_error):
				self._sync_with_connector(connector)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		after = self._recovery()
		self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'restoration_evidence_missing'}, after)
		self.assertEqual((8, 7), (after['progress']['compare_end'], after['progress']['fork_height']))
		self.assertEqual([statement_path(7, 8), lock_path], [
			path for path in connector.paths if path.startswith(('lock/', 'transactions/confirmed?', 'statements/transaction?'))])

	def test_migrated_sync_rejects_missing_hash_lock_with_unexpired_shared_creation(self):
		self._assert_migrated_sync_rejects_hash_lock_state(None, 'Symbol Hash Lock absence is not supported by the shared branch')

	def test_migrated_sync_rejects_used_hash_lock_with_only_orphan_completion(self):
		self._assert_migrated_sync_rejects_hash_lock_state({'status': 1}, 'does not match a proven creation on the shared branch')

	def test_migrated_sync_rejects_hash_lock_end_height_conflicting_with_shared_duration(self):
		self._assert_migrated_sync_rejects_hash_lock_state({'endHeight': '11'}, 'does not match a proven creation on the shared branch')

	def test_migrated_sync_rejects_mismatched_hash_lock_key_during_restoration(self):
		self._assert_migrated_sync_rejects_hash_lock_state({'hash': 'CD' * 32}, 'response hash does not match dirty key')

	def test_migrated_sync_rejects_hash_lock_when_node_retreats_below_the_proven_suffix(self):
		# Arrange: after proof through H8, the first fresh chain info reports H7, which still reaches the proven fork.
		node, lock_path, _, restored = self._interrupt_migrated_aggregate_bonded_batch(should_write_completion=True)
		connector = LockRepairTipChangeConnector(node.blocks, 6, shorten_on_read=2, hash_lock_responses={lock_path: restored})
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Node chain tip changed before Symbol Hash Lock recovery commit'):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([8, 7], connector.reported_heights)
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual({**recovery, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'}, self._recovery())

	def test_migrated_sync_preserves_hash_lock_when_replacement_blocks_have_unverified_transactions(self):
		# Arrange: replacement tip H9 contains an unverified transaction beyond the local physical tail at H8.
		node, lock_path, _, restored = self._interrupt_migrated_aggregate_bonded_batch(should_write_completion=True)
		block = create_node_block(9)
		_set_block_transactions(block, [create_node_transaction(9)])
		blocks = [*node.blocks, block]
		_commit_recovery_suffix(blocks, 9)
		node = RecoveryConnector(blocks, 6, hash_lock_responses={lock_path: restored})
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, 'unverified transaction range on the replacement branch'):
				self._sync_with_connector(node)

		# Assert: the latest lock endpoint cannot fill the gap in the history proof.
		self.assertEqual([], [path for path in node.paths if path.startswith('lock/')])
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		after = self._recovery()
		self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'restoration_evidence_missing'}, after)

	def test_migrated_sync_rejects_malformed_hash_lock_replacement_block_evidence(self):
		cases = (
			('block', 'transactionsHash', None, 'unverified transaction range on the replacement branch'),
			('block', 'transactionsHash', 'not-hex', 'unverified transaction range on the replacement branch'),
			('block', 'transactionsHash', 'AC' * 32, 'unverified transaction range on the replacement branch'),
			('meta', 'transactionsCount', False, 'unverified transaction range on the replacement branch'),
			('block', 'height', 'unknown', 'Malformed Symbol Hash Lock replacement branch evidence')
		)
		for section, field, value, expected_error in cases:
			with self.subTest(field=field, value=value):
				# Arrange: H9 lies beyond the local physical tail and is read only to prove the replacement suffix.
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				node, _, _, _ = self._interrupt_migrated_aggregate_bonded_batch(should_write_completion=True)
				blocks = [*node.blocks, create_node_block(9)]
				_commit_recovery_suffix(blocks, 9)
				block = blocks[-1]
				if value is None:
					block[section].pop(field)
				else:
					block[section][field] = value

				connector = RecoveryConnector(blocks, 6)
				before = self._capture_preserved_state()
				recovery = self._recovery()
				generations = self._read_generation_rows()

				# Act:
				with self._use_database(UnexpectedRepairDatabase(database)):
					with self.assertRaisesRegex(SymbolRollbackError, expected_error):
						self._sync_with_connector(connector)

				# Assert:
				self.assertEqual([], [path for path in connector.paths if path.startswith('lock/')])
				self._assert_preserved_state(before, before.sync_state)
				self.assertEqual(generations, self._read_generation_rows())
				after = self._recovery()
				self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'restoration_evidence_missing'}, after)
				self.assertEqual((8, 7), (after['progress']['compare_end'], after['progress']['fork_height']))

	def _prepare_two_page_hash_lock_suffix(self):
		node, _, _, _ = self._interrupt_migrated_aggregate_bonded_batch(should_write_completion=True)
		# The second replacement page starts at H107. The local range ends at H8.
		blocks = [*node.blocks, *_chain(109)[8:]]
		_commit_recovery_suffix(blocks, 9)
		return blocks, 'blocks?pageSize=100&offset=106&orderBy=height'

	def test_migrated_sync_invalidates_hash_lock_suffix_when_pages_have_disconnected_parents(self):
		# Arrange: the first block of the second suffix page contradicts the preceding page's last hash.
		blocks, suffix_page = self._prepare_two_page_hash_lock_suffix()
		blocks[106]['block']['previousBlockHash'] = 'AC' * 32
		commit_node_block(blocks[106])
		_commit_recovery_suffix(blocks, 108)
		node = RecoveryConnector(blocks, 6)
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, '^Pinned Symbol reconciliation evidence changed$'):
				self._sync_with_connector(node)

		# Assert:
		self.assertEqual([suffix_page], [path for path in node.paths if path == suffix_page or path.startswith('lock/')])
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual({**recovery, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'}, self._recovery())

	def test_migrated_sync_preserves_hash_lock_when_suffix_page_transport_fails(self):
		# Arrange: the first suffix page succeeds and the next one fails its HTTP requests.
		blocks, suffix_page = self._prepare_two_page_hash_lock_suffix()
		failure = NodeException('temporary Hash Lock suffix page failure')
		node = FailingPrerequisiteConnector(blocks, 6, suffix_page, failure)
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(NodeException, '^temporary Hash Lock suffix page failure$') as raised:
				self._sync_with_connector(node)

		# Assert:
		self.assertIs(failure, raised.exception)
		self.assertEqual([suffix_page] * 3, [path for path in node.paths if path == suffix_page or path.startswith('lock/')])
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		after = self._recovery()
		self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'reconciliation_wait'}, after)

	def test_migrated_sync_exhausts_reconciliation_budget_during_hash_lock_suffix_proof(self):
		# Arrange: the second suffix page consumes the remaining reconciliation time.
		blocks, suffix_page = self._prepare_two_page_hash_lock_suffix()
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()
		clock = ManualReconciliationClock()
		node = LockRepairDelayedPageConnector(blocks, 6, clock, suffix_page)
		self.puller = create_symbol_puller(
			self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, time_source=clock))
		database = self.exit_stack.enter_context(self.puller.symbol_db)

		# Act:
		with self._use_database(UnexpectedRepairDatabase(database)):
			with self.assertRaisesRegex(SymbolRollbackError, '^Symbol branch reconciliation request budget exhausted$'):
				self._sync_with_connector(node)

		# Assert:
		self.assertEqual([suffix_page], [path for path in node.paths if path == suffix_page or path.startswith('lock/')])
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		after = self._recovery()
		self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'reconciliation_wait'}, after)

	def test_migrated_sync_resumes_hash_lock_suffix_after_a_completed_proof_page(self):
		# Arrange: block 106 is fully scanned before the second page exhausts the time budget.
		blocks, suffix_page = self._prepare_two_page_hash_lock_suffix()
		database = self.puller.symbol_db
		[(lock,)] = self._fetch_table_state(('symbol_hash_locks',))['symbol_hash_locks']
		latest = {**lock['raw_payload'], 'lock': {**lock['raw_payload']['lock'], 'status': 0}}
		lock_path = f'lock/hash/{latest["lock"]["hash"]}'
		clock = ManualReconciliationClock()
		node = LockRepairDelayedPageConnector(blocks, 6, clock, suffix_page)
		self.puller = create_symbol_puller(
			self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, time_source=clock))
		self.exit_stack.enter_context(self.puller.symbol_db)

		# Act:
		with self._use_database(UnexpectedRepairDatabase(database)):
			with self.assertRaisesRegex(SymbolRollbackError, 'reconciliation request budget exhausted'):
				self._sync_with_connector(node)

		# Assert: the completed first page is durable.
		self.assertEqual(106, self._recovery()['progress']['hash_lock_scan']['height'])
		self.assertEqual((6, 7), (
			database.get_sync_state()['last_synced_height'], database.get_sync_state()['dirty_state_from_height']))

		# Act:
		resumed = RecoveryConnector(blocks, 6, hash_lock_responses={lock_path: latest})
		heights, sync = self._sync_with_connector(resumed)

		# Assert: only the later proof page is scanned again. Forward replay still fetches both ranges.
		first_page = 'blocks?pageSize=100&offset=6&orderBy=height'
		self.assertEqual(['blocks/106', suffix_page, lock_path], [
			path for path in resumed.paths[:resumed.paths.index(first_page)] if path in (first_page, suffix_page, lock_path, 'blocks/106')])
		self.assertEqual((109, 'healthy', None), (heights[-1], sync['status'], self._recovery()['stop_reason']))

	def test_migrated_sync_invalidates_changed_hash_lock_proof_cursor(self):
		for change in ('shorter', 'different_hash', 'different_root', 'different_saved_parent'):
			with self.subTest(change=change):
				# Arrange: stop after recording a complete suffix page, beyond the local physical tail.
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				blocks, suffix_page = self._prepare_two_page_hash_lock_suffix()
				clock = ManualReconciliationClock()
				node = LockRepairDelayedPageConnector(blocks, 6, clock, suffix_page)
				self.puller = create_symbol_puller(
					self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, time_source=clock))
				self.exit_stack.enter_context(self.puller.symbol_db)
				with self.assertRaisesRegex(SymbolRollbackError, 'reconciliation request budget exhausted'):
					self._sync_with_connector(node)

				self.assertEqual(106, self._recovery()['progress']['hash_lock_scan']['height'])
				before = self._capture_preserved_state()
				if change == 'different_saved_parent':
					progress = self._recovery()['progress']
					progress['hash_lock_scan']['block'][1] = 'ac' * 32
					database.update_fork_reconciliation(progress, 0, ForkRecoveryStopReason.RECONCILIATION_WAIT)
					message = 'Previously scanned Symbol Hash Lock replay block changed'
				elif change == 'shorter':
					blocks = blocks[:105]
					message = 'Node chain tip fell below the scanned Symbol replacement block'
				else:
					if change == 'different_hash':
						blocks[105]['block']['timestamp'] = '106001'
						commit_node_block(blocks[105])
					else:
						blocks[105]['block']['transactionsHash'] = 'AC' * 32

					message = 'Previously scanned Symbol Hash Lock replay block changed'

				# Act:
				with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
					with self.assertRaisesRegex(SymbolRollbackError, message):
						self._sync_with_connector(RecoveryConnector(blocks, 6))

				# Assert:
				self._assert_preserved_state(before, before.sync_state)
				recovery = self._recovery()
				self.assertEqual((None, 1, 'reconciliation_wait'), (
					recovery['progress'], recovery['invalidations'], recovery['stop_reason']))

	def _assert_migrated_sync_replays_incomplete_common_transactions(self, height, expected_heights, *, should_keep_top_level):
		# Arrange: commit part or none of the transaction rows under an already-written header.
		node, lock_path, _, _ = self._interrupt_migrated_aggregate_bonded_batch(
			should_write_completion=True, reuse_height=8, should_replay_shared_branch=True)
		database = self.puller.symbol_db
		transactions = []
		if should_keep_top_level:
			with database.connection, database.connection.cursor() as cursor:
				cursor.execute('SELECT raw_payload FROM symbol_transactions WHERE height = %s AND NOT is_embedded', (height,))
				transactions = [create_transaction_row(payload, Network.TESTNET, 100) for (payload,) in cursor.fetchall()]
		else:
			with database.connection, database.connection.cursor() as cursor:
				cursor.execute('DELETE FROM symbol_receipts WHERE height = %s', (height,))

		database.upsert_transactions_for_height(height, transactions)

		before = self._capture_preserved_state()
		self.assertEqual(expected_heights, sorted(row['height'] for (row,) in before.tables['symbol_transactions']))

		# Act:
		heights, sync = self._sync_with_connector(node)

		# Assert: the matching header did not certify the incomplete stored artifacts.
		self.assertEqual((list(range(1, 9)), 'healthy', None, None), (
			heights, sync['status'], sync['dirty_state_from_height'], self._recovery()['resume_height']))
		after = self._capture_preserved_state()
		self.assertEqual([5, 7, 7, 8], sorted(row['height'] for (row,) in after.tables['symbol_transactions']))
		self.assertEqual([5, 7, 8], sorted(row['height'] for (row,) in after.tables['symbol_receipts']))
		[(lock,)] = after.tables['symbol_hash_locks']
		self.assertEqual(('unused', 17, HASH_LOCK_AMOUNT), (lock['status'], lock['end_height'], lock['amount']))
		self.assertEqual([transaction_path(7, 8), lock_path, transaction_path(7, 8)], [
			path for path in node.paths if path.startswith(('transactions/confirmed?', 'lock/hash/'))])

	def test_migrated_sync_recovers_lock_key_missing_from_a_header_only_dirty_block(self):
		# Arrange: only H7's header has been written; the new key cannot be derived from any local event or cache.
		node, lock_path, lock_hash = self._interrupt_migrated_hash_lock_batch()
		node.paths.clear()
		database = self.puller.symbol_db
		database.upsert_transactions_for_height(7, [])
		with database.connection, database.connection.cursor() as cursor:
			cursor.execute('DELETE FROM symbol_receipts WHERE height = 7')

		before = self._capture_preserved_state()
		self.assertEqual(([], [], []), tuple(
			before.tables[name] for name in ('symbol_transactions', 'symbol_receipts', 'symbol_hash_locks')))

		# Act:
		heights, state = self._sync_with_connector(node)

		# Assert:
		self.assertEqual((list(range(1, 9)), 'healthy', None, None), (
			heights, state['status'], state['dirty_state_from_height'], self._recovery()['stop_reason']))
		[(lock,)] = self._fetch_table_state(('symbol_hash_locks',))['symbol_hash_locks']
		self.assertEqual((lock_hash, 'unused', 12), (lock['hash'][2:].upper(), lock['status'], lock['end_height']))
		self.assertEqual([transaction_path(7, 8), lock_path, transaction_path(7, 8)], [
			path for path in node.paths if path.startswith(('transactions/confirmed?', 'lock/hash/'))])

	def test_migrated_sync_replays_dirty_common_block_with_only_its_header(self):
		self._assert_migrated_sync_replays_incomplete_common_transactions(8, [5, 7, 7], should_keep_top_level=False)

	def test_migrated_sync_replays_dirty_common_block_missing_embedded_transaction(self):
		self._assert_migrated_sync_replays_incomplete_common_transactions(7, [5, 7, 8], should_keep_top_level=True)

	def _assert_migrated_sync_defers_hash_lock_restoration_after_growth(self, grow_on_read):
		# Arrange: a fresh chain-info response advertises an uninspected H9 after proof through H8.
		node, lock_path, _, restored = self._interrupt_migrated_aggregate_bonded_batch(should_write_completion=True)
		connector = LockRepairTipGrowthConnector(node.blocks, 6, grow_on_read=grow_on_read, hash_lock_responses={lock_path: restored})
		self.puller.symbol_db.update_fork_reconciliation(None, 2, ForkRecoveryStopReason.RECONCILIATION_WAIT)
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Node chain grew beyond the verified Symbol Hash Lock state range'):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(9, connector.chain_height)
		self.assertEqual(2, self._recovery()['invalidations'])
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		after = self._recovery()
		self.assertEqual({**recovery, 'progress': after['progress']}, after)

	def test_migrated_sync_defers_hash_lock_restoration_when_node_grows_after_state_lookup(self):
		self._assert_migrated_sync_defers_hash_lock_restoration_after_growth(2)

	def test_migrated_sync_defers_hash_lock_restoration_when_node_grows_at_closing_read(self):
		self._assert_migrated_sync_defers_hash_lock_restoration_after_growth(3)

	def test_migrated_sync_restores_used_hash_lock_with_proven_shared_completion(self):
		# Arrange: the node and dirty branch share H7 and H8, including the completion at H7.
		node, lock_path, _, completed = self._interrupt_migrated_aggregate_bonded_batch(
			should_write_completion=True, should_replay_shared_branch=True)
		retained = {**completed['lock'], 'status': 0}

		self._assert_hash_lock_uses_retained_state_until_replay_commits(node, lock_path, retained, completed)

	def test_migrated_sync_preserves_lock_when_shared_completion_receipt_was_not_written(self):
		# Arrange: the persisted H7 completion transaction is shared, but its receipt write was interrupted.
		node, lock_path, _, completed = self._interrupt_migrated_aggregate_bonded_batch(
			should_write_completion=False, should_replay_shared_branch=True)
		unused = {**completed, 'lock': {**completed['lock'], 'status': 0}}
		connector = RecoveryConnector(
			node.blocks, 6, hash_lock_responses={lock_path: unused}, transactions_by_path=node.transactions_by_path)
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(
				SymbolRollbackError, 'Symbol receipts Merkle root does not match block at height 7'
			):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([transaction_path(7, 8), statement_path(7, 8)], [
			path for path in connector.paths if path.startswith(('lock/', 'transactions/confirmed?', 'statements/transaction?'))])
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		after = self._recovery()
		self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'restoration_evidence_missing'}, after)

	def test_migrated_sync_rejects_unused_hash_lock_after_completion_before_the_repair_cut(self):
		# Arrange: H6 completed the H5 lock, then orphan H7 reused the key for a new Unused lock.
		blocks, lock_path, completed, reused = self._interrupt_migrated_lock_reuse(retained_end_height=12, should_complete=True)
		response = {**completed, 'lock': {**completed['lock'], 'status': 0}}
		node = RecoveryConnector(blocks, 6, hash_lock_responses={lock_path: response})
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()
		[(current,)] = before.tables['symbol_hash_locks']
		self.assertEqual((reused, 'unused'), (current['raw_payload'], current['status']))
		self.assertEqual([5, 6, 7], sorted(row['height'] for (row,) in before.tables['symbol_receipts']))

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, 'does not match a proven creation on the shared branch'):
				self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		after = self._recovery()
		self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'restoration_evidence_missing'}, after)

	def test_migrated_sync_rejects_missing_hash_lock_when_retained_completion_has_no_proven_origin(self):
		# Arrange: H6 still identifies an older lock whose creation details are missing; only orphan H7 reuse is proven.
		blocks, lock_path, _, reused = self._interrupt_migrated_lock_reuse(retained_end_height=12, should_complete=True)
		database = self.puller.symbol_db
		database.upsert_transactions_for_height(5, [])
		with database.connection, database.connection.cursor() as cursor:
			cursor.execute('DELETE FROM symbol_receipts WHERE height = 5')

		node = RecoveryConnector(blocks, 6)
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()
		[(current,)] = before.tables['symbol_hash_locks']
		self.assertEqual(reused, current['raw_payload'])

		# Act:
		with self._use_database(UnexpectedRepairDatabase(database)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Symbol Hash Lock absence is not supported by the shared branch'):
				self._sync_with_connector(node)

		# Assert:
		self.assertEqual([lock_path], [path for path in node.paths if path.startswith('lock/')])
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		after = self._recovery()
		self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'restoration_evidence_missing'}, after)

	def test_migrated_sync_can_delete_missing_hash_lock_after_shared_expiration_is_finalized(self):
		# Arrange: the sole retained origin ends at verified F=6 and H7 reuse is on the discarded branch.
		blocks, lock_path, _, reused = self._interrupt_migrated_lock_reuse(retained_end_height=6, should_complete=False)
		node = RecoveryConnector(blocks, 6)
		[(current,)] = self._fetch_table_state(('symbol_hash_locks',))['symbol_hash_locks']
		self.assertEqual(reused, current['raw_payload'])

		# Act:
		heights, sync = self._sync_with_connector(node)

		# Assert:
		self.assertEqual(list(range(1, 9)), heights)
		self.assertEqual(('healthy', 8, 6, None), (
			sync['status'], sync['last_synced_height'], sync['finalized_height'], sync['dirty_state_from_height']))
		self.assertEqual([lock_path], [path for path in node.paths if path.startswith('lock/')])
		self.assertEqual([], self._fetch_table_state(('symbol_hash_locks',))['symbol_hash_locks'])
		self.assertEqual([5, 6], sorted(row['height'] for (row,) in self._fetch_table_state(('symbol_receipts',))['symbol_receipts']))

	def test_migrated_sync_can_delete_missing_hash_lock_when_its_only_creation_is_orphaned(self):
		# Arrange: the only origin and the corresponding current row are on the discarded H7 branch.
		_, lock_path, lock_hash = self._interrupt_migrated_hash_lock_batch()
		database = self.puller.symbol_db
		current = {'lock': {
			'hash': lock_hash, 'ownerAddress': SIGNER_ADDRESS, 'mosaicId': NATIVE_MOSAIC_ID,
			'amount': str(HASH_LOCK_AMOUNT), 'endHeight': '12', 'status': 0
		}, 'id': 'orphaned-lock'}
		database.upsert_hash_lock(create_hash_lock_row(current, 7))
		blocks = _chain(8, 7)
		_commit_recovery_suffix(blocks)
		node = RecoveryConnector(blocks, 6)

		# Act:
		heights, sync = self._sync_with_connector(node)

		# Assert:
		self.assertEqual(list(range(1, 9)), heights)
		self.assertEqual(('healthy', 8, 6, None), (
			sync['status'], sync['last_synced_height'], sync['finalized_height'], sync['dirty_state_from_height']))
		self.assertEqual([lock_path], [path for path in node.paths if path.startswith('lock/')])
		self.assertEqual(
			{'symbol_hash_locks': [], 'symbol_transactions': [], 'symbol_receipts': []},
			self._fetch_table_state(('symbol_hash_locks', 'symbol_transactions', 'symbol_receipts')))

	def test_migrated_sync_rejects_bonded_completion_without_a_proven_active_lifetime(self):
		# Arrange: the H5 creation identifies the key, but its end height is uncertain or is the completion height.
		for sql in (
			"UPDATE symbol_transactions SET body = body - 'duration', raw_payload = raw_payload #- '{transaction,duration}' WHERE height = 5",
			"""UPDATE symbol_transactions SET body = jsonb_set(body, '{duration}', '"7.0"'),
			raw_payload = jsonb_set(raw_payload, '{transaction,duration}', '"7.0"') WHERE height = 5""",
			"""
				UPDATE symbol_transactions SET body = jsonb_set(body, '{duration}', '"2"'),
					raw_payload = jsonb_set(raw_payload, '{transaction,duration}', '"2"') WHERE height = 5;
				UPDATE symbol_hash_locks SET end_height = 7;
			"""
		):
			with self.subTest(sql=sql):
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				node, _, _, _ = self._interrupt_migrated_aggregate_bonded_batch(should_write_completion=True)
				with database.connection, database.connection.cursor() as cursor:
					cursor.execute(sql)

				connector = RecoveryConnector(node.blocks, 6)
				before = self._capture_preserved_state()
				recovery = self._recovery()
				generations = self._read_generation_rows()

				# Act:
				with self._use_database(UnexpectedRepairDatabase(database)):
					with self.assertRaisesRegex(SymbolRollbackError, 'contains lock events whose pruned state cannot be reconstructed safely'):
						self._sync_with_connector(connector)

				# Assert:
				self.assertEqual([], [path for path in connector.paths if path.startswith('lock/')])
				self._assert_preserved_state(before, before.sync_state)
				self.assertEqual(generations, self._read_generation_rows())
				after = self._recovery()
				self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'restoration_evidence_missing'}, after)

	def test_migrated_sync_preserves_history_when_hash_lock_response_only_matches_orphan_reuse(self):
		# Arrange: the H7 completion consumes the retained lock and H8 recreates its key on the discarded branch.
		node, lock_path, _, _ = self._interrupt_migrated_aggregate_bonded_batch(should_write_completion=True, reuse_height=8)
		before = self._capture_preserved_state()
		[(orphan_lock,)] = before.tables['symbol_hash_locks']
		connector = RecoveryConnector(node.blocks, 6, hash_lock_responses={lock_path: orphan_lock['raw_payload']})
		recovery = self._recovery()
		generations = self._read_generation_rows()

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, 'does not match a proven creation on the shared branch'):
				self._sync_with_connector(connector)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		after = self._recovery()
		self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'restoration_evidence_missing'}, after)
		self.assertEqual((8, 7), (after['progress']['compare_end'], after['progress']['fork_height']))
		self.assertEqual([statement_path(7, 8), lock_path], [
			path for path in connector.paths if path.startswith(('lock/', 'transactions/confirmed?', 'statements/transaction?'))])

	def test_migrated_sync_preserves_bonded_lock_when_refund_evidence_is_incomplete(self):
		cases = (
			('missing creation receipt', 'DELETE FROM symbol_receipts WHERE height = 5'),
			('raw creation receipt type differs', f"""
				UPDATE symbol_receipts SET raw_payload = jsonb_set(raw_payload, '{{type}}', to_jsonb({ReceiptType.LOCK_HASH_COMPLETED.value}))
				WHERE height = 5
			"""),
			('raw completion receipt type differs', f"""
				UPDATE symbol_receipts SET raw_payload = jsonb_set(raw_payload, '{{type}}', to_jsonb({ReceiptType.LOCK_HASH_CREATED.value}))
				WHERE height = 7
			"""),
			('raw creation height differs', """
				UPDATE symbol_transactions SET raw_payload = jsonb_set(raw_payload, '{meta,height}', to_jsonb('4'::text))
				WHERE height = 5
			"""),
			('raw aggregate height differs', """
				UPDATE symbol_transactions SET raw_payload = jsonb_set(raw_payload, '{meta,height}', to_jsonb('8'::text))
				WHERE height = 7 AND NOT is_embedded
			"""),
			('contradictory creation signer', """
				UPDATE symbol_transactions SET raw_payload = jsonb_set(raw_payload, '{transaction,signerPublicKey}', to_jsonb(repeat('AD', 32)))
				WHERE height = 5
			"""),
			('another plausible creation', """
				INSERT INTO symbol_transactions (hash, is_embedded, height, timestamp, type, type_name,
					signer_public_key, signer_address, raw_payload, body)
				SELECT decode(repeat('AD', 32), 'hex'), false, 4, timestamp, type, type_name, signer_public_key, signer_address,
					raw_payload, jsonb_set(body, '{hash}', to_jsonb(repeat('AC', 32)))
				FROM symbol_transactions WHERE height = 5
			"""),
			('another raw creation with non-lock normalized type', f"""
				INSERT INTO symbol_transactions (hash, is_embedded, height, timestamp, type, type_name,
					signer_public_key, signer_address, raw_payload, body)
				SELECT decode(repeat('AD', 32), 'hex'), false, 4, timestamp, {TransactionType.TRANSFER.value}, 'transfer',
					signer_public_key, signer_address, raw_payload, body
				FROM symbol_transactions WHERE height = 5
			"""),
			('current row disagrees with creation', 'UPDATE symbol_hash_locks SET amount = amount + 1'),
			('completion source does not identify aggregate', 'UPDATE symbol_receipts SET source_primary_id = 2 WHERE height = 7'),
			('raw receipt owner differs from creation', f"""
				UPDATE symbol_receipts SET raw_payload = jsonb_set(raw_payload, '{{targetAddress}}', to_jsonb('{SIGNER_ADDRESS}'::text))
				WHERE height = 7
			"""),
			('nonmatching aggregate hash', """
				UPDATE symbol_transactions SET raw_payload = jsonb_set(raw_payload, '{meta,hash}', to_jsonb(repeat('AD', 32)))
				WHERE height = 7 AND NOT is_embedded
			"""),
			('contradictory aggregate type', f"""
				UPDATE symbol_transactions SET raw_payload = jsonb_set(raw_payload, '{{transaction,type}}', to_jsonb({TransactionType.TRANSFER.value}))
				WHERE height = 7 AND NOT is_embedded
			""")
		)
		for description, sql in cases:
			with self.subTest(description=description):
				# Arrange:
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				node, _, _, _ = self._interrupt_migrated_aggregate_bonded_batch(should_write_completion=True)
				with database.connection, database.connection.cursor() as cursor:
					cursor.execute(sql)

				before = self._capture_preserved_state()
				recovery = self._recovery()
				generations = self._read_generation_rows()
				self.assertIsNotNone(before.refresh_state['valid_run_id'])
				self.assertTrue(generations['symbol_account_refresh_accounts'])

				# Act:
				with self.assertRaisesRegex(SymbolRollbackError, 'contains lock events whose pruned state cannot be reconstructed safely'):
					self._sync_with_connector(node)

				# Assert:
				self._assert_preserved_state(before, before.sync_state)
				self.assertEqual(generations, self._read_generation_rows())
				after = self._recovery()
				self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'restoration_evidence_missing'}, after)
				self.assertEqual((8, 7), (after['progress']['compare_end'], after['progress']['fork_height']))
				self.assertEqual([], [path for path in node.paths if path.startswith(('lock/hash/', 'transactions/confirmed?'))])
				self.assertEqual([], node.post_requests)

	def test_migrated_sync_recovers_an_interrupted_hash_lock_batch_from_persisted_events(self):
		for should_lowercase_hash in (False, True):
			with self.subTest(should_lowercase_hash=should_lowercase_hash):
				# Arrange:
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				node, lock_path, lock_hash = self._interrupt_migrated_hash_lock_batch()
				if should_lowercase_hash:
					with database.connection, database.connection.cursor() as cursor:
						cursor.execute('''
							UPDATE symbol_transactions
							SET raw_payload = jsonb_set(raw_payload, '{transaction,hash}', to_jsonb(%s::text))
							WHERE height = 7
						''', (lock_hash.lower(),))

				# Act: repair requests the persisted logical key before replaying the same branch.
				node.paths.clear()
				heights, sync = self._sync_with_connector(node)

				# Assert:
				self.assertEqual([transaction_path(7, 8), statement_path(7, 8), lock_path, transaction_path(7, 8), statement_path(7, 8)], [
					path for path in node.paths if path.startswith(('lock/', 'transactions/confirmed?', 'statements/transaction?'))])
				self.assertEqual(list(range(1, 9)), heights)
				self.assertEqual(('healthy', 8, 6, None), (
					sync['status'], sync['last_synced_height'], sync['finalized_height'], sync['dirty_state_from_height']))
				recovery = self._recovery()
				self.assertEqual((6, None, None, True), (
					recovery['verified_height'], recovery['resume_height'], recovery['stop_reason'], recovery['legacy_lock_history']))
				[restored_key] = database.get_hash_lock_hashes_updated_from_height(8)
				self.assertEqual(bytes.fromhex(lock_hash), restored_key.hash)

	def test_migrated_sync_preserves_dirty_history_when_the_lock_restore_request_fails(self):
		# Arrange: an interrupted real batch has a complete persisted lock key but no current lock row.
		interrupted_node, lock_path, _ = self._interrupt_migrated_hash_lock_batch()
		before = self._capture_preserved_state()
		recovery = self._recovery()
		failure = NodeException('temporary rollback lock failure')
		node = RecoveryConnector(
			interrupted_node.blocks, 6, hash_lock_responses={lock_path: failure},
			transactions_by_path=interrupted_node.transactions_by_path, statement_pages=interrupted_node.statement_pages)

		# Act:
		with self.assertRaisesRegex(NodeException, '^temporary rollback lock failure$') as raised:
			self._sync_with_connector(node)

		# Assert: the lock was requested from the persisted key, but repair could not clear the dirty history.
		self.assertIs(failure, raised.exception)
		self.assertEqual([transaction_path(7, 8), statement_path(7, 8), *([lock_path] * 3)], [
			path for path in node.paths if path.startswith(('lock/', 'transactions/confirmed?', 'statements/transaction?'))])
		self._assert_preserved_state(before, before.sync_state)
		after = self._recovery()
		self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'reconciliation_wait'}, after)
		self.assertEqual((8, None), (after['progress']['compare_end'], after['progress']['fork_height']))
		self._assert_refresh_skipped_twice(node, 'reconciliation_wait')

	def test_migrated_sync_preserves_dirty_history_when_hash_lock_evidence_is_incomplete(self):
		# Each case starts from the same genuinely persisted Hash Lock transaction and creation receipt.
		cases = (
			('missing signer relation', "DELETE FROM symbol_transaction_addresses WHERE height = 7 AND role = 'signer'"),
			('raw lock type differs from normalized type without a receipt', f"""
				DELETE FROM symbol_receipts WHERE height = 7;
				UPDATE symbol_transactions
				SET raw_payload = jsonb_set(raw_payload, '{{transaction,type}}', to_jsonb({TransactionType.SECRET_PROOF.value}))
				WHERE height = 7
			"""),
			('duplicate receipt at source', """
				INSERT INTO symbol_receipts (
					height, receipt_type, receipt_group, version, source_primary_id, source_secondary_id,
					target_address, mosaic_id, amount, raw_payload
				)
				SELECT height, receipt_type, receipt_group, version, source_primary_id, source_secondary_id,
					target_address, mosaic_id, amount, raw_payload FROM symbol_receipts WHERE height = 7
			"""),
			('different receipt amount', 'UPDATE symbol_receipts SET amount = amount + 1 WHERE height = 7'),
			('different receipt owner', "UPDATE symbol_receipts SET target_address = decode(repeat('FF', 24), 'hex') WHERE height = 7"),
			('ambiguous transaction source', f"""
				INSERT INTO symbol_transactions (
					hash, is_embedded, height, timestamp, type, type_name, signer_public_key, signer_address, raw_payload
				)
				SELECT decode(repeat('EE', 32), 'hex'), false, height, timestamp, {TransactionType.TRANSFER.value}, 'transfer',
					signer_public_key, signer_address, raw_payload FROM symbol_transactions WHERE height = 7
			"""),
			('malformed lock hash', "UPDATE symbol_transactions SET body = jsonb_set(body, '{hash}', to_jsonb('unknown'::text)) WHERE height = 7"),
			('normalized lock hash contradicts original', """
				UPDATE symbol_transactions SET body = jsonb_set(body, '{hash}', to_jsonb(repeat('CD', 32)))
				WHERE height = 7
			"""),
			('missing original lock hash', """
				UPDATE symbol_transactions SET raw_payload = raw_payload #- '{transaction,hash}' WHERE height = 7
			"""),
			('malformed original lock hash', """
				UPDATE symbol_transactions SET raw_payload = jsonb_set(raw_payload, '{transaction,hash}', to_jsonb('unknown'::text))
				WHERE height = 7
			"""),
			('numeric original lock hash matching normalized text', """
				UPDATE symbol_transactions SET body = jsonb_set(body, '{hash}', to_jsonb(repeat('1', 64))),
					raw_payload = jsonb_set(raw_payload, '{transaction,hash}', to_jsonb(repeat('1', 64)::numeric))
				WHERE height = 7
			""")
		)
		for description, sql in cases:
			with self.subTest(description=description):
				# Arrange:
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				node, _, _ = self._interrupt_migrated_hash_lock_batch(should_publish_accounts=True)
				node.paths.clear()
				node.post_requests.clear()
				with database.connection, database.connection.cursor() as cursor:
					cursor.execute(sql)

				before = self._capture_preserved_state()
				recovery = self._recovery()
				generations = self._read_generation_rows()
				self.assertEqual(list(range(1, 9)), self._fetch_block_heights(database))
				self.assertIsNotNone(before.refresh_state['valid_run_id'])
				self.assertTrue(generations['symbol_account_refresh_accounts'])

				# Act:
				with self.assertRaisesRegex(SymbolRollbackError, 'contains lock events whose pruned state cannot be reconstructed safely'):
					self._sync_with_connector(node)

				# Assert: no keys or replacement state can be fetched for an unproven event.
				self._assert_preserved_state(before, before.sync_state)
				self.assertEqual(generations, self._read_generation_rows())
				after = self._recovery()
				self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'restoration_evidence_missing'}, after)
				self.assertEqual((8, None), (after['progress']['compare_end'], after['progress']['fork_height']))
				self.assertEqual([], [path for path in node.paths if path.startswith(('lock/hash/', 'transactions/confirmed?'))])
				self.assertEqual([], node.post_requests)

	def test_migrated_sync_preserves_an_orphan_hash_lock_receipt_without_a_proven_source(self):
		# Arrange: an unmatched creation receipt cannot independently identify its aggregate hash.
		blocks = _chain(8)
		self._seed_legacy_with_unknown_lock_history(blocks[:6], public_height=3, saved_height=6)
		self._sync_with_connector(RecoveryConnector(blocks[:6], 6))
		database = self.puller.symbol_db
		database.mark_sync_write_intent(7)
		database.upsert_blocks([create_block_row(blocks[6], 100, Network.TESTNET)])
		receipt = create_amount_statement_item(7, 1234, receipt_type=ReceiptType.LOCK_HASH_CREATED.value, targetAddress=SIGNER_ADDRESS)
		database.upsert_receipts_for_height(7, create_receipt_rows(receipt), 0)
		before = self._capture_preserved_state()
		node = RecoveryConnector(blocks, 6)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'contains lock events whose pruned state cannot be reconstructed safely'):
			self._sync_with_connector(node)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual(('restoration_evidence_missing', 6, None), (
			self._recovery()['stop_reason'], self._recovery()['verified_height'], self._recovery()['resume_height']))
		self.assertEqual([], [path for path in node.paths if path.startswith(('lock/hash/', 'transactions/confirmed?'))])

	def test_migrated_sync_keeps_blocking_lock_expiry_after_normalized_receipt_label_changes(self):
		receipt_type = ReceiptType.LOCK_HASH_EXPIRED.value
		for raw_type in (receipt_type, str(receipt_type), f'{receipt_type:_}', '٠' + str(receipt_type)):
			with self.subTest(raw_type=raw_type):
				# Arrange: an interrupted batch persisted a source-less Hash Lock expiry and a valid account generation.
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				blocks = _chain(8)
				self._seed_legacy_with_unknown_lock_history(blocks[:6], public_height=3, saved_height=6)
				self._sync_with_published_account_generation(blocks[:6], 6)
				lock_item = {'lock': {
					'hash': 'AB' * 32, 'ownerAddress': SIGNER_ADDRESS, 'mosaicId': NATIVE_MOSAIC_ID, 'amount': '1234',
					'endHeight': '7', 'status': 0
				}, 'id': 'expiring-lock'}
				database.upsert_hash_lock(create_hash_lock_row(lock_item, 6))
				database.mark_sync_write_intent(7)
				database.upsert_blocks([create_block_row(blocks[6], 100, Network.TESTNET)])
				receipt = create_amount_statement_item(7, 1234, receipt_type=raw_type, targetAddress=SIGNER_ADDRESS)
				database.upsert_receipts_for_height(7, create_receipt_rows(receipt), 0)
				first_node = RecoveryConnector(blocks, 6)
				before_first = self._capture_preserved_state()
				self.assertEqual(1, len(before_first.tables['symbol_hash_locks']))

				# Act and assert: with both representations agreeing, an expiry still cannot establish a lock key.
				with self._use_database(UnexpectedRepairDatabase(database)):
					with self.assertRaisesRegex(SymbolRollbackError, 'contains lock events whose pruned state cannot be reconstructed safely'):
						self._sync_with_connector(first_node)

				recovery = self._recovery()
				self.assertEqual('restoration_evidence_missing', recovery['stop_reason'])
				self._assert_preserved_state(before_first, {**before_first.sync_state, 'status': 'unhealthy'})
				self.assertEqual([], [
					path for path in first_node.paths if path.startswith(('lock/', 'transactions/confirmed?', 'statements/transaction?'))])
				self.assertEqual([], first_node.post_requests)

				# Arrange: only the normalized label changes; the lock expiry code remains in the original payload.
				with database.connection, database.connection.cursor() as cursor:
					cursor.execute("UPDATE symbol_receipts SET receipt_type = 'harvestFee' WHERE height = 7")

				before = self._capture_preserved_state()
				self.assertEqual(before_first.tables['symbol_hash_locks'], before.tables['symbol_hash_locks'])
				[(saved,)] = before.tables['symbol_receipts']
				self.assertEqual((7, 'harvestFee', raw_type), (saved['height'], saved['receipt_type'], saved['raw_payload']['type']))
				generations = self._read_generation_rows()
				self.assertIsNotNone(before.refresh_state['valid_run_id'])
				self.assertTrue(generations['symbol_account_refresh_accounts'])
				node = RecoveryConnector(blocks, 6)

				# Act:
				with self._use_database(UnexpectedRepairDatabase(database)):
					with self.assertRaisesRegex(SymbolRollbackError, 'contains lock events whose pruned state cannot be reconstructed safely'):
						self._sync_with_connector(node)

				# Assert:
				self._assert_preserved_state(before, before.sync_state)
				self.assertEqual(generations, self._read_generation_rows())
				self.assertEqual(recovery, self._recovery())
				self.assertEqual([], [
					path for path in node.paths if path.startswith(('lock/', 'transactions/confirmed?', 'statements/transaction?'))])
				self.assertEqual([], node.post_requests)

	def test_sync_registers_verified_ancestor_during_normal_dirty_repair(self):
		# Arrange:
		database = self.puller.symbol_db
		blocks = _chain(6, seal_from=4)
		self._sync_with_connector(RecoveryConnector(blocks[:3], 1))
		# A previously attempted batch has written its header and left its intent.
		database.mark_sync_write_intent(4)
		database.upsert_blocks([create_block_row(block, 100, Network.TESTNET) for block in blocks[3:]])

		# Act: stop between the repair commit and the replacement checkpoint.
		with self._use_database(FailingWriteDatabase(database)):
			with self.assertRaisesRegex(RuntimeError, 'resumed write failed'):
				self._sync_with_connector(RecoveryConnector(blocks, 6))

		# Assert:
		state = database.get_sync_state()
		recovery = self._recovery()
		self.assertEqual((1, 4, 5, 3, 4), (
			state['finalized_height'], state['finalized_epoch'], state['finalized_point'],
			state['last_synced_height'], state['dirty_state_from_height']))
		self.assertEqual((3, None, None, 4), (
			recovery['verified_height'], recovery['verified_epoch'], recovery['verified_point'], recovery['resume_height']))

	def test_migration_records_contiguous_legacy_prefix_and_preserves_public_state_on_replay(self):
		# Arrange: stored heights are dense, but the parent link at three cannot
		# be part of the retained contiguous range. Migration uses only PostgreSQL.
		blocks = _chain(4)
		blocks[2]['block']['previousBlockHash'] = 'AB' * 32
		self._seed_pre_migration_history(blocks, public_height=4, saved_height=4)
		before = self._capture_preserved_state()
		arguments = ['--db-config', str(self.config_ini)]

		# Act:
		migrate_fork_recovery(arguments)

		# Assert:
		migrated = self._recovery()
		self.assertEqual((2, None, 'migration_pending'), (
			migrated['legacy_tip'], migrated['verified_height'], migrated['stop_reason']))
		self.assertEqual((4, 4), (before.sync_state['finalized_height'], before.sync_state['last_synced_height']))
		self._assert_preserved_state(before, before.sync_state)
		with self.puller.symbol_db.connection.cursor() as cursor:
			cursor.execute('SELECT pg_typeof(stop_reason)::text FROM symbol_fork_recovery')
			self.assertEqual(('symbol_fork_recovery_stop_reason',), cursor.fetchone())

		# Act:
		migrate_fork_recovery(arguments)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(migrated, self._recovery())

	def _assert_legacy_ancestor_gap_stops_sync(self, blocks):
		# Arrange: the external writer has committed its deletion.
		before = self._capture_preserved_state()
		database = self.puller.symbol_db

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalization does not establish the legacy rollback boundary$'):
			self._sync_with_connector(RecoveryConnector(blocks, 4))

		# Assert: the missing ancestor is never published as part of a verified prefix.
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual([1, 3, 4, 5], self._fetch_block_heights(database))
		self.assertEqual(1, database.get_contiguous_block_tip())
		recovery = self._recovery()
		self.assertEqual((None, None, 'legacy_fork_unproven', 2, 'missing'), (
			recovery['verified_height'], recovery['continuity_height'], recovery['stop_reason'],
			recovery['progress']['fork_height'], recovery['progress']['fork_difference']))

	def _assert_waiting_for_database_lock(  # pylint: disable=too-many-arguments
		self, observer, waiter_pid, blocker_pid, worker, *, query_fragment=None
	):
		with observer.connection.cursor() as cursor:
			deadline = time.monotonic() + 5
			while time.monotonic() < deadline and not worker.done():
				cursor.execute('SELECT %s = ANY(pg_blocking_pids(%s))', (blocker_pid, waiter_pid))
				if cursor.fetchone()[0]:
					if query_fragment is not None:
						cursor.execute('SELECT query FROM pg_stat_activity WHERE pid = %s', (waiter_pid,))
						self.assertIn(query_fragment, cursor.fetchone()[0])

					return

				time.sleep(0.01)

		self.fail('PostgreSQL did not observe the expected blocked worker')

	def test_initial_migration_waits_for_an_external_history_edit_before_taking_its_snapshot(self):
		# Arrange: an uncommitted delete holds the block table's writer lock.
		blocks = _chain(5)
		self._seed_pre_migration_history(blocks, public_height=4, saved_height=5)
		database = self.puller.symbol_db
		before = database.get_sync_state()
		migration_pid = Queue(maxsize=1)

		@contextmanager
		def connect_at_repeatable_read(config):
			with SymbolDatabase(config) as connection:
				connection.connection.set_session(isolation_level='REPEATABLE READ')
				migration_pid.put(connection.connection.get_backend_pid())
				yield connection

		with (
			SymbolDatabase(database.db_config) as external,
			SymbolDatabase(database.db_config) as observer,
			ThreadPoolExecutor(max_workers=1) as executor
		):
			# Act: let the deletion commit once the real migration is waiting for PostgreSQL.
			with external.connection:
				with external.connection.cursor() as cursor:
					cursor.execute('DELETE FROM symbol_blocks WHERE height = 2')
					self.assertEqual(1, cursor.rowcount)

				worker = executor.submit(
					migrate_fork_recovery, ['--db-config', str(self.config_ini)], database_factory=connect_at_repeatable_read)
				self._assert_waiting_for_database_lock(observer, migration_pid.get(timeout=5), external.connection.get_backend_pid(), worker)

			worker.result(timeout=5)

		# Assert: the migration scanned the committed gap, with no change to public state.
		self.assertEqual(before, database.get_sync_state())
		recovery = self._recovery()
		self.assertEqual((1, 0, 0, None, 'migration_pending'), (
			recovery['legacy_tip'], recovery['continuity_revision'], recovery['block_revision'],
			recovery['verified_height'], recovery['stop_reason']))
		self._assert_legacy_ancestor_gap_stops_sync(blocks)

	def test_invalidation_rescan_keeps_the_old_revision_when_a_writer_deletes_an_ancestor(self):
		# Arrange: pin a legacy comparison at five and hold the recovery row against its rescan update.
		blocks = _chain(5)
		self._seed_legacy(blocks, public_height=4, saved_height=5)
		self._pause_at_pinned_comparison(RecoveryConnector(blocks, 4))
		before = self._capture_preserved_state()
		recovery = self._recovery()
		self.assertEqual(5, recovery['progress']['compare_end'])
		database = self.puller.symbol_db
		node = RecoveryConnector(_chain(5, 5), 4)

		with (
			SymbolDatabase(database.db_config) as external,
			SymbolDatabase(database.db_config) as observer,
			ThreadPoolExecutor(max_workers=1) as executor
		):
			# Act: the external writer commits after the rescan, while its UPDATE waits on the recovery row.
			with external.connection:
				with external.connection.cursor() as cursor:
					cursor.execute('SELECT 1 FROM symbol_fork_recovery WHERE id = 1 FOR UPDATE')
					worker = executor.submit(self._sync_with_connector, node)
					self._assert_waiting_for_database_lock(
						observer, database.connection.get_backend_pid(), external.connection.get_backend_pid(), worker,
						query_fragment='SET legacy_tip')
					cursor.execute('DELETE FROM symbol_blocks WHERE height = 2')
					self.assertEqual(1, cursor.rowcount)

			with self.assertRaisesRegex(SymbolRollbackError, '^Pinned Symbol reconciliation evidence changed$'):
				worker.result(timeout=5)

		# Assert: the committed deletion cannot inherit the old scan's continuity certificate.
		after = self._recovery()
		self._assert_revision_conflict_preserves_checkpoint(before, before.sync_state, {
			**recovery, 'progress': None, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'})
		self.assertNotEqual(after['block_revision'], after['continuity_revision'])
		self._assert_legacy_ancestor_gap_stops_sync(blocks)

	def test_capped_legacy_sync_certifies_only_the_rescanned_prefix_after_an_external_gap(self):
		# Arrange: migration recorded five, but a separate session removed block four.
		blocks = _chain(5, seal_from=4)
		self._seed_legacy(blocks, public_height=3, saved_height=5)
		database = self.puller.symbol_db
		with SymbolDatabase(database.db_config) as external:
			_delete_ancestor(external, height=4)

		# Act: the cap allows a checkpoint of the contiguous prefix only.
		heights, sync = self._sync_with_connector(RecoveryConnector(blocks, 3), max_height=3)

		# Assert:
		self.assertEqual([1, 2, 3, 5], heights)
		recovery = self._recovery()
		self.assertEqual(('healthy', 3, 3, None, 3, None), (
			sync['status'], sync['last_synced_height'], sync['finalized_height'],
			recovery['legacy_tip'], recovery['continuity_height'], recovery['reusable_height']))
		self.assertEqual(recovery['block_revision'], recovery['continuity_revision'])

		# Act: the uncapped run must repair the missing tail rather than reuse the old tip.
		node = RecoveryConnector(blocks, 3)
		heights, sync = self._sync_with_connector(node)

		# Assert:
		self.assertEqual([1, 2, 3, 4, 5], heights)
		self.assertEqual((5, 5), (sync['last_synced_height'], self._recovery()['continuity_height']))
		self.assertEqual([transaction_path(4, 5)], [path for path in node.paths if path.startswith('transactions/confirmed?')])

	def _create_capped_reusable_tip(self):
		blocks = _chain(12)
		self._sync_with_connector(RecoveryConnector(blocks, 7))
		self._sync_with_connector(RecoveryConnector(blocks, 7), max_height=9)
		self.assertEqual(12, self._recovery()['reusable_height'])
		return self.puller.symbol_db

	def test_write_intent_commits_reusable_tip_invalidation_with_the_marker(self):
		# Arrange and establish the valid height boundary for write intents.
		database = self._create_capped_reusable_tip()
		database.mark_sync_write_intent(13)
		old_tip = self._recovery()
		old_sync = database.get_sync_state()
		self.assertEqual((12, 13), (old_tip['reusable_height'], old_sync['dirty_state_from_height']))

		# Act: fail the commit after both writes.
		with _fail_commit(database):
			with self.assertRaisesRegex(RuntimeError, 'checkpoint commit failed'):
				database.mark_sync_write_intent(12)

		# Assert: rollback restores both records.
		self.assertEqual(old_tip, self._recovery())
		self.assertEqual(old_sync, database.get_sync_state())

		# Act:
		database.mark_sync_write_intent(12)

		# Assert:
		self.assertEqual((None, None), (self._recovery()['reusable_height'], self._recovery()['reusable_hash']))
		self.assertEqual(12, database.get_sync_state()['dirty_state_from_height'])

	def test_direct_history_deletion_commits_reusable_tip_invalidation_with_deleted_blocks(self):
		# Arrange and establish that a range above the saved tip does not invalidate it.
		database = self._create_capped_reusable_tip()
		database.delete_blocks_from_height(13)
		old_tip = self._recovery()
		self.assertEqual(12, old_tip['reusable_height'])

		# Act:
		with _fail_commit(database):
			with self.assertRaisesRegex(RuntimeError, 'checkpoint commit failed'):
				database.delete_blocks_from_height(12)

		# Assert:
		self.assertEqual(old_tip, self._recovery())
		self.assertEqual(list(range(1, 13)), self._fetch_block_heights(database))

		# Act:
		database.delete_blocks_from_height(12)

		# Assert:
		self.assertEqual((None, None), (self._recovery()['reusable_height'], self._recovery()['reusable_hash']))
		self.assertEqual(list(range(1, 12)), self._fetch_block_heights(database))

	def test_repair_owns_reusable_tip_when_the_caller_supplies_a_stale_snapshot(self):
		# Arrange: physical block 13 is above the committed reusable tip at height 12.
		database = self._create_capped_reusable_tip()
		database.upsert_blocks([create_block_row(_chain(13)[-1], 100, Network.TESTNET)])
		stale_tip = {'reusable_height': 11, 'reusable_hash': bytes.fromhex(_hash(11, 100_000))}
		checkpoint = self._capture_conditional_checkpoint()
		checkpoint['fork_recovery'].update(stale_tip)

		# Act: remove only the younger row.
		database.repair_rollback_from_height(13, checkpoint, RollbackRefreshEntries())

		# Assert: the database retains its own reusable tip.
		recovery = self._recovery()
		self.assertEqual((12, bytes.fromhex(_hash(12, 100_000))), (recovery['reusable_height'], recovery['reusable_hash']))
		self.assertEqual(list(range(1, 13)), self._fetch_block_heights(database))

		# Arrange: the next attempt reaches the reusable tip.
		checkpoint = self._capture_conditional_checkpoint()
		checkpoint['fork_recovery'].update(stale_tip)

		# Act:
		with _fail_commit(database):
			with self.assertRaisesRegex(RuntimeError, '^checkpoint commit failed$'):
				database.repair_rollback_from_height(12, checkpoint, RollbackRefreshEntries())

		# Assert: the failed commit rolls back the deletion and invalidation together.
		self.assertEqual(recovery, self._recovery())
		self.assertEqual(list(range(1, 13)), self._fetch_block_heights(database))

		# Act:
		database.repair_rollback_from_height(12, checkpoint, RollbackRefreshEntries())

		# Assert:
		recovery = self._recovery()
		self.assertEqual((None, None), (recovery['reusable_height'], recovery['reusable_hash']))
		self.assertEqual(list(range(1, 12)), self._fetch_block_heights(database))

	def _create_symbol_rest_client(self):
		# The REST package and its runtime dependencies are optional in Puller's
		# package-only test run. The cross-package command is recorded in the design.
		flask = pytest.importorskip('flask', exc_type=ModuleNotFoundError)
		rest_routes = pytest.importorskip('rest.routes.symbol', exc_type=ModuleNotFoundError)
		rest_database = pytest.importorskip('rest.db.SymbolDatabase', exc_type=ModuleNotFoundError)
		rest_facade = pytest.importorskip('rest.facade.SymbolRestFacade', exc_type=ModuleNotFoundError)
		rest_app = pytest.importorskip('rest', exc_type=ModuleNotFoundError)
		native = NativeMosaicInfo(NATIVE_MOSAIC_ID, 6)
		database = self.exit_stack.enter_context(rest_database.SymbolDatabase(self.puller.symbol_db.db_config, native))
		app = flask.Flask(__name__)
		rest_app.setup_error_handlers(app)
		rest_routes.setup_symbol_routes(app, rest_facade.SymbolRestFacade(
			database, SymbolNodeConfiguration.from_url('http://node.test:3000'), native, Network.TESTNET))
		return app.test_client()

	def test_rest_reads_public_values_at_a_capped_puller_checkpoint(self):
		# Arrange: a committed block may be visible before finality is publishable.
		client = self._create_symbol_rest_client()
		address = str(Network.TESTNET.address_class(bytes.fromhex(BENEFICIARY_ADDRESS)))
		blocks = _chain(3)
		blocks[1]['meta'].update(transactionsCount=1, totalTransactionsCount=2)
		transactions = {
			transaction_path(1, 2): create_transaction_page(create_complete_aggregate_pair(2, 'AB' * 32, 0))
		}
		self._sync_with_connector(RecoveryConnector(
			blocks, 3, transactions_by_path=transactions, account_by_address={address: create_account_item()}), max_height=2)

		# Act:
		block_response = client.get('/api/symbol/blocks?limit=2&fromHeight=2')
		account_response = client.get(f'/api/symbol/account?address={address}')
		health = client.get('/api/symbol/health').json

		# Assert:
		self.assertEqual(200, block_response.status_code)
		self.assertEqual([(2, False, 0.002, 2, 1, 100002), (1, False, 0.001, 0, 0, 100001)], [
			(
				block['height'], block['isFinalized'], block['totalFees'], block['totalTransactions'],
				block['topLevelTransactions'], block['difficulty']
			)
			for block in block_response.json])
		self.assertEqual(503, account_response.status_code)
		self.assertEqual((True, None, 2), (health['backendSynced'], health['finalizedHeight'], health['lastDBHeight']))

	def test_rest_marks_capped_blocks_finalized_after_the_puller_publishes_finality(self):
		# Arrange:
		client = self._create_symbol_rest_client()
		node = RecoveryConnector(_chain(3), 3)
		self._sync_with_connector(node, max_height=2)
		self._sync_with_connector(node)

		# Act:
		block_response = client.get('/api/symbol/blocks?limit=3&fromHeight=3')

		# Assert:
		self.assertEqual(200, block_response.status_code)
		self.assertEqual([(3, True), (2, True), (1, True)], [(block['height'], block['isFinalized']) for block in block_response.json])

	def test_rest_updates_voting_key_status_when_the_puller_publishes_a_new_epoch(self):
		# Arrange:
		client = self._create_symbol_rest_client()
		address = str(Network.TESTNET.address_class(bytes.fromhex(BENEFICIARY_ADDRESS)))
		account_path = f'/api/symbol/account?address={address}'
		account = create_account_item(supplementalPublicKeys={
			'voting': {'publicKeys': [{'publicKey': 'AA' * 32, 'startEpoch': 5, 'endEpoch': 8}]}
		})
		blocks = _chain(3)
		for epoch, status in ((4, 'future'), (5, 'current')):
			with self.subTest(epoch=epoch):
				# Act:
				self._sync_with_connector(RecoveryConnector(
					blocks, 3, account_by_address={address: account}, finalized_fields={'finalizationEpoch': epoch}))
				account_response = client.get(account_path)

				# Assert:
				self.assertEqual(200, account_response.status_code)
				self.assertEqual(
					[{'publicKey': 'AA' * 32, 'startEpoch': 5, 'endEpoch': 8, 'status': status}], account_response.json['votingKeys'])

	def test_rest_reports_unhealthy_status_after_a_puller_recovery_stop(self):
		# Arrange:
		client = self._create_symbol_rest_client()
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 3))

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Node finalized height is below the verified finalized height'):
			self._sync_with_connector(RecoveryConnector(blocks, 2))

		health = client.get('/api/symbol/health').json

		# Assert:
		self.assertEqual((False, 3, 'unhealthy'), (health['backendSynced'], health['finalizedHeight'], health['status']))
		self.assertEqual([{'type': 'rollback', 'message': 'Symbol backend is in an unhealthy rollback state'}], health['errors'])

	def test_rest_preserves_committed_reads_during_prewrite_node_transport_failures(self):
		# Arrange: both REST routes read a committed healthy checkpoint from the same PostgreSQL database.
		client = self._create_symbol_rest_client()
		blocks = _chain(3)
		address = self._sync_with_published_account_generation(blocks, 2)
		before = self._capture_preserved_state()
		self.assertIsNotNone(before.refresh_state['valid_run_id'])
		generations = self._read_generation_rows()
		self.assertTrue(generations['symbol_account_refresh_accounts'])
		recovery = self._recovery()
		paths = ('/api/symbol/blocks?limit=1', f'/api/symbol/account?address={address}')
		responses = [client.get(path) for path in paths]
		self.assertEqual([200, 200], [response.status_code for response in responses])
		cases = (
			(
				RecoveryConnector(blocks, 2, chain_info_error=NodeException('temporary chain info failure')),
				'temporary chain info failure', ['chain/info'] * 3
			),
			(
				RecoveryConnector(blocks, 2, evidence_by_height={3: NodeException('temporary retained block failure')}),
				'temporary retained block failure', ['chain/info'] + ['blocks/3'] * 3
			),
			(
				RecoveryConnector(blocks[:2], 2, unavailable_page=1),
				'block evidence page unavailable', ['chain/info', 'blocks/2'] + ['blocks?pageSize=100&offset=1&orderBy=height'] * 3
			),
			(
				RecoveryConnector(_chain(4), 2, unavailable_page=3),
				'block evidence page unavailable', ['chain/info', 'blocks/3', 'blocks/2'] + ['blocks?pageSize=100&offset=3&orderBy=height'] * 3
			)
		)

		for node, error, expected_paths in cases:
			with self.subTest(expected_paths=expected_paths):
				# Act:
				with self.assertRaisesRegex(NodeException, error):
					self._sync_with_connector(node)

				# Assert: failed reads leave both route responses and the persisted checkpoint intact.
				self.assertEqual(expected_paths, [path for path in node.paths if path == 'chain/info' or path.startswith('blocks')])
				self._assert_preserved_state(before, before.sync_state)
				self.assertEqual(recovery, self._recovery())
				self.assertEqual(generations, self._read_generation_rows())
				current = [client.get(path) for path in paths]
				self.assertEqual([(response.status_code, response.json) for response in responses], [
					(response.status_code, response.json) for response in current])

	def _seed_hash_lock_reaching_finality(self):
		lock_hash = 'AB' * 32
		item = {'lock': {
			'hash': lock_hash, 'ownerAddress': SIGNER_ADDRESS, 'mosaicId': NATIVE_MOSAIC_ID,
			'amount': '1234', 'endHeight': '2', 'status': 0
		}, 'id': 'reaching-finality'}
		self.puller.symbol_db.upsert_hash_lock(create_hash_lock_row(item, 1))
		return f'lock/hash/{lock_hash}', item

	def _assert_sync_defers_live_hash_lock_cleanup_at_a_cap(self, original, expected_cut):  # pylint: disable=too-many-locals
		# Arrange: the lock reaching finality at H4 is reused by another owner at H5, above the cap.
		key = 'AB' * 32
		path = f'lock/hash/{key}'
		old = {
			'hash': key, 'ownerAddress': SIGNER_ADDRESS, 'mosaicId': NATIVE_MOSAIC_ID,
			'amount': str(HASH_LOCK_AMOUNT), 'endHeight': '4', 'status': 0
		}
		new_public_key = '12' * 32
		new_owner = Network.TESTNET.public_key_to_address(PublicKey(new_public_key)).bytes.hex().upper()
		later = {**old, 'ownerAddress': new_owner, 'endHeight': '10'}
		creation, _ = self._create_bonded_lock_origin(2, SIGNER_PUBLIC_KEY, old)
		recreation, _ = self._create_bonded_lock_origin(5, new_public_key, later)
		blocks = _chain(6)
		_set_block_transactions(blocks[1], [creation])
		_set_block_transactions(blocks[4], [recreation])
		_commit_recovery_suffix(blocks, 2)
		_set_block_transactions(original[1], [creation])
		_commit_recovery_suffix(original, 2)
		self._sync_with_published_account_generation(
			original[:2], 1, transactions_by_path={transaction_path(1, 2): create_transaction_page([creation])},
			hash_lock_responses={path: {'lock': old}})
		self._sync_with_connector(RecoveryConnector(original, 1))
		before = self._capture_preserved_state()
		generations = self._read_generation_rows()
		self.assertEqual((3, 1), (before.sync_state['last_synced_height'], before.sync_state['finalized_height']))
		[(old_row,)] = before.tables['symbol_hash_locks']
		self.assertEqual(('\\x' + SIGNER_ADDRESS.lower(), 4, 2), (old_row['owner_address'], old_row['end_height'], old_row['updated_at_height']))
		future_request = transaction_path(5, 6)
		transactions = {future_request: create_transaction_page([recreation])}
		responses = {path: {'lock': later}}
		capped = RecoveryConnector(blocks, 4, transactions_by_path=transactions, hash_lock_responses=responses)
		wrapper = ObserveRepairCutDatabase(self.puller.symbol_db, self._capture_preserved_state)

		# Act:
		with self._use_database(wrapper):
			heights, state = self._sync_with_connector(capped, max_height=4)

		# Assert: the H4 checkpoint is valid, and neither cleanup nor a lookup can import H5's state.
		self.assertEqual(expected_cut, wrapper.cut.sync_state['dirty_state_from_height'] if wrapper.cut else None)
		self.assertEqual((list(range(1, 5)), 'healthy', 4, 4, 4, None, None), (
			heights, state['status'], state['last_synced_height'], state['finalized_height'], self._recovery()['verified_height'],
			state['dirty_state_from_height'], self._recovery()['resume_height']))
		after_cap = self._capture_preserved_state()
		self.assertEqual(before.tables['symbol_hash_locks'], after_cap.tables['symbol_hash_locks'])
		self.assertEqual(before.tables['symbol_transactions'], after_cap.tables['symbol_transactions'])
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual([], [request for request in capped.paths if request == future_request or request.startswith('lock/hash/')])

		# Act: processing the real H5 creation without the cap can now store the reused lifetime.
		uncapped = RecoveryConnector(blocks, 4, transactions_by_path=transactions, hash_lock_responses=responses)
		heights, state = self._sync_with_connector(uncapped)

		# Assert:
		self.assertEqual((list(range(1, 7)), 'healthy', 6, 4, None, None), (
			heights, state['status'], state['last_synced_height'], state['finalized_height'],
			state['dirty_state_from_height'], self._recovery()['resume_height']))
		self.assertEqual([future_request, path], [
			request for request in uncapped.paths if request.startswith(('transactions/confirmed?', 'lock/hash/'))])
		self.assertEqual({'symbol_hash_locks': [({
			**old_row, 'owner_address': '\\x' + new_owner.lower(), 'end_height': 10, 'updated_at_height': 6, 'raw_payload': {'lock': later}
		},)]}, self._fetch_table_state(('symbol_hash_locks',)))

	def test_sync_defers_live_hash_lock_cleanup_when_cap_excludes_recreation(self):
		self._assert_sync_defers_live_hash_lock_cleanup_at_a_cap(_chain(3), None)

	def test_sync_defers_live_hash_lock_cleanup_after_capped_fork_replay(self):
		# Arrange:
		original = _chain(3)
		original[2]['block']['stateHash'] = 'AB' * 32

		self._assert_sync_defers_live_hash_lock_cleanup_at_a_cap(original, 3)

	def test_sync_defers_capped_repair_when_the_cut_requires_live_hash_lock_state(self):
		# Arrange: the key was last written in the cut, and the node has progressed beyond the cap.
		blocks = _chain(6, seal_from=3)
		orphaned = _chain(3, seal_from=3, fork_height=3)
		self._sync_with_published_account_generation(orphaned, 1)
		_, lock = self._seed_hash_lock_reaching_finality()
		database = self.puller.symbol_db
		database.upsert_hash_lock(create_hash_lock_row(lock, 3))
		saved = self._capture_repair_state_with_generation()
		node = RecoveryConnector(blocks, 1)

		# Act:
		self._sync_expecting_rejection_before_repair(
			node, '^Live Symbol Hash Lock state cannot establish the capped repair baseline$', max_height=4)

		# Assert:
		self._assert_repair_state_with_generation_preserved(saved)
		self.assertEqual('cap_blocks_dirty_repair', self._recovery()['stop_reason'])
		self.assertEqual([], [request for request in node.paths if request.startswith('lock/hash/')])

	def test_rest_preserves_committed_reads_when_lock_cleanup_transport_fails_then_retries(self):  # pylint: disable=too-many-locals
		# Arrange: lock cleanup becomes due only after the next checkpoint publishes finality at two.
		client = self._create_symbol_rest_client()
		blocks = _chain(3)
		address = self._sync_with_published_account_generation(blocks, 1)
		lock_path, _ = self._seed_hash_lock_reaching_finality()
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()
		self.assertIsNotNone(before.refresh_state['valid_run_id'])
		self.assertTrue(generations['symbol_account_refresh_accounts'])
		self.assertEqual((1, 1, 3), (
			before.sync_state['finalized_height'], recovery['verified_height'], before.sync_state['last_synced_height']))
		paths = ('/api/symbol/blocks?limit=1', f'/api/symbol/account?address={address}')
		responses = [client.get(path) for path in paths]
		self.assertEqual([200, 200], [response.status_code for response in responses])
		failure = NodeException('temporary lock detail failure')
		node = RecoveryConnector(blocks, 2, hash_lock_responses={lock_path: failure})

		# Act:
		with self.assertRaisesRegex(NodeException, '^temporary lock detail failure$') as raised:
			self._sync_with_connector(node)

		# Assert: finality committed, and a failed cleanup read changed none of the current rows or generations.
		self.assertIs(failure, raised.exception)
		self.assertEqual([lock_path] * 3, [path for path in node.paths if path.startswith('lock/')])
		finalized_hash = bytes.fromhex(blocks[1]['meta']['hash'])
		committed_state = {**before.sync_state, 'finalized_height': 2, 'finalized_hash': finalized_hash}
		committed_recovery = {**recovery, 'verified_height': 2, 'verified_hash': finalized_hash}
		self._assert_preserved_state(before, committed_state)
		self.assertEqual(committed_recovery, self._recovery())
		self.assertEqual(generations, self._read_generation_rows())
		current = [client.get(path) for path in paths]
		self.assertEqual([(response.status_code, response.json) for response in responses], [
			(response.status_code, response.json) for response in current])

		# Act: the same pending key is fetched again, now with a successful structured not-found response.
		retry = RecoveryConnector(blocks, 2)
		self._sync_with_connector(retry)

		# Assert: the pending cleanup transaction removed the lock and left the checkpoint intact.
		self.assertEqual([lock_path], [path for path in retry.paths if path.startswith('lock/')])
		self._assert_preserved_state(before._replace(tables={**before.tables, 'symbol_hash_locks': []}), committed_state)
		self.assertEqual(committed_recovery, self._recovery())
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual([200, 200], [client.get(path).status_code for path in paths])

	def test_sync_marks_checkpoint_unhealthy_on_mismatched_finalization_cleanup_lock(self):
		# Arrange: the node's successful response identifies a different lock than the requested key.
		blocks = _chain(3)
		self._sync_with_published_account_generation(blocks, 2)
		lock_path, item = self._seed_hash_lock_reaching_finality()
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()
		mismatched = {**item, 'lock': {**item['lock'], 'hash': 'CD' * 32}}
		node = RecoveryConnector(blocks, 2, hash_lock_responses={lock_path: mismatched})

		# Act:
		with self.assertRaisesRegex(CorruptDataException, 'Symbol Hash Lock response hash does not match dirty key'):
			self._sync_with_connector(node)

		# Assert: invalid data closes the gate and leaves the last committed state available for repair.
		self.assertEqual([lock_path], [path for path in node.paths if path.startswith('lock/')])
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual(recovery, self._recovery())
		self.assertEqual(generations, self._read_generation_rows())

	def test_rest_preserves_committed_reads_when_retained_block_returns_http_503_with_json_null(self):
		# Arrange: publish real block and account state in the database shared by Puller and REST.
		client = self._create_symbol_rest_client()
		blocks = _chain(3)
		address = self._sync_with_published_account_generation(blocks, 2)
		before = self._capture_preserved_state()
		generations = self._read_generation_rows()
		recovery = self._recovery()
		self.assertIsNotNone(before.refresh_state['valid_run_id'])
		self.assertTrue(generations['symbol_account_refresh_accounts'])
		self.assertEqual(('healthy', 2, 2, 3, None), (
			before.sync_state['status'], before.sync_state['finalized_height'], recovery['verified_height'],
			before.sync_state['last_synced_height'], recovery['stop_reason']))
		paths = ('/api/symbol/blocks?limit=1', f'/api/symbol/account?address={address}')
		responses = [(response.status_code, response.json) for response in (client.get(path) for path in paths)]
		self.assertEqual([200, 200], [status for status, _ in responses])
		http_paths = []

		async def unavailable_block(request):
			http_paths.append(request.path)
			return web.json_response(None, status=503)

		async def sync_with_unavailable_block():
			app = web.Application()
			app.router.add_get('/blocks/3', unavailable_block)
			with self.assertRaisesRegex(HttpException, '^HTTP request failed with code 503$') as raised:
				async with TestServer(app) as server:
					endpoint = str(server.make_url('')).rstrip('/')
					async with SymbolPullerConnector(endpoint, 13, 100) as connector:
						node = HttpBlockEvidenceConnector(blocks, 2, connector)
						set_symbol_connector(self.puller, node)
						await self.puller.sync_block_headers()

			return node.paths, raised.exception.http_status_code

		# Act:
		node_paths, status = asyncio.run(sync_with_unavailable_block())

		# Assert: the real HTTP failure was retried and left the published checkpoint and route bodies intact.
		self.assertEqual(503, status)
		self.assertEqual(['/blocks/3'] * 3, http_paths)
		self.assertEqual(['chain/info'] + ['blocks/3'] * 3, node_paths)
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(recovery, self._recovery())
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual(responses, [(response.status_code, response.json) for response in (client.get(path) for path in paths)])

	def test_sync_keeps_the_gate_when_chain_info_conflicts_with_verified_finality_before_transport_fails(self):
		# Arrange: the new chain info contradicts verified F=2 before the first retained block request.
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 2))
		before = self._capture_preserved_state()
		recovery = self._recovery()
		node = RecoveryConnector(
			blocks, 2, finalized_fields={'hash': 'AB' * 32},
			evidence_by_height={3: NodeException('temporary retained block failure')})

		# Act:
		with self.assertRaisesRegex(NodeException, '^temporary retained block failure$'):
			self._sync_with_connector(node)

		# Assert: transport failure cannot erase the already-known discrepancy in finality.
		self.assertEqual(['chain/info'] + ['blocks/3'] * 3, [
			path for path in node.paths if path == 'chain/info' or path.startswith('blocks')])
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual({**recovery, 'stop_reason': 'reconciliation_wait'}, self._recovery())

	def test_sync_keeps_the_gate_when_advanced_retained_finality_conflicts_before_transport_fails(self):
		# Arrange: the local block and the retained tip's parent are A at two, while chain info declares B.
		blocks = _chain(3)
		self._sync_with_published_account_generation(blocks, 1)
		before = self._capture_preserved_state()
		generations = self._read_generation_rows()
		recovery = self._recovery()
		self.assertEqual(('healthy', 1, 1, 3), (
			before.sync_state['status'], before.sync_state['finalized_height'], recovery['verified_height'],
			before.sync_state['last_synced_height']))
		self.assertIsNotNone(before.refresh_state['valid_run_id'])
		finalized_hash = _chain(3, 2)[1]['meta']['hash']
		self.assertNotEqual(bytes.fromhex(finalized_hash), self._fetch_block_hash(self.puller.symbol_db, 2))
		failure = NodeException('temporary finalized block read failure')
		node = RecoveryConnector(blocks, 2, finalized_fields={'hash': finalized_hash}, evidence_by_height={2: failure})

		# Act:
		with self.assertRaisesRegex(NodeException, '^temporary finalized block read failure$') as raised:
			self._sync_with_connector(node)

		# Assert: the failed request preserves the previously observed discrepancy without publishing F.
		self.assertIs(failure, raised.exception)
		self.assertEqual(['chain/info', 'blocks/3'] + ['blocks/2'] * 3, node.paths)
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual({**recovery, 'stop_reason': 'reconciliation_wait'}, self._recovery())
		self.assertEqual(generations, self._read_generation_rows())

	def _assert_failed_prerequisite(self, node, failure, expected_paths, *, max_height=None, **puller_options):
		# Each invocation has empty prerequisite caches, as it would in a new worker process.
		puller = create_symbol_puller(self.config_ini, 'testnet', **puller_options)
		set_symbol_connector(puller, node)
		with puller.symbol_db:
			with self.assertRaises(NodeException) as raised:
				asyncio.run(puller.sync_block_headers(max_height))

		self.assertIs(failure, raised.exception)
		self.assertEqual(expected_paths, node.paths)

	def _assert_sync_records_finality_conflict_after_prerequisite_failure(self, failure_path, *, should_bump_revision):
		# Arrange: the saved prefix includes A2, while the new worker observes F=2/B.
		blocks = _chain(3)
		self._sync_with_published_account_generation(blocks, 1)
		if should_bump_revision:
			with self.puller.symbol_db.connection as connection, connection.cursor() as cursor:
				cursor.execute('UPDATE symbol_blocks SET hash = hash WHERE height = 3')

		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()
		self.assertEqual((1, 1, 3, 'healthy'), (
			before.sync_state['finalized_height'], recovery['verified_height'], before.sync_state['last_synced_height'],
			before.sync_state['status']))
		self.assertIsNotNone(before.refresh_state['valid_run_id'])
		self.assertTrue(generations['symbol_account_refresh_accounts'])
		self.assertEqual(should_bump_revision, recovery['block_revision'] != recovery['continuity_revision'])
		finalized_hash = _chain(3, 2)[1]['meta']['hash']
		failure = NodeException(f'temporary {failure_path} failure')
		node = FailingPrerequisiteConnector(blocks, 2, failure_path, failure, finalized_fields={'hash': finalized_hash})
		prerequisites = [] if failure_path == 'network/properties' else ['network/properties']

		# Act:
		self._assert_failed_prerequisite(node, failure, ['chain/info', *prerequisites, *([failure_path] * 3)])

		# Assert: the original transport failure leaves F unpublished and blocks stale reads.
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual({**recovery, 'stop_reason': 'reconciliation_wait'}, self._recovery())
		self.assertEqual(generations, self._read_generation_rows())

	def test_sync_records_finality_conflict_when_network_properties_fail(self):
		self._assert_sync_records_finality_conflict_after_prerequisite_failure('network/properties', should_bump_revision=True)

	def test_sync_records_finality_conflict_when_native_mosaic_fails(self):
		self._assert_sync_records_finality_conflict_after_prerequisite_failure(
			f'mosaics/{NATIVE_MOSAIC_ID}', should_bump_revision=False)

	def test_sync_records_a_bad_verified_anchor_when_network_properties_fail(self):
		# Arrange: a verified database's stored block at V no longer matches the verified anchor.
		blocks = _chain(3)
		self._sync_with_published_account_generation(blocks, 1)
		with self.puller.symbol_db.connection as connection, connection.cursor() as cursor:
			cursor.execute("UPDATE symbol_blocks SET hash = decode(repeat('AB', 32), 'hex') WHERE height = 1")

		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()
		failure = NodeException('temporary network properties failure')
		node = FailingPrerequisiteConnector(blocks, 2, 'network/properties', failure)

		# Act:
		self._assert_failed_prerequisite(node, failure, ['chain/info'] + ['network/properties'] * 3)

		# Assert: the anchor conflict persists even though the original request error propagates.
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual({**recovery, 'stop_reason': 'verified_anchor_conflict'}, self._recovery())
		self.assertEqual(generations, self._read_generation_rows())

	def test_sync_keeps_checkpoint_healthy_when_failed_prerequisite_has_no_comparable_conflict(self):
		# Arrange:
		blocks = _chain(4)
		self._sync_with_published_account_generation(blocks[:3], 1)
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()
		cases = (
			(None, 2, blocks[1]['meta']['hash']),
			(1, 2, _chain(3, 2)[1]['meta']['hash']),
			(None, 4, blocks[3]['meta']['hash'])
		)
		for cap, finalized_height, finalized_hash in cases:
			with self.subTest(cap=cap, finalized_height=finalized_height):
				failure = NodeException('temporary network properties failure')
				node = FailingPrerequisiteConnector(
					blocks, finalized_height, 'network/properties', failure, finalized_fields={'hash': finalized_hash})

				# Act:
				self._assert_failed_prerequisite(node, failure, ['chain/info'] + ['network/properties'] * 3, max_height=cap)

				# Assert:
				self._assert_preserved_state(before, before.sync_state)
				self.assertEqual(recovery, self._recovery())
				self.assertEqual(generations, self._read_generation_rows())

	def test_sync_leaves_legacy_recovery_uninitialized_when_prerequisite_fails(self):
		# Arrange:
		blocks = _chain(3)
		self._seed_pre_migration_history(blocks, public_height=1, saved_height=3)
		before = self._capture_preserved_state()
		failure = NodeException('temporary native mosaic failure')
		mosaic_path = f'mosaics/{NATIVE_MOSAIC_ID}'
		node = FailingPrerequisiteConnector(
			blocks, 2, mosaic_path, failure, finalized_fields={'hash': _chain(3, 2)[1]['meta']['hash']})

		# Act:
		self._assert_failed_prerequisite(node, failure, ['chain/info', 'network/properties'] + [mosaic_path] * 3)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertIsNone(self._recovery())

	def test_sync_preserves_prerequisite_error_when_conflict_classification_exhausts_budget(self):
		# Arrange: even checking for a conflict requires the usual reconciliation SQL budget.
		blocks = _chain(3)
		self._sync_with_published_account_generation(blocks, 1)
		before = self._capture_preserved_state()
		recovery = self._recovery()
		failure = NodeException('temporary network properties failure')
		node = FailingPrerequisiteConnector(
			blocks, 2, 'network/properties', failure, finalized_fields={'hash': _chain(3, 2)[1]['meta']['hash']})

		# Act:
		self._assert_failed_prerequisite(
			node, failure, ['chain/info'] + ['network/properties'] * 3,
			reconciliation_budget_factory=partial(ReconciliationBudget, time_limit=0))

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(recovery, self._recovery())

	def test_sync_logs_an_unavailable_saved_range_without_recording_a_prerequisite_stop(self):
		# Arrange:
		blocks = _chain(3)
		self._sync_with_published_account_generation(blocks, 1)
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()
		failure = NodeException('temporary network properties failure')
		node = FailingPrerequisiteConnector(blocks, 2, 'network/properties', failure)
		self.puller = create_symbol_puller(self.config_ini, 'testnet')
		database = self.exit_stack.enter_context(self.puller.symbol_db)

		# Act:
		with self._use_database(FailingSavedRangeDatabase(database)):
			with self.assertLogs(log.logger, level='ERROR') as messages:
				with self.assertRaises(NodeException) as raised:
					self._sync_with_connector(node)

		# Assert:
		self.assertIs(failure, raised.exception)
		self.assertEqual(['chain/info'] + ['network/properties'] * 3, node.paths)
		self.assertEqual(['Failed to classify a Symbol sync prerequisite failure: Unable to verify persisted saved block range'], [
			record.getMessage() for record in messages.records if 'Failed to classify' in record.getMessage()
		])
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(recovery, self._recovery())
		self.assertEqual(generations, self._read_generation_rows())

	def test_sync_preserves_prerequisite_error_without_a_saved_checkpoint(self):
		# Arrange: an empty migrated database has a fork row but no published history.
		migrate_fork_recovery(['--db-config', str(self.config_ini)])
		before = self._capture_preserved_state()
		recovery = self._recovery()
		failure = NodeException('temporary network properties failure')
		node = FailingPrerequisiteConnector(_chain(3), 2, 'network/properties', failure)

		# Act:
		self._assert_failed_prerequisite(node, failure, ['chain/info'] + ['network/properties'] * 3)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(recovery, self._recovery())

	def test_sync_preserves_healthy_checkpoint_when_advanced_finality_does_not_conflict_in_range(self):
		# Arrange: a new F=2 either agrees with the stored block or lies outside the invocation's cap.
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		before = self._capture_preserved_state()
		recovery = self._recovery()
		cases = (
			(None, blocks[1]['meta']['hash'], 2, ['chain/info', 'blocks/3'] + ['blocks/2'] * 3),
			(1, _chain(3, 2)[1]['meta']['hash'], 3, ['chain/info'] + ['blocks/3'] * 3)
		)
		for cap, finalized_hash, failing_height, expected_paths in cases:
			with self.subTest(cap=cap):
				failure = NodeException('temporary retained block read failure')
				node = RecoveryConnector(blocks, 2, finalized_fields={'hash': finalized_hash}, evidence_by_height={failing_height: failure})

				# Act:
				with self.assertRaisesRegex(NodeException, '^temporary retained block read failure$') as raised:
					self._sync_with_connector(node, max_height=cap)

				# Assert: temporary transport failure leaves the checkpoint and recovery gate intact.
				self.assertIs(failure, raised.exception)
				self.assertEqual(expected_paths, node.paths)
				self._assert_preserved_state(before, before.sync_state)
				self.assertEqual(recovery, self._recovery())

	def test_sync_keeps_the_gate_when_finality_conflicts_below_the_matching_reusable_tip(self):
		# Arrange: cap an already committed branch, retaining the reusable tip and its parent.
		blocks = _chain(12)
		self._sync_with_published_account_generation(blocks, 7)
		self._sync_with_connector(RecoveryConnector(blocks, 7), max_height=9)
		before = self._capture_preserved_state()
		generations = self._read_generation_rows()
		recovery = self._recovery()
		self.assertEqual(('healthy', 7, 7, 9, 12), (
			before.sync_state['status'], before.sync_state['finalized_height'], recovery['verified_height'],
			before.sync_state['last_synced_height'], recovery['reusable_height']))
		finalized_hash = _chain(12, 11)[10]['meta']['hash']
		failure = NodeException('temporary finalized block read failure')
		node = RecoveryConnector(blocks, 11, finalized_fields={'hash': finalized_hash}, evidence_by_height={11: failure})

		# Act:
		with self.assertRaisesRegex(NodeException, '^temporary finalized block read failure$') as raised:
			self._sync_with_connector(node)

		# Assert: the retained tip and its parent were comparable once the cap was removed.
		self.assertIs(failure, raised.exception)
		self.assertEqual(['chain/info', 'blocks/12'] + ['blocks/11'] * 3, node.paths)
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual({**recovery, 'stop_reason': 'reconciliation_wait'}, self._recovery())
		self.assertEqual(generations, self._read_generation_rows())

	def test_sync_keeps_the_gate_when_the_pinned_tip_conflicts_with_chain_info_before_transport_fails(self):
		# Arrange: F=2 does not contradict saved V=1, but its declared hash differs from the pinned block at two.
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		before = self._capture_preserved_state()
		node = RecoveryConnector(blocks[:2], 2, finalized_fields={'hash': 'AB' * 32}, unavailable_page=0)

		# Act:
		with self.assertRaisesRegex(NodeException, '^block evidence page unavailable$'):
			self._sync_with_connector(node)

		# Assert: the failed page follows a directly observed contradiction, so the pin stays gated.
		self.assertEqual(['blocks/2'] + ['blocks?pageSize=100&offset=0&orderBy=height'] * 3, [
			path for path in node.paths if path.startswith('blocks')])
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		recovery = self._recovery()
		self.assertEqual(('reconciliation_wait', 2, None), (
			recovery['stop_reason'], recovery['progress']['compare_end'], recovery['progress']['fork_height']))

	def test_sync_keeps_the_recovery_gate_when_backward_search_observes_a_fork_before_transport_fails(self):
		# Arrange: the shorter node skips the fast path and has a different block on the first backward-search page.
		blocks = _chain(205)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		before = self._capture_preserved_state()
		node = RecoveryConnector(_chain(204, 2), 1, unavailable_page=4)

		# Act:
		with self.assertRaisesRegex(NodeException, '^block evidence page unavailable$'):
			self._sync_with_connector(node)

		# Assert: comparison observed real divergence before deriving a first fork height.
		self.assertEqual(['blocks?pageSize=100&offset=104&orderBy=height'] + ['blocks?pageSize=100&offset=4&orderBy=height'] * 3, [
			path for path in node.paths if path.startswith('blocks?')])
		recovery = self._recovery()
		self.assertEqual(('reconciliation_wait', 104, None), (
			recovery['stop_reason'], recovery['progress']['search_next'], recovery['progress']['fork_height']))
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})

	def test_sync_preserves_a_clean_checkpoint_when_a_rescan_cannot_pin_the_node_tip(self):
		# Arrange: a separate session changes the block revision while leaving the block itself identical.
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 2))
		before = self._capture_preserved_state()
		database = self.puller.symbol_db
		with SymbolDatabase(database.db_config) as external:
			with external.connection:
				with external.connection.cursor() as cursor:
					cursor.execute('UPDATE symbol_blocks SET hash = hash WHERE height = 3')
					self.assertEqual(1, cursor.rowcount)

		recovery = self._recovery()
		self.assertNotEqual(recovery['continuity_revision'], recovery['block_revision'])
		failure = NodeException('temporary comparison tip failure')
		node = RecoveryConnector(blocks, 2, evidence_by_height={3: failure})

		# Act:
		with self.assertRaisesRegex(NodeException, '^temporary comparison tip failure$') as raised:
			self._sync_with_connector(node)

		# Assert: no proof was persisted and the next run must still check the unverified revision.
		self.assertIs(failure, raised.exception)
		self.assertEqual(['blocks/3'] * 3, [path for path in node.paths if path.startswith('blocks')])
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(recovery, self._recovery())

	def test_sync_preserves_the_node_error_when_discarding_transient_comparison_progress_fails(self):
		# Arrange: a shortened matching node pins a comparison before the page request fails.
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 2))
		before = self._capture_preserved_state()
		recovery = self._recovery()
		node = RecoveryConnector(blocks[:2], 2, unavailable_page=1)

		# Act: fail the commit that would have removed the transient pin.
		with self._use_database(FailingTransientComparisonCommitDatabase(self.puller.symbol_db)):
			with self.assertLogs(log.logger, level='ERROR') as diagnostics:
				with self.assertRaisesRegex(NodeException, '^block evidence page unavailable$'):
					self._sync_with_connector(node)

		# Assert: the commit rolled back and the fetch failure remains caller-visible.
		self.assertEqual(1, sum(
			'Failed to discard transient Symbol comparison: checkpoint commit failed' in message
			for message in diagnostics.output))
		self._assert_preserved_state(before, before.sync_state)
		after = self._recovery()
		self.assertEqual({**recovery, 'progress': after['progress'], 'stop_reason': 'reconciliation_wait'}, after)
		self.assertEqual((2, None), (after['progress']['compare_end'], after['progress']['checked_height']))
		self._assert_refresh_skipped_twice(node, 'reconciliation_wait')

	def test_sync_does_not_clear_a_pinned_comparison_after_an_independent_dirty_intent(self):
		# Arrange: a matching shortened tip pins a comparison before an independent writer changes the watermark.
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 2))
		before = self._capture_preserved_state()
		database = self.puller.symbol_db

		# Act:
		with SymbolDatabase(database.db_config) as external:
			node = DirtyIntentOnEvidenceFailureConnector(blocks[:2], external)
			with self.assertRaisesRegex(NodeException, '^block evidence page unavailable$'):
				self._sync_with_connector(node)

		# Assert: the original transport failure propagates and the stale cleanup cannot remove the newer gate.
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy', 'dirty_state_from_height': 3})
		recovery = self._recovery()
		self.assertEqual(('reconciliation_wait', 2, 0), (
			recovery['stop_reason'], recovery['progress']['compare_end'], recovery['invalidations']))

	def test_reconciliation_counts_elapsed_database_page_work_against_the_deadline(self):
		# Arrange:
		blocks = _chain(3)
		self._seed_legacy(blocks, public_height=1, saved_height=3)
		before = self._capture_preserved_state()
		clock = ManualReconciliationClock()
		self.puller = create_symbol_puller(
			self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, time_source=clock))
		database = self.exit_stack.enter_context(self.puller.symbol_db)
		connector = RecoveryConnector(blocks, 1)

		# Act: the initial search and the following PostgreSQL page cost 31 elapsed seconds.
		with self._use_database(DelayedEvidenceDatabase(database, clock)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Symbol branch reconciliation request budget exhausted'):
				self._sync_with_connector(connector)

		# Assert: the previous page remains the durable continuation point, with no forward writes.
		progress = self._recovery()['progress']
		self.assertEqual((1, 1), (progress['checked_height'], progress['common_height']))
		self.assertEqual(31, clock.seconds)
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})

	def test_reconciliation_invalidates_a_changed_parent_at_the_same_saved_hash(self):
		# Arrange:
		blocks = _chain(701)
		self._seed_legacy(blocks, public_height=1, saved_height=701)
		before = self._capture_preserved_state()
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 5))
		self.exit_stack.enter_context(self.puller.symbol_db)
		with self.assertRaisesRegex(SymbolRollbackError, 'Symbol branch reconciliation request budget exhausted'):
			self._sync_with_connector(RecoveryConnector(blocks, 1))

		self.assertEqual((301, [_hash(301, 100_000).lower(), _hash(300, 100_000).lower()]), (
			self._recovery()['progress']['checked_height'], self._recovery()['progress']['checked_evidence']))

		# Act: the pinned tip and all hashes stay the same; the previously checked parent changes.
		blocks[300]['block']['previousBlockHash'] = 'AB' * 32
		connector = RecoveryConnector(blocks, 1)
		with self.assertRaisesRegex(SymbolRollbackError, 'Pinned Symbol reconciliation evidence changed'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual((1, None), (self._recovery()['invalidations'], self._recovery()['progress']))
		self.assertEqual(['blocks/701', 'blocks/301'], [path for path in connector.paths if path.startswith('blocks')])
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})

	def test_migration_rejects_connection_settings_inherited_from_default(self):
		# Arrange: the password is supplied only as a default, even if empty for trust auth.
		configuration = configparser.ConfigParser()
		database_values = self.puller.symbol_db.db_config._asdict()
		configuration['DEFAULT'] = {'password': database_values.pop('password')}
		configuration['symbol_db'] = database_values
		with self.config_ini.open('w', encoding='utf8') as config_file:
			configuration.write(config_file)

		# Act:
		with self.assertRaisesRegex(ValueError, r'Missing required \[symbol_db\] connection settings: password'):
			migrate_fork_recovery(['--db-config', str(self.config_ini)])

		# Assert:
		self.assertIsNone(self._recovery())
		self.assertIsNone(self.puller.symbol_db.get_sync_state())

	def test_sync_adopts_reusable_tip_then_fetches_only_newer_blocks(self):
		# Arrange:
		self._create_capped_reusable_tip()
		connector = RecoveryConnector(_chain(14), 11)

		# Act:
		heights, state = self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(list(range(1, 15)), heights)
		self.assertEqual((14, 11, None), (
			state['last_synced_height'], state['finalized_height'], self._recovery()['reusable_height']))
		self.assertEqual([
			'blocks/12', 'blocks/11', 'blocks?pageSize=100&offset=12&orderBy=height'
		], [path for path in connector.paths if path.startswith('blocks')])
		self.assertEqual([transaction_path(13, 14)], [path for path in connector.paths if path.startswith('transactions/confirmed?')])

	def test_reconciliation_checks_newly_reachable_tail_after_its_pinned_range(self):
		# Arrange:
		blocks = _chain(701)
		self._seed_legacy(blocks, public_height=1, saved_height=701)
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 5))
		self.exit_stack.enter_context(self.puller.symbol_db)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Symbol branch reconciliation request budget exhausted'):
			self._sync_with_connector(RecoveryConnector(blocks, 1), max_height=401)

		# Assert:
		self.assertEqual(401, self._recovery()['progress']['compare_end'])

		# Act: increase the cap and pause again.
		with self.assertRaisesRegex(SymbolRollbackError, 'Symbol branch reconciliation request budget exhausted'):
			self._sync_with_connector(RecoveryConnector(blocks, 1), max_height=501)

		# Assert: the extended range survives the second interruption.
		progress = self._recovery()['progress']
		self.assertEqual((501, 401), (progress['compare_end'], progress['checked_height']))
		self.assertIsNone(self._recovery()['verified_height'])

		# Arrange:
		connector = RecoveryConnector(blocks, 1)

		# Act:
		heights, state = self._sync_with_connector(connector, max_height=501)

		# Assert:
		self.assertEqual(list(range(1, 702)), heights)
		self.assertEqual((501, 1), (state['last_synced_height'], self._recovery()['verified_height']))
		self.assertEqual(
			['blocks?pageSize=100&offset=401&orderBy=height'],
			[path for path in connector.paths if path.startswith('blocks?')])

	def test_sync_rechecks_a_previously_unproven_legacy_fork_when_node_finality_advances(self):
		# Arrange:
		self._seed_legacy(_chain(120, 107), public_height=120, saved_height=120)
		blocks = _chain(110, seal_from=107)
		before = self._capture_preserved_state()

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Node finalization cannot justify changing the legacy public checkpoint'):
			self._sync_with_connector(RecoveryConnector(blocks, 105))

		# Assert:
		self.assertEqual('legacy_node_behind_public', self._recovery()['stop_reason'])
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})

		# Act: advance finality over the previously unproven fork.
		with self.assertRaisesRegex(SymbolRollbackError, 'Pinned Symbol reconciliation evidence changed'):
			self._sync_with_connector(RecoveryConnector(blocks, 108))

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual((1, None), (self._recovery()['invalidations'], self._recovery()['verified_height']))

		# Act: retry with coherent finality.
		heights, state = self._sync_with_connector(RecoveryConnector(blocks, 108))

		# Assert:
		self.assertEqual(list(range(1, 111)), heights)
		self.assertEqual((108, 108), (state['finalized_height'], self._recovery()['verified_height']))

	def test_sync_invalidates_a_database_revision_changed_during_a_saved_evidence_page(self):
		# Arrange:
		blocks = _chain(3)
		self._seed_legacy(blocks, public_height=1, saved_height=3)
		database = self.puller.symbol_db
		old_state = database.get_sync_state()
		replacement = create_block_row(create_node_block(2, block_hash='CC' * 32), 100, Network.TESTNET)
		connector = RecoveryConnector(blocks, 1)

		# Act:
		with self._use_database(ChangingEvidenceDatabase(database, replacement)):
			with self.assertRaisesRegex(SymbolRollbackError, 'Pinned Symbol reconciliation evidence changed'):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual({**old_state, 'status': 'unhealthy'}, database.get_sync_state())
		self.assertEqual((1, None, None), (
			self._recovery()['invalidations'], self._recovery()['progress'], self._recovery()['verified_height']))
		self.assertEqual([], [path for path in connector.paths if path.startswith('transactions/confirmed?')])

	def _capture_conditional_checkpoint(self):
		database = self.puller.symbol_db
		state = database.get_sync_state()
		recovery = self._recovery()
		state['last_synced_block_hash'] = bytes(state['last_synced_block_hash'])
		state['fork_recovery'] = {
			**recovery, 'expected_sync': (
				state['last_synced_height'], state['last_synced_block_hash'], state['dirty_state_from_height']),
			'expected_revision': recovery['block_revision']
		}
		return state

	def test_database_checkpoint_preserves_a_newer_write_intent_when_its_watermark_is_stale(self):
		# Arrange:
		self._sync_with_connector(RecoveryConnector(_chain(3), 3))
		database = self.puller.symbol_db
		checkpoint = self._capture_conditional_checkpoint()
		database.mark_sync_write_intent(4)
		before = self._capture_preserved_state()

		# Act:
		with self.assertRaisesRegex(ValueError, 'Symbol synchronization checkpoint changed before commit'):
			database.checkpoint_sync_state(checkpoint)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(4, database.get_sync_state()['dirty_state_from_height'])

	def test_database_checkpoint_rejects_a_changed_revision_after_capturing_block_evidence(self):
		# Arrange:
		self._sync_with_connector(RecoveryConnector(_chain(3), 3))
		database = self.puller.symbol_db
		checkpoint = self._capture_conditional_checkpoint()
		database.upsert_blocks([create_block_row(create_node_block(4), 100, Network.TESTNET)])
		before = self._capture_preserved_state()

		# Act:
		with self.assertRaisesRegex(ValueError, 'Stored Symbol block history changed before recovery commit'):
			database.checkpoint_sync_state(checkpoint)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual((3, 4), (database.get_sync_state()['last_synced_height'], database.get_max_block_height()))

	def test_database_checkpoint_rejects_verified_finality_overlapping_remaining_dirty_range(self):
		# Arrange:
		self._sync_with_connector(RecoveryConnector(_chain(3), 3))
		database = self.puller.symbol_db
		checkpoint = self._capture_conditional_checkpoint()
		before = self._capture_preserved_state()

		# Act:
		with self.assertRaisesRegex(ValueError, 'Verified finalization exceeds clean synchronization range'):
			database.checkpoint_sync_state({**checkpoint, 'dirty_state_from_height': 3})

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(3, self._recovery()['verified_height'])

	def test_database_checkpoint_rejects_a_watermark_hash_that_does_not_match_the_written_block(self):
		# Arrange:
		self._sync_with_connector(RecoveryConnector(_chain(3), 3))
		database = self.puller.symbol_db
		checkpoint = self._capture_conditional_checkpoint()
		before = self._capture_preserved_state()

		# Act:
		with self.assertRaisesRegex(ValueError, 'Checkpoint block hash does not match local database'):
			database.checkpoint_sync_state({**checkpoint, 'last_synced_block_hash': bytes.fromhex('AB' * 32)})

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(bytes.fromhex(_hash(3, 100_000)), self._recovery()['verified_hash'])

	def test_database_repair_rejects_a_checkpoint_inside_its_own_deletion_range(self):
		# Arrange: the existing checkpoint is valid but is part of the deletion range.
		self._sync_with_connector(RecoveryConnector(_chain(3), 2))
		database = self.puller.symbol_db
		checkpoint = self._capture_conditional_checkpoint()
		before = self._capture_preserved_state()
		recovery = self._recovery()

		# Act:
		with self.assertRaisesRegex(ValueError, '^Symbol repair checkpoint must precede the deletion range$'):
			database.repair_rollback_from_height(3, checkpoint, RollbackRefreshEntries())

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(recovery, self._recovery())

	def test_sync_invalidates_reusable_tip_when_an_expanded_cap_still_cannot_reach_it(self):
		# Arrange:
		self._create_capped_reusable_tip()
		connector = RecoveryConnector(_chain(12), 7)

		# Act:
		heights, state = self._sync_with_connector(connector, max_height=10)

		# Assert:
		self.assertEqual(list(range(1, 13)), heights)
		self.assertEqual((10, 7, None), (state['last_synced_height'], state['finalized_height'], self._recovery()['reusable_height']))
		self.assertEqual([transaction_path(10, 10)], [path for path in connector.paths if path.startswith('transactions/confirmed?')])

	def test_sync_preserves_checkpoint_when_fast_finality_verification_exhausts_budget(self):
		# Arrange:
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		before = self._capture_preserved_state()
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 1))
		self.exit_stack.enter_context(self.puller.symbol_db)
		connector = RecoveryConnector(blocks, 2)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Symbol branch reconciliation request budget exhausted'):
			self._sync_with_connector(connector)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual(['blocks/3'], [path for path in connector.paths if path.startswith('blocks')])
		self.assertEqual((1, 'reconciliation_wait'), (self._recovery()['verified_height'], self._recovery()['stop_reason']))

	def test_sync_preserves_history_when_stored_verified_hash_is_inconsistent(self):
		# Arrange:
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 2))
		database = self.puller.symbol_db
		database.upsert_blocks([create_block_row(create_node_block(2, block_hash='AB' * 32), 100, Network.TESTNET)])
		before = self._capture_preserved_state()
		connector = RecoveryConnector(blocks, 2)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Verified finalized hash is inconsistent in the local database'):
			self._sync_with_connector(connector)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks')])
		self.assertEqual('verified_anchor_conflict', self._recovery()['stop_reason'])

	def test_sync_preserves_history_when_dirty_writes_overlap_the_verified_height(self):
		# Arrange:
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 2))
		self.puller.symbol_db.mark_sync_write_intent(2)
		before = self._capture_preserved_state()
		connector = RecoveryConnector(blocks, 2)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Verified finalization exceeds the saved clean checkpoint$'):
			self._sync_with_connector(connector)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual((2, 'verified_anchor_conflict'), (self._recovery()['verified_height'], self._recovery()['stop_reason']))
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks')])

	def test_sync_rechecks_retained_prefix_after_stored_parent_changes(self):
		# Arrange: change a parent above the verified point outside the workflow.
		blocks = _chain(4, seal_from=3)
		self._sync_with_connector(RecoveryConnector(blocks, 2))
		database = self.puller.symbol_db
		broken_parent = {**blocks[2], 'block': {**blocks[2]['block'], 'previousBlockHash': 'AB' * 32}}
		database.upsert_blocks([create_block_row(broken_parent, 100, Network.TESTNET)])
		connector = RecoveryConnector(blocks, 4)

		# Act:
		heights, state = self._sync_with_connector(connector)

		# Assert: the changed prefix cannot use the endpoint-only checkpoint.
		self.assertEqual([1, 2, 3, 4], heights)
		self.assertEqual((4, 4, None), (state['last_synced_height'], self._recovery()['verified_height'], self._recovery()['stop_reason']))
		self.assertEqual([transaction_path(3, 4)], [path for path in connector.paths if path.startswith('transactions/confirmed?')])
		evidence = list(database.get_block_chain_evidence(3, 3))
		self.assertEqual(bytes.fromhex(_hash(2, 100_000)), bytes(evidence[0][2]))

	def test_sync_preserves_legacy_public_rows_when_the_block_hash_matches_but_its_parent_does_not(self):
		# Arrange: corrupt a parent link at P while keeping the actual hash at that height.
		blocks = _chain(4)
		self._seed_legacy(blocks, public_height=3, saved_height=4)
		self.puller.symbol_db.upsert_blocks([create_block_row(create_node_block(3, previous_hash='AB' * 32), 100, Network.TESTNET)])
		before = self._capture_preserved_state()
		connector = RecoveryConnector(blocks, 4)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalization does not establish the legacy rollback boundary$'):
			self._sync_with_connector(connector)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual('parent_mismatch', self._recovery()['progress']['fork_difference'])
		self.assertEqual([], [path for path in connector.paths if path.startswith('transactions/confirmed?')])

	def test_sync_recertifies_watermark_when_its_saved_hash_differs_from_history(self):
		# Arrange:
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		database = self.puller.symbol_db
		database.upsert_sync_state({**database.get_sync_state(), 'last_synced_block_hash': bytes.fromhex('AB' * 32)})
		connector = RecoveryConnector(blocks, 1)

		# Act:
		heights, state = self._sync_with_connector(connector)

		# Assert: the endpoint-only path was rejected without rewriting matching history.
		self.assertEqual([1, 2, 3], heights)
		self.assertEqual(bytes.fromhex(_hash(3, 100_000)), bytes(state['last_synced_block_hash']))
		self.assertEqual(['blocks?pageSize=100&offset=0&orderBy=height'], [path for path in connector.paths if path.startswith('blocks?')])
		self.assertEqual([], [path for path in connector.paths if path.startswith('transactions/confirmed?')])

	def test_sync_repairs_an_earlier_fork_when_the_resume_parent_was_changed_in_storage(self):
		# Arrange: let the first repair commit, then fail its first block write.
		self._sync_with_connector(RecoveryConnector(_chain(5, 4, seal_from=3), 1))
		database = self.puller.symbol_db
		blocks = _chain(5, seal_from=3)
		with self._use_database(FailingWriteDatabase(database)):
			with self.assertRaisesRegex(RuntimeError, '^resumed write failed$'):
				self._sync_with_connector(RecoveryConnector(blocks, 1))

		self.assertEqual(4, self._recovery()['resume_height'])
		database.upsert_blocks([create_block_row(create_node_block(3, block_hash='AB' * 32), 100, Network.TESTNET)])
		connector = RecoveryConnector(blocks, 1)

		# Act:
		heights, state = self._sync_with_connector(connector)

		# Assert: the stored watermark no longer authorizes resuming at height four.
		self.assertEqual(list(range(1, 6)), heights)
		self.assertEqual((5, None, None), (state['last_synced_height'], state['dirty_state_from_height'], self._recovery()['resume_height']))
		self.assertEqual([transaction_path(3, 5)], [path for path in connector.paths if path.startswith('transactions/confirmed?')])
		self.assertEqual(bytes.fromhex(blocks[2]['meta']['hash']), bytes(database.get_block_hash(3)))

	def test_sync_rejects_no_new_block_finality_that_disagrees_with_saved_history(self):
		# Arrange:
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		before = self._capture_preserved_state()
		connector = RecoveryConnector(blocks, 2, finalized_fields={'hash': 'AB' * 32})

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalized block hash does not match saved Symbol history$'):
			self._sync_with_connector(connector)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual(['blocks/3', 'blocks/2'], [path for path in connector.paths if path.startswith('blocks')])
		self.assertEqual((1, 'finalized_hash_conflict'), (self._recovery()['verified_height'], self._recovery()['stop_reason']))

	def test_sync_reports_newer_write_intent_conflict_without_publishing_finality(self):
		# Arrange:
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		database = self.puller.symbol_db
		before = self._capture_preserved_state()

		# Act:
		with self._use_database(NewerWriteIntentDatabase(database)):
			with self.assertRaisesRegex(SymbolRollbackError, '^Symbol synchronization checkpoint changed before commit$'):
				self._sync_with_connector(RecoveryConnector(blocks, 2))

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy', 'dirty_state_from_height': 4})
		self.assertEqual(1, self._recovery()['verified_height'])

	def test_sync_handles_non_object_block_evidence_without_rewriting_history(self):
		# Arrange:
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		before = self._capture_preserved_state()
		connector = RecoveryConnector(blocks, 1, evidence_by_height={3: []})

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Unable to verify saved block range$') as failure:
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual('Malformed Symbol block response at height 3', str(failure.exception.__cause__))
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual('reconciliation_wait', self._recovery()['stop_reason'])

	def test_sync_marks_unhealthy_when_finality_evidence_is_malformed_after_full_comparison(self):
		# Arrange: a new database revision requires full comparison, even though the block is unchanged.
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		database = self.puller.symbol_db
		database.upsert_blocks([create_block_row(blocks[2], 100, Network.TESTNET)])
		before = self._capture_preserved_state()
		connector = RecoveryConnector(blocks, 2, evidence_by_height={2: []})

		# Act: the direct finality response is malformed after the matching range was compared.
		with self.assertRaisesRegex(SymbolRollbackError, '^Unable to verify saved block range$') as failure:
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual('Malformed Symbol block response at height 2', str(failure.exception.__cause__))
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual((1, 'reconciliation_wait'), (self._recovery()['verified_height'], self._recovery()['stop_reason']))
		self.assertEqual(
			['blocks/3', 'blocks?pageSize=100&offset=0&orderBy=height', 'blocks/2'],
			[path for path in connector.paths if path.startswith('blocks')])

	def _assert_reconciliation_recovers_after_locked_hash_read(self, configured_timeout, elapsed_seconds):
		# Arrange: certify height one, then require full comparison without changing the branch.
		blocks = _chain(3)
		clock = ManualReconciliationClock()
		self.puller = create_symbol_puller(
			self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, time_source=clock))
		self.exit_stack.enter_context(self.puller.symbol_db)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		database = self.puller.symbol_db
		connection = database.connection
		with connection:
			with connection.cursor() as cursor:
				cursor.execute("SELECT pg_catalog.set_config('statement_timeout', %s, false)", (configured_timeout,))

		database.upsert_blocks([create_block_row(blocks[2], 100, Network.TESTNET)])
		before = self._capture_preserved_state()

		# Act: the second connection blocks the actual SQL statement after page evidence succeeds.
		with SymbolDatabase(database.db_config) as blocking_database:
			connector = LockedFinalityReadConnector(blocks, blocking_database, clock, elapsed_seconds)
			with self.assertRaisesRegex(SymbolRollbackError, '^Unable to verify saved block range$') as failure:
				self._sync_with_connector(connector)

		# Assert: the failed read did not poison the connection or prevent the health update.
		self.assertEqual(errorcodes.QUERY_CANCELED, failure.exception.__cause__.pgcode)
		self.assertEqual(
			['blocks/3', 'blocks?pageSize=100&offset=0&orderBy=height', 'blocks/2'],
			[path for path in connector.paths if path.startswith('blocks')])
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		recovery = self._recovery()
		self.assertEqual((1, 3, 'reconciliation_wait'), (
			recovery['verified_height'], recovery['progress']['checked_height'], recovery['stop_reason']))

		# A healthy retry completes without replacing the matched history or reopening the connection.
		connector = RecoveryConnector(blocks, 2)
		heights, _ = self._sync_with_connector(connector)
		self.assertIs(connection, database.connection)
		self.assertEqual([1, 2, 3], heights)
		self._assert_preserved_state(before, {
			**before.sync_state, 'finalized_height': 2, 'finalized_hash': bytes.fromhex(_hash(2, 100_000))
		})
		self.assertEqual((2, None, None), (self._recovery()['verified_height'], self._recovery()['progress'], self._recovery()['stop_reason']))
		self.assertEqual([], [path for path in connector.paths if path.startswith(('blocks?', 'transactions/confirmed?'))])
		with connection.cursor() as cursor:
			cursor.execute('SHOW statement_timeout')
			self.assertEqual((configured_timeout,), cursor.fetchone())

	def test_sync_bounds_sql_hash_read_by_remaining_reconciliation_time_and_recovers_on_the_same_connection(self):
		self._assert_reconciliation_recovers_after_locked_hash_read('5s', 29.9)

	def test_sync_preserves_a_stricter_configured_statement_timeout_and_recovers_on_the_same_connection(self):
		self._assert_reconciliation_recovers_after_locked_hash_read('100ms', 0)

	def _assert_sync_recovers_after_independent_sql_failure(self, lock_database_factory, expected_block_requests, should_compare):
		# Arrange: leave a clean checkpoint with F=1 and a recoverable PostgreSQL read timeout.
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		database = self.puller.symbol_db
		connection = database.connection
		if should_compare:
			database.upsert_blocks([create_block_row(blocks[2], 100, Network.TESTNET)])

		with connection:
			with connection.cursor() as cursor:
				cursor.execute("SET statement_timeout = '100ms'")

		before = self._capture_preserved_state()
		connector = RecoveryConnector(blocks, 2)

		# Act:
		with SymbolDatabase(database.db_config) as blocker:
			with self._use_database(lock_database_factory(database, blocker)):
				with self.assertRaisesRegex(SymbolRollbackError, '^Unable to verify saved block range$') as failure:
					self._sync_with_connector(connector)

		# Assert: health changes without updating finality, comparison progress or the checkpoint.
		self.assertEqual(errorcodes.QUERY_CANCELED, failure.exception.__cause__.pgcode)
		self.assertEqual(expected_block_requests, [path for path in connector.paths if path.startswith('blocks')])
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		recovery = self._recovery()
		self.assertEqual((1, None, 0, 'reconciliation_wait'), (
			recovery['verified_height'], recovery['progress'], recovery['invalidations'], recovery['stop_reason']))

		# The same connection can finish a no-new-block checkpoint with the original timeout.
		connector = RecoveryConnector(blocks, 2)
		heights, _ = self._sync_with_connector(connector)
		self.assertIs(connection, database.connection)
		self.assertEqual([1, 2, 3], heights)
		self._assert_preserved_state(before, {
			**before.sync_state, 'finalized_height': 2, 'finalized_hash': bytes.fromhex(_hash(2, 100_000))
		})
		self.assertEqual((2, None, None), (self._recovery()['verified_height'], self._recovery()['progress'], self._recovery()['stop_reason']))
		self.assertEqual([], [path for path in connector.paths if path.startswith('transactions/confirmed?')])
		with connection.cursor() as cursor:
			cursor.execute('SHOW statement_timeout')
			self.assertEqual(('100ms',), cursor.fetchone())

	def test_sync_records_a_failed_independent_prefix_scan_and_can_retry_on_the_same_connection(self):
		self._assert_sync_recovers_after_independent_sql_failure(LockedContiguousInspectionDatabase, [], should_compare=True)

	def test_sync_records_a_failed_no_new_block_checkpoint_hash_read_and_can_retry_on_the_same_connection(self):
		self._assert_sync_recovers_after_independent_sql_failure(
			LockedCheckpointHashDatabase, ['blocks/3', 'blocks/2'], should_compare=False)

	def test_sync_excludes_contiguous_prefix_inspection_from_reconciliation_deadline(self):
		# Arrange: change the revision without changing history so the entire retained prefix must be inspected.
		blocks = _chain(3)
		clock = ManualReconciliationClock()
		self.puller = create_symbol_puller(
			self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, time_source=clock))
		database = self.exit_stack.enter_context(self.puller.symbol_db)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		database.upsert_blocks([create_block_row(blocks[2], 100, Network.TESTNET)])
		connector = RecoveryConnector(blocks, 2)

		# Act:
		with self._use_database(DelayedContiguousInspectionDatabase(database, clock)):
			heights, state = self._sync_with_connector(connector)

		# Assert: a 35-second contiguous inspection used none of the 30-second comparison budget.
		self.assertEqual(35, clock.seconds)
		self.assertEqual([1, 2, 3], heights)
		self.assertEqual(('healthy', 2, 3, None), (
			state['status'], state['finalized_height'], state['last_synced_height'], self._recovery()['stop_reason']))
		self.assertEqual(
			['blocks/3', 'blocks?pageSize=100&offset=0&orderBy=height', 'blocks/2'],
			[path for path in connector.paths if path.startswith('blocks')])

	def test_sync_cancels_block_evidence_request_if_local_parent_check_consumes_deadline(self):
		# Arrange:
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		before = self._capture_preserved_state()
		clock = ManualReconciliationClock()
		self.puller = create_symbol_puller(
			self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, time_source=clock))
		self.exit_stack.enter_context(self.puller.symbol_db)
		connector = RecoveryConnector(blocks, 1)

		# Act:
		with self._use_database(ExpiringBlockReadDatabase(self.puller.symbol_db, clock)):
			with self.assertRaisesRegex(SymbolRollbackError, '^Symbol branch reconciliation request budget exhausted$'):
				self._sync_with_connector(connector)

		# Assert: the first block request was cancelled before dispatch.
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks')])
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual('reconciliation_wait', self._recovery()['stop_reason'])

	def test_sync_rejects_a_matching_legacy_common_block_with_a_conflicting_finalized_hash(self):
		# Arrange: local and node block one match, but chain info claims another hash at one.
		blocks = _chain(3)
		self._seed_legacy(blocks, public_height=1, saved_height=3)
		before = self._capture_preserved_state()
		connector = RecoveryConnector(blocks, 1, finalized_fields={'hash': 'AB' * 32})

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalized block hash does not match chain info$'):
			self._sync_with_connector(connector)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual((None, 1, None), (self._recovery()['verified_height'], self._recovery()['invalidations'], self._recovery()['progress']))
		self.assertEqual([], [path for path in connector.paths if path.startswith('transactions/confirmed?')])

	def test_reconciliation_rejects_a_page_that_conflicts_with_the_pinned_comparison_tip(self):
		# Arrange: the detail and page responses disagree only on the saved tip's hash.
		blocks = _chain(4)
		self._seed_legacy(blocks, public_height=1, saved_height=4)
		before = self._capture_preserved_state()
		conflicting_tip = create_node_block(4, block_hash='AB' * 32)
		connector = RecoveryConnector(blocks, 2, evidence_by_height={4: conflicting_tip})

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Pinned Symbol reconciliation evidence changed$'):
			self._sync_with_connector(connector)

		# Assert: neither response can authorize a checkpoint, repair, or generation change.
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		recovery = self._recovery()
		self.assertEqual((None, 1, None, 'reconciliation_wait'), (
			recovery['verified_height'], recovery['invalidations'], recovery['progress'], recovery['stop_reason']))
		self.assertEqual([
			'blocks/4', 'blocks?pageSize=100&offset=0&orderBy=height', 'blocks?pageSize=100&offset=1&orderBy=height'
		], [path for path in connector.paths if path.startswith('blocks')])
		self.assertEqual([], [path for path in connector.paths if path.startswith('transactions/confirmed?')])

	def test_reconciliation_rejects_divergent_parent_evidence_for_the_finalized_block_beyond_physical_tip(self):
		# Arrange: only the local comparison tip was pinned when the first run stopped.
		blocks = _chain(6)
		self._seed_legacy(blocks[:4], public_height=3, saved_height=4)
		before = self._capture_preserved_state()
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 1))
		self.exit_stack.enter_context(self.puller.symbol_db)
		with self.assertRaisesRegex(SymbolRollbackError, '^Symbol branch reconciliation request budget exhausted$'):
			self._sync_with_connector(RecoveryConnector(blocks, 6))

		self.assertIsNone(self._recovery()['progress']['finalized_parent'])
		self.puller = create_symbol_puller(self.config_ini, 'testnet')
		self.exit_stack.enter_context(self.puller.symbol_db)
		conflicting_finalized = create_node_block(6, previous_hash='AB' * 32)
		connector = RecoveryConnector(blocks, 6, evidence_by_height={6: conflicting_finalized})

		# Act: the second run obtains the same finalized hash with two different parents.
		with self.assertRaisesRegex(SymbolRollbackError, '^Pinned Symbol reconciliation evidence changed$'):
			self._sync_with_connector(connector)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual((None, 1, None), (self._recovery()['verified_height'], self._recovery()['invalidations'], self._recovery()['progress']))
		self.assertEqual(['blocks/4', 'blocks/6'], [path for path in connector.paths if path.startswith('blocks/')])
		self.assertEqual([], [path for path in connector.paths if path.startswith('transactions/confirmed?')])

	def test_sync_keeps_primary_repair_commit_error_if_recording_the_stop_also_fails(self):
		# Arrange:
		self._sync_with_connector(RecoveryConnector(_chain(5, 4), 1))
		before = self._capture_preserved_state()
		connector = RecoveryConnector(_chain(5, seal_from=4), 1)
		database = self.puller.symbol_db

		# Act:
		with self._use_database(FailingRepairCommitAndStopDatabase(database)):
			with self.assertLogs(log.logger, level='ERROR') as diagnostics:
				with self.assertRaisesRegex(RuntimeError, '^checkpoint commit failed$'):
					self._sync_with_connector(connector)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(
			['Failed to record Symbol sync failure: recovery stop write failed'], [record.getMessage() for record in diagnostics.records])
		self.assertEqual((None, 1, 'reconciliation_wait'), (
			self._recovery()['resume_height'], self._recovery()['verified_height'], self._recovery()['stop_reason']))
		self.assertEqual([], [path for path in connector.paths if path.startswith('transactions/confirmed?')])

	def test_sync_preserves_legacy_history_when_dirty_marker_precedes_the_proven_fork(self):
		# Arrange:
		self._seed_legacy(_chain(8, 7), public_height=2, saved_height=6, dirty=6)
		before = self._capture_preserved_state()
		connector = RecoveryConnector(_chain(8), 8)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Legacy dirty writes precede the proven Symbol fork'):
			self._sync_with_connector(connector)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual((7, 'legacy_dirty_before_fork'), (
			self._recovery()['progress']['fork_height'], self._recovery()['stop_reason']))
		self.assertEqual([], [path for path in connector.paths if path.startswith('transactions/confirmed?')])

	def test_sync_invalidates_fork_proof_when_the_predecessor_changes_before_commit(self):
		# Arrange:
		self._seed_legacy(_chain(7, 6), public_height=6, saved_height=6, dirty=7)
		before = self._capture_preserved_state()
		connector = ChangedPredecessorConnector(_chain(7, seal_from=6), 7)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Pinned Symbol reconciliation evidence changed'):
			self._sync_with_connector(connector)

		# Assert:
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual((1, None), (self._recovery()['invalidations'], self._recovery()['progress']))
		self.assertEqual('blocks/5', connector.paths[-1])

	def _seed_legacy_commit_boundary(self):
		legacy = _chain(120, 103)
		connector = RecoveryConnector(
			legacy, 120, account_pages={1: [create_account_item()]}, finalized_fields={'hash': legacy[-1]['meta']['hash']})
		self._sync_with_connector(connector)
		for _ in range(2):
			self.assertTrue(asyncio.run(self.puller.refresh_accounts()))

		self._seed_legacy(legacy, public_height=120, saved_height=120, dirty=121)
		database = self.puller.symbol_db
		database.upsert_transactions_for_height(115, [{**create_transaction_entry(15, 'legacy-transaction'), 'height': 115}])
		database.upsert_receipts_for_height(116, create_receipt_rows(create_amount_statement_item(116, 117)), 0)

	def _read_generation_rows(self):
		return self._fetch_table_state(('symbol_account_refresh_accounts', 'symbol_account_refresh_mosaics', 'symbol_account_list_ranks'))

	def test_sync_preserves_legacy_repair_state_when_finality_regresses_before_commit(self):
		# Arrange: F=105 proves the fork at 103 until /chain/info falls back to 102.
		self._seed_legacy_commit_boundary()
		before = self._capture_preserved_state()
		generations = self._read_generation_rows()
		recovery = self._recovery()
		canonical = _chain(110, seal_from=103)
		connector = FinalityChangingBeforeCommitConnector(canonical, 105, 102, changed_block=_chain(110, 104)[104])

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalized checkpoint changed before Symbol recovery commit$'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertTrue(connector.has_changed)
		self.assertEqual(2, connector.paths.count('chain/info'))
		self.assertEqual(list(range(1, 121)), self._fetch_block_heights(self.puller.symbol_db))
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual({**recovery, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'}, self._recovery())
		self.assertEqual([], [path for path in connector.paths if path.startswith('transactions/confirmed?')])

	def test_recover_fork_rejects_regressed_finality_at_terminal_release(self):
		# Arrange: the real command runs against a legacy branch with a terminal stop.
		self._seed_legacy_commit_boundary()
		self._set_terminal_stop()
		before = self._capture_preserved_state()
		generations = self._read_generation_rows()
		recovery = self._recovery()
		canonical = _chain(110, seal_from=103)
		connector = FinalityChangingBeforeCommitConnector(canonical, 105, 102, changed_block=_chain(110, 104)[104])
		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalized checkpoint changed before Symbol recovery commit$'):
			self._run_recover_cli(connector, 102, canonical[101]['meta']['hash'])

		# Assert: leave the gate terminal and hand no proof to ordinary sync.
		self.assertTrue(connector.has_changed)
		self.assertEqual(2, connector.paths.count('chain/info'))
		self.assertEqual(['open', 'close'], connector.lifecycle)
		self.assertEqual(recovery, self._recovery())
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		self._assert_refresh_skipped_twice(connector, 'evidence_invalidated')

	def test_sync_rereads_finality_after_the_last_pinned_block_request(self):
		# Arrange: the node still serves the pinned block and parent after F has regressed.
		self._seed_legacy(_chain(120, 103), public_height=120, saved_height=120)
		before = self._capture_preserved_state()
		recovery = self._recovery()
		connector = FinalityChangingBeforeCommitConnector(_chain(110, seal_from=103), 105, 102, change_at='blocks/105')
		connector.minimum_chain_info_reads = 2

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalized checkpoint changed before Symbol recovery commit$'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertTrue(connector.has_changed)
		self.assertEqual(['chain/info', 'blocks/105', 'chain/info'], [
			path for path in connector.paths[connector.paths.index('chain/info') + 1:] if path in ('chain/info', 'blocks/105')
		][-3:])
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual({**recovery, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'}, self._recovery())

	def test_sync_repairs_when_finality_advances_and_the_pinned_block_is_unchanged(self):
		# Arrange:
		self._seed_legacy(_chain(120, 103), public_height=120, saved_height=120)
		connector = FinalityChangingBeforeCommitConnector(_chain(110, seal_from=103), 105, 106, change_at='blocks/105')
		connector.minimum_chain_info_reads = 2

		# Act:
		heights, state = self._sync_with_connector(connector)

		# Assert: the committed proof remains tied to 105.
		self.assertTrue(connector.has_changed)
		self.assertEqual(5, connector.paths.count('chain/info'))
		self.assertEqual(['chain/info', 'blocks/105', 'chain/info', 'blocks/105', 'chain/info', 'chain/info'], [
			path for path in connector.paths[connector.paths.index('blocks/103') + 1:] if path in ('chain/info', 'blocks/105')])
		self.assertEqual(list(range(1, 111)), heights)
		self.assertEqual((105, 110, 105), (state['finalized_height'], state['last_synced_height'], self._recovery()['verified_height']))

	def _seed_verified_tail_with_generation(self, blocks):
		node = RecoveryConnector(blocks, 3, account_pages={1: [create_account_item()]})
		self._sync_with_connector(node)
		self.assertTrue(asyncio.run(self.puller.refresh_accounts()))
		database = self.puller.symbol_db
		for height in (7, 8):
			database.upsert_transactions_for_height(height, [create_transaction_entry(height, f'tail-transaction-{height}')])
			database.upsert_receipts_for_height(height, create_receipt_rows(create_amount_statement_item(height, height + 1)), 0)

	def test_sync_rejects_contradicted_publication_finality_when_resuming_an_older_proof(self):
		# Arrange: a real generation and tail artifacts are at risk if the shorten commits.
		blocks = _chain(8)
		self._seed_verified_tail_with_generation(blocks)
		self._pause_at_pinned_comparison(RecoveryConnector(blocks[:6], 3))
		before = self._capture_preserved_state()
		generations = self._read_generation_rows()
		recovery = self._recovery()
		self.assertEqual((3, 6), (recovery['progress']['finalized'][0], recovery['progress']['compare_end']))
		refreshed = _chain(6, 5, seal_from=5)
		hash_a, hash_b = blocks[4]['meta']['hash'], refreshed[4]['meta']['hash']
		node = SwitchingRepairViewConnector(blocks[:6], 5, refreshed)

		# Act: the saved proof still matches F=3, but this run's F=5 changes before deletion.
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalized checkpoint changed before Symbol recovery commit$'):
			self._sync_with_connector(node)

		# Assert:
		self.assertEqual([(6, hash_a), (6, hash_b)], node.chain_views)
		self.assertEqual({**recovery, 'progress': None, 'invalidations': 1}, self._recovery())
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())

		# Act: a coherent node now proves the actual fork above V=3.
		coherent = RecoveryConnector(
			refreshed, 5, finalized_fields={'hash': hash_b}, mosaics_by_id={NATIVE_MOSAIC_ID: create_mosaic_item(NATIVE_MOSAIC_ID)})
		heights, sync = self._sync_with_connector(coherent)

		# Assert:
		self.assertEqual(list(range(1, 7)), heights)
		self.assertEqual(('healthy', 6, 5, bytes.fromhex(hash_b)), (
			sync['status'], sync['last_synced_height'], sync['finalized_height'], bytes(sync['finalized_hash'])))
		self.assertEqual((5, bytes.fromhex(hash_b), None, 0), (
			self._recovery()['verified_height'], self._recovery()['verified_hash'],
			self._recovery()['stop_reason'], self._recovery()['invalidations']))

	def test_sync_rejects_a_contradicted_publication_checkpoint_without_repair(self):
		# Arrange: a short observation pins F=3. The resumed comparison can now reach the stored tip at eight.
		blocks = _chain(8)
		self._seed_verified_tail_with_generation(blocks)
		self._pause_at_pinned_comparison(RecoveryConnector(blocks[:6], 3))
		before = self._capture_preserved_state()
		generations = self._read_generation_rows()
		recovery = self._recovery()
		self.assertEqual((3, 6), (recovery['progress']['finalized'][0], recovery['progress']['compare_end']))
		self.assertIsNotNone(before.refresh_state['valid_run_id'])
		refreshed = _chain(8, 5, seal_from=5)
		hash_a, hash_b = blocks[4]['meta']['hash'], refreshed[4]['meta']['hash']
		node = SwitchingRepairViewConnector(blocks, 5, refreshed)

		# Act: the comparison needs no repair, but the fresh finality hash contradicts the publication candidate.
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalized checkpoint changed before Symbol recovery commit$'):
			self._sync_with_connector(node)

		# Assert: the old prefix and newly reachable tail were compared, and no restoration or publication ran.
		self.assertEqual([(8, hash_a), (8, hash_b)], node.chain_views)
		self.assertEqual(1, node.paths.count('blocks?pageSize=100&offset=6&orderBy=height'))
		self.assertEqual([], node.post_requests)
		self.assertEqual({**recovery, 'progress': None, 'invalidations': 1}, self._recovery())
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())

		# Act: a coherent node can prove and publish the actual fork above V=3.
		coherent = RecoveryConnector(
			refreshed, 5, finalized_fields={'hash': hash_b}, mosaics_by_id={NATIVE_MOSAIC_ID: create_mosaic_item(NATIVE_MOSAIC_ID)})
		heights, sync = self._sync_with_connector(coherent)

		# Assert:
		self.assertEqual(list(range(1, 9)), heights)
		self.assertEqual(('healthy', 8, 5, bytes.fromhex(hash_b)), (
			sync['status'], sync['last_synced_height'], sync['finalized_height'], bytes(sync['finalized_hash'])))
		self.assertEqual((5, bytes.fromhex(hash_b), None, 0), (
			self._recovery()['verified_height'], self._recovery()['verified_hash'],
			self._recovery()['stop_reason'], self._recovery()['invalidations']))

	def test_sync_rechecks_the_publication_block_when_latest_finality_advances(self):
		# Arrange: the resumed proof fixes F=3, while this run first observes F=5.
		blocks = _chain(8)
		self._sync_with_connector(RecoveryConnector(blocks, 3))
		self._pause_at_pinned_comparison(RecoveryConnector(blocks[:6], 3))
		before = self._capture_preserved_state()
		recovery = self._recovery()
		self.assertEqual(3, recovery['progress']['finalized'][0])
		changed_parent = create_node_block(5, blocks[4]['meta']['hash'], 'AB' * 32)
		node = FinalityChangingBeforeCommitConnector(blocks[:6], 5, 6, changed_block=changed_parent, change_at='chain/info')

		# Act: fresh F=6 leaves the fixed block intact but returns a different parent for block five.
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalized block evidence changed before Symbol recovery commit$'):
			self._sync_with_connector(node)

		# Assert: both pinned heights were checked after the fresh chain-info observation.
		self.assertTrue(node.has_changed)
		self.assertEqual(2, node.paths.count('chain/info'))
		self.assertEqual(['chain/info', 'blocks/3', 'blocks/5'], node.paths[-3:])
		self.assertEqual({**recovery, 'progress': None, 'invalidations': 1}, self._recovery())
		self._assert_preserved_state(before, before.sync_state)

	def test_sync_rejects_unmatched_publication_block_above_the_repair_cut(self):
		# Arrange: stored F=3 proof resumes against a fork at four while this run observes raw F=5.
		blocks = _chain(8)
		self._sync_with_connector(RecoveryConnector(blocks, 3))
		canonical = _chain(6, 4)
		self._pause_at_pinned_comparison(RecoveryConnector(canonical, 3))
		before = self._capture_preserved_state()
		recovery = self._recovery()
		node = RecoveryConnector(
			canonical, 5, finalized_fields={'hash': canonical[4]['meta']['hash']}, evidence_by_height={5: blocks[4]})

		# Act: direct evidence for raw F=5 contradicts the initial chain info before repair can start.
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalized block hash does not match chain info$'):
			self._sync_with_connector(node)

		# Assert:
		self.assertEqual('blocks/5', node.paths[-1])
		self.assertEqual(1, node.paths.count('chain/info'))
		self.assertEqual({**recovery, 'progress': None, 'invalidations': 1}, self._recovery())
		self._assert_preserved_state(before, before.sync_state)

	def test_sync_defers_fork_repair_when_the_first_fresh_tip_falls_below_the_fork(self):
		# Arrange: fork seven has both stored history and a published generation above it.
		blocks = _chain(8)
		self._seed_verified_tail_with_generation(blocks)
		before = self._capture_preserved_state()
		generations = self._read_generation_rows()
		recovery = self._recovery()
		self.assertEqual((8, 3, 3), (before.sync_state['last_synced_height'], before.sync_state['finalized_height'], recovery['verified_height']))
		self.assertEqual(8, before.refresh_state['last_completed_height'])
		self.assertIsNotNone(before.refresh_state['valid_run_id'])
		for table in ('symbol_transactions', 'symbol_receipts'):
			self.assertEqual({7, 8}, {row[0]['height'] for row in before.tables[table]})

		fork = _chain(8, 7, seal_from=7)
		node = SwitchingRepairViewConnector(fork, 3, blocks[:5])

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node chain tip fell below the proven fork before Symbol repair$'):
			self._sync_with_connector(node)

		# Assert: repair reached the proven boundary, but the first fresh observation invalidated it.
		final_hash = blocks[2]['meta']['hash']
		self.assertEqual([(8, final_hash), (5, final_hash)], node.chain_views)
		self.assertEqual(['blocks/6', 'blocks/7', 'chain/info'], node.paths[-3:])
		self.assertEqual([], [path for path in node.paths if path.startswith('transactions/confirmed?')])
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual({**recovery, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'}, self._recovery())

		# Act: a coherent node whose tip is exactly the fork height permits ordinary repair.
		node = RecoveryConnector(fork[:7], 3, mosaics_by_id={NATIVE_MOSAIC_ID: create_mosaic_item(NATIVE_MOSAIC_ID)})
		heights, sync = self._sync_with_connector(node)

		# Assert: replay replaces exactly the forked tail and retains the finalized floor.
		self.assertEqual(list(range(1, 8)), heights)
		self.assertEqual([transaction_path(7, 7)], [path for path in node.paths if path.startswith('transactions/confirmed?')])
		self.assertEqual(('healthy', 7, 3, None), (
			sync['status'], sync['last_synced_height'], sync['finalized_height'], sync['dirty_state_from_height']))
		after = self._recovery()
		self.assertEqual((3, None, None, 0), (after['verified_height'], after['resume_height'], after['stop_reason'], after['invalidations']))
		database = self.puller.symbol_db
		self.assertEqual(bytes.fromhex(fork[6]['meta']['hash']), bytes(database.get_block_hash(7)))
		self.assertIsNone(database.get_account_refresh_state()['valid_run_id'])

	def test_sync_defers_dirty_repair_when_the_closing_tip_cannot_reach_the_fork(self):
		# Arrange: dirty writes move the repair cut to six, but the proven fork still starts at seven.
		blocks = _chain(8, seal_from=6)
		self._seed_verified_tail_with_generation(blocks)
		self.puller.symbol_db.mark_sync_write_intent(6)
		before = self._capture_preserved_state()
		generations = self._read_generation_rows()
		recovery = self._recovery()
		self.assertEqual(6, before.sync_state['dirty_state_from_height'])
		node = SwitchingRepairViewConnector(_chain(8, 7, seal_from=6), 3, blocks[:6], switch_on_read=3)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node chain tip fell below the proven fork before Symbol repair$'):
			self._sync_with_connector(node)

		# Assert: the closing observation reaches the cut at six but cannot authorize the fork at seven.
		final_hash = blocks[2]['meta']['hash']
		self.assertEqual([(8, final_hash), (8, final_hash), (6, final_hash)], node.chain_views)
		self.assertEqual(['blocks/7', 'chain/info', 'blocks/3', 'blocks/8', 'blocks/6', 'blocks/7', 'chain/info'], node.paths[-7:])
		self.assertEqual([], [path for path in node.paths if path.startswith('transactions/confirmed?')])
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual({**recovery, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'}, self._recovery())

	def test_sync_preserves_matching_tail_and_generation_when_the_node_tip_regrows_before_commit(self):
		# Arrange:
		blocks = _chain(8)
		self._seed_verified_tail_with_generation(blocks)
		before = self._capture_preserved_state()
		generations = self._read_generation_rows()
		recovery = self._recovery()
		self.assertEqual(8, before.refresh_state['last_completed_height'])
		self.assertIsNotNone(before.refresh_state['valid_run_id'])
		self.assertTrue(generations['symbol_account_refresh_accounts'])
		for table in ('symbol_transactions', 'symbol_receipts'):
			self.assertEqual({7, 8}, {row[0]['height'] for row in before.tables[table]})

		node = SwitchingRepairViewConnector(blocks[:6], 3, blocks, switch_on_read=3)

		# Act: the last chain-info read observes the return of blocks seven and eight.
		with self.assertRaisesRegex(SymbolRollbackError, '^Node chain tip changed before Symbol shortening repair$'):
			self._sync_with_connector(node)

		# Assert:
		final_hash = blocks[2]['meta']['hash']
		self.assertEqual([(6, final_hash), (6, final_hash), (8, final_hash), (8, final_hash)], node.chain_views)
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual({**recovery, 'stop_reason': 'reconciliation_wait'}, self._recovery())

		# Act: the now-stable matching tip can continue without a rollback or replay.
		heights, _ = self._sync_with_connector(RecoveryConnector(blocks, 3))

		# Assert:
		self.assertEqual(list(range(1, 9)), heights)
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual(recovery, self._recovery())

	def test_recover_fork_preserves_terminal_state_when_shortening_is_deferred(self):
		# Arrange:
		blocks = _chain(8)
		self._seed_verified_tail_with_generation(blocks)
		self._set_terminal_stop()
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()
		node = SwitchingRepairViewConnector(blocks[:6], 3, blocks, switch_on_read=3)
		final_hash = blocks[2]['meta']['hash']

		# Act:
		with self._use_database(UnexpectedRepairDatabase(self.puller.symbol_db)):
			with self.assertRaisesRegex(SymbolRollbackError, '^Node chain tip changed before Symbol shortening repair$'):
				self._recover_fork(node, 3, final_hash)

		# Assert:
		self.assertEqual([(6, final_hash), (6, final_hash), (8, final_hash), (8, final_hash)], node.chain_views)
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(recovery, self._recovery())
		self.assertEqual(generations, self._read_generation_rows())

	def test_sync_counts_growth_with_a_changed_parent_as_contradictory_evidence(self):
		# Arrange: the shorter view matches, but its retained tip has a different parent after growth.
		blocks = _chain(8)
		self._seed_verified_tail_with_generation(blocks)
		before = self._capture_preserved_state()
		generations = self._read_generation_rows()
		recovery = self._recovery()
		refreshed = _chain(6)
		refreshed[4]['block']['previousBlockHash'] = 'AB' * 32
		node = SwitchingRepairViewConnector(blocks[:5], 3, refreshed)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node fork boundary changed while the shortened Symbol tip grew$'):
			self._sync_with_connector(node)

		# Assert: the fresh finality and retained tip were both read, and only the contradiction was recorded.
		self.assertEqual(['chain/info', 'blocks/3', 'blocks/5'], node.paths[-3:])
		self.assertEqual({**recovery, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'}, self._recovery())
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual(generations, self._read_generation_rows())

	def test_sync_retries_three_matching_tip_growths_without_consuming_the_invalidation_limit(self):
		# Arrange: the protected history already has one recorded contradiction from an earlier run.
		blocks = _chain(8)
		self._seed_verified_tail_with_generation(blocks)
		database = self.puller.symbol_db
		database.update_fork_reconciliation(None, 1, ForkRecoveryStopReason.RECONCILIATION_WAIT)
		before = self._capture_preserved_state()
		generations = self._read_generation_rows()
		recovery = self._recovery()
		final_hash = blocks[2]['meta']['hash']

		for planned_tip in (5, 6, 7):
			with self.subTest(planned_tip=planned_tip):
				node = SwitchingRepairViewConnector(blocks[:planned_tip], 3, blocks[:planned_tip + 1])

				# Act:
				with self.assertRaisesRegex(SymbolRollbackError, '^Node chain tip changed before Symbol shortening repair$'):
					self._sync_with_connector(node)

				# Assert: a matching tip growth defers the cut and preserves the earlier counter.
				self.assertEqual([(planned_tip, final_hash), (planned_tip + 1, final_hash), (planned_tip + 1, final_hash)], node.chain_views)
				self.assertEqual(recovery, self._recovery())
				self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
				self.assertEqual(generations, self._read_generation_rows())

		# Act: the node catches up and ordinary sync succeeds without administrative recovery.
		heights, _ = self._sync_with_connector(RecoveryConnector(blocks, 3))

		# Assert:
		self.assertEqual(list(range(1, 9)), heights)
		self.assertEqual({**recovery, 'invalidations': 0, 'stop_reason': None}, self._recovery())
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())

	def test_sync_defers_a_further_shortened_tip_until_the_new_tip_is_proven(self):
		# Arrange:
		blocks = _chain(8)
		self._sync_with_connector(RecoveryConnector(blocks, 3))
		before = self._capture_preserved_state()
		recovery = self._recovery()
		node = SwitchingRepairViewConnector(blocks[:6], 3, blocks[:5])

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node chain tip changed before Symbol shortening repair$'):
			self._sync_with_connector(node)

		# Assert:
		final_hash = blocks[2]['meta']['hash']
		self.assertEqual([(6, final_hash), (5, final_hash)], node.chain_views)
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual({**recovery, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'}, self._recovery())

		# Act: a coherent shortened view proves the corrected cut at six.
		heights, sync = self._sync_with_connector(RecoveryConnector(blocks[:5], 3))

		# Assert:
		self.assertEqual(list(range(1, 6)), heights)
		self.assertEqual(('healthy', 5, 5, 3), (
			sync['status'], sync['chain_height'], sync['last_synced_height'], sync['finalized_height']))

	def test_capped_sync_defers_repair_when_fresh_finality_crosses_the_cap(self):
		# Arrange: a fork at three is repairable under max_height=4 while raw F=2.
		blocks = _chain(4)
		self._sync_with_connector(RecoveryConnector(blocks, 1))
		before = self._capture_preserved_state()
		recovery = self._recovery()
		canonical = _chain(8, 3, seal_from=3)
		node = FinalityChangingBeforeCommitConnector(canonical, 2, 5, change_at='chain/info')

		# Act: the fresh observation puts F beyond the cap before deletion.
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalization crossed max_height before Symbol recovery commit$'):
			self._sync_with_connector(node, max_height=4)

		# Assert:
		self.assertTrue(node.has_changed)
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual({**recovery, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'}, self._recovery())

		# Act: an invocation with coherent above-cap finality can replay the permitted history.
		node = RecoveryConnector(canonical, 5, finalized_fields={'hash': canonical[4]['meta']['hash']})
		heights, sync = self._sync_with_connector(node, max_height=4)

		# Assert: repair reaches the cap without promoting P or V.
		self.assertEqual(list(range(1, 5)), heights)
		self.assertEqual(('healthy', 4, 1, 1), (
			sync['status'], sync['last_synced_height'], sync['finalized_height'], self._recovery()['verified_height']))
		self.assertEqual(bytes.fromhex(canonical[3]['meta']['hash']), bytes(sync['last_synced_block_hash']))

	def test_sync_charges_final_chain_info_retry_to_the_repair_proof_budget(self):
		# Arrange: five attempts reach the repair boundary, leaving two for the first fresh chain info and block.
		self._seed_legacy(_chain(120, 103), public_height=120, saved_height=120)
		before = self._capture_preserved_state()
		self.puller = create_symbol_puller(self.config_ini, 'testnet', reconciliation_budget_factory=partial(ReconciliationBudget, 9))
		self.exit_stack.enter_context(self.puller.symbol_db)
		connector = RetryingCommitChainInfoConnector(_chain(110, seal_from=103), 105)

		# Act: retrying chain info takes the last available attempt.
		with self.assertRaisesRegex(SymbolRollbackError, '^Symbol branch reconciliation request budget exhausted$'):
			self._sync_with_connector(connector)

		# Assert: the fixed block was never dispatched and the completed comparison remains resumable.
		self.assertEqual(['blocks/103', 'chain/info', 'chain/info'], connector.paths[-3:])
		self.assertEqual(3, connector.paths.count('chain/info'))
		self.assertEqual([], [path for path in connector.paths if path == 'blocks/105' or path.startswith('transactions/confirmed?')])
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		recovery = self._recovery()
		self.assertEqual((0, 'reconciliation_wait', 103), (
			recovery['invalidations'], recovery['stop_reason'], recovery['progress']['fork_height']))

	def test_sync_rechecks_the_finalized_block_even_when_its_height_is_below_the_common_point(self):
		# Arrange: shortening six to five finds a common point at five, above raw F=3.
		blocks = _chain(6)
		self._sync_with_connector(RecoveryConnector(blocks, 2))
		before = self._capture_preserved_state()
		changed_block = create_node_block(3, 'AB' * 32, blocks[1]['meta']['hash'])
		connector = FinalityChangingBeforeCommitConnector(blocks[:5], 3, 4, changed_block=changed_block, change_at='chain/info')

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalized block evidence changed before Symbol recovery commit$'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertTrue(connector.has_changed)
		self.assertEqual(['chain/info', 'blocks/3', 'chain/info', 'blocks/3'], [
			path for path in connector.paths if path in ('chain/info', 'blocks/3')])
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual((2, None, 1), (
			self._recovery()['verified_height'], self._recovery()['resume_height'], self._recovery()['invalidations']))

	def test_recover_fork_rechecks_the_fixed_hash_and_parent_without_a_pending_repair(self):
		# Arrange: no history repair is required to reopen this terminal stop.
		blocks = _chain(5)
		self._sync_with_connector(RecoveryConnector(blocks, 2))
		self._set_terminal_stop()
		before = self._capture_preserved_state()
		recovery = self._recovery()
		candidate = (3, blocks[2]['meta']['hash'])

		for changed_block in (
			create_node_block(4, 'AB' * 32, blocks[2]['meta']['hash']),
			create_node_block(4, blocks[3]['meta']['hash'], 'AB' * 32)
		):
			with self.subTest(block=changed_block['meta']['hash'], parent=changed_block['block']['previousBlockHash']):
				connector = FinalityChangingBeforeCommitConnector(blocks, 4, 4, changed_block=changed_block, change_at='chain/info')

				# Act:
				with self.assertRaisesRegex(SymbolRollbackError, '^Node finalized block evidence changed before Symbol recovery commit$'):
					self._recover_fork(connector, *candidate)

				# Assert: the new chain-info tuple agrees; the direct block disagrees.
				self.assertEqual(['chain/info', 'blocks/4'], connector.paths[-2:])
				self.assertEqual(2, connector.paths.count('chain/info'))
				self.assertEqual(recovery, self._recovery())
				self._assert_preserved_state(before, before.sync_state)
				self._assert_refresh_skipped_twice(connector, 'evidence_invalidated')

	def test_recover_fork_keeps_terminal_gate_when_closing_finality_conflicts_with_retained_history(self):
		# Arrange: the retained branch and terminal gate agree with F=1, but the node later advertises a contradictory F=8.
		blocks = _chain(10)
		_commit_recovery_suffix(blocks, 2)
		self._sync_with_published_account_generation(blocks, 1)
		self._set_terminal_stop()
		before, generations = self._capture_preserved_state(), self._read_generation_rows()
		recovery = self._recovery()
		self.assertEqual(('evidence_invalidated', 3), (recovery['stop_reason'], recovery['invalidations']))
		candidate = (1, blocks[0]['meta']['hash'])
		node = ClosingFinalityConnector(blocks, 1, closing_height=8, should_conflict=True)
		self.assertNotEqual(blocks[7]['meta']['hash'], node.closing_hash)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, '^Node advanced finalized hash does not match verified Symbol history$'):
			self._recover_fork(node, *candidate)

		# Assert: neither the administrative gate nor account refresh can proceed.
		self.assertEqual([(1, candidate[1]), (8, node.closing_hash)], node.reported_finality[:2])
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(recovery, self._recovery())
		self.assertEqual(generations, self._read_generation_rows())
		self._assert_refresh_skipped_twice(node, 'evidence_invalidated')

		# Act: the genuine F=8 lets the same administrative command release the gate.
		self._recover_fork(ClosingFinalityConnector(blocks, 1, closing_height=8), *candidate)

		# Assert:
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual({**recovery, 'stop_reason': None, 'invalidations': 0}, self._recovery())

	def _prepare_forward_revision_conflict(self, blocks):
		connector = RecoveryConnector(blocks[:5], 4, account_pages={1: [create_account_item()]})
		self._sync_with_connector(connector)
		self.assertTrue(asyncio.run(self.puller.refresh_accounts()))
		database = self.puller.symbol_db
		database.begin_account_refresh('abandoned-at-checkpoint', datetime(2026, 1, 1, tzinfo=timezone.utc))
		lock_entry = {'lock': {
			'hash': 'AA' * 32, 'ownerAddress': SIGNER_ADDRESS, 'mosaicId': NATIVE_MOSAIC_ID,
			'amount': '1234', 'endHeight': '6', 'status': 0
		}, 'id': 'hash-lock'}
		database.upsert_hash_lock(create_hash_lock_row(lock_entry, 1))
		state = self._capture_preserved_state()
		recovery = self._recovery()
		self.assertEqual((5, 4, 4, 5), (
			state.sync_state['last_synced_height'], state.sync_state['finalized_height'],
			recovery['verified_height'], recovery['continuity_height']))
		return state, recovery

	def _assert_revision_conflict_preserves_checkpoint(self, before, expected_sync_state, expected_recovery, *, tip=None):
		recovery = self._recovery()
		self.assertNotEqual(expected_recovery['block_revision'], recovery['block_revision'])
		self.assertEqual({**expected_recovery, 'block_revision': recovery['block_revision']}, recovery)
		after = self._capture_preserved_state()
		# Omit the intentional external deletion and, when present, the batch's own durable row.
		previous_blocks = [row for row in before.tables['symbol_blocks'] if row[0]['height'] != 2]
		actual_blocks = [row for row in after.tables['symbol_blocks'] if row[0]['height'] != tip]
		self.assertEqual(previous_blocks, actual_blocks)
		expected_tables = {**before.tables, 'symbol_blocks': after.tables['symbol_blocks']}
		if tip is not None:
			# The batch refreshed its beneficiary and balances before the checkpoint rejected publication.
			[(previous_account,)] = expected_tables['symbol_accounts']
			[(account,)] = after.tables['symbol_accounts']
			self.assertGreater(account['updated_at'], previous_account['updated_at'])
			expected_tables['symbol_accounts'] = [({**previous_account, 'last_seen_height': tip, 'updated_at': account['updated_at']},)]
			[(previous_balance,)] = expected_tables['symbol_account_mosaics']
			expected_tables['symbol_account_mosaics'] = [({**previous_balance, 'updated_at_height': tip},)]

		self.assertEqual(expected_tables, after.tables)
		self.assertEqual(expected_sync_state, after.sync_state)
		self.assertEqual(before.refresh_state, after.refresh_state)

	def _assert_following_sync_stops_at_verified_ancestor_gap(self, blocks):
		connector = RecoveryConnector(blocks, 6)
		with self.assertRaisesRegex(SymbolRollbackError, '^Local contiguous Symbol history does not reach the verified finalized height$'):
			self._sync_with_connector(connector)

		self.assertEqual('verified_anchor_conflict', self._recovery()['stop_reason'])
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks')])

	def test_sync_rejects_forward_write_when_the_reconciled_revision_changes_during_fetch(self):
		# Arrange:
		blocks = _chain(6)
		before, recovery = self._prepare_forward_revision_conflict(blocks)
		generations = self._read_generation_rows()
		database = self.puller.symbol_db

		# Act:
		with SymbolDatabase(database.db_config) as external:
			connector = DeleteAncestorOnForwardPageConnector(blocks, external)
			with self.assertRaisesRegex(SymbolRollbackError, '^Stored Symbol block history changed before recovery commit$'):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1, 3, 4, 5], self._fetch_block_heights(database))
		self._assert_revision_conflict_preserves_checkpoint(before, {**before.sync_state, 'status': 'unhealthy'}, recovery)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual([], [path for path in connector.paths if path.startswith('lock/hash/')])
		self._assert_following_sync_stops_at_verified_ancestor_gap(blocks)

	def test_sync_does_not_recertify_a_new_revision_in_a_no_new_block_checkpoint(self):
		# Arrange:
		blocks = _chain(6)
		before, recovery = self._prepare_forward_revision_conflict(blocks)
		database = self.puller.symbol_db
		connector = RecoveryConnector(blocks[:5], 4)

		# Act:
		with SymbolDatabase(database.db_config) as external:
			wrapper = DeleteAncestorAfterFinalHashDatabase(database, external, connector)
			with self._use_database(wrapper):
				with self.assertRaisesRegex(SymbolRollbackError, '^Stored Symbol block history changed before recovery commit$'):
					self._sync_with_connector(connector)

		# Assert:
		self.assertTrue(wrapper.has_deleted)
		self.assertEqual(['blocks/5', 'blocks/4'], [path for path in connector.paths if path.startswith('blocks')])
		self.assertEqual([1, 3, 4, 5], self._fetch_block_heights(database))
		self._assert_revision_conflict_preserves_checkpoint(before, {**before.sync_state, 'status': 'unhealthy'}, recovery)
		self._assert_following_sync_stops_at_verified_ancestor_gap(blocks)

	def test_sync_rejects_history_changed_after_write_intent_before_block_write(self):
		# Arrange:
		blocks = _chain(6)
		before, recovery = self._prepare_forward_revision_conflict(blocks)
		database = self.puller.symbol_db

		# Act:
		with SymbolDatabase(database.db_config) as external:
			with self._use_database(DeleteAncestorAfterWriteIntentDatabase(database, external)):
				with self.assertRaisesRegex(SymbolRollbackError, '^Stored Symbol block history changed before recovery commit$'):
					self._sync_with_connector(RecoveryConnector(blocks, 6))

		# Assert: the intent survived, and block six was never written.
		self.assertEqual([1, 3, 4, 5], self._fetch_block_heights(database))
		self._assert_revision_conflict_preserves_checkpoint(
			before, {**before.sync_state, 'status': 'unhealthy', 'dirty_state_from_height': 6}, recovery)
		self._assert_following_sync_stops_at_verified_ancestor_gap(blocks)

	def test_sync_keeps_dirty_intent_when_an_external_revision_follows_its_own_block_write(self):
		# Arrange:
		blocks = _chain(6)
		before, recovery = self._prepare_forward_revision_conflict(blocks)
		generations = self._read_generation_rows()
		database = self.puller.symbol_db

		# Act:
		with SymbolDatabase(database.db_config) as external:
			with self._use_database(DeleteAncestorAfterBlockWriteDatabase(database, external)):
				with self.assertRaisesRegex(SymbolRollbackError, '^Stored Symbol block history changed before recovery commit$'):
					self._sync_with_connector(RecoveryConnector(blocks, 6))

		# Assert: the local write is durable, while its checkpoint and cleanup were rejected.
		self.assertEqual([1, 3, 4, 5, 6], self._fetch_block_heights(database))
		self.assertEqual(bytes.fromhex(blocks[5]['meta']['hash']), bytes(database.get_block_hash(6)))
		self._assert_revision_conflict_preserves_checkpoint(
			before, {**before.sync_state, 'status': 'unhealthy', 'dirty_state_from_height': 6}, recovery, tip=6)
		self.assertEqual(generations, self._read_generation_rows())
		self._assert_following_sync_stops_at_verified_ancestor_gap(blocks)

	def test_sync_rejects_the_next_batch_when_history_changes_after_a_committed_checkpoint(self):
		# Arrange: blocks six and seven require separate batches from the same prefetched page.
		blocks = _chain(7)
		before, recovery = self._prepare_forward_revision_conflict(blocks)
		generations = self._read_generation_rows()
		database = self.puller.symbol_db
		self.puller._max_transactions_per_batch = 1  # pylint: disable=protected-access
		for block in blocks[5:]:
			block['meta'].update(transactionsCount=1, totalTransactionsCount=1)

		transactions = {transaction_path(height, height): create_transaction_page([create_node_transaction(height)]) for height in (6, 7)}
		connector = RecoveryConnector(blocks, 7, transactions_by_path=transactions)

		# Act: the edit commits after batch six's checkpoint and before batch seven's write intent.
		with SymbolDatabase(database.db_config) as external:
			wrapper = DeleteAncestorAfterCheckpointDatabase(database, external)
			with self._use_database(wrapper):
				with self.assertRaisesRegex(SymbolRollbackError, '^Stored Symbol block history changed before recovery commit$'):
					self._sync_with_connector(connector)

		# Assert: six's committed state survives, seven is absent, and the external edit remains uncertified.
		self.assertEqual([1, 3, 4, 5, 6], self._fetch_block_heights(database))
		after = self._capture_preserved_state()
		self.assertEqual({
			**before.sync_state,
			'status': 'unhealthy',
			'chain_height': 7,
			'last_synced_height': 6,
			'last_synced_block_hash': bytes.fromhex(blocks[5]['meta']['hash'])
		}, after.sync_state)
		current_recovery = self._recovery()
		own_revision = wrapper.committed_recovery['block_revision']
		self.assertNotEqual(own_revision, current_recovery['block_revision'])
		self.assertEqual({
			**recovery,
			'block_revision': current_recovery['block_revision'],
			'continuity_height': 6,
			'continuity_revision': own_revision
		}, current_recovery)
		self.assertEqual(before.tables['symbol_hash_locks'], after.tables['symbol_hash_locks'])
		self.assertEqual(before.refresh_state, after.refresh_state)
		self.assertEqual(generations, self._read_generation_rows())
		self.assertEqual([], [path for path in connector.paths if path.startswith('lock/hash/')])

	def test_sync_rejects_a_changed_fixed_finalized_hash_when_resuming_before_common_point_search(self):
		# Arrange: trimming six to five requires reconciliation and the first attempt only pins F=3.
		blocks = _chain(6)
		self._sync_with_connector(RecoveryConnector(blocks, 2))
		before = self._capture_preserved_state()
		recovery = self._recovery()
		paused = RecoveryConnector(blocks[:5], 3)

		# Act:
		self._pause_at_pinned_comparison(paused)

		# Assert:
		progress = self._recovery()['progress']
		self.assertEqual((3, 5, None, None), (
			progress['finalized'][0], progress['search_next'], progress['checked_height'], progress['finalized_parent']))
		self.assertEqual(['blocks/5'], [path for path in paused.paths if path.startswith('blocks')])

		# Act: finality has advanced, but the old fixed block contradicts its recorded hash.
		changed_block = create_node_block(3, 'AB' * 32, blocks[1]['meta']['hash'])
		connector = RecoveryConnector(blocks[:5], 4, evidence_by_height={3: changed_block})
		with self.assertRaisesRegex(SymbolRollbackError, '^Node finalized block hash does not match chain info$'):
			self._sync_with_connector(connector)

		# Assert: comparison and the new finalized block were checked before the original pin failed.
		self.assertEqual(['chain/info', 'blocks/5', 'blocks?pageSize=100&offset=1&orderBy=height', 'blocks/4', 'blocks/3'], [
			path for path in connector.paths if path == 'chain/info' or path.startswith('blocks')])
		self.assertEqual([], connector.post_requests)
		self._assert_preserved_state(before, {**before.sync_state, 'status': 'unhealthy'})
		self.assertEqual({**recovery, 'invalidations': 1, 'stop_reason': 'reconciliation_wait'}, self._recovery())

	def test_recover_fork_reopens_terminal_gate_at_zero_finality_with_a_fresh_chain_read(self):
		# Arrange: the node has stored blocks and still reports the zero-height finalized boundary.
		blocks = _chain(3)
		self._sync_with_connector(RecoveryConnector(blocks, 0, account_pages={1: [create_account_item()]}))
		self.assertTrue(asyncio.run(self.puller.refresh_accounts()))
		self._set_terminal_stop()
		before = self._capture_preserved_state()
		recovery = self._recovery()
		generations = self._read_generation_rows()
		connector = RecoveryConnector(blocks, 0)

		# Act:
		self._recover_fork(connector, 0, '00' * 32)

		# Assert: the terminal gate can reopen after the fresh observation without requesting a block at height zero.
		self.assertEqual([
			'chain/info', 'blocks/3', 'blocks?pageSize=100&offset=0&orderBy=height', 'chain/info'
		], connector.paths)
		self.assertEqual({**recovery, 'invalidations': 0, 'stop_reason': None}, self._recovery())
		self._assert_preserved_state(before, before.sync_state)
		self.assertEqual(generations, self._read_generation_rows())
