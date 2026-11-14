# pylint: disable=too-many-lines
import asyncio
import copy
import json
from contextlib import contextmanager
from datetime import datetime
from unittest.mock import AsyncMock, patch

from common.tests.PostgresTestUtils import drop_symbol_block_tables_if_present
from psycopg2 import Error as PsycopgError
from symbolchain.sc import MosaicSupplyChangeAction, ReceiptType, TransactionType
from symbolchain.symbol.IdGenerator import generate_namespace_id
from symbolchain.symbol.KeyPair import PublicKey
from symbolchain.symbol.Network import Address, Network
from symbollightapi.model.Exceptions import NodeException

from puller.db.SymbolDatabase import RollbackRefreshEntries
from puller.facade.SymbolPuller import BLOCK_PAGE_FETCH_CONCURRENCY, MAX_PAGE_SIZE, SymbolRollbackError
from puller.model.symbol.Account import create_account_row
from puller.model.symbol.Block import create_block_row
from puller.model.symbol.Receipt import create_receipt_rows
from puller.model.symbol.Transaction import TRANSACTION_TYPE_LABELS
from tests.test.SymbolDatabaseTestUtils import normalize_sync_state
from tests.test.SymbolLockTestUtils import create_secret_lock_item
from tests.test.SymbolMetadataTestUtils import (
	SCOPED_METADATA_KEY,
	SOURCE_ADDRESS,
	TARGET_ADDRESS,
	create_expected_metadata_row,
	create_metadata_item,
	fetch_metadata_rows,
	metadata_path
)
from tests.test.SymbolMosaicTestUtils import (
	MOSAIC_ID,
	create_expected_mosaic_row,
	create_mosaic_item,
	create_persisted_mosaic_state,
	fetch_mosaic_state
)
from tests.test.SymbolNamespaceTestUtils import (
	NAMESPACE_ROOT_ID,
	NAMESPACE_SUB_ID,
	create_namespace_item,
	fetch_namespace_state,
	seed_namespace
)
from tests.test.SymbolTestConstants import BENEFICIARY_ADDRESS, RECIPIENT_ADDRESS, SIGNER_ADDRESS
from tests.test.SymbolTransactionTestUtils import create_transaction_entry

from .puller_test_utils import (
	COMPLETE_BATCH_STATE_DURABLE_TABLES,
	COMPLETE_BATCH_STATE_SUPPLEMENTAL_TABLES,
	NATIVE_MOSAIC_ID,
	BoundedNamespaceDetailConnector,
	ChainInfoOverrideConnector,
	DelegatingSymbolDatabase,
	FakeConnector,
	NamespaceNamesResponseConnector,
	NoOpRateLimiter,
	ResponseConnector,
	SymbolPullerTestBase,
	create_account_item,
	create_adaptive_batch_fixture,
	create_amount_statement_item,
	create_artifact_expiry_statement,
	create_complete_aggregate_pair,
	create_embedded_node_transaction,
	create_multi_batch_block_pages,
	create_network_properties,
	create_node_block,
	create_node_transaction,
	create_resolution_statement,
	create_statement_item,
	create_symbol_puller,
	create_sync_state,
	create_transaction_page,
	resolution_path,
	set_symbol_connector,
	set_symbol_rate_limiter,
	set_sync_block_pages,
	statement_path,
	transaction_path
)

CHECKPOINT_COMMIT_EMPTY_TABLES = COMPLETE_BATCH_STATE_SUPPLEMENTAL_TABLES
CHECKPOINT_COMMIT_STABLE_TABLES = COMPLETE_BATCH_STATE_DURABLE_TABLES + COMPLETE_BATCH_STATE_SUPPLEMENTAL_TABLES


def create_block_hash(height):
	"""Returns the default node block hash used by create_node_block for one height."""
	return bytes.fromhex(f'{height:064X}')


def create_checkpoint_sync_state(finalized_height, last_synced_height, **overrides):
	"""Creates sync state whose finalized and synced hashes follow create_node_block defaults."""
	return create_sync_state(**{
		'finalized_height': finalized_height,
		'finalized_hash': create_block_hash(finalized_height),
		'last_synced_height': last_synced_height,
		'last_synced_block_hash': create_block_hash(last_synced_height),
		**overrides
	})


def create_uncheckpointed_sync_state(dirty_state_from_height, **overrides):
	"""Creates dirty sync state with no recorded finalized anchor or checkpoint."""
	return create_sync_state(**{
		'finalized_height': None,
		'finalized_hash': None,
		'last_synced_height': None,
		'last_synced_block_hash': None,
		'dirty_state_from_height': dirty_state_from_height,
		**overrides
	})


def seed_healthy_refresh_state(database, run_id, last_completed_height):
	"""Seeds one published healthy account refresh generation."""
	database.upsert_account_refresh_state({
		'status': 'healthy', 'last_successful_run_id': run_id, 'last_completed_height': last_completed_height
	})


def create_linked_node_blocks(start_height, hash_characters):
	"""Creates node blocks keyed by height whose hashes chain from start_height."""
	blocks = {}
	previous_hash = None
	for height, character in enumerate(hash_characters, start_height):
		blocks[height] = create_node_block(height, block_hash=character * 64, previous_hash=previous_hash)
		previous_hash = character * 64

	return blocks


def _assert_checkpoint_transaction_address_rows(test_case, cursor, transaction_hashes):
	cursor.execute(
		'SELECT t.height, t.hash, ta.address, ta.role '
		'FROM symbol_transactions AS t '
		'JOIN symbol_transaction_addresses AS ta ON ta.transaction_id = t.id '
		'ORDER BY t.height, ta.address')
	expected_address_rows = [
		(height, bytes.fromhex(transaction_hash), address, role)
		for height, transaction_hash in transaction_hashes
		for address, role in ((bytes.fromhex(SIGNER_ADDRESS), 'signer'), (bytes.fromhex(RECIPIENT_ADDRESS), 'recipient'))
	]
	expected_address_rows.sort(key=lambda row: (row[0], row[2]))
	test_case.assertEqual(expected_address_rows, [
		(height, bytes(transaction_hash), bytes(address), role)
		for height, transaction_hash, address, role in cursor.fetchall()
	])


def _fetch_transaction_counts(database):
	cursor = database.connection.cursor()
	cursor.execute(
		'SELECT b.height, COUNT(t.id) FROM symbol_blocks AS b '
		'LEFT JOIN symbol_transactions AS t ON t.height = b.height '
		'GROUP BY b.height ORDER BY b.height')
	return cursor.fetchall()


class FailingSyncWriteIntentDatabase(DelegatingSymbolDatabase):
	def mark_sync_write_intent(self, height):  # pylint: disable=no-self-use
		raise RuntimeError(f'write intent failed at height {height}')


class FailingSyncTransactionDatabase(DelegatingSymbolDatabase):
	def upsert_transactions_for_height(self, height, transaction_rows):  # pylint: disable=no-self-use
		raise RuntimeError(f'transaction write failed at height {height}')


class FailingAdaptiveSecondRangeReceiptDatabase(DelegatingSymbolDatabase):
	def upsert_receipts_for_height(self, height, receipts, block_reward):  # pylint: disable=unused-argument
		if 5 == height:
			raise RuntimeError('adaptive second-range receipt write failed')

		return self.database.upsert_receipts_for_height(height, receipts, block_reward)


class FailingSyncBlockDatabase(DelegatingSymbolDatabase):
	def upsert_blocks(self, blocks):  # pylint: disable=unused-argument,no-self-use
		raise RuntimeError('block write failed')


class InvalidFinalSyncStateDatabase(DelegatingSymbolDatabase):
	def __init__(self, database):
		super().__init__(database)
		self.publication_attempts = 0
		self.publication_error = None

	def upsert_sync_state(self, sync_state):
		self.publication_attempts += 1
		try:
			return self.database.upsert_sync_state({**sync_state, 'status': 'invalid'})
		except PsycopgError as exception:
			self.publication_error = exception
			raise


class FailingSyncReceiptDatabase(DelegatingSymbolDatabase):
	def upsert_receipts_for_height(self, height, receipts, block_reward):  # pylint: disable=unused-argument,no-self-use
		raise RuntimeError(f'receipt write failed at height {height}')


class FailingSyncMultisigDatabase(DelegatingSymbolDatabase):
	def upsert_multisig(self, address, multisig_row):  # pylint: disable=unused-argument,no-self-use
		raise RuntimeError('multisig write failed')


class FailingSyncNamespaceDatabase(DelegatingSymbolDatabase):
	def apply_namespace_entries(self, namespace_entries):  # pylint: disable=unused-argument,no-self-use
		raise RuntimeError('namespace write failed')


class FailingSyncMosaicDatabase(DelegatingSymbolDatabase):
	def upsert_mosaic(self, mosaic_row):  # pylint: disable=unused-argument,no-self-use
		raise RuntimeError('mosaic write failed')


class FailingSyncMetadataDatabase(DelegatingSymbolDatabase):
	def upsert_metadata(self, metadata_row):  # pylint: disable=unused-argument,no-self-use
		raise RuntimeError('metadata write failed')


class FailingSyncHashLockDatabase(DelegatingSymbolDatabase):
	def upsert_hash_lock(self, hash_lock_row):  # pylint: disable=unused-argument,no-self-use
		raise RuntimeError('hash lock write failed')


class FailingSyncSecretLockDatabase(DelegatingSymbolDatabase):
	def replace_secret_locks(self, search_key, secret_lock_rows):  # pylint: disable=unused-argument,no-self-use
		raise RuntimeError('secret lock write failed')


class FailingSyncMosaicRestrictionDatabase(DelegatingSymbolDatabase):
	def replace_mosaic_restrictions(self, restriction_key, restriction_rows):  # pylint: disable=unused-argument,no-self-use
		raise RuntimeError('mosaic restriction write failed')


class FailingSyncCurrentStateDatabase(DelegatingSymbolDatabase):
	def upsert_account_current_state(self, account_row, mosaic_rows, overwrite_is_harvesting_active=False):  # pylint: disable=no-self-use
		raise RuntimeError('current-state write failed')


class FailingSyncTransactionAndStatusDatabase(FailingSyncTransactionDatabase):
	def mark_sync_unhealthy(self):  # pylint: disable=no-self-use
		raise RuntimeError('status update failed')


class FailingCheckpointCommitConnection:
	"""Delegates the PostgreSQL connection and fails one armed commit."""

	def __init__(self, connection):
		self._connection = connection
		self._fail_next_commit = False

	def fail_next_commit(self):
		self._fail_next_commit = True

	def commit(self):
		if self._fail_next_commit:
			self._fail_next_commit = False
			raise RuntimeError('second checkpoint commit failed')

		return self._connection.commit()

	def __getattr__(self, name):
		return getattr(self._connection, name)


class FailingSecondCheckpointCommitDatabase(DelegatingSymbolDatabase):
	def __init__(self, database):
		super().__init__(database)
		self.checkpoint_count = 0

	def checkpoint_sync_state(self, sync_state):
		self.checkpoint_count += 1
		if 2 == self.checkpoint_count:
			self.database.connection.fail_next_commit()

		return self.database.checkpoint_sync_state(sync_state)


class FailingFinalizationCleanupDatabase(DelegatingSymbolDatabase):
	def apply_finalization_lock_entries(self, hash_lock_entries, secret_lock_entries):  # pylint: disable=unused-argument,no-self-use
		raise RuntimeError('finalization cleanup failed')


class MissingNewFinalizedBlockHashDatabase(DelegatingSymbolDatabase):
	def get_block_hash(self, height):
		if 1 == height:
			return None

		return self.database.get_block_hash(height)


class FailingRollbackArtifactStateDatabase(DelegatingSymbolDatabase):
	def has_artifact_state_gaps(self, height):  # pylint: disable=unused-argument,no-self-use
		raise RuntimeError('artifact state gap lookup failed')


class RollbackAccountResponseConnector(FakeConnector):
	def __init__(self, *args, batch_response=None, account_lookup_response=None, **kwargs):
		super().__init__(*args, **kwargs)
		self.batch_response = batch_response
		self.account_lookup_response = account_lookup_response

	async def post(self, url_path, request_payload, *args):
		if 'accounts' == url_path and self.batch_response is not None:
			self.paths.append(url_path)
			self.post_payloads_list.append(request_payload)
			self.post_requests.append((url_path, request_payload))
			return self.batch_response

		return await super().post(url_path, request_payload, *args)

	async def get(self, url_path, *args):
		if url_path.startswith('accounts/') and self.account_lookup_response is not None:
			self.paths.append(url_path)
			return self.account_lookup_response

		return await super().get(url_path, *args)


class NodeBlockEvidenceConnector(FakeConnector):
	"""Returns selected block responses verbatim for rollback evidence validation."""

	def __init__(self, *args, block_response_overrides=None, **kwargs):
		super().__init__(*args, **kwargs)
		self.block_response_overrides = block_response_overrides or {}

	async def get(self, url_path, *args):
		if url_path.startswith('blocks/'):
			height = int(url_path.removeprefix('blocks/'))
			if height in self.block_response_overrides:
				self.paths.append(url_path)
				response = self.block_response_overrides[height]
				if isinstance(response, Exception):
					raise response

				return response

		return await super().get(url_path, *args)


class WorkflowDetailConnector(FakeConnector):
	"""Adds deterministic current-state detail responses to the shared sync fixture."""

	def __init__(self, *args, hash_lock_item=None, secret_lock_item=None, restriction_response=None, **kwargs):
		super().__init__(*args, **kwargs)
		self.hash_lock_item = hash_lock_item
		self.secret_lock_item = secret_lock_item
		self.restriction_response = restriction_response

	async def get(self, url_path, *args):
		if url_path.startswith('lock/hash/'):
			self.paths.append(url_path)
			return self.hash_lock_item
		if url_path.startswith('lock/secret?'):
			self.paths.append(url_path)
			return {'data': [self.secret_lock_item]}
		if url_path.startswith('restrictions/mosaic?'):
			self.paths.append(url_path)
			return self.restriction_response

		return await super().get(url_path, *args)


class CancelAtNextBatchConnector(FakeConnector):
	"""Stops the next block fetch so the test can cancel at a batch boundary."""

	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.next_batch_started = asyncio.Event()
		self.next_batch_gate = asyncio.Event()

	async def get(self, url_path, *args):
		if 'blocks?pageSize=100&offset=1000&' == url_path[:len('blocks?pageSize=100&offset=1000&')]:
			self.next_batch_started.set()
			await self.next_batch_gate.wait()

		return await super().get(url_path, *args)


class FailingNextBatchFetchConnector(FakeConnector):
	"""Raises a terminal fetch error for the first page after the first checkpoint."""

	async def get(self, url_path, *args):
		if 'blocks?pageSize=100&offset=1000&' == url_path[:len('blocks?pageSize=100&offset=1000&')]:
			raise RuntimeError('terminal block fetch failed')

		return await super().get(url_path, *args)


class RecordingCheckpointDatabase(DelegatingSymbolDatabase):
	def __init__(self, database):
		super().__init__(database)
		self.published_states = []

	def checkpoint_sync_state(self, sync_state):
		result = self.database.checkpoint_sync_state(sync_state)
		self.published_states.append(self.database.get_sync_state())
		return result


class DatabaseObservingPerformanceLogger:
	def __init__(self, database, state_snapshot=None):
		self.database = database
		self.state_snapshot = state_snapshot
		self.events = []
		self.completed_sync_states = []
		self.completed_state_snapshots = []

	def info(self, message):
		event = json.loads(message)
		self.events.append(event)
		if 'symbol_sync_batch_completed' == event['event']:
			self.completed_sync_states.append(normalize_sync_state(self.database.get_sync_state()))
			if self.state_snapshot:
				self.completed_state_snapshots.append(self.state_snapshot())


def _create_adaptive_sync_fixture(failing_transaction_range=None):
	blocks, transaction_pages, statement_pages = create_adaptive_batch_fixture(
		(0, 2, 3, 1, 4, 0, 2),
		((1, 3), (4, 6), (7, 7)),
		top_level_counts=(0, 1, 3, 1, 4, 0, 2),
		transactions_by_height={2: create_complete_aggregate_pair(2, 'A' * 64, 0)},
		failing_transaction_range=failing_transaction_range)
	statement_pages[statement_path(1, 3)] = {
		'data': [create_amount_statement_item(2, 11, ReceiptType.INFLATION.value, 'receipt-2')]
	}
	statement_pages[statement_path(4, 6)] = {
		'data': [
			create_amount_statement_item(4, 44, ReceiptType.INFLATION.value, 'receipt-4'),
			create_amount_statement_item(5, 55, ReceiptType.INFLATION.value, 'receipt-5')
		]
	}
	statement_pages[statement_path(7, 7)] = {
		'data': [create_amount_statement_item(7, 77, ReceiptType.INFLATION.value, 'receipt-7')]
	}

	return blocks, transaction_pages, statement_pages


def _expected_adaptive_transaction_identities(through_height):
	identities = [
		(2, bytes.fromhex('A' * 64), None),
		(2, bytes.fromhex('A' * 64), 0)
	]
	for height, transaction_count in ((3, 3), (4, 1), (5, 4), (7, 2)):
		if height <= through_height:
			identities.extend(
				(height, bytes.fromhex(f'{height:060X}{index:04X}'), None)
				for index in range(transaction_count))

	return [identity for identity in identities if identity[0] <= through_height]


def _capture_adaptive_transaction_payloads(transaction_pages):
	first_range_items = transaction_pages[transaction_path(1, 3)]['data']
	second_range_items = transaction_pages[transaction_path(4, 6)]['data']
	return {
		'aggregate': copy.deepcopy(next(
			item for item in first_range_items
			if item['meta']['height'] == '2' and 'aggregateHash' not in item['meta'])),
		'embedded': copy.deepcopy(next(
			item for item in first_range_items
			if item['meta']['height'] == '2' and 'aggregateHash' in item['meta'])),
		'transfer': copy.deepcopy(next(item for item in second_range_items if item['meta']['height'] == '4'))
	}


@contextmanager
def _replace_symbol_database(puller, replacement_database):
	original_database = puller.symbol_db
	puller.symbol_db = replacement_database
	try:
		yield
	finally:
		puller.symbol_db = original_database


@contextmanager
def _failing_checkpoint_connection(database):
	original_connection = database.connection
	setattr(database, 'connection', FailingCheckpointCommitConnection(original_connection))
	try:
		yield
	finally:
		setattr(database, 'connection', original_connection)


class SymbolPullerSyncTest(SymbolPullerTestBase):  # pylint: disable=too-many-public-methods
	def _seed_rollback_preservation_rows(self, database, height):
		beneficiary = bytes.fromhex(BENEFICIARY_ADDRESS)
		recipient = bytes.fromhex(RECIPIENT_ADDRESS)
		database.upsert_transactions_for_height(height, [create_transaction_entry(
			height,
			f'rollback-preservation-{height}',
			signer_address=beneficiary,
			recipient_address=recipient,
			address_rows=[
				{'address': beneficiary, 'role': 'signer'},
				{'address': recipient, 'role': 'recipient'}
			])])
		database.upsert_receipts_for_height(height, create_receipt_rows(create_statement_item(
			height,
			{
				'version': 1,
				'type': ReceiptType.HARVEST_FEE.value,
				'targetAddress': BENEFICIARY_ADDRESS,
				'mosaicId': NATIVE_MOSAIC_ID,
				'amount': '11'
			},
			f'rollback-preservation-harvest-fee-{height}')), 0)
		account_row, mosaic_rows = create_account_row(
			create_account_item(BENEFICIARY_ADDRESS),
			self.puller.symbol_facade.network,
			height,
			NATIVE_MOSAIC_ID,
			6)
		database.upsert_account_current_state(account_row, mosaic_rows)
		database.upsert_multisig(beneficiary, {
			'address': beneficiary,
			'min_approval': 1,
			'min_removal': 1,
			'cosignatory_addresses': [recipient],
			'multisig_addresses': [],
			'updated_at_height': height
		})

	def _seed_account_rollback_fixture(self):
		database = self.puller.symbol_db
		address = Network.TESTNET.public_key_to_address(PublicKey('A' * 64)).bytes
		other_address = Network.TESTNET.public_key_to_address(PublicKey('B' * 64)).bytes
		self._seed_blocks(database, [1, 2, 3], {2: 'D' * 64})
		database.upsert_sync_state(create_sync_state(last_synced_height=3))
		account_row, mosaic_rows = create_account_row(
			create_account_item(address.hex().upper()), self.puller.symbol_facade.network, 2, NATIVE_MOSAIC_ID, 6)
		database.upsert_account_current_state(account_row, mosaic_rows)
		database.upsert_multisig(address, {
			'address': address,
			'min_approval': 1,
			'min_removal': 1,
			'cosignatory_addresses': [],
			'multisig_addresses': [],
			'updated_at_height': 2
		})
		database.upsert_receipts_for_height(2, create_receipt_rows(create_statement_item(
			2,
			{
				'version': 1,
				'type': ReceiptType.HARVEST_FEE.value,
				'targetAddress': address.hex().upper(),
				'mosaicId': NATIVE_MOSAIC_ID,
				'amount': '11'
			},
			'rollback-account-beneficiary')), 0)
		replacement_block = create_node_block(2, block_hash='B' * 64)
		terminal_block = create_node_block(3, previous_hash='B' * 64)
		connector_args = {
			'chain_height': 3,
			'pages': {1: [replacement_block, terminal_block]},
			'block_by_height': {1: create_node_block(1), 2: replacement_block, 3: terminal_block},
			'finalized_height': 3,
			'transactions_by_path': {transaction_path(2, 3): create_transaction_page([])},
			'statement_pages': {statement_path(2, 3): {'data': []}}
		}
		return database, address, other_address, connector_args

	def _seed_uncheckpointed_dirty_range(self, heights, block_hashes=None):
		database = self.puller.symbol_db
		self._seed_blocks(database, heights, block_hashes)
		database.upsert_sync_state(create_uncheckpointed_sync_state(
			1,
			status='unhealthy'))
		return database

	@staticmethod
	def _create_namespace_batch_connector():
		return FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=2, total_transactions_count=2)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([
					create_node_transaction(
						1,
						transaction_hash='A' * 64,
						transaction_id='namespace-registration',
						type=TransactionType.NAMESPACE_REGISTRATION.value,
						id=NAMESPACE_ROOT_ID,
						name='root',
						registrationType=0),
					create_node_transaction(
						1,
						transaction_hash='B' * 64,
						transaction_id='mosaic-alias',
						type=TransactionType.MOSAIC_ALIAS.value,
						namespaceId=NAMESPACE_ROOT_ID,
						mosaicId=NATIVE_MOSAIC_ID,
						aliasAction=1)
				])
			},
			namespace_by_id={
				NAMESPACE_ROOT_ID: create_namespace_item(alias={'type': 1, 'mosaicId': NATIVE_MOSAIC_ID})
			},
			namespace_names={NAMESPACE_ROOT_ID: 'root'})

	@staticmethod
	def _create_mosaic_definition_sync_connector(
		include_namespace_alias=False,
		mosaics_by_id=None,
		mosaics_response=None,
		transactions_count=1,
		total_transactions_count=1
	):
		transactions = [create_node_transaction(
			1,
			transaction_hash='A' * 64,
			transaction_id='mosaic-definition',
			type=TransactionType.MOSAIC_DEFINITION.value,
			id=MOSAIC_ID,
			duration='0',
			flags=2,
			divisibility=6)]
		connector_arguments = {
			'transactions_by_path': {transaction_path(1, 1): create_transaction_page(transactions)},
			'mosaics_by_id': mosaics_by_id if mosaics_by_id is not None else {MOSAIC_ID: create_mosaic_item()}
		}
		if include_namespace_alias:
			transactions.extend([
				create_node_transaction(
					1,
					transaction_hash='B' * 64,
					transaction_id='namespace-registration',
					type=TransactionType.NAMESPACE_REGISTRATION.value,
					id=NAMESPACE_ROOT_ID,
					name='root',
					registrationType=0),
				create_node_transaction(
					1,
					transaction_hash='C' * 64,
					transaction_id='mosaic-alias',
					type=TransactionType.MOSAIC_ALIAS.value,
					namespaceId=NAMESPACE_ROOT_ID,
					mosaicId=MOSAIC_ID,
					aliasAction=1)
			])
			connector_arguments.update({
				'namespace_by_id': {NAMESPACE_ROOT_ID: create_namespace_item(alias={'type': 1, 'mosaicId': MOSAIC_ID})},
				'namespace_names': {NAMESPACE_ROOT_ID: 'root'}
			})
		if mosaics_response is not None:
			connector_arguments['mosaics_response'] = mosaics_response

		return FakeConnector(1, {0: [create_node_block(
			1,
			transactions_count=transactions_count,
			total_transactions_count=total_transactions_count)]}, **connector_arguments)

	def test_sync_block_headers_persists_mosaic_discovered_from_definition_transaction(self):
		# Arrange:
		connector = self._create_mosaic_definition_sync_connector()

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		expected_row = create_expected_mosaic_row(create_mosaic_item(), 1)
		self.assertEqual([create_persisted_mosaic_state(expected_row, [])], fetch_mosaic_state(self.puller.symbol_db))
		self.assertEqual(1, connector.paths.count('mosaics'))

	def test_sync_block_headers_persists_mosaic_expired_receipt_and_refreshes_mosaic(self):
		# Arrange:
		mosaic_item = create_mosaic_item(supply='777', item_id='000000000000000000000001')
		connector = FakeConnector(
			1,
			{0: [create_node_block(1)]},
			statement_pages={statement_path(1, 1): {'data': [create_artifact_expiry_statement(
				1, ReceiptType.MOSAIC_EXPIRED.value, MOSAIC_ID)]}},
			mosaics_by_id={MOSAIC_ID: mosaic_item})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'SELECT receipt_type, receipt_group, artifact_id, mosaic_id, amount FROM symbol_receipts')
		self.assertEqual([
			('mosaicExpired', 'artifactExpiry', MOSAIC_ID, None, 0)
		], cursor.fetchall())
		self.assertEqual([{'mosaicIds': [MOSAIC_ID]}], [
			payload for path, payload in connector.post_requests if 'mosaics' == path
		])
		self.assertEqual(1, connector.paths.count('mosaics'))
		expected_row = create_expected_mosaic_row(mosaic_item, 1)
		self.assertEqual([create_persisted_mosaic_state(expected_row, [])], fetch_mosaic_state(self.puller.symbol_db))

	def _assert_alias_supply_change_refreshes_mosaic_state(
		self, alias_mosaic_id, transaction_items, resolution_entries, original_supply, new_supply,
		transactions_count, total_transactions_count
	):  # pylint: disable=too-many-arguments,too-many-positional-arguments
		# Arrange:
		self.puller.symbol_db.upsert_mosaic(create_expected_mosaic_row(
			create_mosaic_item(supply=str(original_supply)),
			0))
		block = create_node_block(
			1,
			transactions_count=transactions_count,
			total_transactions_count=total_transactions_count)
		connector = FakeConnector(
			1,
			{0: [block]},
			transactions_by_path={transaction_path(1, 1): create_transaction_page(transaction_items)},
			mosaic_resolutions_by_height={1: [create_resolution_statement(
				1,
				alias_mosaic_id,
				resolution_entries
			)]},
			mosaics_by_id={MOSAIC_ID: create_mosaic_item(supply=str(new_supply))})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		mosaic_state = fetch_mosaic_state(self.puller.symbol_db)
		self.assertEqual(new_supply, mosaic_state[0].supply)
		self.assertEqual(1, mosaic_state[0].updated_at_height)
		self.assertEqual([{'mosaicIds': [MOSAIC_ID]}], [
			payload for path, payload in connector.post_requests if 'mosaics' == path
		])
		self.assertEqual([resolution_path('mosaic', 1)], [
			path for path in connector.paths if path.startswith('statements/resolutions/mosaic?')
		])

	def test_sync_block_headers_refreshes_mosaic_supply_for_top_level_alias_supply_change(self):
		alias_mosaic_id = 'A95F1F8A96159516'
		original_supply = 987654321
		supply_delta = 10
		self._assert_alias_supply_change_refreshes_mosaic_state(
			alias_mosaic_id,
			[create_node_transaction(
				1,
				transaction_hash='A' * 64,
				transaction_id='mosaic-supply-change',
				type=TransactionType.MOSAIC_SUPPLY_CHANGE.value,
				mosaicId=alias_mosaic_id,
				delta=str(supply_delta),
				action=MosaicSupplyChangeAction.INCREASE.value)],
			[{'source': {'primaryId': 1, 'secondaryId': 0}, 'resolved': MOSAIC_ID}],
			original_supply,
			original_supply + supply_delta,
			1,
			1)

	def test_sync_block_headers_refreshes_mosaic_supply_for_embedded_alias_supply_change(self):
		alias_mosaic_id = 'A95F1F8A96159516'
		mosaic_id_at_aggregate_source = '0000000000000002'
		original_supply = 987654321
		supply_delta = 10
		aggregate_hash = 'A' * 64
		self._assert_alias_supply_change_refreshes_mosaic_state(
			alias_mosaic_id,
			create_complete_aggregate_pair(
				1,
				aggregate_hash,
				0,
				transaction_id='embedded-mosaic-supply-change',
				type=TransactionType.MOSAIC_SUPPLY_CHANGE.value,
				mosaicId=alias_mosaic_id,
				delta=str(supply_delta),
				action=MosaicSupplyChangeAction.INCREASE.value),
			[
				# The (1, 0) entry proves the embedded transaction uses (1, 1), not its parent aggregate source.
				{'source': {'primaryId': 1, 'secondaryId': 0}, 'resolved': mosaic_id_at_aggregate_source},
				{'source': {'primaryId': 1, 'secondaryId': 1}, 'resolved': MOSAIC_ID}
			],
			original_supply,
			original_supply + supply_delta,
			1,
			2)

	def test_sync_block_headers_deletes_dirty_mosaic_when_batch_response_omits_it(self):
		# Arrange:
		self.puller.symbol_db.upsert_mosaic(create_expected_mosaic_row(create_mosaic_item(), 0))
		connector = self._create_mosaic_definition_sync_connector(mosaics_by_id={})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([], fetch_mosaic_state(self.puller.symbol_db))

	def test_sync_block_headers_writes_namespaces_before_mosaics_for_same_batch_alias(self):
		# Arrange:
		connector = self._create_mosaic_definition_sync_connector(
			include_namespace_alias=True,
			transactions_count=3,
			total_transactions_count=3)

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(['root'], fetch_mosaic_state(self.puller.symbol_db)[0].alias_names)
		self.assertEqual([
			('namespaces/names', {'namespaceIds': [NAMESPACE_ROOT_ID]}),
			('mosaics', {'mosaicIds': [MOSAIC_ID]})
		], [
			(path, payload) for path, payload in connector.post_requests
			if path in ('namespaces/names', 'mosaics')
		])

	def test_sync_block_headers_rejects_malformed_mosaics_response(self):
		# Arrange:
		connector = self._create_mosaic_definition_sync_connector(mosaics_response={'data': []})

		# Act / Assert:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Malformed Symbol mosaics batch response')

		# Assert:
		self.assertEqual(1, connector.paths.count('mosaics'))

	def test_sync_block_headers_does_not_write_any_batch_state_when_mosaic_fetch_fails(self):
		# Arrange:
		connector = self._create_mosaic_definition_sync_connector(
			include_namespace_alias=True,
			mosaics_by_id={MOSAIC_ID: RuntimeError('mosaic fetch failed')},
			transactions_count=3,
			total_transactions_count=3)

		# Act / Assert:
		with self.assertRaisesRegex(RuntimeError, 'mosaic fetch failed'):
			self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_accounts')
		account_count = cursor.fetchone()[0]
		cursor.execute('SELECT COUNT(*) FROM symbol_namespaces')
		namespace_count = cursor.fetchone()[0]
		cursor.execute('SELECT COUNT(*) FROM symbol_mosaics')
		mosaic_count = cursor.fetchone()[0]
		namespace_rows, alias_rows = fetch_namespace_state(self.puller.symbol_db.connection)
		self.assertEqual([], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(0, account_count)
		self.assertEqual(0, namespace_count)
		self.assertEqual(0, mosaic_count)
		self.assertEqual([], namespace_rows)
		self.assertEqual([], alias_rows)
		self.assertIsNone(self.puller.symbol_db.get_sync_state())

	def test_sync_block_headers_keeps_dirty_marker_when_mosaic_write_fails(self):
		# Arrange:
		connector = self._create_mosaic_definition_sync_connector()
		database = self.puller.symbol_db
		with _replace_symbol_database(self.puller, FailingSyncMosaicDatabase(database)):
			# Act / Assert:
			with self.assertRaisesRegex(RuntimeError, 'mosaic write failed'):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1], self._fetch_block_heights(database))
		sync_state = database.get_sync_state()
		self.assertEqual('unhealthy', sync_state['status'])
		self.assertEqual(1, sync_state['dirty_state_from_height'])

	def test_sync_block_headers_converges_mosaic_state_when_restarted_from_existing_blocks(self):
		# Arrange:
		connector = self._create_mosaic_definition_sync_connector()
		self._sync_with_connector(connector)
		first_mosaic_state = fetch_mosaic_state(self.puller.symbol_db)
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('DELETE FROM symbol_sync_state')
		self.puller.symbol_db.connection.commit()

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(first_mosaic_state, fetch_mosaic_state(self.puller.symbol_db))

	def test_sync_block_headers_persists_dirty_namespace_state_after_registration_and_alias_transactions(self):
		# Arrange:
		connector = self._create_namespace_batch_connector()

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		namespace_rows, alias_rows = fetch_namespace_state(self.puller.symbol_db.connection)
		self.assertEqual([
			(
				NAMESPACE_ROOT_ID, None, NAMESPACE_ROOT_ID, 'root', 'root', 1, 'root',
				BENEFICIARY_ADDRESS.lower(), 1, None, 'mosaic', NATIVE_MOSAIC_ID, None,
				create_namespace_item(alias={'type': 1, 'mosaicId': NATIVE_MOSAIC_ID}), 1)
		], namespace_rows)
		self.assertEqual([
			('mosaic', NATIVE_MOSAIC_ID, 'root', 1),
			('namespace', NAMESPACE_ROOT_ID, 'root', 1)
		], alias_rows)
		self.assertEqual([
			{'addresses': [self._beneficiary_address_text()]},
			{'namespaceIds': [NAMESPACE_ROOT_ID]}
		], connector.post_payloads)
		self._assert_namespace_requests(
			connector,
			[NAMESPACE_ROOT_ID],
			[{'namespaceIds': [NAMESPACE_ROOT_ID]}])

	def test_sync_block_headers_keeps_dirty_marker_when_namespace_write_fails(self):
		# Arrange:
		connector = self._create_namespace_batch_connector()
		database = self.puller.symbol_db
		with _replace_symbol_database(self.puller, FailingSyncNamespaceDatabase(database)):
			# Act / Assert:
			with self.assertRaisesRegex(RuntimeError, 'namespace write failed'):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1], self._fetch_block_heights(database))
		sync_state = database.get_sync_state()
		self.assertEqual('unhealthy', sync_state['status'])
		self.assertEqual(1, sync_state['dirty_state_from_height'])

	def test_sync_block_headers_deletes_dirty_namespace_state_when_namespace_is_not_found(self):
		# Arrange:
		seed_namespace(self.puller.symbol_db, create_namespace_item(), {NAMESPACE_ROOT_ID: 'root'})
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([create_node_transaction(
					1,
					transaction_hash='A' * 64,
					transaction_id='namespace-registration',
					type=TransactionType.NAMESPACE_REGISTRATION.value,
					id=NAMESPACE_ROOT_ID,
					name='root',
					registrationType=0)])
			},
			namespace_by_id={NAMESPACE_ROOT_ID: {
				'code': 'ResourceNotFound',
				'message': f'no resource exists with id {NAMESPACE_ROOT_ID}'
			}}
		)

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(([], []), fetch_namespace_state(self.puller.symbol_db.connection))
		self.assertEqual([1], self._fetch_block_heights(self.puller.symbol_db))
		self._assert_namespace_requests(connector, [NAMESPACE_ROOT_ID], [])

	def test_sync_block_headers_rolls_back_namespace_entries_when_later_write_conflicts_with_stale_full_name(self):
		# Arrange:
		first_name = 'first'
		second_name = 'second'
		stale_name = 'stale'
		first_id = f'{generate_namespace_id(first_name):016X}'
		second_id = f'{generate_namespace_id(second_name):016X}'
		stale_id = f'{generate_namespace_id(stale_name):016X}'
		seed_namespace(
			self.puller.symbol_db,
			create_namespace_item(
				namespace_id=first_id,
				root_id=first_id,
				alias={'type': 1, 'mosaicId': 'mosaic-a-old'}),
			{first_id: first_name},
			0)
		# Seed a stale local row that occupies the second namespace's full name,
		# allowing valid Node namespace data to trigger a later persistence failure.
		seed_namespace(
			self.puller.symbol_db,
			create_namespace_item(namespace_id=stale_id, root_id=stale_id),
			{stale_id: second_name},
			0)
		before_state = fetch_namespace_state(self.puller.symbol_db.connection)
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=2, total_transactions_count=2)]},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([
				create_node_transaction(
					1,
					transaction_hash='A' * 64,
					transaction_id='namespace-a-registration',
					type=TransactionType.NAMESPACE_REGISTRATION.value,
					id=first_id,
					name=first_name,
					registrationType=0),
				create_node_transaction(
					1,
					transaction_hash='B' * 64,
					transaction_id='namespace-b-registration',
					type=TransactionType.NAMESPACE_REGISTRATION.value,
					id=second_id,
					name=second_name,
					registrationType=0)
			])},
			namespace_by_id={
				first_id: create_namespace_item(
					namespace_id=first_id,
					root_id=first_id,
					alias={'type': 1, 'mosaicId': 'mosaic-a-new'}),
				second_id: create_namespace_item(namespace_id=second_id, root_id=second_id)
			},
			namespace_names={first_id: first_name, second_id: second_name})

		# Act:
		with self.assertRaises(PsycopgError):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(before_state, fetch_namespace_state(self.puller.symbol_db.connection))
		self.assertEqual([1], self._fetch_block_heights(self.puller.symbol_db))
		sync_state = self.puller.symbol_db.get_sync_state()
		self.assertEqual('unhealthy', sync_state['status'])
		self.assertEqual(1, sync_state['dirty_state_from_height'])
		self._assert_namespace_requests(
			connector,
			[first_id, second_id],
			[{'namespaceIds': [first_id, second_id]}])

	def test_sync_block_headers_converges_namespace_state_when_restarted_from_existing_blocks(self):
		# Arrange:
		connector = self._create_namespace_batch_connector()
		self._sync_with_connector(connector)
		first_sync_namespace_paths = [
			path for path in connector.paths if path.startswith('namespaces/') and path != 'namespaces/names'
		]
		first_sync_names_payloads = [
			payload for path, payload in connector.post_requests if 'namespaces/names' == path
		]
		first_namespace_state = fetch_namespace_state(self.puller.symbol_db.connection)
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('DELETE FROM symbol_sync_state')
		self.puller.symbol_db.connection.commit()

		# Act:
		self._sync_with_connector(connector)
		second_sync_namespace_paths = [
			path for path in connector.paths if path.startswith('namespaces/') and path != 'namespaces/names'
		][len(first_sync_namespace_paths):]
		second_sync_names_payloads = [
			payload for path, payload in connector.post_requests if 'namespaces/names' == path
		][len(first_sync_names_payloads):]

		# Assert:
		self.assertEqual(first_namespace_state, fetch_namespace_state(self.puller.symbol_db.connection))
		# The two identical requests correspond to the initial sync and the resync after sync state deletion.
		self.assertEqual([f'namespaces/{NAMESPACE_ROOT_ID}'], first_sync_namespace_paths)
		self.assertEqual([f'namespaces/{NAMESPACE_ROOT_ID}'], second_sync_namespace_paths)
		self.assertEqual([{'namespaceIds': [NAMESPACE_ROOT_ID]}], first_sync_names_payloads)
		self.assertEqual([{'namespaceIds': [NAMESPACE_ROOT_ID]}], second_sync_names_payloads)

	def test_sync_block_headers_does_not_write_batch_state_when_namespace_fetch_fails(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([create_node_transaction(
					1,
					type=TransactionType.NAMESPACE_REGISTRATION.value,
					id=NAMESPACE_ROOT_ID,
					name='root',
					registrationType=0)])
			},
			namespace_by_id={NAMESPACE_ROOT_ID: RuntimeError('namespace fetch failed')})

		# Act:
		with self.assertRaisesRegex(RuntimeError, 'namespace fetch failed'):
			self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_accounts')
		account_count = cursor.fetchone()[0]
		cursor.execute('SELECT COUNT(*) FROM symbol_namespaces')
		namespace_count = cursor.fetchone()[0]
		self.assertEqual([], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(0, account_count)
		self.assertEqual(0, namespace_count)
		self.assertIsNone(self.puller.symbol_db.get_sync_state())
		self._assert_namespace_requests(connector, [NAMESPACE_ROOT_ID], [])

	def test_sync_block_headers_ignores_unrelated_transaction_and_receipt_for_namespace_refresh(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([create_node_transaction(
				1,
				type=TransactionType.TRANSFER.value)]),
			},
			statement_pages={statement_path(1, 1): {'data': [create_artifact_expiry_statement(
				1, ReceiptType.MOSAIC_EXPIRED.value, '0000000000000001')]}})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self._assert_namespace_requests(connector, [], [])

	def test_sync_block_headers_makes_no_namespace_requests_for_empty_transaction_and_receipt_batch(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1)]})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self._assert_namespace_requests(connector, [], [])

	def test_sync_block_headers_collects_all_namespace_dirty_sources_in_first_encounter_order(self):
		# Arrange:
		namespace_ids = [f'{index:016X}' for index in (8, 2, 7, 1, 6, 3, 5, 4)]
		transactions = [
			create_node_transaction(
				1,
				transaction_hash=f'{index + 100:064X}',
				transaction_id=f'transaction-{index}',
				type=transaction_type,
				**fields)
			for index, transaction_type, fields in [
				(0, TransactionType.NAMESPACE_REGISTRATION.value, {'id': namespace_ids[0]}),
				(1, TransactionType.ADDRESS_ALIAS.value, {'namespaceId': namespace_ids[1], 'aliasAction': 0, 'address': BENEFICIARY_ADDRESS}),
				(2, TransactionType.ADDRESS_ALIAS.value, {'namespaceId': namespace_ids[2], 'aliasAction': 1, 'address': BENEFICIARY_ADDRESS}),
				(3, TransactionType.MOSAIC_ALIAS.value, {'namespaceId': namespace_ids[3], 'aliasAction': 0}),
				(4, TransactionType.MOSAIC_ALIAS.value, {'namespaceId': namespace_ids[4], 'aliasAction': 1}),
			]
		]
		transactions.append(create_embedded_node_transaction(
			1,
			'A' * 64,
			1,
			transaction_id='embedded-registration',
			type=TransactionType.NAMESPACE_REGISTRATION.value,
			id=namespace_ids[5]))
		statement_items = [
			create_artifact_expiry_statement(1, ReceiptType.NAMESPACE_EXPIRED.value, namespace_ids[6]),
			create_artifact_expiry_statement(1, ReceiptType.NAMESPACE_DELETED.value, namespace_ids[7])
		]
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=5, total_transactions_count=6)]},
			transactions_by_path={transaction_path(1, 1): create_transaction_page(transactions)},
			statement_pages={statement_path(1, 1): {'data': statement_items}},
			namespace_by_id={
				namespace_id: create_namespace_item(namespace_id=namespace_id, root_id=namespace_id)
				for namespace_id in namespace_ids
			},
			namespace_names={namespace_id: f'name-{namespace_id}' for namespace_id in namespace_ids})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self._assert_namespace_requests(connector, namespace_ids, [{'namespaceIds': namespace_ids}])

	def test_sync_block_headers_resolves_duplicate_and_ancestor_namespace_names(self):
		# Arrange:
		connector = NamespaceNamesResponseConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([create_node_transaction(
				1,
				type=TransactionType.NAMESPACE_REGISTRATION.value,
				id=NAMESPACE_SUB_ID)]),
			},
			namespace_by_id={NAMESPACE_SUB_ID: create_namespace_item(
				namespace_id=NAMESPACE_SUB_ID,
				root_id=NAMESPACE_ROOT_ID,
				parent_id=NAMESPACE_ROOT_ID)},
			names_response=[
				{'id': NAMESPACE_ROOT_ID, 'name': 'root'},
				{'id': NAMESPACE_SUB_ID, 'name': 'sub', 'parentId': NAMESPACE_ROOT_ID},
				{'id': NAMESPACE_ROOT_ID, 'name': 'root'}
			])
		# Only the child is dirty; its root name comes from the ancestor entry returned by POST /namespaces/names.

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT name, full_name FROM symbol_namespaces')
		self.assertEqual([('sub', 'root.sub')], cursor.fetchall())
		self._assert_namespace_requests(
			connector,
			[NAMESPACE_SUB_ID],
			[{'namespaceIds': [NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID]}])

	def test_sync_block_headers_rejects_malformed_namespace_names_response_before_writes(self):
		# Arrange:
		connector = NamespaceNamesResponseConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([create_node_transaction(
				1,
				type=TransactionType.NAMESPACE_REGISTRATION.value,
				id=NAMESPACE_ROOT_ID)]),
			},
			namespace_by_id={NAMESPACE_ROOT_ID: create_namespace_item()},
			names_response={'data': []})

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, 'Malformed Symbol namespace names response'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([], self._fetch_block_heights(self.puller.symbol_db))
		self.assertIsNone(self.puller.symbol_db.get_sync_state())
		self._assert_namespace_requests(
			connector,
			[NAMESPACE_ROOT_ID],
			[{'namespaceIds': [NAMESPACE_ROOT_ID]}])

	def test_sync_block_headers_fetches_namespace_details_concurrently_in_bounded_chunks(self):
		# Arrange:
		namespace_ids = [f'{index:016X}' for index in range(1, MAX_PAGE_SIZE + 2)]
		connector = BoundedNamespaceDetailConnector(
			1,
			{0: [create_node_block(1, transactions_count=101, total_transactions_count=101)]},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([
				create_node_transaction(
					1,
					transaction_hash=f'{index + 100:064X}',
					transaction_id=f'namespace-{index}',
					type=TransactionType.NAMESPACE_REGISTRATION.value,
					id=namespace_id)
				for index, namespace_id in enumerate(namespace_ids[:MAX_PAGE_SIZE])
			], page_number=1), transaction_path(1, 1, 2): create_transaction_page([
				create_node_transaction(
					1,
					transaction_hash=f'{index + 100:064X}',
					transaction_id=f'namespace-{index}',
					type=TransactionType.NAMESPACE_REGISTRATION.value,
					id=namespace_id)
				for index, namespace_id in enumerate(namespace_ids[MAX_PAGE_SIZE:], start=MAX_PAGE_SIZE)
			], page_number=2)},
			namespace_by_id={
				namespace_id: create_namespace_item(namespace_id=namespace_id, root_id=namespace_id)
				for namespace_id in namespace_ids
			},
			namespace_names={namespace_id: f'name-{namespace_id}' for namespace_id in namespace_ids})
		set_symbol_rate_limiter(self.puller, NoOpRateLimiter())

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(
			[f'namespaces/{namespace_id}' for namespace_id in namespace_ids],
			connector.detail_paths)
		self._assert_namespace_requests(
			connector,
			namespace_ids,
			[
				{'namespaceIds': namespace_ids[:MAX_PAGE_SIZE]},
				{'namespaceIds': namespace_ids[MAX_PAGE_SIZE:]}
			])
		self.assertGreater(connector.max_in_flight_detail_requests, 1)
		self.assertLessEqual(connector.max_in_flight_detail_requests, MAX_PAGE_SIZE)
		self.assertEqual(0, connector.in_flight_detail_requests)

	def _assert_sync_request_counts(self, connector, block_page_count, batch_count):
		# Assert:
		block_paths = [
			path for path in connector.paths
			if path.startswith('blocks?pageSize=100&offset=')
		]
		transaction_paths = [
			path for path in connector.paths
			if path.startswith('transactions/confirmed?')
		]
		statement_paths = [
			path for path in connector.paths
			if path.startswith('statements/transaction?')
		]
		account_paths = [
			path for path in connector.paths
			if 'accounts' == path
		]
		multisig_paths = [
			path for path in connector.paths
			if path.startswith('account/') and path.endswith('/multisig')
		]

		self.assertEqual(1, connector.paths.count('chain/info'))
		self.assertEqual(1, connector.paths.count('network/properties'))
		self.assertEqual(1, connector.paths.count(f'mosaics/{NATIVE_MOSAIC_ID}'))
		self.assertEqual(block_page_count, len(block_paths))
		self.assertEqual(batch_count, len(transaction_paths))
		self.assertEqual(batch_count, len(statement_paths))
		self.assertEqual(batch_count, len(account_paths))
		self.assertEqual(batch_count, len(multisig_paths))
		self.assertEqual(3 + block_page_count + 4 * batch_count, len(connector.paths))

	def test_sync_block_headers_pulls_chain_info_network_properties_and_blocks(
		self
	):
		# Arrange:
		connector = FakeConnector(
			2,
			{0: [create_node_block(1), create_node_block(2)]}
		)

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		beneficiary_address_text = self._beneficiary_address_text()
		self.assertEqual([
			'chain/info',
			'network/properties',
			f'mosaics/{NATIVE_MOSAIC_ID}',
			'blocks?pageSize=100&offset=0&orderBy=height',
			transaction_path(1, 2),
			statement_path(1, 2),
			'accounts',
			f'account/{beneficiary_address_text}/multisig'
		], connector.paths)

	def test_sync_block_headers_persists_synced_block_watermark(self):
		# Arrange:
		connector = FakeConnector(
			2,
			{0: [create_node_block(1), create_node_block(2)]}
		)

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1, 2], block_heights)
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(2, sync_state['chain_height'])
		self.assertEqual(1, sync_state['finalized_height'])
		self.assertEqual(
			create_block_hash(2),
			bytes(sync_state['last_synced_block_hash'])
		)
		self.assertIsNone(sync_state['dirty_state_from_height'])

	def test_sync_block_headers_accepts_valid_parent_hash_chain(self):
		# Arrange:
		connector = FakeConnector(
			3,
			{0: [create_node_block(1), create_node_block(2), create_node_block(3)]}
		)

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1, 2, 3], block_heights)
		self.assertEqual(3, sync_state['last_synced_height'])

	def test_sync_block_headers_accepts_height_one_with_zero_previous_hash(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1)]})

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1], block_heights)
		self.assertEqual(1, sync_state['last_synced_height'])

	def test_sync_block_headers_rejects_nonzero_previous_hash_at_height_one(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1, previous_hash='A' * 64)]})

		# Act / Assert:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			f'Symbol block chain mismatch at height 1: expected previous hash {bytes(32).hex().upper()}, got {"A" * 64}')

	def test_sync_block_headers_does_not_write_blocks_when_write_intent_fails(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1)]})
		database = self.puller.symbol_db
		with _replace_symbol_database(self.puller, FailingSyncWriteIntentDatabase(database)):
			# Act / Assert:
			with self.assertRaisesRegex(RuntimeError, 'write intent failed at height 1'):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([], self._fetch_block_heights(database))
		self.assertIsNone(database.get_sync_state())

	def test_sync_block_headers_keeps_dirty_marker_when_block_write_fails(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1)]})
		database = self.puller.symbol_db
		with _replace_symbol_database(self.puller, FailingSyncBlockDatabase(database)):
			# Act / Assert:
			with self.assertRaisesRegex(RuntimeError, 'block write failed'):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([], self._fetch_block_heights(database))
		sync_state = database.get_sync_state()
		self.assertEqual('unhealthy', sync_state['status'])
		self.assertEqual(1, sync_state['dirty_state_from_height'])

	def test_sync_block_headers_keeps_dirty_marker_when_receipt_write_fails(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1)]})
		database = self.puller.symbol_db
		with _replace_symbol_database(self.puller, FailingSyncReceiptDatabase(database)):
			# Act / Assert:
			with self.assertRaisesRegex(RuntimeError, 'receipt write failed at height 1'):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1], self._fetch_block_heights(database))
		cursor = database.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_receipts')
		self.assertEqual(0, cursor.fetchone()[0])
		sync_state = database.get_sync_state()
		self.assertEqual('unhealthy', sync_state['status'])
		self.assertEqual(1, sync_state['dirty_state_from_height'])

	def test_sync_block_headers_keeps_dirty_marker_when_multisig_write_fails(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([create_node_transaction(1)])})
		database = self.puller.symbol_db
		with _replace_symbol_database(self.puller, FailingSyncMultisigDatabase(database)):
			# Act / Assert:
			with self.assertRaisesRegex(RuntimeError, 'multisig write failed'):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1], self._fetch_block_heights(database))
		sync_state = database.get_sync_state()
		self.assertEqual('unhealthy', sync_state['status'])
		self.assertEqual(1, sync_state['dirty_state_from_height'])

	def test_sync_block_headers_keeps_dirty_intent_after_transaction_write_failure(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1)]})
		database = self.puller.symbol_db
		with _replace_symbol_database(self.puller, FailingSyncTransactionDatabase(database)):
			# Act / Assert:
			with self.assertRaisesRegex(RuntimeError, 'transaction write failed at height 1'):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1], self._fetch_block_heights(database))
		sync_state = database.get_sync_state()
		self.assertEqual('unhealthy', sync_state['status'])
		self.assertEqual(1, sync_state['dirty_state_from_height'])

	def test_sync_block_headers_propagates_capped_status_update_failure(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		database.upsert_sync_state(create_checkpoint_sync_state(
			1, 4,
			chain_height=5,
			dirty_state_from_height=5))
		set_symbol_connector(self.puller, FakeConnector(
			5,
			{},
			block_by_height={1: create_node_block(1), 2: create_node_block(2, block_hash='B' * 64)}))

		with _replace_symbol_database(self.puller, FailingSyncTransactionAndStatusDatabase(database)):
			# Act:
			with self.assertRaisesRegex(RuntimeError, 'status update failed'):
				asyncio.run(self.puller.sync_block_headers(max_height=2))

		# Assert:
		sync_state = database.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(5, sync_state['dirty_state_from_height'])

	def test_sync_block_headers_preserves_original_error_when_unhealthy_update_fails(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1)]})
		database = self.puller.symbol_db
		with _replace_symbol_database(self.puller, FailingSyncTransactionAndStatusDatabase(database)):
			# Act / Assert:
			with self.assertRaisesRegex(RuntimeError, 'transaction write failed at height 1'):
				self._sync_with_connector(connector)

		# Assert:
		sync_state = database.get_sync_state()
		self.assertEqual('initialized', sync_state['status'])
		self.assertEqual(1, sync_state['dirty_state_from_height'])

		# Act:
		self._sync_with_connector(FakeConnector(1, {0: [create_node_block(1)]}))

		# Assert:
		sync_state = database.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertIsNone(sync_state['dirty_state_from_height'])

	def test_sync_block_headers_keeps_dirty_intent_after_current_state_write_failure(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1)]})
		database = self.puller.symbol_db
		with _replace_symbol_database(self.puller, FailingSyncCurrentStateDatabase(database)):
			# Act / Assert:
			with self.assertRaisesRegex(RuntimeError, 'current-state write failed'):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1], self._fetch_block_heights(database))
		cursor = database.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_transactions')
		self.assertEqual(0, cursor.fetchone()[0])
		cursor.execute('SELECT COUNT(*) FROM symbol_receipts')
		self.assertEqual(0, cursor.fetchone()[0])
		sync_state = database.get_sync_state()
		self.assertEqual('unhealthy', sync_state['status'])
		self.assertEqual(1, sync_state['dirty_state_from_height'])

	def test_sync_block_headers_repairs_height_one_dirty_tail_before_forward_sync(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1)]})
		database = self.puller.symbol_db
		with _replace_symbol_database(self.puller, FailingSyncCurrentStateDatabase(database)):
			with self.assertRaisesRegex(RuntimeError, 'current-state write failed'):
				self._sync_with_connector(connector)

		# Act:
		self._sync_with_connector(FakeConnector(1, {0: [create_node_block(1)]}))

		# The height-1 repair can temporarily leave node-confirmed current state without a block; the run above completes
		# the subsequent forward sync and establishes the terminal healthy state.
		# Assert:
		sync_state = database.get_sync_state()
		self.assertEqual([1], self._fetch_block_heights(database))
		self.assertEqual('healthy', sync_state['status'])
		self.assertIsNone(sync_state['dirty_state_from_height'])

	def test_sync_block_headers_keeps_minimum_dirty_height_when_forward_sync_fails_after_repair(self):
		# Arrange:
		first_connector = FakeConnector(1, {0: [create_node_block(1)]})
		database = self.puller.symbol_db
		with _replace_symbol_database(self.puller, FailingSyncTransactionDatabase(database)):
			with self.assertRaisesRegex(RuntimeError, 'transaction write failed at height 1'):
				self._sync_with_connector(first_connector)

		second_connector = FakeConnector(2, {0: [create_node_block(1), create_node_block(2)]})
		with _replace_symbol_database(self.puller, FailingSyncCurrentStateDatabase(database)):
			# Act / Assert:
			with self.assertRaisesRegex(RuntimeError, 'current-state write failed'):
				self._sync_with_connector(second_connector)

		# Assert:
		sync_state = database.get_sync_state()
		self.assertEqual('unhealthy', sync_state['status'])
		self.assertEqual(1, sync_state['dirty_state_from_height'])

	def test_sync_block_headers_keeps_dirty_tail_outside_explicit_cap_untouched(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		database.upsert_sync_state(create_checkpoint_sync_state(
			1, 4,
			chain_height=5,
			dirty_state_from_height=5))
		connector = FakeConnector(
			5,
			{},
			block_by_height={1: create_node_block(1), 2: create_node_block(2, block_hash='B' * 64)})
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers(max_height=2))

		# Assert:
		self.assertEqual([1, 2, 3, 4, 5], self._fetch_block_heights(database))
		self.assertEqual(0, connector.paths.count('blocks/2'))
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks?page')])
		sync_state = database.get_sync_state()
		self.assertEqual('unhealthy', sync_state['status'])
		self.assertEqual(5, sync_state['dirty_state_from_height'])

	def test_sync_block_headers_keeps_partially_capped_dirty_tail_untouched(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		database.upsert_sync_state(create_checkpoint_sync_state(
			1, 2,
			chain_height=5,
			dirty_state_from_height=3))
		connector = FakeConnector(
			5, {}, block_by_height={1: create_node_block(1), 2: create_node_block(2, block_hash='B' * 64)})
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers(max_height=4))

		# Assert:
		self.assertEqual([1, 2, 3, 4, 5], self._fetch_block_heights(database))
		self.assertEqual(0, connector.paths.count('blocks/2'))
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks?page')])
		sync_state = database.get_sync_state()
		self.assertEqual('unhealthy', sync_state['status'])
		self.assertEqual(3, sync_state['dirty_state_from_height'])

	def test_sync_block_headers_removes_orphan_tail_when_node_chain_is_shorter_than_dirty_start(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		database.upsert_sync_state(create_checkpoint_sync_state(
			1, 4,
			chain_height=5,
			dirty_state_from_height=5))
		connector = FakeConnector(3, {}, block_by_height={
			1: create_node_block(1),
			2: create_node_block(2),
			3: create_node_block(3)
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		sync_state = database.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(3, sync_state['last_synced_height'])
		self.assertIsNone(sync_state['dirty_state_from_height'])

	def test_sync_block_headers_converges_orphan_current_state_before_forward_sync(self):
		# Arrange:
		database = self.puller.symbol_db
		orphan_mosaic_id = 'A' * 16
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		seed_namespace(database, create_namespace_item(), {NAMESPACE_ROOT_ID: 'orphan'}, observed_height=5)
		database.upsert_mosaic(create_expected_mosaic_row(create_mosaic_item(orphan_mosaic_id), 5))
		metadata_item = create_metadata_item(
			metadata_type=1,
			target_id=orphan_mosaic_id,
			composite_hash='11' * 32)
		database.upsert_metadata(create_expected_metadata_row(
			metadata_item,
			5,
			composite_hash=bytes.fromhex('11' * 32),
			metadata_type='mosaic',
			target_id=orphan_mosaic_id,
			value_utf8='orphan',
			scoped_metadata_key=SCOPED_METADATA_KEY,
			source_address=bytes.fromhex(SOURCE_ADDRESS),
			target_address=bytes.fromhex(TARGET_ADDRESS),
			value_hex='6F727068616E'))
		database.upsert_sync_state(create_checkpoint_sync_state(
			1, 4,
			chain_height=5,
			dirty_state_from_height=5))
		namespace_not_found = {
			'code': 'ResourceNotFound',
			'message': f'no resource exists with id {NAMESPACE_ROOT_ID}'
		}
		metadata_query = metadata_path(
			1,
			target_id=orphan_mosaic_id,
			source_address=SOURCE_ADDRESS,
			target_address=TARGET_ADDRESS,
			scoped_metadata_key=SCOPED_METADATA_KEY)
		connector = FakeConnector(
			6,
			{4: [create_node_block(5), create_node_block(6)]},
			block_by_height={height: create_node_block(height) for height in range(1, 6)},
			namespace_by_id={NAMESPACE_ROOT_ID: namespace_not_found},
			mosaics_response=[],
			mosaics_by_id={orphan_mosaic_id: None},
			metadata_by_query={metadata_query: {'data': []}})
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([1, 2, 3, 4, 5, 6], self._fetch_block_heights(database))
		self.assertEqual([], fetch_namespace_state(database.connection)[0])
		self.assertEqual([], fetch_mosaic_state(database))
		self.assertEqual([], fetch_metadata_rows(database))
		repair_and_page_paths = [
			path for path in connector.paths
			if path.startswith('blocks?page') or path in (
				f'namespaces/{NAMESPACE_ROOT_ID}', 'mosaics', f'mosaics/{orphan_mosaic_id}', metadata_query
			)
		]
		self.assertEqual([
			f'namespaces/{NAMESPACE_ROOT_ID}',
			'mosaics',
			f'mosaics/{orphan_mosaic_id}',
			metadata_query,
			'blocks?pageSize=100&offset=4&orderBy=height'
		], repair_and_page_paths)
		sync_state = database.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertIsNone(sync_state['dirty_state_from_height'])

	def test_sync_block_headers_rejects_dirty_shortening_repair_above_operator_cap(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		self._seed_rollback_preservation_rows(database, 5)
		database.upsert_sync_state(create_checkpoint_sync_state(
			1, 4,
			chain_height=5,
			dirty_state_from_height=5))
		before_state = self._capture_preserved_state()
		connector = FakeConnector(
			3,
			{},
			block_by_height={height: create_node_block(height) for height in (1, 2, 3)})
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(SymbolRollbackError, 'Rollback would delete persisted blocks above max_height'):
			asyncio.run(self.puller.sync_block_headers(max_height=2))

		# Assert:
		self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
		self.assertEqual([1, 2, 3, 4, 5], self._fetch_block_heights(database))
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks?page')])

	def test_sync_block_headers_preserves_existing_empty_watermark_when_no_pages_are_returned(self):
		# Arrange:
		database = self.puller.symbol_db
		database.upsert_sync_state(create_sync_state(
			chain_height=1,
			finalized_height=None,
			finalized_hash=None,
			last_synced_height=None,
			last_synced_block_hash=None))
		set_symbol_connector(self.puller, FakeConnector(1, {}, finalized_height=0))
		set_sync_block_pages(self.puller, AsyncMock(return_value=(None, None)))

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		sync_state = database.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertIsNone(sync_state['last_synced_height'])
		self.assertIsNone(sync_state['last_synced_block_hash'])

	def test_sync_block_headers_rejects_parent_hash_mismatch_at_stored_block_boundary(self):
		# Arrange:
		stored_height = 1
		connector = FakeConnector(
			2,
			{1: [create_node_block(2, previous_hash='A' * 64)]},
			block_by_height={1: create_node_block(1)}
		)
		self._seed_blocks(self.puller.symbol_db, [stored_height])
		existing_sync_state = create_sync_state(
			chain_height=stored_height,
			last_synced_height=stored_height,
			last_synced_block_hash=create_block_hash(stored_height))
		self.puller.symbol_db.upsert_sync_state(existing_sync_state)
		expected_state = self._fetch_complete_batch_state()
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(
			ValueError,
			f'Symbol block chain mismatch at height 2: expected previous hash {1:064X}, got {"A" * 64}'
		):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual(expected_state, self._fetch_complete_batch_state())
		self.assertEqual([
			'chain/info',
			'network/properties',
			f'mosaics/{NATIVE_MOSAIC_ID}',
			'blocks/1',
			'blocks?pageSize=100&offset=1&orderBy=height'
		], connector.paths)

	def test_sync_block_headers_rejects_parent_hash_mismatch_within_page_before_related_fetches(self):
		# Arrange:
		connector = FakeConnector(
			2,
			{0: [create_node_block(1), create_node_block(
				2, previous_hash='A' * 64, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={transaction_path(1, 2): create_transaction_page([create_node_transaction(2)])},
			statement_pages={
				statement_path(1, 2): {'data': [create_amount_statement_item(2, 2000)]}
			}
		)
		expected_state = self._fetch_complete_batch_state()
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(
			ValueError,
			f'Symbol block chain mismatch at height 2: expected previous hash {1:064X}, got {"A" * 64}'
		):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual(expected_state, self._fetch_complete_batch_state())
		self.assertEqual([
			'chain/info',
			'network/properties',
			f'mosaics/{NATIVE_MOSAIC_ID}',
			'blocks?pageSize=100&offset=0&orderBy=height'
		], connector.paths)

	def test_sync_block_headers_rejects_parent_hash_mismatch_at_page_boundary(self):
		# Arrange:
		first_page = [create_node_block(height) for height in range(1, 101)]
		second_page = [create_node_block(101, previous_hash='A' * 64)]
		connector = FakeConnector(101, {0: first_page, 100: second_page})
		expected_state = self._fetch_complete_batch_state()
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(
			ValueError,
			f'Symbol block chain mismatch at height 101: expected previous hash {100:064X}, got {"A" * 64}'
		):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual(expected_state, self._fetch_complete_batch_state())
		self.assertEqual([
			'chain/info',
			'network/properties',
			f'mosaics/{NATIVE_MOSAIC_ID}',
			'blocks?pageSize=100&offset=0&orderBy=height',
			'blocks?pageSize=100&offset=100&orderBy=height'
		], connector.paths)

	def test_sync_block_headers_persists_prior_batch_before_later_batch_validation_failure(self):
		# Arrange:
		chain_height = BLOCK_PAGE_FETCH_CONCURRENCY * MAX_PAGE_SIZE + 1
		pages = {
			offset: [
				create_node_block(height)
				for height in range(offset + 1, min(offset + MAX_PAGE_SIZE + 1, chain_height + 1))
			]
			for offset in range(0, chain_height, MAX_PAGE_SIZE)
		}
		pages[BLOCK_PAGE_FETCH_CONCURRENCY * MAX_PAGE_SIZE] = [
			create_node_block(chain_height, previous_hash='A' * 64)
		]
		connector = FakeConnector(chain_height, pages, finalized_height=chain_height - 1)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(
			ValueError,
			f'Symbol block chain mismatch at height {chain_height}: '
			f'expected previous hash {chain_height - 1:064X}, got {"A" * 64}'
		):
			asyncio.run(self.puller.sync_block_headers())

		# Each block-page batch commits before a later page can fail validation, so earlier rows may remain persisted.
		# Assert:
		self.assertEqual(list(range(1, chain_height)), self._fetch_block_heights(self.puller.symbol_db))
		sync_state = self.puller.symbol_db.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(chain_height - 1, sync_state['last_synced_height'])
		self.assertIsNone(sync_state['dirty_state_from_height'])
		block_paths = [path for path in connector.paths if path.startswith('blocks?pageSize=100&offset=')]
		transaction_paths = [path for path in connector.paths if path.startswith('transactions/confirmed?')]
		statement_paths = [path for path in connector.paths if path.startswith('statements/transaction?')]
		self.assertEqual(BLOCK_PAGE_FETCH_CONCURRENCY + 1, len(block_paths))
		self.assertEqual([transaction_path(1, chain_height - 1)], transaction_paths)
		self.assertEqual([statement_path(1, chain_height - 1)], statement_paths)

		# Act: restart with the valid node chain so the committed checkpoint resumes forward sync.
		last_page_offset = BLOCK_PAGE_FETCH_CONCURRENCY * MAX_PAGE_SIZE
		repaired_pages = {
			**pages,
			last_page_offset: [create_node_block(chain_height)]
		}
		self._sync_with_connector(FakeConnector(chain_height, repaired_pages, finalized_height=chain_height - 1))

		# Assert:
		self.assertEqual(list(range(1, chain_height + 1)), self._fetch_block_heights(self.puller.symbol_db))
		sync_state = self.puller.symbol_db.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertIsNone(sync_state['dirty_state_from_height'])

	def test_sync_block_headers_keeps_dirty_marker_when_metadata_write_fails_and_restart_converges(self):
		# Arrange:
		block = create_node_block(1, transactions_count=1, total_transactions_count=1)
		transaction = create_node_transaction(
			1,
			type=TransactionType.MOSAIC_METADATA.value,
			targetAddress=RECIPIENT_ADDRESS,
			targetMosaicId=NATIVE_MOSAIC_ID,
			scopedMetadataKey=SCOPED_METADATA_KEY,
			valueSizeDelta=5,
			value='68656C6C6F')
		metadata_item = create_metadata_item(
			metadata_type=1,
			target_id=NATIVE_MOSAIC_ID,
			source_address=SIGNER_ADDRESS,
			target_address=RECIPIENT_ADDRESS)
		metadata_query = metadata_path(1, NATIVE_MOSAIC_ID)
		connector = FakeConnector(
			1,
			{0: [block]},
			block_by_height={1: block},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([transaction])},
			metadata_by_query={metadata_query: {'data': [metadata_item]}})
		database = self.puller.symbol_db
		with _replace_symbol_database(self.puller, FailingSyncMetadataDatabase(database)):
			# Act + Assert:
			with self.assertRaisesRegex(RuntimeError, 'metadata write failed'):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1], self._fetch_block_heights(database))
		self.assertEqual([], fetch_metadata_rows(database))
		sync_state = database.get_sync_state()
		self.assertEqual('unhealthy', sync_state['status'])
		self.assertIsNone(sync_state['last_synced_height'])
		self.assertIsNone(sync_state['last_synced_block_hash'])
		self.assertEqual(1, sync_state['dirty_state_from_height'])

		# Act: restart with the real writer and the same node state.
		restart_puller = create_symbol_puller(self.config_ini, 'testnet', connector=connector)
		with restart_puller.symbol_db:
			asyncio.run(restart_puller.sync_block_headers())

		# Assert:
		sync_state = database.get_sync_state()
		self.assertEqual(1, sync_state['last_synced_height'])
		self.assertEqual(create_block_hash(1), bytes(sync_state['last_synced_block_hash']))
		self.assertIsNone(sync_state['dirty_state_from_height'])
		self.assertEqual(1, len(fetch_metadata_rows(database)))

	def test_sync_block_headers_keeps_dirty_marker_when_hash_lock_write_fails_and_restart_converges(self):
		# Arrange:
		lock_hash = 'AA' * 32
		block = create_node_block(1, transactions_count=1, total_transactions_count=1)
		transaction = create_node_transaction(
			1,
			type=TransactionType.HASH_LOCK.value,
			hash=lock_hash,
			mosaicId=NATIVE_MOSAIC_ID,
			amount='1234')
		hash_lock_item = {
			'lock': {
				'hash': lock_hash,
				'ownerAddress': SIGNER_ADDRESS,
				'mosaicId': NATIVE_MOSAIC_ID,
				'amount': '1234',
				'endHeight': '100',
				'status': 0
			},
			'id': 'hash-lock'
		}
		connector = WorkflowDetailConnector(
			1,
			{0: [block]},
			block_by_height={1: block},
			hash_lock_item=hash_lock_item,
			transactions_by_path={transaction_path(1, 1): create_transaction_page([transaction])})
		database = self.puller.symbol_db
		with _replace_symbol_database(self.puller, FailingSyncHashLockDatabase(database)):
			# Act + Assert:
			with self.assertRaisesRegex(RuntimeError, 'hash lock write failed'):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1], self._fetch_block_heights(database))
		cursor = database.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_hash_locks')
		self.assertEqual(0, cursor.fetchone()[0])
		sync_state = database.get_sync_state()
		self.assertEqual('unhealthy', sync_state['status'])
		self.assertIsNone(sync_state['last_synced_height'])
		self.assertIsNone(sync_state['last_synced_block_hash'])
		self.assertEqual(1, sync_state['dirty_state_from_height'])

		# Act: restart with the real writer and the same node state.
		restart_puller = create_symbol_puller(self.config_ini, 'testnet', connector=connector)
		with restart_puller.symbol_db:
			asyncio.run(restart_puller.sync_block_headers())

		# Assert:
		sync_state = database.get_sync_state()
		self.assertEqual(1, sync_state['last_synced_height'])
		self.assertEqual(create_block_hash(1), bytes(sync_state['last_synced_block_hash']))
		self.assertIsNone(sync_state['dirty_state_from_height'])
		cursor.execute('SELECT COUNT(*) FROM symbol_hash_locks')
		self.assertEqual(1, cursor.fetchone()[0])

	def test_sync_block_headers_keeps_dirty_marker_when_secret_lock_write_fails_and_restart_converges(self):
		# Arrange:
		secret = 'CC' * 32
		block = create_node_block(1, transactions_count=1, total_transactions_count=1)
		transaction = create_node_transaction(
			1,
			type=TransactionType.SECRET_LOCK.value,
			secret=secret,
			hashAlgorithm=1,
			mosaicId=NATIVE_MOSAIC_ID,
			amount='1234')
		secret_lock_item = create_secret_lock_item(
			composite_hash='DD' * 32,
			owner_address=SIGNER_ADDRESS,
			recipient_address=RECIPIENT_ADDRESS,
			secret=secret,
			hash_algorithm=1,
			mosaic_id=NATIVE_MOSAIC_ID,
			amount='1234',
			end_height='100',
			status=0,
			item_id='secret-lock')
		connector = WorkflowDetailConnector(
			1,
			{0: [block]},
			block_by_height={1: block},
			secret_lock_item=secret_lock_item,
			transactions_by_path={transaction_path(1, 1): create_transaction_page([transaction])})
		database = self.puller.symbol_db
		with _replace_symbol_database(self.puller, FailingSyncSecretLockDatabase(database)):
			# Act + Assert:
			with self.assertRaisesRegex(RuntimeError, 'secret lock write failed'):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1], self._fetch_block_heights(database))
		cursor = database.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_secret_locks')
		self.assertEqual(0, cursor.fetchone()[0])
		sync_state = database.get_sync_state()
		self.assertEqual('unhealthy', sync_state['status'])
		self.assertIsNone(sync_state['last_synced_height'])
		self.assertIsNone(sync_state['last_synced_block_hash'])
		self.assertEqual(1, sync_state['dirty_state_from_height'])

		# Act: restart with the real writer and the same node state.
		restart_puller = create_symbol_puller(self.config_ini, 'testnet', connector=connector)
		with restart_puller.symbol_db:
			asyncio.run(restart_puller.sync_block_headers())

		# Assert:
		sync_state = database.get_sync_state()
		self.assertEqual(1, sync_state['last_synced_height'])
		self.assertEqual(create_block_hash(1), bytes(sync_state['last_synced_block_hash']))
		self.assertIsNone(sync_state['dirty_state_from_height'])
		cursor.execute('SELECT COUNT(*) FROM symbol_secret_locks')
		self.assertEqual(1, cursor.fetchone()[0])

	def test_sync_block_headers_keeps_dirty_marker_when_mosaic_restriction_write_fails_and_restart_converges(self):
		# Arrange:
		block = create_node_block(1, transactions_count=1, total_transactions_count=1)
		transaction = create_node_transaction(
			1,
			type=TransactionType.MOSAIC_ADDRESS_RESTRICTION.value,
			mosaicId=NATIVE_MOSAIC_ID,
			targetAddress=RECIPIENT_ADDRESS)
		restriction_response = {
			'pagination': {'pageNumber': 1, 'pageSize': 100},
			'data': [{
				'id': 'BB' * 12,
				'mosaicRestrictionEntry': {
					'version': 1,
					'compositeHash': 'AA' * 32,
					'entryType': 0,
					'mosaicId': NATIVE_MOSAIC_ID,
					'targetAddress': RECIPIENT_ADDRESS,
					'restrictions': [{'key': '1', 'value': '2'}]
				}
			}]
		}
		connector = WorkflowDetailConnector(
			1,
			{0: [block]},
			block_by_height={1: block},
			restriction_response=restriction_response,
			transactions_by_path={transaction_path(1, 1): create_transaction_page([transaction])})
		database = self.puller.symbol_db
		with _replace_symbol_database(self.puller, FailingSyncMosaicRestrictionDatabase(database)):
			# Act + Assert:
			with self.assertRaisesRegex(RuntimeError, 'mosaic restriction write failed'):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1], self._fetch_block_heights(database))
		cursor = database.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_mosaic_restrictions')
		self.assertEqual(0, cursor.fetchone()[0])
		sync_state = database.get_sync_state()
		self.assertEqual('unhealthy', sync_state['status'])
		self.assertIsNone(sync_state['last_synced_height'])
		self.assertIsNone(sync_state['last_synced_block_hash'])
		self.assertEqual(1, sync_state['dirty_state_from_height'])

		# Act: restart with the real writer and the same node state.
		restart_puller = create_symbol_puller(self.config_ini, 'testnet', connector=connector)
		with restart_puller.symbol_db:
			asyncio.run(restart_puller.sync_block_headers())

		# Assert:
		sync_state = database.get_sync_state()
		self.assertEqual(1, sync_state['last_synced_height'])
		self.assertEqual(create_block_hash(1), bytes(sync_state['last_synced_block_hash']))
		self.assertIsNone(sync_state['dirty_state_from_height'])
		cursor.execute('SELECT COUNT(*) FROM symbol_mosaic_restrictions')
		self.assertEqual(1, cursor.fetchone()[0])

	def _create_checkpoint_commit_failure_scenario(self):
		first_batch_end = BLOCK_PAGE_FETCH_CONCURRENCY * MAX_PAGE_SIZE
		second_batch_end = first_batch_end * 2
		chain_height = second_batch_end + 1
		transaction_heights = (1, first_batch_end + 1, chain_height)
		pages = create_multi_batch_block_pages(chain_height)
		for height in transaction_heights:
			offset = (height - 1) // MAX_PAGE_SIZE * MAX_PAGE_SIZE
			pages[offset][height - offset - 1]['meta']['transactionsCount'] = 1
			pages[offset][height - offset - 1]['meta']['totalTransactionsCount'] = 1
		transaction_pages = {
			transaction_path(1, first_batch_end): create_transaction_page([
				create_node_transaction(1, transaction_hash='1' * 64, transaction_id='transaction-1')]),
			transaction_path(first_batch_end + 1, second_batch_end): create_transaction_page([
				create_node_transaction(first_batch_end + 1, transaction_hash='2' * 64, transaction_id='transaction-2')]),
			transaction_path(chain_height, chain_height): create_transaction_page([
				create_node_transaction(chain_height, transaction_hash='3' * 64, transaction_id='transaction-3')])
		}
		statement_pages = {
			statement_path(1, first_batch_end): {'data': [create_amount_statement_item(1, 10)]},
			statement_path(first_batch_end + 1, second_batch_end): {
				'data': [create_amount_statement_item(first_batch_end + 1, 20)]
			},
			statement_path(chain_height, chain_height): {'data': [create_amount_statement_item(chain_height, 30)]}
		}
		return {
			'first_batch_end': first_batch_end,
			'second_batch_end': second_batch_end,
			'chain_height': chain_height,
			'pages': pages,
			'transaction_pages': transaction_pages,
			'statement_pages': statement_pages,
			'batch_multisig_paths': [
				f'account/{self._beneficiary_address_text()}/multisig',
				f'account/{Address(bytes.fromhex(RECIPIENT_ADDRESS))}/multisig'
			]
		}

	@staticmethod
	def _create_checkpoint_commit_failure_connector(scenario):
		return FakeConnector(
			scenario['chain_height'],
			scenario['pages'],
			finalized_height=scenario['chain_height'],
			transactions_by_path=scenario['transaction_pages'],
			statement_pages=scenario['statement_pages'],
			mosaics_by_id={NATIVE_MOSAIC_ID: create_mosaic_item(NATIVE_MOSAIC_ID)})

	def _assert_empty_checkpoint_tables(self, state):
		for table_name in CHECKPOINT_COMMIT_EMPTY_TABLES:
			self.assertEqual([], state[table_name], table_name)

	def _assert_failed_checkpoint_state(self, scenario, failing_database):
		database = self.puller.symbol_db
		first_batch_end = scenario['first_batch_end']
		chain_height = scenario['chain_height']
		failed_state = self._fetch_complete_batch_state()
		self._assert_empty_checkpoint_tables(failed_state)
		self.assertEqual(2, failing_database.checkpoint_count)
		self.assertEqual({
			'status': 'unhealthy',
			'chain_height': chain_height,
			'finalized_height': first_batch_end,
			'finalized_hash': create_block_hash(first_batch_end),
			'finalized_epoch': None,
			'finalized_point': None,
			'last_synced_height': first_batch_end,
			'last_synced_block_hash': create_block_hash(first_batch_end),
			'dirty_state_from_height': first_batch_end + 1
		}, normalize_sync_state(database.get_sync_state()))

	def _assert_failed_checkpoint_rows(self, scenario):
		database = self.puller.symbol_db
		first_batch_end = scenario['first_batch_end']
		second_batch_end = scenario['second_batch_end']
		self.assertEqual(list(range(1, second_batch_end + 1)), self._fetch_block_heights(database))
		cursor = database.connection.cursor()
		cursor.execute('SELECT height, hash FROM symbol_blocks WHERE height <= %s ORDER BY height', (first_batch_end,))
		first_checkpointed_blocks = [(height, bytes(block_hash)) for height, block_hash in cursor.fetchall()]
		cursor.execute('SELECT height, encode(hash, \'hex\') FROM symbol_transactions ORDER BY height')
		self.assertEqual([(1, '1' * 64), (first_batch_end + 1, '2' * 64)], cursor.fetchall())
		cursor.execute('SELECT height, amount FROM symbol_receipts ORDER BY height')
		self.assertEqual([(1, 10), (first_batch_end + 1, 20)], cursor.fetchall())
		self._assert_checkpoint_account_rows(cursor, first_batch_end, second_batch_end, second_batch_end)
		self._assert_checkpoint_transaction_mosaic_rows(cursor, [
			(1, bytes.fromhex('1' * 64), NATIVE_MOSAIC_ID, 1_000, 'transfer', 0),
			(first_batch_end + 1, bytes.fromhex('2' * 64), NATIVE_MOSAIC_ID, (first_batch_end + 1) * 1_000, 'transfer', 0)
		])
		_assert_checkpoint_transaction_address_rows(self, cursor, (
			(1, '1' * 64),
			(first_batch_end + 1, '2' * 64)))
		return first_checkpointed_blocks

	def _assert_checkpoint_failure_events(self, scenario, logger):
		first_batch_end = scenario['first_batch_end']
		chain_height = scenario['chain_height']
		failed_batch_events = [event for event in logger.events if event['event'] == 'symbol_sync_batch_failed']
		self.assertEqual(1, len(failed_batch_events))
		self.assertEqual('checkpoint_commit', failed_batch_events[0]['failed_phase'])
		completed_batch_events = [event for event in logger.events if event['event'] == 'symbol_sync_batch_completed']
		self.assertEqual(1, len(completed_batch_events))
		self.assertEqual(first_batch_end, completed_batch_events[0]['end_height'])
		self.assertEqual(1, len(logger.completed_sync_states))
		self.assertEqual({
			'status': 'healthy',
			'chain_height': chain_height,
			'finalized_height': first_batch_end,
			'finalized_hash': create_block_hash(first_batch_end),
			'finalized_epoch': None,
			'finalized_point': None,
			'last_synced_height': first_batch_end,
			'last_synced_block_hash': create_block_hash(first_batch_end),
			'dirty_state_from_height': None
		}, logger.completed_sync_states[0])
		self.assertEqual(1, len(logger.completed_state_snapshots))
		first_checkpoint_state = logger.completed_state_snapshots[0]
		self.assertEqual(first_batch_end, max(row[0]['height'] for row in first_checkpoint_state['symbol_blocks']))
		failed_sync_events = [event for event in logger.events if event['event'] == 'symbol_sync_failed']
		self.assertEqual(1, len(failed_sync_events))
		self.assertEqual(first_batch_end, failed_sync_events[0]['last_completed_height'])
		self.assertEqual([], [event for event in logger.events if event['event'] == 'symbol_sync_completed'])
		return first_checkpoint_state

	def _assert_checkpoint_failure_requests(self, scenario, connector):
		first_batch_end = scenario['first_batch_end']
		second_batch_end = scenario['second_batch_end']
		self.assertEqual([
			f'blocks?pageSize=100&offset={offset}&orderBy=height'
			for offset in range(0, second_batch_end, MAX_PAGE_SIZE)
		], [path for path in connector.paths if path.startswith('blocks?pageSize=100&offset=')])
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks/')])
		self.assertEqual([
			transaction_path(1, first_batch_end), transaction_path(first_batch_end + 1, second_batch_end)
		], [path for path in connector.paths if path.startswith('transactions/confirmed?')])
		self.assertEqual([
			statement_path(1, first_batch_end), statement_path(first_batch_end + 1, second_batch_end)
		], [path for path in connector.paths if path.startswith('statements/transaction?')])
		self.assertEqual(1, connector.paths.count('chain/info'))
		self.assertEqual(1, connector.paths.count('network/properties'))
		self.assertEqual(1, connector.paths.count(f'mosaics/{NATIVE_MOSAIC_ID}'))
		self.assertEqual(2, connector.paths.count('accounts'))
		self.assertEqual(
			scenario['batch_multisig_paths'] + scenario['batch_multisig_paths'],
			[path for path in connector.paths if path.endswith('/multisig')])

	def _assert_restarted_checkpoint_state(self, scenario, first_checkpoint_state, first_checkpointed_blocks):
		database = self.puller.symbol_db
		first_batch_end = scenario['first_batch_end']
		chain_height = scenario['chain_height']
		final_state = self._fetch_complete_batch_state()
		for table_name in CHECKPOINT_COMMIT_EMPTY_TABLES:
			if 'symbol_mosaics' != table_name:
				self.assertEqual([], final_state[table_name], table_name)
		cursor = database.connection.cursor()
		cursor.execute('SELECT mosaic_id, updated_at_height FROM symbol_mosaics')
		self.assertEqual([(NATIVE_MOSAIC_ID, first_batch_end)], cursor.fetchall())
		for table_name in CHECKPOINT_COMMIT_STABLE_TABLES:
			self.assertTrue(all(row in final_state[table_name] for row in first_checkpoint_state[table_name]), table_name)
		self.assertEqual({
			'status': 'healthy',
			'chain_height': chain_height,
			'finalized_height': chain_height,
			'finalized_hash': create_block_hash(chain_height),
			'finalized_epoch': 4,
			'finalized_point': 5,
			'last_synced_height': chain_height,
			'last_synced_block_hash': create_block_hash(chain_height),
			'dirty_state_from_height': None
		}, normalize_sync_state(database.get_sync_state()))
		self.assertEqual(list(range(1, chain_height + 1)), self._fetch_block_heights(database))
		cursor = database.connection.cursor()
		cursor.execute('SELECT height, hash FROM symbol_blocks WHERE height <= %s ORDER BY height', (first_batch_end,))
		self.assertEqual(first_checkpointed_blocks, [(height, bytes(block_hash)) for height, block_hash in cursor.fetchall()])
		return cursor

	def _assert_checkpoint_account_rows(self, cursor, first_seen_height, last_seen_height, mosaic_height):
		expected_addresses = sorted([bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS)])
		cursor.execute('SELECT address, first_seen_height, last_seen_height FROM symbol_accounts ORDER BY address')
		expected_account_rows = [
			(address, first_seen_height, last_seen_height) for address in expected_addresses
		]
		actual_account_rows = [(bytes(address), first_seen, last_seen) for address, first_seen, last_seen in cursor.fetchall()]
		self.assertEqual(expected_account_rows, actual_account_rows)
		cursor.execute(
			'SELECT address, mosaic_id, amount, updated_at_height '
			'FROM symbol_account_mosaics ORDER BY address, mosaic_id')
		expected_mosaic_rows = [
			(address, NATIVE_MOSAIC_ID, 20_000 * 10 ** 6, mosaic_height) for address in expected_addresses
		]
		actual_mosaic_rows = [
			(bytes(address), mosaic_id, amount, updated_height)
			for address, mosaic_id, amount, updated_height in cursor.fetchall()]
		self.assertEqual(expected_mosaic_rows, actual_mosaic_rows)

	def _assert_checkpoint_transaction_mosaic_rows(self, cursor, expected_rows):
		cursor.execute(
			'SELECT t.height, t.hash, tm.mosaic_id, tm.amount, tm.role, tm.position '
			'FROM symbol_transactions AS t '
			'JOIN symbol_transaction_mosaics AS tm ON tm.transaction_id = t.id '
			'ORDER BY t.height')
		self.assertEqual(expected_rows, [
			(height, bytes(transaction_hash), mosaic_id, amount, role, position)
			for height, transaction_hash, mosaic_id, amount, role, position in cursor.fetchall()])

	# pylint: disable=too-many-arguments,too-many-positional-arguments,too-many-locals
	def _assert_adaptive_saved_content(
		self,
		database,
		through_height,
		expected_receipt_heights,
		account_last_seen_height,
		account_mosaic_height,
		expected_payloads,
		block_reward_through_height=None,
		account_first_seen_height=3
	):
		# Act:
		cursor = database.connection.cursor()
		cursor.execute(
			'SELECT height, COALESCE(hash, aggregate_hash), embedded_index '
			'FROM symbol_transactions '
			'ORDER BY height, COALESCE(hash, aggregate_hash), embedded_index NULLS FIRST')
		actual_identities = [
			(height, bytes(transaction_hash), embedded_index)
			for height, transaction_hash, embedded_index in cursor.fetchall()]

		# Assert:
		self.assertEqual(list(range(1, through_height + 1)), self._fetch_block_heights(database))
		self.assertEqual([
			(height, count)
			for height, count in ((1, 0), (2, 2), (3, 3), (4, 1), (5, 4), (6, 0), (7, 2))
			if height <= through_height
		], _fetch_transaction_counts(database))
		expected_identities = sorted(
			_expected_adaptive_transaction_identities(through_height),
			key=lambda identity: (identity[0], identity[1], -1 if identity[2] is None else identity[2]))
		self.assertEqual(expected_identities, actual_identities)

		expected_address_rows = sorted([
			(
				height,
				transaction_hash,
				embedded_index,
				address,
				role
			)
			for height, transaction_hash, embedded_index in expected_identities
			for address, role in (
				((bytes.fromhex(SIGNER_ADDRESS), 'signer'),)
				if (2, bytes.fromhex('A' * 64), None) == (height, transaction_hash, embedded_index)
				else ((bytes.fromhex(SIGNER_ADDRESS), 'signer'), (bytes.fromhex(RECIPIENT_ADDRESS), 'recipient')))
		],
			key=lambda row: (
				row[0], row[1], -1 if row[2] is None else row[2], row[3], row[4]))
		cursor.execute(
			'SELECT t.height, COALESCE(t.hash, t.aggregate_hash), t.embedded_index, ta.address, ta.role '
			'FROM symbol_transactions AS t '
			'JOIN symbol_transaction_addresses AS ta ON ta.transaction_id = t.id '
			'ORDER BY t.height, COALESCE(t.hash, t.aggregate_hash), t.embedded_index NULLS FIRST, ta.address, ta.role')
		self.assertEqual(expected_address_rows, [
			(height, bytes(transaction_hash), embedded_index, bytes(address), role)
			for height, transaction_hash, embedded_index, address, role in cursor.fetchall()])

		expected_mosaic_rows = [
			(height, transaction_hash, embedded_index, NATIVE_MOSAIC_ID, height * 1_000, 'transfer', 0)
			for height, transaction_hash, embedded_index in expected_identities
			if (2, bytes.fromhex('A' * 64), None) != (height, transaction_hash, embedded_index)]
		cursor.execute(
			'SELECT t.height, COALESCE(t.hash, t.aggregate_hash), t.embedded_index, '
			'tm.mosaic_id, tm.amount, tm.role, tm.position '
			'FROM symbol_transactions AS t '
			'JOIN symbol_transaction_mosaics AS tm ON tm.transaction_id = t.id '
			'ORDER BY t.height, COALESCE(t.hash, t.aggregate_hash), t.embedded_index NULLS FIRST')
		self.assertEqual(expected_mosaic_rows, [
			(height, bytes(transaction_hash), embedded_index, mosaic_id, amount, role, position)
			for height, transaction_hash, embedded_index, mosaic_id, amount, role, position in cursor.fetchall()])

		expected_receipts = [
			(
				height,
				'inflation',
				'inflation',
				amount,
				{
					'version': 1,
					'type': ReceiptType.INFLATION.value,
					'mosaicId': NATIVE_MOSAIC_ID,
					'amount': str(amount)
				}
			)
			for height, amount in expected_receipt_heights
		]
		cursor.execute(
			'SELECT height, receipt_type, receipt_group, amount, raw_payload '
			'FROM symbol_receipts ORDER BY height, id')
		self.assertEqual(expected_receipts, cursor.fetchall())
		cursor.execute(
			'SELECT height, block_reward FROM symbol_blocks WHERE block_reward IS NOT NULL ORDER BY height')
		if block_reward_through_height is None:
			block_reward_through_height = through_height
		expected_block_rewards = [
			(height, dict(expected_receipt_heights).get(height, 0))
			for height in range(1, block_reward_through_height + 1)]
		self.assertEqual(expected_block_rewards, cursor.fetchall())

		self._assert_checkpoint_account_rows(
			cursor, account_first_seen_height, account_last_seen_height, account_mosaic_height)

		expected_bodies = {
			'aggregate': {
				'version': 1,
				'network': 152,
				'signature': '1' * 128,
				'recipientAddress': RECIPIENT_ADDRESS,
				'mosaics': [{'id': NATIVE_MOSAIC_ID, 'amount': '2000'}],
				'transactionsHash': '9' * 64,
				'cosignatures': []
			},
			'embedded': {
				'version': 1,
				'network': 152,
				'recipientAddress': RECIPIENT_ADDRESS,
				'mosaics': [{'id': NATIVE_MOSAIC_ID, 'amount': '2000'}]
			},
			'transfer': {
				'version': 1,
				'network': 152,
				'signature': '1' * 128,
				'recipientAddress': RECIPIENT_ADDRESS,
				'mosaics': [{'id': NATIVE_MOSAIC_ID, 'amount': '4000'}]
			}
		}
		expected_row_selectors = (
			('aggregate', 'hash = %s', (bytes.fromhex('A' * 64),)),
			('embedded', 'aggregate_hash = %s AND embedded_index = 0', (bytes.fromhex('A' * 64),)),
			('transfer', 'hash = %s', (bytes.fromhex(f'{4:060X}0000'),))
		)
		for name, selector, parameters in expected_row_selectors:
			if 'transfer' == name and through_height < 4:
				continue

			cursor.execute(f'SELECT body, raw_payload FROM symbol_transactions WHERE {selector}', parameters)
			self.assertEqual(1, cursor.rowcount)
			self.assertEqual((expected_bodies[name], expected_payloads[name]), cursor.fetchone())

	def _assert_adaptive_checkpoint_snapshot_is_preserved(self, checkpoint_snapshot, persisted_snapshot):
		# Assert:
		for table_name in CHECKPOINT_COMMIT_STABLE_TABLES:
			self.assertTrue(
				all(row in persisted_snapshot[table_name] for row in checkpoint_snapshot[table_name]),
				table_name)

	def _assert_restarted_checkpoint_rows(self, scenario, cursor):
		first_batch_end = scenario['first_batch_end']
		chain_height = scenario['chain_height']
		cursor.execute('SELECT height, encode(hash, \'hex\') FROM symbol_transactions ORDER BY height')
		self.assertEqual([
			(1, '1' * 64),
			(first_batch_end + 1, '2' * 64),
			(chain_height, '3' * 64)
		], cursor.fetchall())
		cursor.execute('SELECT height, amount FROM symbol_receipts ORDER BY height')
		self.assertEqual([(1, 10), (first_batch_end + 1, 20), (chain_height, 30)], cursor.fetchall())
		# Dirty-range repair preserves first_seen_height from the first committed checkpoint.
		self._assert_checkpoint_account_rows(cursor, first_batch_end, chain_height, chain_height)
		self._assert_checkpoint_transaction_mosaic_rows(cursor, [
			(1, bytes.fromhex('1' * 64), NATIVE_MOSAIC_ID, 1_000, 'transfer', 0),
			(first_batch_end + 1, bytes.fromhex('2' * 64), NATIVE_MOSAIC_ID, (first_batch_end + 1) * 1_000, 'transfer', 0),
			(chain_height, bytes.fromhex('3' * 64), NATIVE_MOSAIC_ID, chain_height * 1_000, 'transfer', 0)
		])
		_assert_checkpoint_transaction_address_rows(self, cursor, (
			(1, '1' * 64),
			(first_batch_end + 1, '2' * 64),
			(chain_height, '3' * 64)))

	def _assert_checkpoint_restart_requests(self, scenario, connector):
		first_batch_end = scenario['first_batch_end']
		second_batch_end = scenario['second_batch_end']
		chain_height = scenario['chain_height']
		self.assertEqual([
			f'blocks?pageSize=100&offset={offset}&orderBy=height'
			for offset in range(first_batch_end, chain_height, MAX_PAGE_SIZE)
		], [path for path in connector.paths if path.startswith('blocks?pageSize=100&offset=')])
		self.assertEqual(
			[f'blocks/{height}' for height in range(first_batch_end, second_batch_end + 1)] + [f'blocks/{chain_height}'],
			[path for path in connector.paths if path.startswith('blocks/')])
		self.assertEqual([
			transaction_path(first_batch_end + 1, second_batch_end),
			transaction_path(chain_height, chain_height)
		], [path for path in connector.paths if path.startswith('transactions/confirmed?')])
		self.assertEqual([
			statement_path(first_batch_end + 1, second_batch_end),
			statement_path(chain_height, chain_height)
		], [path for path in connector.paths if path.startswith('statements/transaction?')])
		self.assertEqual(1, connector.paths.count('chain/info'))
		self.assertEqual(1, connector.paths.count('network/properties'))
		self.assertEqual(1, connector.paths.count(f'mosaics/{NATIVE_MOSAIC_ID}'))
		self.assertEqual(3, connector.paths.count('accounts'))
		self.assertEqual(
			scenario['batch_multisig_paths'] * 3,
			[path for path in connector.paths if path.endswith('/multisig')])

	def test_sync_block_headers_keeps_checkpoint_and_marker_when_checkpoint_commit_fails(self):
		# Arrange:
		scenario = self._create_checkpoint_commit_failure_scenario()
		connector = self._create_checkpoint_commit_failure_connector(scenario)

		database = self.puller.symbol_db
		failing_database = FailingSecondCheckpointCommitDatabase(database)
		logger = DatabaseObservingPerformanceLogger(database, self._fetch_complete_batch_state)
		self.puller._performance_logger = logger  # pylint: disable=protected-access

		# Act: fail the second checkpoint commit after the first one commits.
		with _replace_symbol_database(self.puller, failing_database):
			with self.assertRaisesRegex(RuntimeError, 'second checkpoint commit failed'):
				with _failing_checkpoint_connection(database):
					self._sync_with_connector(connector)

		# Assert: the first checkpoint and all failure observability remain durable.
		self._assert_failed_checkpoint_state(scenario, failing_database)
		first_checkpointed_blocks = self._assert_failed_checkpoint_rows(scenario)
		first_checkpoint_state = self._assert_checkpoint_failure_events(scenario, logger)
		self._assert_checkpoint_failure_requests(scenario, connector)

		# Act: repair the dirty range and resume with a new Puller.
		restart_connector = self._create_checkpoint_commit_failure_connector(scenario)
		restart_puller = create_symbol_puller(self.config_ini, 'testnet', connector=restart_connector)
		with restart_puller.symbol_db:
			asyncio.run(restart_puller.sync_block_headers())

		# Assert: restart converges without changing the first checkpointed range.
		cursor = self._assert_restarted_checkpoint_state(
			scenario, first_checkpoint_state, first_checkpointed_blocks)
		self._assert_restarted_checkpoint_rows(scenario, cursor)
		self._assert_checkpoint_restart_requests(scenario, restart_connector)

	def test_sync_block_headers_logs_existing_checkpoint_when_first_new_batch_fetch_fails(self):
		# Arrange:
		checkpoint_height = 1000
		self._seed_blocks(self.puller.symbol_db, range(1, checkpoint_height + 1))
		self.puller.symbol_db.upsert_sync_state(create_checkpoint_sync_state(
			checkpoint_height, checkpoint_height,
			chain_height=checkpoint_height))
		connector = FailingNextBatchFetchConnector(
			checkpoint_height + 1,
			{},
			block_by_height={checkpoint_height: create_node_block(checkpoint_height)},
			finalized_height=checkpoint_height)
		logger = DatabaseObservingPerformanceLogger(self.puller.symbol_db)
		self.puller._performance_logger = logger  # pylint: disable=protected-access

		# Act + Assert:
		with self.assertRaisesRegex(RuntimeError, 'terminal block fetch failed'):
			self._sync_with_connector(connector)

		# Assert:
		sync_state = self.puller.symbol_db.get_sync_state()
		self.assertEqual(checkpoint_height, sync_state['last_synced_height'])
		self.assertIsNone(sync_state['dirty_state_from_height'])
		failed_sync_events = [event for event in logger.events if event['event'] == 'symbol_sync_failed']
		self.assertEqual(1, len(failed_sync_events))
		self.assertEqual(checkpoint_height, failed_sync_events[0]['last_completed_height'])

	def test_sync_block_headers_publishes_each_multi_batch_checkpoint_before_completion_logging(self):
		# Arrange:
		chain_height = BLOCK_PAGE_FETCH_CONCURRENCY * MAX_PAGE_SIZE + 1
		connector = FakeConnector(
			chain_height,
			create_multi_batch_block_pages(chain_height),
			finalized_height=chain_height - 1)
		database = self.puller.symbol_db
		recording_database = RecordingCheckpointDatabase(database)
		logger = DatabaseObservingPerformanceLogger(database)
		self.puller._performance_logger = logger  # pylint: disable=protected-access

		# Act:
		with _replace_symbol_database(self.puller, recording_database):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([chain_height - 1, chain_height], [
			state['last_synced_height'] for state in recording_database.published_states])
		self.assertEqual([
			create_block_hash(chain_height - 1),
			create_block_hash(chain_height)
		], [bytes(state['last_synced_block_hash']) for state in recording_database.published_states])
		self.assertEqual([None, None], [
			state['dirty_state_from_height'] for state in recording_database.published_states])
		self.assertEqual([chain_height - 1, chain_height], [
			state['last_synced_height'] for state in logger.completed_sync_states])

	def test_sync_block_headers_splits_one_fetch_window_into_contiguous_transaction_ranges(self):
		# Arrange:
		self.puller._max_transactions_per_batch = 5  # pylint: disable=protected-access
		blocks, transaction_pages, statement_pages = _create_adaptive_sync_fixture()
		connector = FakeConnector(
			7,
			{0: blocks},
			finalized_height=7,
			transactions_by_path=transaction_pages,
			statement_pages=statement_pages)
		database = self.puller.symbol_db
		recording_database = RecordingCheckpointDatabase(database)

		# Act:
		with _replace_symbol_database(self.puller, recording_database):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1, 2, 3, 4, 5, 6, 7], self._fetch_block_heights(database))
		self.assertEqual([
			(1, 0), (2, 2), (3, 3), (4, 1), (5, 4), (6, 0), (7, 2)
		], _fetch_transaction_counts(database))
		self.assertEqual([
			(3, create_block_hash(3), None, 3, create_block_hash(3), None, None),
			(6, create_block_hash(6), None, 6, create_block_hash(6), None, None),
			(7, create_block_hash(7), None, 7, create_block_hash(7), 4, 5)
		], [
			(
				state['last_synced_height'],
				bytes(state['last_synced_block_hash']),
				state['dirty_state_from_height'],
				state['finalized_height'],
				bytes(state['finalized_hash']),
				state['finalized_epoch'],
				state['finalized_point'])
			for state in recording_database.published_states
		])
		self.assertEqual([
			transaction_path(1, 3), transaction_path(4, 6), transaction_path(7, 7)
		], [path for path in connector.paths if path.startswith('transactions/confirmed?')])
		self.assertEqual([
			statement_path(1, 3), statement_path(4, 6), statement_path(7, 7)
		], [path for path in connector.paths if path.startswith('statements/transaction?')])
		self.assertEqual(1, len([path for path in connector.paths if path.startswith('blocks?pageSize=100&offset=')]))
		self.assertEqual(7, database.get_sync_state()['last_synced_height'])

	def test_sync_block_headers_uses_each_adaptive_range_count_for_transaction_pages(self):
		# Arrange:
		self.puller._max_transactions_per_batch = 150  # pylint: disable=protected-access
		total_transaction_counts = (90, 60, 80)
		blocks = [
			create_node_block(
				height,
				transactions_count=transaction_count,
				total_transactions_count=transaction_count)
			for height, transaction_count in enumerate(total_transaction_counts, 1)
		]
		transactions_by_height = {}
		transaction_index = 0
		for height, transaction_count in enumerate(total_transaction_counts, 1):
			transactions_by_height[height] = []
			for block_index in range(transaction_count):
				transaction_index += 1
				transactions_by_height[height].append(create_node_transaction(
					height,
					transaction_hash=f'{transaction_index:064X}',
					transaction_id=f'transaction-{transaction_index}',
					block_index=block_index))
		first_range_transactions = transactions_by_height[1] + transactions_by_height[2]
		transaction_pages = {
			transaction_path(1, 2, 1): create_transaction_page(first_range_transactions[:MAX_PAGE_SIZE], page_number=1),
			transaction_path(1, 2, 2): create_transaction_page(first_range_transactions[MAX_PAGE_SIZE:], page_number=2),
			transaction_path(3, 3, 1): create_transaction_page(transactions_by_height[3], page_number=1)
		}
		statement_pages = {
			statement_path(1, 2): {'data': []},
			statement_path(3, 3): {'data': []}
		}
		connector = FakeConnector(
			3,
			{0: blocks},
			finalized_height=3,
			transactions_by_path=transaction_pages,
			statement_pages=statement_pages)

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([
			transaction_path(1, 2, 1), transaction_path(1, 2, 2), transaction_path(3, 3, 1)
		], [path for path in connector.paths if path.startswith('transactions/confirmed?')])
		self.assertEqual([(1, 90), (2, 60), (3, 80)], _fetch_transaction_counts(self.puller.symbol_db))

	def test_sync_block_headers_splits_finalized_and_capped_unfinalized_ranges(self):
		# Arrange:
		self.puller._max_transactions_per_batch = 150  # pylint: disable=protected-access

		def make_transfers(height, count, first_hash, start_index=0):
			return [
				create_node_transaction(
					height,
					transaction_hash=f'{first_hash + index:064X}',
					transaction_id=f'transaction-{height}-{index}',
					block_index=start_index + index)
				for index in range(count)
			]

		height_one_transactions = make_transfers(1, 49, 1)
		height_two_aggregate = create_complete_aggregate_pair(2, 'B' * 64, 0)
		height_two_transactions = height_two_aggregate + make_transfers(2, 50, 1000, start_index=1)
		height_three_transactions = make_transfers(3, 100, 2000)
		height_four_transactions = make_transfers(4, 80, 3000)
		blocks = [
			create_node_block(1, transactions_count=49, total_transactions_count=49),
			create_node_block(2, transactions_count=51, total_transactions_count=52),
			create_node_block(3, transactions_count=100, total_transactions_count=100),
			create_node_block(4, transactions_count=80, total_transactions_count=80),
			create_node_block(5, transactions_count=20, total_transactions_count=20)
		]
		finalized_range_items = height_one_transactions + height_two_transactions
		transaction_pages = {
			transaction_path(1, 2, 1): create_transaction_page(finalized_range_items[:MAX_PAGE_SIZE], page_number=1),
			transaction_path(1, 2, 2): create_transaction_page(finalized_range_items[MAX_PAGE_SIZE:], page_number=2),
			transaction_path(3, 3, 1): create_transaction_page(height_three_transactions, page_number=1),
			transaction_path(3, 3, 2): create_transaction_page([], page_number=2),
			transaction_path(4, 4, 1): create_transaction_page(height_four_transactions, page_number=1)
		}
		statement_pages = {
			statement_path(1, 2): {'data': [create_amount_statement_item(2, 12, item_id='finalized-receipt')]},
			statement_path(3, 3): {'data': [create_amount_statement_item(3, 33, item_id='unfinalized-receipt')]},
			statement_path(4, 4): {'data': [create_amount_statement_item(4, 44, item_id='capped-receipt')]}
		}
		connector = FakeConnector(
			5,
			{0: blocks},
			finalized_height=2,
			transactions_by_path=transaction_pages,
			statement_pages=statement_pages)

		# Act:
		self._sync_with_connector(connector, max_height=4)

		# Assert:
		database = self.puller.symbol_db
		self.assertEqual([1, 2, 3, 4], self._fetch_block_heights(database))
		self.assertEqual([(1, 49), (2, 52), (3, 100), (4, 80)], _fetch_transaction_counts(database))
		cursor = database.connection.cursor()
		cursor.execute(
			'SELECT height, COUNT(*), COUNT(*) FILTER (WHERE NOT is_embedded) '
			'FROM symbol_transactions GROUP BY height ORDER BY height')
		self.assertEqual([(1, 49, 49), (2, 52, 51), (3, 100, 100), (4, 80, 80)], cursor.fetchall())
		self.assertEqual([
			transaction_path(1, 2, 1), transaction_path(1, 2, 2),
			transaction_path(3, 3, 1), transaction_path(3, 3, 2), transaction_path(4, 4, 1)
		], [path for path in connector.paths if path.startswith('transactions/confirmed?')])
		self.assertEqual([
			statement_path(1, 2), statement_path(3, 3), statement_path(4, 4)
		], [path for path in connector.paths if path.startswith('statements/transaction?')])
		cursor.execute('SELECT height, amount FROM symbol_receipts ORDER BY height')
		self.assertEqual([(2, 12), (3, 33), (4, 44)], cursor.fetchall())
		self.assertEqual({
			'status': 'healthy',
			'chain_height': 4,
			'finalized_height': 2,
			'finalized_hash': create_block_hash(2),
			'finalized_epoch': 4,
			'finalized_point': 5,
			'last_synced_height': 4,
			'last_synced_block_hash': create_block_hash(4),
			'dirty_state_from_height': None
		}, normalize_sync_state(database.get_sync_state()))

	def test_sync_block_headers_keeps_adaptive_checkpoint_and_repairs_after_checkpoint_commit_failure(self):
		# Arrange:
		self.puller._max_transactions_per_batch = 5  # pylint: disable=protected-access
		blocks, transaction_pages, statement_pages = _create_adaptive_sync_fixture()
		expected_payloads = _capture_adaptive_transaction_payloads(transaction_pages)
		connector = FakeConnector(
			7,
			{0: blocks},
			finalized_height=7,
			transactions_by_path=transaction_pages,
			statement_pages=statement_pages)
		database = self.puller.symbol_db
		failing_database = FailingSecondCheckpointCommitDatabase(database)
		logger = DatabaseObservingPerformanceLogger(database, self._fetch_complete_batch_state)
		self.puller._performance_logger = logger  # pylint: disable=protected-access

		# Act + Assert:
		with _replace_symbol_database(self.puller, failing_database):
			with self.assertRaisesRegex(RuntimeError, 'second checkpoint commit failed'):
				with _failing_checkpoint_connection(database):
					self._sync_with_connector(connector)

		# Assert:
		self._assert_adaptive_saved_content(
			database,
			6,
			((2, 11), (4, 44), (5, 55)),
			6,
			6,
			expected_payloads)
		failed_snapshot = self._fetch_complete_batch_state()
		self._assert_adaptive_checkpoint_snapshot_is_preserved(
			logger.completed_state_snapshots[0], failed_snapshot)
		sync_state = database.get_sync_state()
		self.assertEqual({
			'status': 'unhealthy',
			'chain_height': 7,
			'finalized_height': 3,
			'finalized_hash': create_block_hash(3),
			'finalized_epoch': None,
			'finalized_point': None,
			'last_synced_height': 3,
			'last_synced_block_hash': create_block_hash(3),
			'dirty_state_from_height': 4
		}, normalize_sync_state(sync_state))
		self.assertEqual(2, failing_database.checkpoint_count)
		self.assertEqual(1, len(logger.completed_state_snapshots))
		self.assertEqual(3, len(logger.completed_state_snapshots[0]['symbol_blocks']))
		self.assertEqual(5, len(logger.completed_state_snapshots[0]['symbol_transactions']))
		self.assertEqual([
			transaction_path(1, 3), transaction_path(4, 6)
		], [path for path in connector.paths if path.startswith('transactions/confirmed?')])
		self.assertEqual([3], [state['last_synced_height'] for state in logger.completed_sync_states])
		failed_batch_events = [event for event in logger.events if event['event'] == 'symbol_sync_batch_failed']
		self.assertEqual([(4, 6)], [
			(event['start_height'], event['end_height']) for event in failed_batch_events])
		self.assertEqual([(3, 5, 4)], [
			(event['block_count'], event['transaction_count'], event['start_height'])
			for event in failed_batch_events])

		# Act: restart with the real writer and the same adaptive cap.
		restart_connector = FakeConnector(
			7,
			{0: blocks, 3: blocks[3:]},
			finalized_height=7,
			transactions_by_path=transaction_pages,
			statement_pages=statement_pages,
			mosaics_by_id={NATIVE_MOSAIC_ID: create_mosaic_item(NATIVE_MOSAIC_ID)})
		restart_puller = create_symbol_puller(
			self.config_ini,
			'testnet',
			connector=restart_connector,
			max_transactions_per_batch=5)
		with restart_puller.symbol_db:
			asyncio.run(restart_puller.sync_block_headers())

		# Assert:
		self._assert_adaptive_saved_content(
			database,
			7,
			((2, 11), (4, 44), (5, 55), (7, 77)),
			7,
			7,
			expected_payloads,
			account_first_seen_height=3)
		self._assert_adaptive_checkpoint_snapshot_is_preserved(
			logger.completed_state_snapshots[0], self._fetch_complete_batch_state())
		sync_state = database.get_sync_state()
		self.assertEqual({
			'status': 'healthy',
			'chain_height': 7,
			'finalized_height': 7,
			'finalized_hash': create_block_hash(7),
			'finalized_epoch': 4,
			'finalized_point': 5,
			'last_synced_height': 7,
			'last_synced_block_hash': create_block_hash(7),
			'dirty_state_from_height': None
		}, normalize_sync_state(sync_state))
		self.assertEqual([
			transaction_path(4, 6), transaction_path(7, 7)
		], [path for path in restart_connector.paths if path.startswith('transactions/confirmed?')])

	def test_sync_block_headers_preserves_prior_adaptive_checkpoint_after_later_transaction_fetch_failure(self):
		# Arrange:
		self.puller._max_transactions_per_batch = 5  # pylint: disable=protected-access
		blocks, transaction_pages, statement_pages = _create_adaptive_sync_fixture((4, 6))
		_, valid_transaction_pages, _ = _create_adaptive_sync_fixture()
		expected_payloads = _capture_adaptive_transaction_payloads(valid_transaction_pages)
		connector = FakeConnector(
			7,
			{0: blocks},
			finalized_height=7,
			transactions_by_path=transaction_pages,
			statement_pages=statement_pages)
		database = self.puller.symbol_db
		logger = DatabaseObservingPerformanceLogger(database, self._fetch_complete_batch_state)
		self.puller._performance_logger = logger  # pylint: disable=protected-access

		# Act + Assert:
		with self.assertRaisesRegex(RuntimeError, 'adaptive transaction fetch failed'):
			self._sync_with_connector(connector)

		# Assert:
		self._assert_adaptive_saved_content(
			database,
			3,
			((2, 11),),
			3,
			3,
			expected_payloads)
		sync_state = database.get_sync_state()
		self.assertEqual({
			'status': 'healthy',
			'chain_height': 7,
			'finalized_height': 3,
			'finalized_hash': create_block_hash(3),
			'finalized_epoch': None,
			'finalized_point': None,
			'last_synced_height': 3,
			'last_synced_block_hash': create_block_hash(3),
			'dirty_state_from_height': None
		}, normalize_sync_state(sync_state))
		self.assertEqual(1, len(logger.completed_state_snapshots))
		self.assertEqual(logger.completed_state_snapshots[0], self._fetch_complete_batch_state())
		self.assertEqual([
			transaction_path(1, 3), transaction_path(4, 6)
		], [path for path in connector.paths if path.startswith('transactions/confirmed?')])
		failed_batch_events = [event for event in logger.events if event['event'] == 'symbol_sync_batch_failed']
		self.assertEqual([(4, 6, 3, 0)], [
			(event['start_height'], event['end_height'], event['block_count'], event['transaction_count'])
			for event in failed_batch_events])

		# Act: restart with the valid node pages and the same adaptive cap.
		restart_connector = FakeConnector(
			7,
			{0: blocks, 3: blocks[3:]},
			finalized_height=7,
			transactions_by_path=_create_adaptive_sync_fixture()[1],
			statement_pages=statement_pages)
		restart_puller = create_symbol_puller(
			self.config_ini,
			'testnet',
			connector=restart_connector,
			max_transactions_per_batch=5)
		with restart_puller.symbol_db:
			asyncio.run(restart_puller.sync_block_headers())

		# Assert:
		self._assert_adaptive_saved_content(
			database,
			7,
			((2, 11), (4, 44), (5, 55), (7, 77)),
			7,
			7,
			expected_payloads)
		sync_state = database.get_sync_state()
		self.assertEqual({
			'status': 'healthy',
			'chain_height': 7,
			'finalized_height': 7,
			'finalized_hash': create_block_hash(7),
			'finalized_epoch': 4,
			'finalized_point': 5,
			'last_synced_height': 7,
			'last_synced_block_hash': create_block_hash(7),
			'dirty_state_from_height': None
		}, normalize_sync_state(sync_state))
		self.assertEqual([
			transaction_path(4, 6), transaction_path(7, 7)
		], [path for path in restart_connector.paths if path.startswith('transactions/confirmed?')])

	def test_sync_block_headers_applies_adaptive_ranges_to_max_height_partial_window(self):
		# Arrange:
		self.puller._max_transactions_per_batch = 5  # pylint: disable=protected-access
		blocks, transaction_pages, statement_pages = _create_adaptive_sync_fixture()
		connector = FakeConnector(
			7,
			{0: blocks},
			finalized_height=7,
			transactions_by_path=transaction_pages,
			statement_pages=statement_pages)

		# Act:
		self._sync_with_connector(connector, max_height=6)

		# Assert:
		self.assertEqual([1, 2, 3, 4, 5, 6], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual([
			transaction_path(1, 3), transaction_path(4, 6)
		], [path for path in connector.paths if path.startswith('transactions/confirmed?')])
		sync_state = self.puller.symbol_db.get_sync_state()
		self.assertEqual(6, sync_state['last_synced_height'])
		self.assertIsNone(sync_state['dirty_state_from_height'])

	def test_sync_block_headers_repairs_adaptive_dirty_marker_after_later_receipt_write_failure(self):
		# Arrange:
		self.puller._max_transactions_per_batch = 5  # pylint: disable=protected-access
		blocks, transaction_pages, statement_pages = _create_adaptive_sync_fixture()
		expected_payloads = _capture_adaptive_transaction_payloads(transaction_pages)
		connector = FakeConnector(
			7,
			{0: blocks},
			finalized_height=7,
			transactions_by_path=transaction_pages,
			statement_pages=statement_pages)
		database = self.puller.symbol_db
		failing_database = FailingAdaptiveSecondRangeReceiptDatabase(database)
		logger = DatabaseObservingPerformanceLogger(database, self._fetch_complete_batch_state)
		self.puller._performance_logger = logger  # pylint: disable=protected-access

		# Act + Assert:
		with _replace_symbol_database(self.puller, failing_database):
			with self.assertRaisesRegex(RuntimeError, 'adaptive second-range receipt write failed'):
				self._sync_with_connector(connector)

		# Assert:
		self._assert_adaptive_saved_content(
			database,
			6,
			((2, 11), (4, 44)),
			3,
			3,
			expected_payloads,
			block_reward_through_height=4)
		sync_state = database.get_sync_state()
		self.assertEqual({
			'status': 'unhealthy',
			'chain_height': 7,
			'finalized_height': 3,
			'finalized_hash': create_block_hash(3),
			'finalized_epoch': None,
			'finalized_point': None,
			'last_synced_height': 3,
			'last_synced_block_hash': create_block_hash(3),
			'dirty_state_from_height': 4
		}, normalize_sync_state(sync_state))
		self.assertEqual(1, len(logger.completed_state_snapshots))
		failed_snapshot = self._fetch_complete_batch_state()
		self._assert_adaptive_checkpoint_snapshot_is_preserved(
			logger.completed_state_snapshots[0], failed_snapshot)
		self.assertEqual(logger.completed_state_snapshots[0]['symbol_accounts'], failed_snapshot['symbol_accounts'])
		self.assertEqual(
			logger.completed_state_snapshots[0]['symbol_account_mosaics'],
			failed_snapshot['symbol_account_mosaics'])
		self.assertEqual([
			transaction_path(1, 3), transaction_path(4, 6)
		], [path for path in connector.paths if path.startswith('transactions/confirmed?')])
		self.assertEqual([
			statement_path(1, 3), statement_path(4, 6)
		], [path for path in connector.paths if path.startswith('statements/transaction?')])

		# Act: restart with the real writer and the same adaptive cap.
		restart_connector = FakeConnector(
			7,
			{0: blocks, 3: blocks[3:]},
			finalized_height=7,
			transactions_by_path=transaction_pages,
			statement_pages=statement_pages,
			mosaics_by_id={NATIVE_MOSAIC_ID: create_mosaic_item(NATIVE_MOSAIC_ID)})
		restart_puller = create_symbol_puller(
			self.config_ini,
			'testnet',
			connector=restart_connector,
			max_transactions_per_batch=5)
		with restart_puller.symbol_db:
			asyncio.run(restart_puller.sync_block_headers())

		# Assert:
		self._assert_adaptive_saved_content(
			database,
			7,
			((2, 11), (4, 44), (5, 55), (7, 77)),
			7,
			7,
			expected_payloads)
		self._assert_adaptive_checkpoint_snapshot_is_preserved(
			logger.completed_state_snapshots[0], self._fetch_complete_batch_state())
		sync_state = database.get_sync_state()
		self.assertEqual({
			'status': 'healthy',
			'chain_height': 7,
			'finalized_height': 7,
			'finalized_hash': create_block_hash(7),
			'finalized_epoch': 4,
			'finalized_point': 5,
			'last_synced_height': 7,
			'last_synced_block_hash': create_block_hash(7),
			'dirty_state_from_height': None
		}, normalize_sync_state(sync_state))
		self.assertEqual([
			transaction_path(4, 6), transaction_path(7, 7)
		], [path for path in restart_connector.paths if path.startswith('transactions/confirmed?')])

	def test_sync_block_headers_keeps_prior_checkpoint_after_terminal_next_batch_fetch_failure(self):
		# Arrange:
		chain_height = BLOCK_PAGE_FETCH_CONCURRENCY * MAX_PAGE_SIZE + 1
		connector = FailingNextBatchFetchConnector(
			chain_height,
			create_multi_batch_block_pages(chain_height),
			finalized_height=chain_height)
		database = self.puller.symbol_db
		logger = DatabaseObservingPerformanceLogger(database)
		self.puller._performance_logger = logger  # pylint: disable=protected-access

		# Act + Assert:
		with self.assertRaisesRegex(RuntimeError, 'terminal block fetch failed'):
			self._sync_with_connector(connector)

		# Assert:
		sync_state = database.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(chain_height - 1, sync_state['last_synced_height'])
		self.assertEqual(create_block_hash(chain_height - 1), bytes(sync_state['last_synced_block_hash']))
		self.assertEqual(chain_height - 1, sync_state['finalized_height'])
		self.assertEqual(create_block_hash(chain_height - 1), bytes(sync_state['finalized_hash']))
		self.assertIsNone(sync_state['dirty_state_from_height'])
		failed_events = [event for event in logger.events if event['event'] == 'symbol_sync_failed']
		self.assertEqual(1, len(failed_events))
		self.assertEqual(chain_height - 1, failed_events[0]['last_completed_height'])

		# Act: restart from the durable checkpoint with a connector that serves only batch 2.
		restart_connector = FakeConnector(
			chain_height,
			{chain_height - 1: [create_node_block(chain_height)]},
			block_by_height={chain_height - 1: create_node_block(chain_height - 1)},
			finalized_height=chain_height)
		restart_puller = create_symbol_puller(self.config_ini, 'testnet', connector=restart_connector)
		with restart_puller.symbol_db:
			asyncio.run(restart_puller.sync_block_headers())

		# Assert:
		self.assertEqual(chain_height, database.get_sync_state()['last_synced_height'])
		self.assertEqual([
			f'blocks?pageSize=100&offset={chain_height - 1}&orderBy=height'
		], [path for path in restart_connector.paths if path.startswith('blocks?page')])

	def test_sync_block_headers_cancellation_after_checkpoint_resumes_without_repairing_checkpointed_range(self):
		# Arrange:
		chain_height = BLOCK_PAGE_FETCH_CONCURRENCY * MAX_PAGE_SIZE + 1
		connector = CancelAtNextBatchConnector(
			chain_height,
			create_multi_batch_block_pages(chain_height),
			finalized_height=chain_height - 1)
		set_symbol_connector(self.puller, connector)

		async def cancel_at_next_batch_fetch():
			task = asyncio.create_task(self.puller.sync_block_headers())
			await connector.next_batch_started.wait()
			task.cancel()
			with self.assertRaises(asyncio.CancelledError):
				await task

		# Act:
		asyncio.run(cancel_at_next_batch_fetch())

		# Assert:
		database = self.puller.symbol_db
		sync_state = database.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(chain_height - 1, sync_state['last_synced_height'])
		self.assertEqual(create_block_hash(chain_height - 1), bytes(sync_state['last_synced_block_hash']))
		self.assertIsNone(sync_state['dirty_state_from_height'])
		self.assertEqual(list(range(1, chain_height)), self._fetch_block_heights(database))

		# Act: restart with only the uncached page available.
		restart_connector = FakeConnector(
			chain_height,
			{chain_height - 1: [create_node_block(chain_height)]},
			block_by_height={chain_height - 1: create_node_block(chain_height - 1)},
			finalized_height=chain_height - 1)
		restart_puller = create_symbol_puller(self.config_ini, 'testnet', connector=restart_connector)
		with restart_puller.symbol_db:
			asyncio.run(restart_puller.sync_block_headers())

		# Assert:
		self.assertEqual(chain_height, database.get_sync_state()['last_synced_height'])
		self.assertEqual([
			f'blocks?pageSize=100&offset={chain_height - 1}&orderBy=height'
		], [path for path in restart_connector.paths if path.startswith('blocks?page')])

	def test_sync_block_headers_keeps_checkpoint_when_finalization_cleanup_fails(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1)]})
		database = self.puller.symbol_db
		with _replace_symbol_database(self.puller, FailingFinalizationCleanupDatabase(database)):
			# Act / Assert:
			with self.assertRaisesRegex(RuntimeError, 'finalization cleanup failed'):
				self._sync_with_connector(connector)

		# Assert:
		sync_state = database.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(1, sync_state['last_synced_height'])
		self.assertIsNone(sync_state['dirty_state_from_height'])

	def test_sync_block_headers_new_puller_resumes_after_checkpoint_without_repairing_checkpointed_range(self):
		# Arrange:
		first_connector = FakeConnector(
			1001,
			create_multi_batch_block_pages(1001),
			finalized_height=1000)
		self._sync_with_connector(first_connector, max_height=1000)
		second_connector = FakeConnector(
			1001,
			{1000: [create_node_block(1001)]},
			block_by_height={1000: create_node_block(1000)},
			finalized_height=1000)
		second_puller = create_symbol_puller(self.config_ini, 'testnet', connector=second_connector)

		# Act:
		with second_puller.symbol_db:
			asyncio.run(second_puller.sync_block_headers())
			second_sync_state = second_puller.symbol_db.get_sync_state()

		# Assert:
		self.assertEqual(1001, second_sync_state['last_synced_height'])
		self.assertEqual([
			'chain/info',
			'network/properties',
			f'mosaics/{NATIVE_MOSAIC_ID}',
			'blocks/1000',
			'blocks?pageSize=100&offset=1000&orderBy=height',
			transaction_path(1001, 1001),
			statement_path(1001, 1001),
			'accounts',
			f'account/{self._beneficiary_address_text()}/multisig'
		], second_connector.paths)

	def test_sync_block_headers_rejects_mismatched_new_finalized_hash_before_checkpoint(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1])
		checkpoint_hash = create_block_hash(1)
		database.upsert_sync_state(create_checkpoint_sync_state(
			1, 1,
			chain_height=1,
			finalized_hash=checkpoint_hash,
			last_synced_block_hash=checkpoint_hash))
		connector = ChainInfoOverrideConnector(
			2,
			{1: [create_node_block(2)]},
			block_by_height={1: create_node_block(1)},
			finalized_height=2,
			finalized_fields={'hash': 'A' * 64})

		# Act / Assert:
		with self.assertRaisesRegex(SymbolRollbackError, 'Finalized block hash does not match local database'):
			self._sync_with_connector(connector)

		# Assert:
		sync_state = database.get_sync_state()
		self.assertEqual('unhealthy', sync_state['status'])
		self.assertEqual(1, sync_state['last_synced_height'])
		self.assertEqual(create_block_hash(1), bytes(sync_state['last_synced_block_hash']))
		self.assertEqual(2, sync_state['dirty_state_from_height'])
		self.assertEqual([
			'chain/info',
			'network/properties',
			f'mosaics/{NATIVE_MOSAIC_ID}',
			'blocks/1',
			'blocks?pageSize=100&offset=1&orderBy=height',
			transaction_path(2, 2),
			statement_path(2, 2),
			'accounts',
			f'account/{self._beneficiary_address_text()}/multisig'
		], connector.paths)

	def test_rollback_verification_respects_max_height_scan_boundary(self):
		# Arrange: the cap is two, so saved height three must not be compared with the node.
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3])
		sync_state = create_checkpoint_sync_state(1, 3)
		connector = FakeConnector(
			5,
			{},
			block_by_height={height: create_node_block(height) for height in (1, 2)},
			finalized_height=5)
		set_symbol_connector(self.puller, connector)

		# Act:
		repair_height = asyncio.run(self.puller._repair_from_recorded_finalized_anchor(  # pylint: disable=protected-access
			sync_state,
			5,
			create_block_hash(5),
			2,
			node_chain_height=5,
			node_finalized_height=5))

		# Assert:
		self.assertIsNone(repair_height)
		self.assertEqual(['blocks/1', 'blocks/2'], connector.paths)
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))

	def test_saved_block_fetch_failure_marks_sync_unhealthy_before_repair(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3])
		sync_state = create_sync_state(last_synced_height=3, last_synced_block_hash=create_block_hash(3))
		database.upsert_sync_state(sync_state)
		connector = FakeConnector(
			3,
			{},
			block_by_height={
				1: create_node_block(1),
				2: RuntimeError('saved block fetch failed'),
				3: create_node_block(3)},
			finalized_height=3)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(SymbolRollbackError, 'Unable to verify saved block range'):
			asyncio.run(self.puller._repair_from_recorded_finalized_anchor(  # pylint: disable=protected-access
				sync_state,
				3,
				create_block_hash(3),
				3,
				node_chain_height=3,
				node_finalized_height=3,
				node_finalized_hash=create_block_hash(3)))

		# Assert: only health changes; the recorded anchor and saved rows remain available for retry.
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		persisted_state = database.get_sync_state()
		persisted_state['finalized_hash'] = bytes(persisted_state['finalized_hash'])
		persisted_state['last_synced_block_hash'] = bytes(persisted_state['last_synced_block_hash'])
		self.assertEqual({**sync_state, 'status': 'unhealthy'}, persisted_state)

	def test_finalized_lock_event_branch_mismatch_fails_closed(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3], {2: b'old fork'.hex()})
		sync_state = create_sync_state(last_synced_height=3, last_synced_block_hash=create_block_hash(3))
		database.upsert_sync_state(sync_state)
		database.upsert_transactions_for_height(2, [create_transaction_entry(
			2,
			'old-hash-lock-transaction',
			type=TransactionType.HASH_LOCK.value,
			type_name=TRANSACTION_TYPE_LABELS[TransactionType.HASH_LOCK.value],
			signer_address=bytes.fromhex(SIGNER_ADDRESS),
			target_address=bytes.fromhex(RECIPIENT_ADDRESS),
			body={})])
		connector = FakeConnector(
			3,
			{},
			block_by_height={1: create_node_block(1), 2: create_node_block(2), 3: create_node_block(3)},
			finalized_height=3)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(SymbolRollbackError, 'contains lock events whose pruned state'):
			asyncio.run(self.puller._repair_from_recorded_finalized_anchor(  # pylint: disable=protected-access
				sync_state,
				3,
				create_block_hash(3),
				3,
				node_chain_height=3,
				node_finalized_height=3,
				node_finalized_hash=create_block_hash(3)))

		# Assert:
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		persisted_state = database.get_sync_state()
		persisted_state['finalized_hash'] = bytes(persisted_state['finalized_hash'])
		persisted_state['last_synced_block_hash'] = bytes(persisted_state['last_synced_block_hash'])
		self.assertEqual({**sync_state, 'status': 'unhealthy'}, persisted_state)

	def test_shorter_node_repairs_earliest_mismatch_below_node_tip(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4], {2: b'old fork'.hex()})
		sync_state = create_sync_state(
			last_synced_height=4,
			last_synced_block_hash=create_block_hash(4))
		connector = FakeConnector(
			3,
			{},
			block_by_height={height: create_node_block(height) for height in (1, 2, 3)},
			finalized_height=1)
		set_symbol_connector(self.puller, connector)

		# Act: a shorter node still has common persisted heights whose hashes need comparison.
		with patch.object(self.puller, '_repair_from_height', new_callable=AsyncMock, return_value=2) as repair:
			repair_height = asyncio.run(self.puller._repair_from_recorded_finalized_anchor(  # pylint: disable=protected-access
				sync_state,
				1,
				create_block_hash(1),
				2,
				node_chain_height=3,
				node_finalized_height=1,
				node_finalized_hash=create_block_hash(1)))

		# Assert:
		self.assertEqual(2, repair_height)
		repair.assert_awaited_once_with(2, sync_state, 1, True, True)
		self.assertEqual(['blocks/1', 'blocks/2'], connector.paths)

	def test_rollback_verification_rejects_missing_saved_anchor(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3])
		sync_state = create_sync_state(
			finalized_height=None,
			finalized_hash=None,
			last_synced_height=3,
			last_synced_block_hash=create_block_hash(3))
		connector = FakeConnector(5, {}, block_by_height={5: create_node_block(5)}, finalized_height=5)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(SymbolRollbackError, 'Recorded finalized anchor is missing from local sync state'):
			asyncio.run(self.puller._repair_from_recorded_finalized_anchor(  # pylint: disable=protected-access
				sync_state,
				5,
				create_block_hash(5),
				5,
				node_chain_height=5,
				node_finalized_height=5))

		# Assert:
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		self.assertEqual('unhealthy', database.get_sync_state()['status'])

	def test_finalized_rollback_refreshes_receipt_only_address_and_inflation_mosaic(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3])
		beneficiary = bytes.fromhex(BENEFICIARY_ADDRESS)
		receipt_address = Network.TESTNET.public_key_to_address(PublicKey('A' * 64)).bytes
		unrelated_address = bytes.fromhex(RECIPIENT_ADDRESS)
		for address in (beneficiary, receipt_address, unrelated_address):
			account_row, mosaic_rows = create_account_row(
				create_account_item(address.hex().upper()),
				self.puller.symbol_facade.network,
				99 if address == unrelated_address else 2,
				NATIVE_MOSAIC_ID,
				6)
			database.upsert_account_current_state(account_row, mosaic_rows)
		database.upsert_multisig(beneficiary, {
			'address': beneficiary,
			'min_approval': 1,
			'min_removal': 1,
			'cosignatory_addresses': [],
			'multisig_addresses': [],
			'updated_at_height': 2
		})
		database.upsert_multisig(unrelated_address, {
			'address': unrelated_address,
			'min_approval': 2,
			'min_removal': 1,
			'cosignatory_addresses': [beneficiary],
			'multisig_addresses': [receipt_address],
			'updated_at_height': 1
		})
		receipts = create_receipt_rows(create_statement_item(
			2,
			{
				'version': 1,
				'type': ReceiptType.HARVEST_FEE.value,
				'targetAddress': receipt_address.hex().upper(),
				'mosaicId': NATIVE_MOSAIC_ID,
				'amount': '11'
			},
			'old-branch-harvest-fee'))
		receipts.extend(create_receipt_rows(create_amount_statement_item(2, 13)))
		database.upsert_receipts_for_height(2, receipts, 0)
		node_mosaic = create_mosaic_item(NATIVE_MOSAIC_ID)
		connector = FakeConnector(
			3,
			{},
			mosaics_by_id={NATIVE_MOSAIC_ID: node_mosaic},
			account_by_address={
				str(Address(beneficiary)): create_account_item(beneficiary.hex().upper()),
				str(Address(receipt_address)): create_account_item(
					receipt_address.hex().upper(), mosaics=[{'id': NATIVE_MOSAIC_ID, 'amount': '777000000'}])
			})
		set_symbol_connector(self.puller, connector)
		sync_state = create_sync_state(last_synced_height=3, last_synced_block_hash=create_block_hash(3))

		# Act:
		asyncio.run(self.puller._repair_from_height(2, sync_state, 3))  # pylint: disable=protected-access

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute('SELECT address, last_seen_height FROM symbol_accounts ORDER BY address')
		self.assertEqual(sorted([
			(beneficiary, 1),
			(receipt_address, 1),
			(unrelated_address, 99)
		]), [(bytes(address), last_seen_height) for address, last_seen_height in cursor.fetchall()])
		self.assertEqual([{'addresses': [str(Address(address)) for address in sorted((beneficiary, receipt_address))]}], [
			payload for route, payload in connector.post_requests if route == 'accounts'
		])
		cursor.execute(
			'SELECT address, mosaic_id, amount, updated_at_height '
			'FROM symbol_account_mosaics ORDER BY address, mosaic_id')
		self.assertEqual(sorted([
			(beneficiary, NATIVE_MOSAIC_ID, 20_000 * 10 ** 6, 1),
			(receipt_address, NATIVE_MOSAIC_ID, 777_000_000, 1),
			(unrelated_address, NATIVE_MOSAIC_ID, 20_000 * 10 ** 6, 99)
		]), [
			(bytes(address), mosaic_id, amount, updated_at_height)
			for address, mosaic_id, amount, updated_at_height in cursor.fetchall()])
		cursor.execute('SELECT COUNT(*) FROM symbol_multisig WHERE address = %s', (beneficiary,))
		self.assertEqual(0, cursor.fetchone()[0])
		cursor.execute(
			'SELECT address, min_approval, min_removal, cosignatory_addresses, multisig_addresses, updated_at_height '
			'FROM symbol_multisig WHERE address = %s',
			(unrelated_address,))
		multisig_row = cursor.fetchone()
		self.assertEqual(unrelated_address, bytes(multisig_row[0]))
		self.assertEqual((2, 1, [beneficiary], [receipt_address], 1), (
			multisig_row[1],
			multisig_row[2],
			[bytes(address) for address in multisig_row[3]],
			[bytes(address) for address in multisig_row[4]],
			multisig_row[5]))
		cursor.execute('SELECT mosaic_id, updated_at_height FROM symbol_mosaics WHERE mosaic_id = %s', (NATIVE_MOSAIC_ID,))
		self.assertEqual((NATIVE_MOSAIC_ID, 1), cursor.fetchone())

	# pylint: disable=too-many-statements
	def test_public_sync_retries_and_publishes_replacement_receipts_with_unrelated_state_preserved(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3], {2: 'D' * 64})
		database.upsert_sync_state(create_sync_state(last_synced_height=3))
		old_only_address = Network.TESTNET.public_key_to_address(PublicKey('A' * 64)).bytes
		unrelated_address = Network.TESTNET.public_key_to_address(PublicKey('B' * 64)).bytes
		for address, observed_height in ((old_only_address, 2), (unrelated_address, 99)):
			account_row, mosaic_rows = create_account_row(
				create_account_item(address.hex().upper()),
				self.puller.symbol_facade.network,
				observed_height,
				NATIVE_MOSAIC_ID,
				6)
			database.upsert_account_current_state(account_row, mosaic_rows)
		database.upsert_multisig(unrelated_address, {
			'address': unrelated_address,
			'min_approval': 2,
			'min_removal': 1,
			'cosignatory_addresses': [old_only_address],
			'multisig_addresses': [bytes.fromhex(SIGNER_ADDRESS)],
			'updated_at_height': 1
		})
		old_receipts = create_receipt_rows(create_statement_item(
			2,
			{
				'version': 1,
				'type': ReceiptType.HARVEST_FEE.value,
				'targetAddress': old_only_address.hex().upper(),
				'mosaicId': NATIVE_MOSAIC_ID,
				'amount': '11'
			},
			'old-branch-harvest-fee'))
		old_receipts.extend(create_receipt_rows(create_amount_statement_item(2, 13)))
		database.upsert_receipts_for_height(2, old_receipts, 0)
		cursor = database.connection.cursor()
		cursor.execute('SELECT to_jsonb(row) FROM symbol_accounts AS row WHERE address = %s', (unrelated_address,))
		unrelated_account_before = cursor.fetchone()[0]
		cursor.execute(
			'SELECT to_jsonb(row) FROM symbol_account_mosaics AS row WHERE address = %s', (unrelated_address,))
		unrelated_balance_before = cursor.fetchone()[0]
		cursor.execute('SELECT to_jsonb(row) FROM symbol_multisig AS row WHERE address = %s', (unrelated_address,))
		unrelated_multisig_before = cursor.fetchone()[0]
		old_snapshot = self._fetch_complete_batch_state()
		replacement_block = create_node_block(2, block_hash='B' * 64, transactions_count=0, total_transactions_count=0)
		terminal_block = create_node_block(3, previous_hash='B' * 64)
		later_blocks = [create_node_block(4), create_node_block(5)]
		new_receipt_statements = {
			'data': [
				create_statement_item(2, {
					'version': 1,
					'type': ReceiptType.HARVEST_FEE.value,
					'targetAddress': SIGNER_ADDRESS,
					'mosaicId': NATIVE_MOSAIC_ID,
					'amount': '21'
				}, 'replacement-harvest-fee'),
				create_amount_statement_item(2, 23, item_id='replacement-inflation')
			]
		}
		connector_args = {
			'chain_height': 5,
			'pages': {
				1: [replacement_block, terminal_block, *later_blocks],
				2: [terminal_block, *later_blocks]
			},
			'block_by_height': {
				1: create_node_block(1),
				2: replacement_block,
				3: terminal_block,
				4: later_blocks[0],
				5: later_blocks[1]
			},
			'finalized_height': 5,
			'transactions_by_path': {transaction_path(2, 5): create_transaction_page([])},
			'statement_pages': {statement_path(2, 5): new_receipt_statements},
			'mosaics_by_id': {NATIVE_MOSAIC_ID: create_mosaic_item(NATIVE_MOSAIC_ID)}
		}
		broken_connector = FakeConnector(
			**{
				**connector_args,
				'account_by_address': {str(Address(old_only_address)): RuntimeError('old-only account unavailable')}
			})

		# Act: the failed prefetch keeps the old branch, then a retry re-detects and repairs it.
		with self.assertRaisesRegex(RuntimeError, 'old-only account unavailable'):
			self._sync_with_connector(broken_connector)
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		self.assertEqual(2, len(self._fetch_receipts(database)))
		self.assertEqual('unhealthy', database.get_sync_state()['status'])
		self.assertEqual(3, database.get_sync_state()['last_synced_height'])
		logger = DatabaseObservingPerformanceLogger(database, self._fetch_complete_batch_state)
		self.puller._performance_logger = logger  # pylint: disable=protected-access
		retry_connector = FakeConnector(**connector_args)

		# Act:
		self._sync_with_connector(retry_connector)

		# Assert: replacement receipts and snapshot are published, while unrelated account state is byte-for-byte stable.
		self.assertEqual(1, retry_connector.paths.count('blocks/5'))
		self.assertEqual([
			('harvestFee', 'balanceChange', NATIVE_MOSAIC_ID, 21),
			('inflation', 'inflation', NATIVE_MOSAIC_ID, 23)
		], [
			(receipt_type, receipt_group, mosaic_id, amount)
			for _, receipt_type, receipt_group, _, _, mosaic_id, amount in self._fetch_receipts(database)
		])
		self.assertEqual(5, database.get_sync_state()['last_synced_height'])
		cursor.execute('SELECT to_jsonb(row) FROM symbol_accounts AS row WHERE address = %s', (unrelated_address,))
		self.assertEqual(unrelated_account_before, cursor.fetchone()[0])
		cursor.execute(
			'SELECT to_jsonb(row) FROM symbol_account_mosaics AS row WHERE address = %s', (unrelated_address,))
		self.assertEqual(unrelated_balance_before, cursor.fetchone()[0])
		cursor.execute('SELECT to_jsonb(row) FROM symbol_multisig AS row WHERE address = %s', (unrelated_address,))
		self.assertEqual(unrelated_multisig_before, cursor.fetchone()[0])
		self.assertEqual(1, len(logger.completed_state_snapshots))
		self.assertNotEqual(old_snapshot, logger.completed_state_snapshots[0])
		published_snapshot = copy.deepcopy(logger.completed_state_snapshots[0])
		persisted_snapshot = self._fetch_complete_batch_state()
		published_sync_state = published_snapshot['symbol_sync_state'][0][0]
		persisted_sync_state = persisted_snapshot['symbol_sync_state'][0][0]
		published_at = datetime.fromisoformat(published_sync_state['updated_at'])
		persisted_at = datetime.fromisoformat(persisted_sync_state['updated_at'])
		self.assertGreaterEqual(persisted_at, published_at)
		published_sync_state.pop('updated_at')
		persisted_sync_state.pop('updated_at')
		self.assertEqual(published_snapshot, persisted_snapshot)

	# pylint: disable=too-many-statements
	def test_public_rollback_confirms_account_absence_and_rejects_invalid_lookup_responses(self):
		# Arrange:
		database, address, other_address, connector_args = self._seed_account_rollback_fixture()
		address_text = str(Address(address))
		invalid_responses = (
			('malformed batch', {'data': []}, None, 'Malformed Symbol accounts batch response'),
			('unexpected batch address', [create_account_item(other_address.hex().upper())], None,
				'Unexpected or duplicate Symbol account'),
			('duplicate requested address', [
				create_account_item(address.hex().upper()), create_account_item(address.hex().upper())], None,
				'Unexpected or duplicate Symbol account'),
			('malformed lookup', [], {'error': 'malformed'}, 'Malformed Symbol account lookup response'),
			('mismatched lookup address', [], {'account': {'address': other_address.hex().upper()}},
				'Symbol account lookup returned a different address'))
		cursor = database.connection.cursor()
		before_invalid_state = self._capture_preserved_state()

		# Act: every uncertain response aborts before deleting any old-branch state.
		for case_name, batch_response, lookup_response, expected_error in invalid_responses:
			with self.subTest(case=case_name):
				connector = RollbackAccountResponseConnector(
					**connector_args,
					batch_response=batch_response,
					account_lookup_response=lookup_response)
				with self.assertRaises(ValueError) as exception_context:
					self._sync_with_connector(connector)

				# Assert:
				self.assertIn(expected_error, str(exception_context.exception))
				self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
				self._assert_preserved_state(before_invalid_state, {**before_invalid_state.sync_state, 'status': 'unhealthy'})
				cursor.execute('SELECT COUNT(*) FROM symbol_accounts WHERE address = %s', (address,))
				self.assertEqual(1, cursor.fetchone()[0])
				self.assertEqual('unhealthy', database.get_sync_state()['status'])

		# Act / Assert: only an explicit not-found multisig response means the row is absent.
		before_multisig_state = self._capture_preserved_state()
		null_multisig_connector = FakeConnector(
			**{
				**connector_args,
				'multisig_by_address': {address_text: {'multisig': None}}
			})
		with self.assertRaisesRegex(ValueError, 'Malformed Symbol multisig response'):
			self._sync_with_connector(null_multisig_connector)
		cursor.execute('SELECT to_jsonb(row) FROM symbol_accounts AS row WHERE address = %s', (address,))
		self.assertEqual(1, cursor.rowcount)
		cursor.execute('SELECT to_jsonb(row) FROM symbol_multisig AS row WHERE address = %s', (address,))
		self.assertEqual(1, cursor.rowcount)
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		self._assert_preserved_state(before_multisig_state, {**before_multisig_state.sync_state, 'status': 'unhealthy'})

		# Act: only the node's explicit not-found response permits account-family cleanup.
		connector = RollbackAccountResponseConnector(
			**connector_args,
			account_by_address={address_text: None})
		self._sync_with_connector(connector)

		# Assert:
		for table_name in ('symbol_accounts', 'symbol_account_mosaics', 'symbol_multisig'):
			cursor.execute(f'SELECT COUNT(*) FROM {table_name} WHERE address = %s', (address,))
			self.assertEqual(0, cursor.fetchone()[0], table_name)
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		self.assertEqual('healthy', database.get_sync_state()['status'])

	def _prepare_empty_chain_info_rejection(self):
		database = self.puller.symbol_db
		drop_symbol_block_tables_if_present(database)
		database.create_tables()
		return self._capture_preserved_state(), None

	def _prepare_saved_chain_info_rejection(self, heights, sync_state, run_id=None, preservation_height=None):
		database = self.puller.symbol_db
		drop_symbol_block_tables_if_present(database)
		database.create_tables()
		self._seed_blocks(database, heights)
		if preservation_height is not None:
			self._seed_rollback_preservation_rows(database, preservation_height)

		database.upsert_sync_state(sync_state)
		if run_id is not None:
			seed_healthy_refresh_state(database, run_id, max(heights))

		return self._capture_preserved_state(), {**sync_state, 'status': 'unhealthy'}

	def _assert_chain_info_rejected_before_writes(
		self, connector, max_height, before, expected_sync_state,
		expected_message, expected_cause_type, expected_cause_args, expected_paths
	):
		# Act:
		with self.assertRaises(SymbolRollbackError) as context:
			self._sync_with_connector(connector, max_height=max_height)

		# Assert:
		self.assertEqual(expected_message, str(context.exception))
		self.assertIs(expected_cause_type, type(context.exception.__cause__))
		self.assertEqual(expected_cause_args, getattr(context.exception.__cause__, 'args', None))
		self.assertEqual(expected_paths, connector.paths)
		self._assert_preserved_state(before, expected_sync_state)

	def test_public_sync_rejects_finalized_height_above_node_tip_before_capping(self):
		for max_height in (None, 2):
			with self.subTest(max_height=max_height):
				# Arrange:
				before, expected = self._prepare_saved_chain_info_rejection([1], create_checkpoint_sync_state(1, 1))
				connector = ChainInfoOverrideConnector(
					5, {0: [create_node_block(height) for height in range(1, 6)]},
					finalized_height=5, finalized_fields={'height': '6'})

				# Act / Assert:
				self._assert_chain_info_rejected_before_writes(
					connector, max_height, before, expected,
					'Node finalized height exceeds node chain height', type(None), None, ['chain/info'])

	def test_public_sync_resumes_after_publishing_zero_height_finality(self):
		# Arrange:
		database = self.puller.symbol_db
		first_connector = FakeConnector(1, {0: [create_node_block(1)]}, finalized_height=0)

		# Act: the first run saves height one while the node has no finalized block above zero.
		self._sync_with_connector(first_connector)

		# Assert:
		first_state = database.get_sync_state()
		self.assertEqual('healthy', first_state['status'])
		self.assertEqual(0, first_state['finalized_height'])
		self.assertEqual(bytes(32), bytes(first_state['finalized_hash']))
		self.assertEqual(1, first_state['last_synced_height'])
		self.assertEqual([1], self._fetch_block_heights(database))

		# Arrange: the same saved branch becomes finalized on the next node report.
		second_connector = FakeConnector(1, {}, block_by_height={1: create_node_block(1)}, finalized_height=1)

		# Act:
		self._sync_with_connector(second_connector)

		# Assert:
		second_state = database.get_sync_state()
		self.assertEqual('healthy', second_state['status'])
		self.assertEqual(1, second_state['finalized_height'])
		self.assertEqual(create_block_hash(1), bytes(second_state['finalized_hash']))
		self.assertEqual(1, second_state['last_synced_height'])
		self.assertIsNone(second_state['dirty_state_from_height'])
		self.assertEqual([1], self._fetch_block_heights(database))
		self.assertEqual(1, second_connector.paths.count('blocks/1'))
		self.assertEqual([], [path for path in second_connector.paths if path.startswith('blocks?pageSize=')])

	def test_public_sync_rejects_nonzero_hash_at_zero_finalized_height_before_initial_write(self):
		# Arrange:
		before, expected = self._prepare_empty_chain_info_rejection()
		invalid_connector = ChainInfoOverrideConnector(
			1, {0: [create_node_block(1)]}, finalized_height=0, finalized_fields={'hash': 'A' * 64})

		# Act / Assert:
		self._assert_chain_info_rejected_before_writes(
			invalid_connector, None, before, expected,
			'Malformed Symbol finalized block in chain info', ValueError,
			('Symbol zero-height finalized block must have a zero hash',), ['chain/info'])

		# Arrange: a valid response can still initialize the same database.
		valid_connector = FakeConnector(1, {0: [create_node_block(1)]}, finalized_height=0)

		# Act:
		self._sync_with_connector(valid_connector)

		# Assert:
		database = self.puller.symbol_db
		self.assertEqual([1], self._fetch_block_heights(database))
		valid_state = database.get_sync_state()
		self.assertEqual('healthy', valid_state['status'])
		self.assertEqual(0, valid_state['finalized_height'])
		self.assertEqual(bytes(32), bytes(valid_state['finalized_hash']))
		self.assertEqual(1, valid_state['last_synced_height'])

	def test_public_sync_rejects_nonzero_hash_at_zero_finalized_height_with_checkpoint(self):
		for dirty_height, status in ((None, 'healthy'), (2, 'unhealthy')):
			with self.subTest(dirty_height=dirty_height):
				# Arrange: node finality stays at zero, so the reported hash is the only invalid input.
				before, expected = self._prepare_saved_chain_info_rejection(
					[1], create_checkpoint_sync_state(
						0, 1, chain_height=1, finalized_epoch=4, finalized_point=5,
						dirty_state_from_height=dirty_height, status=status), 'zero-finalized-input', 1)
				invalid_connector = ChainInfoOverrideConnector(
					1, {0: [create_node_block(1)]}, finalized_height=0, finalized_fields={'hash': 'A' * 64})

				# Act / Assert:
				self._assert_chain_info_rejected_before_writes(
					invalid_connector, None, before, expected,
					'Malformed Symbol finalized block in chain info', ValueError,
					('Symbol zero-height finalized block must have a zero hash',), ['chain/info'])

	def test_public_sync_rejects_zero_chain_tip_with_saved_history_before_cap_or_repair(self):
		# Arrange:
		before, expected = self._prepare_saved_chain_info_rejection(
			[1, 2, 3], create_checkpoint_sync_state(0, 3), 'zero-chain-tip', 3)
		connector = ChainInfoOverrideConnector(3, {}, chain_fields={'height': 0}, finalized_height=0)

		# Act / Assert:
		self._assert_chain_info_rejected_before_writes(
			connector, 2, before, expected,
			'Malformed Symbol finalized block in chain info', ValueError,
			('Symbol chain or finalized height is outside the valid range',), ['chain/info'])

	def test_public_sync_rejects_invalid_chain_info_height_types_before_sync_writes(self):
		preparations = (
			(False, None, self._prepare_empty_chain_info_rejection),
			(True, 2, lambda: self._prepare_saved_chain_info_rejection(
				[1, 2, 3], create_checkpoint_sync_state(0, 3), 'invalid-height', 3))
		)
		for has_checkpoint, cap, prepare in preparations:
			for height_field in ('chain', 'finalized'):
				invalid_heights = (
					('missing', {}, ('height',), KeyError, ('height',)),
					('null', {'height': None}, (), ValueError, (f'Malformed Symbol {height_field} height in chain info',)),
					('boolean', {'height': True}, (), ValueError, (f'Malformed Symbol {height_field} height in chain info',)),
					('negative', {'height': -1}, (), ValueError, ('Symbol chain or finalized height is outside the valid range',)),
					('fraction', {'height': 1.5}, (), ValueError, (f'Malformed Symbol {height_field} height in chain info',)),
					('separator', {'height': '1_0'}, (), ValueError, (f'Malformed Symbol {height_field} height in chain info',))
				)
				field_prefix = height_field
				for case_name, fields, omitted, cause_type, cause_args in invalid_heights:
					with self.subTest(checkpoint=has_checkpoint, field=height_field, case=case_name):
						# Arrange:
						before, expected = prepare()
						connector = ChainInfoOverrideConnector(3, {}, finalized_height=0, **{
							field_prefix + '_fields': fields, 'omitted_' + field_prefix + '_fields': omitted})

						# Act / Assert:
						self._assert_chain_info_rejected_before_writes(
							connector, cap, before, expected,
							'Malformed Symbol finalized block in chain info', cause_type, cause_args, ['chain/info'])

	def test_public_sync_accepts_integer_and_ascii_digit_chain_info_heights(self):
		for height_field, height_value in (('chain', 1), ('finalized', 0), ('chain', '01'), ('finalized', '00')):
			with self.subTest(field=height_field, value=height_value):
				# Arrange:
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				connector = ChainInfoOverrideConnector(
					1,
					{0: [create_node_block(1)]},
					finalized_height=0,
					chain_fields={'height': height_value} if 'chain' == height_field else {},
					finalized_fields={'height': height_value} if 'finalized' == height_field else {})

				# Act:
				self._sync_with_connector(connector)

				# Assert:
				self.assertEqual([1], self._fetch_block_heights(database))
				self.assertEqual('healthy', database.get_sync_state()['status'])
				self.assertEqual(0, database.get_sync_state()['finalized_height'])

	def test_public_sync_rejects_uncapped_postgres_int_overflow_before_writes(self):
		preparations = (
			(False, self._prepare_empty_chain_info_rejection),
			(True, lambda: self._prepare_saved_chain_info_rejection(
				[1, 2, 3, 4, 5], create_checkpoint_sync_state(3, 3, dirty_state_from_height=4, status='repairing'),
				'overflow-preservation', 4))
		)
		for has_dirty_checkpoint, prepare in preparations:
			with self.subTest(has_dirty_checkpoint=has_dirty_checkpoint):
				# Arrange:
				before, expected = prepare()
				connector = FakeConnector(2_147_483_648, {}, finalized_height=3)

				# Act / Assert:
				self._assert_chain_info_rejected_before_writes(
					connector, None, before, expected,
					'Effective Symbol chain height exceeds PostgreSQL int range', type(None), None, ['chain/info'])

	def test_public_sync_rejects_uint64_overflow_before_max_height(self):
		for invalid_field, chain_height, finalized_height, fields in (
			('chain', 5, 1, {'chain_fields': {'height': str(2**64)}}),
			('finalized', 2**64, 2**64, {'finalized_fields': {'height': str(2**64)}})
		):
			with self.subTest(invalid_field=invalid_field):
				# Arrange: equal overflowing heights avoid rejection solely for their ordering.
				before, expected = self._prepare_empty_chain_info_rejection()
				connector = ChainInfoOverrideConnector(chain_height, {}, finalized_height=finalized_height, **fields)

				# Act / Assert:
				self._assert_chain_info_rejected_before_writes(
					connector, 2, before, expected,
					'Malformed Symbol finalized block in chain info', ValueError,
					(f'Symbol {invalid_field} height exceeds uint64',), ['chain/info'])

	def test_public_sync_accepts_uint64_node_heights_when_cap_fits_postgres_int(self):
		# Arrange: the node advertises the largest uint64 height, but the requested checkpoint is two.
		database = self.puller.symbol_db
		connector = FakeConnector(
			(1 << 64) - 1, {0: [create_node_block(1), create_node_block(2)]},
			finalized_height=(1 << 64) - 1)

		# Act:
		self._sync_with_connector(connector, max_height=2)

		# Assert:
		self.assertEqual([1, 2], self._fetch_block_heights(database))
		sync_state = database.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(2, sync_state['chain_height'])
		self.assertEqual(2, sync_state['finalized_height'])
		self.assertEqual(2, sync_state['last_synced_height'])
		self.assertIsNone(sync_state['dirty_state_from_height'])

	def test_public_sync_accepts_postgres_int_max_chain_height_without_forward_sync(self):
		# Arrange: a stored anchor at the boundary lets the public run avoid a large forward range.
		database = self.puller.symbol_db
		boundary_height = (1 << 31) - 1
		boundary_block = create_node_block(1)
		boundary_block['block']['height'] = str(boundary_height)
		boundary_block['block']['previousBlockHash'] = f'{boundary_height - 1:064X}'
		boundary_block['meta']['hash'] = f'{boundary_height:064X}'
		boundary_block['id'] = str(boundary_height)
		database.upsert_blocks([create_block_row(boundary_block, 100, self.puller.symbol_facade.network)])
		database.upsert_sync_state(create_checkpoint_sync_state(
			boundary_height, boundary_height,
			chain_height=boundary_height))
		connector = FakeConnector(
			boundary_height, {},
			block_by_height={boundary_height: boundary_block},
			finalized_height=boundary_height)

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([boundary_height], self._fetch_block_heights(database))
		sync_state = database.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(boundary_height, sync_state['chain_height'])
		self.assertEqual(boundary_height, sync_state['finalized_height'])
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks?pageSize=')])

	def test_public_sync_rejects_invalid_finalization_json_values_before_initial_write(self):
		for field_name in ('finalizationEpoch', 'finalizationPoint'):
			invalid_value_reason = (f'Symbol {field_name} must be a uint32 JSON integer',)
			cases = (
				('missing', {}, (field_name,), KeyError, (field_name,)),
				('null', {field_name: None}, (), ValueError, invalid_value_reason),
				('boolean', {field_name: True}, (), ValueError, invalid_value_reason),
				('negative', {field_name: -1}, (), ValueError, invalid_value_reason),
				('fraction', {field_name: 1.5}, (), ValueError, invalid_value_reason),
				('string', {field_name: '1'}, (), ValueError, invalid_value_reason),
				('uint32 overflow', {field_name: 1 << 32}, (), ValueError, invalid_value_reason)
			)
			for case_name, field_values, omitted_fields, cause_type, cause_args in cases:
				with self.subTest(field_name=field_name, case=case_name):
					# Arrange: the cap must not hide an invalid reported finalization value.
					before, expected = self._prepare_empty_chain_info_rejection()
					connector = ChainInfoOverrideConnector(
						2, {}, finalized_fields=field_values, omitted_finalized_fields=omitted_fields, finalized_height=2)

					# Act / Assert:
					self._assert_chain_info_rejected_before_writes(
						connector, 1, before, expected,
						'Malformed Symbol finalized block in chain info', cause_type, cause_args, ['chain/info'])

	def test_public_sync_rejects_uncapped_finalization_int_overflow_before_initial_write(self):
		for field_name in ('finalizationEpoch', 'finalizationPoint'):
			with self.subTest(field_name=field_name):
				# Arrange: 2^31 is valid uint32, but cannot be stored uncapped in PostgreSQL int.
				before, expected = self._prepare_empty_chain_info_rejection()
				connector = ChainInfoOverrideConnector(2, {}, finalized_fields={field_name: 1 << 31}, finalized_height=1)

				# Act / Assert:
				self._assert_chain_info_rejected_before_writes(
					connector, None, before, expected,
					'Node finalization metadata exceeds PostgreSQL int range', type(None), None, ['chain/info'])

	def test_public_sync_preserves_dirty_state_for_uncapped_finalization_int_overflow(self):
		for field_name in ('finalizationEpoch', 'finalizationPoint'):
			with self.subTest(field_name=field_name):
				# Arrange:
				before, expected = self._prepare_saved_chain_info_rejection(
					[1, 2], create_checkpoint_sync_state(1, 1, dirty_state_from_height=2, status='repairing'),
					'finalization-overflow', 2)
				connector = ChainInfoOverrideConnector(2, {}, finalized_fields={field_name: 1 << 31}, finalized_height=1)

				# Act / Assert:
				self._assert_chain_info_rejected_before_writes(
					connector, None, before, expected,
					'Node finalization metadata exceeds PostgreSQL int range', type(None), None, ['chain/info'])

	def test_public_sync_publishes_max_postgres_finalization_values_without_forward_sync(self):
		# Arrange: first establish a saved block, then update only the node's finalized metadata.
		database = self.puller.symbol_db
		self._sync_with_connector(FakeConnector(1, {0: [create_node_block(1)]}, finalized_height=1))
		connector = ChainInfoOverrideConnector(
			1,
			{},
			block_by_height={1: create_node_block(1)},
			finalized_height=1,
			finalized_fields={'finalizationEpoch': (1 << 31) - 1, 'finalizationPoint': (1 << 31) - 1})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1], self._fetch_block_heights(database))
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks?pageSize=')])
		sync_state = database.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual((1 << 31) - 1, sync_state['finalized_epoch'])
		self.assertEqual((1 << 31) - 1, sync_state['finalized_point'])

	def test_public_sync_uses_calculated_epoch_when_capped_reported_values_exceed_postgres_int(self):
		# Arrange: node metadata is valid uint32, but capped sync publishes only the calculated epoch.
		database = self.puller.symbol_db
		connector = ChainInfoOverrideConnector(
			3,
			{0: [create_node_block(1), create_node_block(2)]},
			finalized_height=3,
			finalized_fields={'finalizationEpoch': 1 << 31, 'finalizationPoint': 1 << 31})

		# Act:
		self._sync_with_connector(connector, max_height=2)

		# Assert:
		self.assertEqual([1, 2], self._fetch_block_heights(database))
		sync_state = database.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(2, sync_state['finalized_epoch'])
		self.assertIsNone(sync_state['finalized_point'])

	def test_public_sync_rejects_calculated_finalization_epoch_over_postgres_int_before_blocks(self):
		# Arrange:
		before, expected = self._prepare_empty_chain_info_rejection()
		connector = FakeConnector(
			1 << 31, {}, finalized_height=1 << 31,
			network_properties=create_network_properties(voting_set_grouping='1'))

		# Act / Assert:
		self._assert_chain_info_rejected_before_writes(
			connector, (1 << 31) - 1, before, expected,
			'Invalid capped Symbol finalization epoch', ValueError,
			('Calculated Symbol finalization epoch exceeds PostgreSQL int range',), ['chain/info', 'network/properties'])

	def test_public_sync_preserves_dirty_state_when_capped_grouping_exceeds_uint64(self):
		# Arrange:
		before, expected = self._prepare_saved_chain_info_rejection(
			[1, 2], create_checkpoint_sync_state(1, 1, chain_height=2, dirty_state_from_height=2, status='repairing'),
			'invalid-grouping', 2)
		connector = FakeConnector(
			2, {}, finalized_height=2,
			network_properties=create_network_properties(voting_set_grouping=str(1 << 64)))

		# Act / Assert:
		self._assert_chain_info_rejected_before_writes(
			connector, 1, before, expected,
			'Invalid capped Symbol finalization epoch', ValueError,
			('Symbol chain.votingSetGrouping exceeds uint64',), ['chain/info', 'network/properties'])

	def test_public_sync_keeps_connection_usable_after_final_publication_sql_error_without_forward_sync(self):
		# Arrange: the saved block and finalized anchor already match the node.
		database = self.puller.symbol_db
		self._sync_with_connector(FakeConnector(1, {0: [create_node_block(1)]}, finalized_height=1))
		before_sync_state = database.get_sync_state()
		before_block_heights = self._fetch_block_heights(database)
		connector = FakeConnector(1, {}, block_by_height={1: create_node_block(1)}, finalized_height=1)
		failing_database = InvalidFinalSyncStateDatabase(database)

		# Act: the replacement status is valid to the Puller but invalid for the PostgreSQL enum.
		with _replace_symbol_database(self.puller, failing_database):
			with self.assertRaises(PsycopgError) as context:
				self._sync_with_connector(connector)

		# Assert: SQL was attempted, rolled back, and the original error reached the caller.
		self.assertIs(failing_database.publication_error, context.exception)
		self.assertEqual(1, failing_database.publication_attempts)
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks?pageSize=')])
		self.assertEqual(before_block_heights, self._fetch_block_heights(database))
		self.assertEqual(before_sync_state, database.get_sync_state())

	def test_public_sync_rejects_inconsistent_zero_height_finalized_anchor(self):
		for anchor_hash in (None, bytes.fromhex('A' * 64)):
			with self.subTest(anchor_hash=anchor_hash):
				# Arrange:
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				self._seed_blocks(database, [1])
				database.upsert_sync_state(create_checkpoint_sync_state(
					0, 1,
					finalized_hash=anchor_hash))
				before_state = self._capture_preserved_state()
				connector = FakeConnector(1, {}, finalized_height=1)

				# Act:
				with self.assertRaises(SymbolRollbackError) as exception_context:
					self._sync_with_connector(connector)

				# Assert:
				self.assertIn('zero-height finalized anchor has an inconsistent hash', str(exception_context.exception))
				self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
				self.assertEqual([], [path for path in connector.paths if path.startswith('blocks?pageSize=')])

	def test_public_sync_rejects_branch_evidence_with_unconfirmed_previous_hash(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3])
		database.upsert_sync_state(create_checkpoint_sync_state(1, 3))
		before_state = self._capture_preserved_state()
		bad_parent_block = create_node_block(2, previous_hash='A' * 64)
		connector = FakeConnector(
			3,
			{},
			block_by_height={1: create_node_block(1), 2: bad_parent_block, 3: create_node_block(3)},
			finalized_height=1)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Unable to verify saved block range') as exception_context:
			self._sync_with_connector(connector)

		# Assert:
		self.assertIsInstance(exception_context.exception.__cause__, ValueError)
		self.assertIn('previous hash does not match confirmed parent', str(exception_context.exception.__cause__))
		self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks?pageSize=')])

	def test_public_sync_rejects_disconnected_branch_before_rollback(self):
		for finalized_height in (3, 5):
			with self.subTest(finalized_height=finalized_height):
				# Arrange: block two forks from the saved parent, while the finalized block belongs to another branch.
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				self._seed_blocks(database, [1, 2, 3])
				self._seed_rollback_preservation_rows(database, 2)
				seed_healthy_refresh_state(database, 'disconnected-branch', 3)
				database.upsert_sync_state(create_sync_state())
				before_state = self._capture_preserved_state()
				forked_block = create_node_block(2, block_hash='A' * 64)
				blocks = {
					1: create_node_block(1),
					2: forked_block,
					3: create_node_block(3, previous_hash=f'{2:064X}' if 3 == finalized_height else 'A' * 64)
				}
				if 5 == finalized_height:
					blocks[4] = create_node_block(4, block_hash='B' * 64)
					blocks[5] = create_node_block(5, previous_hash=f'{4:064X}')

				connector = FakeConnector(finalized_height, {}, block_by_height=blocks, finalized_height=finalized_height)
				if 5 == finalized_height:
					connector.pages[2] = [blocks[3], blocks[4], blocks[5]]
				set_symbol_connector(self.puller, connector)

				# Act:
				with self.assertRaises(SymbolRollbackError) as exception_context:
					asyncio.run(self.puller.sync_block_headers())

				# Assert: a valid finalized hash alone does not authorize deletion from the other branch.
				self.assertIn('Unable to verify node branch through finalized height', str(exception_context.exception))
				self.assertIsInstance(exception_context.exception.__cause__, ValueError)
				self.assertIn(f'height {finalized_height}', str(exception_context.exception.__cause__))
				self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
				self.assertEqual(1, connector.paths.count(f'blocks/{finalized_height}'))
				expected_page_paths = ['blocks?pageSize=100&offset=2&orderBy=height'] if 5 == finalized_height else []
				self.assertEqual(expected_page_paths, [
					path for path in connector.paths if path.startswith('blocks?pageSize=')])

	def test_public_sync_retries_matching_dirty_tail_with_paginated_finality_evidence(self):
		for node_height, finalized_height in ((60, 45), (220, 206)):
			with self.subTest(node_height=node_height, finalized_height=finalized_height):
				# Arrange: the checkpoint is three; saved dirty rows four and five agree with the node.
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				self._seed_blocks(database, [1, 2, 3, 4, 5])
				self._seed_rollback_preservation_rows(database, 4)
				database.upsert_sync_state(create_checkpoint_sync_state(
					3, 3,
					dirty_state_from_height=4,
					status='unhealthy'))
				seed_healthy_refresh_state(database, 'matching-dirty-tail', 5)
				node_blocks = {height: create_node_block(height) for height in range(1, node_height + 1)}
				verification_offsets = list(range(5, finalized_height - 1, 100))
				forward_offsets = list(range(3, node_height, 100))
				pages = {
					offset: [node_blocks[height] for height in range(offset + 1, min(offset + 101, node_height + 1))]
					for offset in set(verification_offsets + forward_offsets)
				}
				connector = FakeConnector(
					node_height, pages, block_by_height=node_blocks, finalized_height=finalized_height)
				before_sync_state = database.get_sync_state()
				self.assertEqual(3, before_sync_state['last_synced_height'])
				self.assertEqual(create_block_hash(3), bytes(before_sync_state['last_synced_block_hash']))
				self.assertEqual(5, database.get_max_block_height())

				# Act:
				self._sync_with_connector(connector)

				# Assert: verification pages precede the forward-sync pages and no block-by-block walk occurs.
				self.assertEqual(list(range(1, node_height + 1)), self._fetch_block_heights(database))
				sync_state = database.get_sync_state()
				self.assertEqual('healthy', sync_state['status'])
				self.assertEqual(finalized_height, sync_state['finalized_height'])
				self.assertEqual(node_height, sync_state['last_synced_height'])
				self.assertIsNone(sync_state['dirty_state_from_height'])
				self.assertEqual('stale', database.get_account_refresh_state()['status'])
				self.assertEqual(1, connector.paths.count('blocks/4'))
				self.assertEqual(1, connector.paths.count('blocks/5'))
				self.assertEqual([], [
					path for path in connector.paths
					if path.startswith('blocks/') and 6 <= int(path.removeprefix('blocks/')) < finalized_height
				])
				self.assertEqual([
					f'blocks?pageSize=100&offset={offset}&orderBy=height'
					for offset in verification_offsets + forward_offsets
				], [path for path in connector.paths if path.startswith('blocks?pageSize=')])

	def test_public_sync_preserves_branch_when_paginated_finality_evidence_is_invalid(self):
		for invalid_page in (
			'boundary_parent', 'finalized_hash', 'missing_height', 'duplicate_height', 'out_of_order',
			'short_middle_page', 'invalid_hash', 'page_fetch_failure', 'empty_page', 'oversized_page'
		):
			with self.subTest(invalid_page=invalid_page):
				# Arrange: the first saved mismatch is at four; finality is across the second page.
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				self._seed_blocks(database, [1, 2, 3, 4, 5])
				self._seed_rollback_preservation_rows(database, 4)
				database.upsert_sync_state(create_checkpoint_sync_state(3, 5))
				seed_healthy_refresh_state(database, 'page-evidence', 5)
				before_state = self._capture_preserved_state()
				node_blocks = {height: create_node_block(height) for height in range(1, 111)}
				node_blocks[4] = create_node_block(4, block_hash='A' * 64)
				node_blocks[5] = create_node_block(5, previous_hash='A' * 64)
				pages = {
					4: [copy.deepcopy(node_blocks[height]) for height in range(5, 105)],
					104: [copy.deepcopy(node_blocks[height]) for height in range(105, 111)]
				}
				if 'boundary_parent' == invalid_page:
					pages[104][0]['block']['previousBlockHash'] = 'B' * 64
				elif 'finalized_hash' == invalid_page:
					pages[104][1]['meta']['hash'] = 'C' * 64
				elif 'missing_height' == invalid_page:
					pages[104].pop(0)
				elif 'duplicate_height' == invalid_page:
					pages[4][1] = copy.deepcopy(pages[4][0])
				elif 'out_of_order' == invalid_page:
					pages[4][1], pages[4][2] = pages[4][2], pages[4][1]
				elif 'short_middle_page' == invalid_page:
					pages[4].pop()
				elif 'invalid_hash' == invalid_page:
					pages[4][0]['meta']['hash'] = 'G' * 64
				elif 'page_fetch_failure' == invalid_page:
					del pages[104]
				elif 'empty_page' == invalid_page:
					pages[4] = []
				else:
					pages[4].append(copy.deepcopy(pages[104][0]))

				connector = FakeConnector(110, pages, block_by_height=node_blocks, finalized_height=106)
				set_symbol_connector(self.puller, connector)

				# Act:
				with self.assertRaisesRegex(SymbolRollbackError, 'Unable to verify node branch through finalized height'):
					asyncio.run(self.puller.sync_block_headers())

				# Assert: no history, current state, or published generation was changed.
				self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
				self.assertFalse(any(path.startswith('blocks?pageSize=100&offset=3&') for path in connector.paths))

	def test_public_sync_repairs_connected_branch_after_paginated_finality_verification(self):
		# Arrange: the replacement at four connects through the page boundary to finalized height 106.
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		self._seed_rollback_preservation_rows(database, 4)
		database.upsert_sync_state(create_checkpoint_sync_state(3, 5))
		seed_healthy_refresh_state(database, 'connected-page-branch', 5)
		before_refresh_state = database.get_account_refresh_state()
		node_blocks = {height: create_node_block(height) for height in range(1, 111)}
		node_blocks[4] = create_node_block(4, block_hash='A' * 64)
		node_blocks[5] = create_node_block(5, previous_hash='A' * 64)
		pages = {
			4: [node_blocks[height] for height in range(5, 105)],
			104: [node_blocks[height] for height in range(105, 111)],
			3: [node_blocks[height] for height in range(4, 104)],
			103: [node_blocks[height] for height in range(104, 111)]
		}
		connector = FakeConnector(110, pages, block_by_height=node_blocks, finalized_height=106)

		# Act:
		self._sync_with_connector(connector)

		# Assert: rollback removed old receipts and invalidated the published account generation.
		self.assertEqual(list(range(1, 111)), self._fetch_block_heights(database))
		self.assertEqual(bytes.fromhex('A' * 64), self._fetch_block_hash(database, 4))
		self.assertEqual([], self._fetch_receipts(database))
		self.assertEqual('healthy', database.get_sync_state()['status'])
		self.assertEqual(106, database.get_sync_state()['finalized_height'])
		self.assertIsNone(database.get_sync_state()['dirty_state_from_height'])
		self.assertEqual('healthy', before_refresh_state['status'])
		self.assertEqual('stale', database.get_account_refresh_state()['status'])
		self.assertEqual([
			'blocks?pageSize=100&offset=4&orderBy=height',
			'blocks?pageSize=100&offset=104&orderBy=height',
			'blocks?pageSize=100&offset=3&orderBy=height',
			'blocks?pageSize=100&offset=103&orderBy=height'
		], [path for path in connector.paths if path.startswith('blocks?pageSize=')])

	def test_public_sync_rejects_preverified_finalized_block_with_unconfirmed_previous_hash(self):
		# Arrange: the finalized hash itself agrees, but the cached block contradicts its confirmed parent.
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3])
		self._seed_rollback_preservation_rows(database, 2)
		seed_healthy_refresh_state(database, 'parent-evidence', 3)
		database.upsert_sync_state(create_sync_state())
		before_state = self._capture_preserved_state()
		connector = FakeConnector(
			3,
			{},
			block_by_height={
				1: create_node_block(1),
				2: create_node_block(2, previous_hash='A' * 64),
				3: create_node_block(3)
			},
			finalized_height=2)
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Unable to verify saved block range') as exception_context:
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertIsInstance(exception_context.exception.__cause__, ValueError)
		self.assertIn('previous hash does not match confirmed parent', str(exception_context.exception.__cause__))
		self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
		self.assertEqual(1, connector.paths.count('blocks/2'))
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks?pageSize=')])

	def test_public_sync_rejects_uncheckpointed_dirty_finalized_block_with_unconfirmed_previous_hash(self):
		# Arrange: a dirty first batch has no checkpoint but still has a verified parent at height one.
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2])
		self._seed_rollback_preservation_rows(database, 2)
		seed_healthy_refresh_state(database, 'dirty-parent-evidence', 2)
		database.upsert_sync_state(create_uncheckpointed_sync_state(
			2,
			status='unhealthy'))
		before_state = self._capture_preserved_state()
		connector = FakeConnector(
			2,
			{},
			block_by_height={1: create_node_block(1), 2: create_node_block(2, previous_hash='A' * 64)},
			finalized_height=2)
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Unable to verify persisted dirty block range') as exception_context:
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertIsInstance(exception_context.exception.__cause__, ValueError)
		self.assertIn('previous hash does not match confirmed parent', str(exception_context.exception.__cause__))
		self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
		self.assertEqual(1, connector.paths.count('blocks/2'))
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks?pageSize=')])

	def test_public_sync_rejects_recorded_anchor_without_checkpoint_for_clean_or_dirty_state(self):
		for dirty_state_from_height in (None, 1):
			with self.subTest(dirty_state_from_height=dirty_state_from_height):
				# Arrange:
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				self._seed_blocks(database, [1, 2, 3, 4, 5])
				database.upsert_sync_state(create_sync_state(
					finalized_height=5,
					finalized_hash=create_block_hash(5),
					last_synced_height=None,
					last_synced_block_hash=None,
					dirty_state_from_height=dirty_state_from_height))
				before_state = self._capture_preserved_state()
				connector = FakeConnector(
					5,
					{},
					block_by_height={5: create_node_block(5)},
					finalized_height=5)

				# Act:
				with self.assertRaises(SymbolRollbackError) as exception_context:
					self._sync_with_connector(connector)

				# Assert: the incomplete checkpoint is rejected before dirty-tail repair or forward sync.
				self.assertIn('Recorded finalized anchor is missing from local sync state', str(exception_context.exception))
				self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
				self.assertEqual([1, 2, 3, 4, 5], self._fetch_block_heights(database))
				self.assertEqual([], [path for path in connector.paths if path.startswith('blocks?pageSize=')])

	def _seed_rollback_mosaic_lookup(self, lookup_response):
		database = self.puller.symbol_db
		mosaic_id = '1234567890ABCDEF'
		self._seed_blocks(database, [1, 2, 3], {2: 'D' * 64})
		database.upsert_sync_state(create_sync_state(last_synced_height=3))
		database.upsert_mosaic(create_expected_mosaic_row(create_mosaic_item(mosaic_id=mosaic_id, supply='123'), 2))
		seed_healthy_refresh_state(database, 'mosaic-lookup', 3)
		replacement = create_node_block(2, block_hash='B' * 64)
		terminal = create_node_block(3, previous_hash='B' * 64)
		connector = FakeConnector(
			3, {1: [replacement, terminal], 2: [terminal]},
			block_by_height={1: create_node_block(1), 2: replacement, 3: terminal},
			finalized_height=3, mosaics_response=[], mosaics_by_id={mosaic_id: lookup_response})
		return mosaic_id, connector

	def test_public_sync_refreshes_rollback_mosaic_missing_from_batch_but_present_by_id(self):
		# Arrange: only the orphaned current row identifies this non-native mosaic.
		database = self.puller.symbol_db
		mosaic_item = create_mosaic_item(mosaic_id='1234567890ABCDEF', supply='777')
		mosaic_id, connector = self._seed_rollback_mosaic_lookup(mosaic_item)

		# Act:
		self._sync_with_connector(connector)

		# Assert: the singleton response replaces the old supply instead of deleting the mosaic.
		self.assertEqual([create_persisted_mosaic_state(create_expected_mosaic_row(mosaic_item, 1), [])], fetch_mosaic_state(database))
		self.assertEqual(['mosaics', f'mosaics/{mosaic_id}'], [
			path for path in connector.paths if path in ('mosaics', f'mosaics/{mosaic_id}')
		])
		self.assertEqual('healthy', database.get_sync_state()['status'])
		self.assertEqual('stale', database.get_account_refresh_state()['status'])

	def test_public_sync_deletes_rollback_mosaic_after_singleton_not_found(self):
		# Arrange: both the batch and the explicit lookup confirm that the old mosaic is gone.
		database = self.puller.symbol_db
		mosaic_id, connector = self._seed_rollback_mosaic_lookup(None)

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([], fetch_mosaic_state(database))
		self.assertEqual(['mosaics', f'mosaics/{mosaic_id}'], [
			path for path in connector.paths if path in ('mosaics', f'mosaics/{mosaic_id}')
		])
		self.assertEqual('healthy', database.get_sync_state()['status'])

	def test_public_sync_preserves_history_and_publication_when_rollback_mosaic_prefetch_fails(self):
		mosaic_id = '1234567890ABCDEF'
		lookup_paths = ['mosaics', f'mosaics/{mosaic_id}']
		invalid_batch_reason = 'Unexpected or duplicate Symbol mosaic in rollback batch response'
		cases = (
			('fetch failure', [], RuntimeError('mosaic lookup unavailable'), RuntimeError, 'mosaic lookup unavailable', lookup_paths),
			('non-object', [], [], ValueError, f'Malformed Symbol mosaic lookup response for {mosaic_id}', lookup_paths),
			('malformed mosaic', [], {'mosaic': None}, ValueError, f'Malformed Symbol mosaic lookup response for {mosaic_id}', lookup_paths),
			('different id', [], create_mosaic_item(mosaic_id='FEDCBA0987654321'), ValueError,
				f'Symbol mosaic lookup returned a different id for {mosaic_id}', lookup_paths),
			('duplicate batch id', [
				create_mosaic_item(mosaic_id=mosaic_id, supply='1'),
				create_mosaic_item(mosaic_id=mosaic_id, supply='2')
			], None, ValueError, invalid_batch_reason, ['mosaics']),
			('unrequested batch id', [create_mosaic_item(mosaic_id='FEDCBA0987654321')], None,
				ValueError, invalid_batch_reason, ['mosaics'])
		)
		for case_name, batch_response, response, exception_type, message, expected_paths in cases:
			with self.subTest(case=case_name):
				# Arrange:
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				_, connector = self._seed_rollback_mosaic_lookup(response)
				connector.mosaics_response = batch_response
				before_state = self._capture_preserved_state()

				# Act:
				with self.assertRaises(exception_type) as context:
					self._sync_with_connector(connector)

				# Assert: failed prefetch retains every row and the published generation.
				self.assertEqual(message, str(context.exception))
				self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
				self.assertEqual(expected_paths, [
					path for path in connector.paths if path in ('mosaics', f'mosaics/{mosaic_id}')
				])

	def test_public_sync_rejects_missing_inflation_native_mosaic_from_bulk_lookup(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3], {2: 'D' * 64})
		database.upsert_sync_state(create_checkpoint_sync_state(1, 3))
		database.upsert_mosaic(create_expected_mosaic_row(create_mosaic_item(NATIVE_MOSAIC_ID), 1))
		database.upsert_receipts_for_height(2, create_receipt_rows(create_amount_statement_item(2, 13)), 0)
		self.assertEqual([], database.get_mosaic_ids_updated_from_height(2))
		self.assertEqual([NATIVE_MOSAIC_ID], database.get_rollback_inflation_mosaic_ids(2))
		before_state = self._capture_preserved_state()
		connector = FakeConnector(
			3,
			{1: [create_node_block(2, block_hash='B' * 64), create_node_block(3, previous_hash='B' * 64)]},
			block_by_height={1: create_node_block(1), 2: create_node_block(2, block_hash='B' * 64), 3: create_node_block(3)},
			mosaics_by_id={},
			finalized_height=1)

		# Act:
		with self.assertRaises(ValueError) as exception_context:
			self._sync_with_connector(connector)

		# Assert: the confirmed singleton mosaic is not deleted based on contradictory bulk evidence.
		self.assertIn('Native mosaic exists by singular lookup but is missing', str(exception_context.exception))
		self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		self.assertEqual(1, connector.paths.count(f'mosaics/{NATIVE_MOSAIC_ID}'))
		self.assertEqual([{'mosaicIds': [NATIVE_MOSAIC_ID]}], [
			payload for path, payload in connector.post_requests if 'mosaics' == path
		])
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks?pageSize=')])

	def test_public_sync_fails_closed_when_orphan_artifact_events_have_missing_current_rows(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3], {2: 'D' * 64})
		database.upsert_sync_state(create_sync_state(last_synced_height=3))
		seed_namespace(
			database,
			create_namespace_item(),
			{NAMESPACE_ROOT_ID: 'surviving-root'},
			1)
		database.upsert_transactions_for_height(2, [
			create_transaction_entry(
				2,
				'vanished-namespace-registration',
				type=TransactionType.NAMESPACE_REGISTRATION.value,
				type_name=TRANSACTION_TYPE_LABELS[TransactionType.NAMESPACE_REGISTRATION.value],
				body={'id': NAMESPACE_ROOT_ID}),
			create_transaction_entry(
				2,
				'vanished-mosaic-definition',
				type=TransactionType.MOSAIC_DEFINITION.value,
				type_name=TRANSACTION_TYPE_LABELS[TransactionType.MOSAIC_DEFINITION.value],
				body={'id': MOSAIC_ID},
				mosaic_rows=[{'mosaic_id': MOSAIC_ID, 'amount': 0, 'role': 'definition', 'position': 0}])
		])
		receipts = create_receipt_rows(create_artifact_expiry_statement(
			2, ReceiptType.NAMESPACE_DELETED.value, NAMESPACE_ROOT_ID))
		receipts.extend(create_receipt_rows(create_artifact_expiry_statement(
			2, ReceiptType.MOSAIC_EXPIRED.value, MOSAIC_ID)))
		database.upsert_receipts_for_height(2, receipts, 0)
		replacement_block = create_node_block(2, block_hash='B' * 64)
		terminal_block = create_node_block(3, previous_hash='B' * 64)
		connector = FakeConnector(
			3,
			{1: [replacement_block, terminal_block]},
			block_by_height={1: create_node_block(1), 2: replacement_block, 3: terminal_block},
			finalized_height=3)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(
			SymbolRollbackError,
			'contains namespace or mosaic events whose missing current state cannot be reconstructed safely'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert: orphan history remains available for a later recovery decision.
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		self.assertEqual('unhealthy', database.get_sync_state()['status'])
		cursor = database.connection.cursor()
		cursor.execute('SELECT type_name FROM symbol_transactions WHERE height = 2 ORDER BY type_name')
		self.assertEqual([
			TRANSACTION_TYPE_LABELS[TransactionType.MOSAIC_DEFINITION.value],
			TRANSACTION_TYPE_LABELS[TransactionType.NAMESPACE_REGISTRATION.value]
		], [row[0] for row in cursor.fetchall()])
		cursor.execute('SELECT receipt_type, artifact_id FROM symbol_receipts WHERE height = 2 ORDER BY receipt_type')
		self.assertEqual([
			('mosaicExpired', MOSAIC_ID),
			('namespaceDeleted', NAMESPACE_ROOT_ID)
		], cursor.fetchall())
		cursor.execute('SELECT namespace_id FROM symbol_namespaces')
		self.assertEqual([(NAMESPACE_ROOT_ID,)], cursor.fetchall())

	def test_public_sync_retains_old_branch_when_artifact_safety_check_fails(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3], {2: 'D' * 64})
		database.upsert_sync_state(create_sync_state(last_synced_height=3))
		replacement_block = create_node_block(2, block_hash='B' * 64)
		terminal_block = create_node_block(3, previous_hash='B' * 64)
		connector = FakeConnector(
			3,
			{1: [replacement_block, terminal_block]},
			block_by_height={1: create_node_block(1), 2: replacement_block, 3: terminal_block},
			finalized_height=3)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with _replace_symbol_database(self.puller, FailingRollbackArtifactStateDatabase(database)):
			with self.assertRaisesRegex(
				SymbolRollbackError,
				'Unable to verify rollback namespace and mosaic state') as exception_context:
				asyncio.run(self.puller.sync_block_headers())

		# Assert: the database read failure remains the cause and the fork is untouched.
		self.assertIsInstance(exception_context.exception.__cause__, RuntimeError)
		self.assertEqual('artifact state gap lookup failed', str(exception_context.exception.__cause__))
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		updated_state = database.get_sync_state()
		self.assertEqual('unhealthy', updated_state['status'])
		self.assertIsNone(updated_state['dirty_state_from_height'])
		self.assertEqual(1, updated_state['finalized_height'])

	def test_public_sync_fails_closed_when_artifact_state_rows_predate_orphan_events(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3], {2: 'D' * 64})
		database.upsert_sync_state(create_sync_state(last_synced_height=3))
		seed_namespace(database, create_namespace_item(), {NAMESPACE_ROOT_ID: 'root'}, 1)
		database.upsert_mosaic(create_expected_mosaic_row(create_mosaic_item(mosaic_id=MOSAIC_ID), 1))
		database.upsert_transactions_for_height(2, [
			create_transaction_entry(
				2,
				'old-height-namespace-alias',
				type=TransactionType.ADDRESS_ALIAS.value,
				type_name=TRANSACTION_TYPE_LABELS[TransactionType.ADDRESS_ALIAS.value],
				body={'namespaceId': NAMESPACE_ROOT_ID}),
			create_transaction_entry(
				2,
				'old-height-mosaic-supply',
				type=TransactionType.MOSAIC_SUPPLY_CHANGE.value,
				type_name=TRANSACTION_TYPE_LABELS[TransactionType.MOSAIC_SUPPLY_CHANGE.value],
				body={'mosaicId': MOSAIC_ID},
				mosaic_rows=[{'mosaic_id': MOSAIC_ID, 'amount': 1, 'role': 'definition', 'position': 0}])
		])
		namespace_before = fetch_namespace_state(database.connection)
		mosaic_before = fetch_mosaic_state(database)
		replacement_block = create_node_block(2, block_hash='B' * 64)
		terminal_block = create_node_block(3, previous_hash='B' * 64)
		connector = FakeConnector(
			3,
			{1: [replacement_block, terminal_block]},
			block_by_height={1: create_node_block(1), 2: replacement_block, 3: terminal_block},
			finalized_height=3)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(
			SymbolRollbackError,
			'contains namespace or mosaic events whose missing current state cannot be reconstructed safely'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert: pre-fork current rows are retained because they were not selected for refetch.
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		self.assertEqual(namespace_before, fetch_namespace_state(database.connection))
		self.assertEqual(mosaic_before, fetch_mosaic_state(database))
		self.assertEqual('unhealthy', database.get_sync_state()['status'])

	def test_public_sync_rejects_invalid_recorded_anchor_shape_without_changing_saved_blocks(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3])
		invalid_states = (
			(create_checkpoint_sync_state(2, 1),
				'Recorded finalized anchor exceeds local saved height'),
			(create_sync_state(finalized_height=None, finalized_hash=create_block_hash(1),
				last_synced_height=1, last_synced_block_hash=create_block_hash(1)),
				'Recorded finalized anchor hash has no height'))

		# Act / Assert:
		for sync_state, expected_error in invalid_states:
			with self.subTest(error=expected_error):
				database.upsert_sync_state(sync_state)
				set_symbol_connector(self.puller, FakeConnector(3, {}, finalized_height=3))
				with self.assertRaisesRegex(SymbolRollbackError, expected_error):
					asyncio.run(self.puller.sync_block_headers())
				self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
				persisted_state = database.get_sync_state()
				self.assertEqual('unhealthy', persisted_state['status'])
				self.assertEqual(sync_state['finalized_height'], persisted_state['finalized_height'])
				self.assertEqual(bytes(sync_state['finalized_hash']), bytes(persisted_state['finalized_hash']))

	def test_public_sync_marks_unhealthy_when_latest_finalized_block_cannot_be_read(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3])
		sync_state = create_sync_state(last_synced_height=3, last_synced_block_hash=create_block_hash(3))
		database.upsert_sync_state(sync_state)
		connector = FakeConnector(
			3,
			{},
			block_by_height={1: create_node_block(1), 3: RuntimeError('latest finality unavailable')},
			finalized_height=3)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(SymbolRollbackError, 'Unable to verify latest node finalized block'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		self.assertEqual('unhealthy', database.get_sync_state()['status'])
		self.assertEqual(1, database.get_sync_state()['finalized_height'])

	def test_public_sync_preserves_primary_anchor_error_when_health_update_fails(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3], {1: 'A' * 64})
		sync_state = create_sync_state(last_synced_height=3, last_synced_block_hash=create_block_hash(3))
		database.upsert_sync_state(sync_state)
		set_symbol_connector(self.puller, FakeConnector(3, {}, finalized_height=3))

		# Act / Assert:
		with patch.object(database, 'upsert_sync_state', side_effect=RuntimeError('health update failed')):
			with self.assertRaisesRegex(
				SymbolRollbackError,
				'Recorded finalized anchor is missing or inconsistent in local database'):
				asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		self.assertEqual('healthy', database.get_sync_state()['status'])
		self.assertEqual(1, database.get_sync_state()['finalized_height'])

	def test_public_sync_marks_unhealthy_when_atomic_rollback_write_fails(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3], {2: 'D' * 64})
		sync_state = create_sync_state(last_synced_height=3, last_synced_block_hash=create_block_hash(3))
		database.upsert_sync_state(sync_state)
		replacement_block = create_node_block(2, block_hash='B' * 64)
		terminal_block = create_node_block(3, previous_hash='B' * 64)
		connector = FakeConnector(
			3,
			{1: [replacement_block, terminal_block]},
			block_by_height={1: create_node_block(1), 2: replacement_block, 3: terminal_block},
			finalized_height=3)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with patch.object(database, 'repair_rollback_from_height', side_effect=RuntimeError('atomic rollback failed')):
			with self.assertRaisesRegex(RuntimeError, 'atomic rollback failed'):
				asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		persisted_state = database.get_sync_state()
		self.assertEqual('unhealthy', persisted_state['status'])
		self.assertEqual(1, persisted_state['finalized_height'])

	def test_public_sync_marks_unhealthy_when_dirty_tail_lookup_fails_without_checkpoint(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1])
		sync_state = create_uncheckpointed_sync_state(1)
		database.upsert_sync_state(sync_state)
		connector = FakeConnector(3, {0: [create_node_block(1), create_node_block(2), create_node_block(3)]}, finalized_height=3)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with patch.object(database, 'get_max_block_height', side_effect=RuntimeError('dirty tail lookup failed')):
			with self.assertRaisesRegex(SymbolRollbackError, 'Unable to verify persisted dirty block range'):
				asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([1], self._fetch_block_heights(database))
		self.assertEqual('unhealthy', database.get_sync_state()['status'])

	def test_public_sync_preserves_checkpoint_and_dirty_marker_when_tail_lookup_fails(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3])
		sync_state = create_sync_state(last_synced_height=3, dirty_state_from_height=2)
		database.upsert_sync_state(sync_state)
		before_state = self._fetch_complete_batch_state()
		connector = FakeConnector(
			3,
			{},
			block_by_height={1: create_node_block(1), 3: create_node_block(3)},
			finalized_height=3)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with patch.object(database, 'get_max_block_height', side_effect=RuntimeError('persisted tail unavailable')):
			with self.assertRaisesRegex(
				SymbolRollbackError,
				'Unable to verify persisted dirty block range') as exception_context:
				asyncio.run(self.puller.sync_block_headers())

		# Assert: the read error remains the cause and only health/timestamp can change.
		self.assertIsInstance(exception_context.exception.__cause__, RuntimeError)
		self.assertEqual('persisted tail unavailable', str(exception_context.exception.__cause__))
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		after_state = self._fetch_complete_batch_state()
		before_sync_state = dict(before_state['symbol_sync_state'][0][0])
		after_sync_state = dict(after_state['symbol_sync_state'][0][0])
		self.assertEqual('unhealthy', after_sync_state['status'])
		self.assertEqual(2, after_sync_state['dirty_state_from_height'])
		self.assertEqual(1, after_sync_state['finalized_height'])
		self.assertEqual(before_sync_state['finalized_hash'], after_sync_state['finalized_hash'])
		self.assertGreaterEqual(
			datetime.fromisoformat(after_sync_state['updated_at']),
			datetime.fromisoformat(before_sync_state['updated_at']))
		before_sync_state.update({'status': 'unhealthy'})
		before_sync_state.pop('updated_at')
		after_sync_state.pop('updated_at')
		before_state['symbol_sync_state'] = [(before_sync_state,)]
		after_state['symbol_sync_state'] = [(after_sync_state,)]
		self.assertEqual(before_state, after_state)

	def test_public_sync_rejects_node_shorter_than_recorded_anchor(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3])
		sync_state = create_checkpoint_sync_state(2, 3)
		database.upsert_sync_state(sync_state)
		connector = FakeConnector(
			1,
			{},
			block_by_height={1: create_node_block(1), 2: create_node_block(2)},
			finalized_height=1)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(SymbolRollbackError, 'Node finalized height is below the recorded finalized height'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		self.assertEqual('unhealthy', database.get_sync_state()['status'])

	def test_public_sync_rejects_dirty_rollback_boundary_at_recorded_anchor(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3])
		sync_state = create_sync_state(last_synced_height=3, dirty_state_from_height=1)
		database.upsert_sync_state(sync_state)
		connector = FakeConnector(
			3,
			{},
			block_by_height={1: create_node_block(1), 2: create_node_block(2), 3: create_node_block(3)},
			finalized_height=1)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(SymbolRollbackError, 'Rollback boundary is at or below recorded finalized height'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		self.assertEqual('unhealthy', database.get_sync_state()['status'])

	def test_public_sync_retries_partial_first_batch_when_dirty_tail_matches_node(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2], {2: 'D' * 64})
		database.upsert_sync_state(create_uncheckpointed_sync_state(
			1,
			status='unhealthy'))
		blocks = [
			create_node_block(1),
			create_node_block(2, block_hash='D' * 64),
			create_node_block(3, previous_hash='D' * 64)]
		connector = FakeConnector(
			3,
			{0: blocks},
			block_by_height=dict(enumerate(blocks, 1)),
			finalized_height=3)

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		sync_state = database.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(3, sync_state['last_synced_height'])
		self.assertIsNone(sync_state['dirty_state_from_height'])
		self.assertEqual(['blocks/1', 'blocks/2', 'blocks/3'], [
			path for path in connector.paths if path.startswith('blocks/')])

	def test_public_sync_fails_closed_for_finalized_lock_event_in_dirty_first_batch_fork(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2], {2: 'D' * 64})
		database.upsert_sync_state(create_uncheckpointed_sync_state(
			1,
			status='unhealthy'))
		database.upsert_transactions_for_height(2, [create_transaction_entry(
			2,
			'partial-first-batch-lock',
			type=TransactionType.HASH_LOCK.value,
			type_name=TRANSACTION_TYPE_LABELS[TransactionType.HASH_LOCK.value],
			signer_address=bytes.fromhex(SIGNER_ADDRESS),
			target_address=bytes.fromhex(RECIPIENT_ADDRESS),
			body={})])
		replacement_block = create_node_block(2, block_hash='B' * 64)
		terminal_block = create_node_block(3, previous_hash='B' * 64)
		connector = FakeConnector(
			3,
			{1: [replacement_block, terminal_block]},
			block_by_height={1: create_node_block(1), 2: replacement_block, 3: terminal_block},
			finalized_height=3)

		# Act / Assert:
		with self.assertRaisesRegex(SymbolRollbackError, 'contains lock events whose pruned state'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1, 2], self._fetch_block_heights(database))
		self.assertEqual('unhealthy', database.get_sync_state()['status'])
		cursor = database.connection.cursor()
		cursor.execute('SELECT id FROM symbol_transactions WHERE height = 2')
		self.assertEqual(1, cursor.rowcount)

	def test_public_sync_rejects_uncheckpointed_dirty_tail_finality_mismatch_or_unavailable_block(self):
		# Arrange:
		database = self._seed_uncheckpointed_dirty_range([1, 2])
		block_cases = (
			(create_node_block(2, block_hash='A' * 64),
				'Node finalized block hash does not match chain info'),
			(RuntimeError('dirty finalized block unavailable'), 'Unable to verify latest node finalized block'))

		# Act / Assert:
		for remote_block, expected_error in block_cases:
			with self.subTest(error=expected_error):
				database.upsert_sync_state(create_uncheckpointed_sync_state(
					1,
					status='unhealthy'))
				connector = FakeConnector(
					2,
					{},
					block_by_height={1: create_node_block(1), 2: remote_block},
					finalized_height=2)
				set_symbol_connector(self.puller, connector)
				with self.assertRaisesRegex(SymbolRollbackError, expected_error):
					asyncio.run(self.puller.sync_block_headers())
				self.assertEqual([1, 2], self._fetch_block_heights(database))
				self.assertEqual('unhealthy', database.get_sync_state()['status'])

	def test_public_sync_preserves_recorded_anchor_when_cap_is_below_anchor_and_uncapped_node_forks(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		self._seed_rollback_preservation_rows(database, 3)
		sync_state = create_checkpoint_sync_state(5, 5)
		database.upsert_sync_state(sync_state)
		before_state = self._capture_preserved_state()

		# Act: a cap below the recorded finalized anchor fails closed.
		capped_connector = FakeConnector(5, {}, block_by_height={5: create_node_block(5)}, finalized_height=5)
		with self.assertRaisesRegex(SymbolRollbackError, 'max_height is below the recorded finalized height'):
			self._sync_with_connector(capped_connector, max_height=2)

		# Act: the uncapped run sees the node's replacement anchor and also preserves history.
		fork_blocks = create_linked_node_blocks(3, 'CDE')
		forked_connector = ChainInfoOverrideConnector(
			5,
			{},
			block_by_height={1: create_node_block(1), 2: create_node_block(2), **fork_blocks},
			finalized_height=5,
			finalized_fields={'hash': fork_blocks[5]['meta']['hash']})
		self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
		self.assertEqual(create_block_hash(3), self._fetch_block_hash(database, 3))
		self.assertEqual(create_block_hash(4), self._fetch_block_hash(database, 4))
		self.assertEqual(create_block_hash(5), self._fetch_block_hash(database, 5))
		with self.assertRaisesRegex(SymbolRollbackError, 'Recorded finalized anchor hash does not match node block'):
			self._sync_with_connector(forked_connector)

		# Assert:
		self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
		self.assertEqual('C' * 64, fork_blocks[3]['meta']['hash'])
		self.assertEqual('C' * 64, fork_blocks[4]['block']['previousBlockHash'])
		self.assertEqual('D' * 64, fork_blocks[5]['block']['previousBlockHash'])
		self.assertEqual(create_block_hash(3), self._fetch_block_hash(database, 3))
		self.assertEqual(create_block_hash(4), self._fetch_block_hash(database, 4))
		self.assertEqual(create_block_hash(5), self._fetch_block_hash(database, 5))

	def test_public_sync_preserves_rows_when_capped_fork_repair_would_delete_above_cap(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		self._seed_rollback_preservation_rows(database, 2)
		database.upsert_sync_state(create_sync_state(last_synced_height=5))
		before_state = self._capture_preserved_state()
		connector = FakeConnector(
			5,
			{},
			block_by_height={
				1: create_node_block(1),
				2: create_node_block(2, block_hash='A' * 64),
				5: create_node_block(5)
			},
			finalized_height=5)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(SymbolRollbackError, 'Rollback would delete persisted blocks above max_height'):
			asyncio.run(self.puller.sync_block_headers(max_height=3))

		# Assert:
		self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})

	def test_public_sync_detects_dirty_tip_beyond_node_and_guards_orphan_expiry_receipt(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5, 6])
		self._seed_rollback_preservation_rows(database, 6)
		database.upsert_sync_state(create_sync_state(
			finalized_height=1,
			finalized_hash=create_block_hash(1),
			last_synced_height=3,
			dirty_state_from_height=4,
			status='unhealthy'))
		database.upsert_receipts_for_height(6, create_receipt_rows(create_artifact_expiry_statement(
			6, ReceiptType.NAMESPACE_DELETED.value, NAMESPACE_ROOT_ID)), 0)
		before_state = self._capture_preserved_state()
		connector = FakeConnector(
			5,
			{},
			block_by_height={height: create_node_block(height) for height in range(1, 6)},
			finalized_height=5)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(
			SymbolRollbackError,
			'contains namespace or mosaic events whose missing current state cannot be reconstructed safely'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
		self.assertEqual([1, 2, 3, 4, 5, 6], self._fetch_block_heights(database))

	@staticmethod
	def _invalid_block_responses(height):
		invalid_responses = []
		for case_name, hash_text in (
			('empty hash', ''),
			('short hash', 'A' * 63),
			('long hash', 'A' * 65),
			('invalid hex', 'Z' * 64)):
			block_response = create_node_block(height)
			block_response['meta']['hash'] = hash_text
			invalid_responses.append((case_name, block_response))

		invalid_responses.append(('wrong height', create_node_block(height + 1)))
		invalid_responses.append(('missing block object', {}))
		float_height_response = create_node_block(height)
		float_height_response['block']['height'] = height + 0.9
		invalid_responses.append(('float height', float_height_response))
		boolean_height_response = create_node_block(height)
		boolean_height_response['block']['height'] = True
		invalid_responses.append(('boolean height', boolean_height_response))
		return invalid_responses

	def test_public_sync_rejects_malformed_finalized_anchor_evidence_without_deleting_history(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3])
		self._seed_rollback_preservation_rows(database, 2)
		database.upsert_sync_state(create_sync_state(last_synced_height=3))
		before_state = self._capture_preserved_state()

		# Act / Assert:
		for case_name, malformed_block in self._invalid_block_responses(1):
			with self.subTest(case=case_name):
				connector = NodeBlockEvidenceConnector(
					3,
					{},
					block_response_overrides={1: malformed_block, 3: create_node_block(3)},
					finalized_height=3)
				set_symbol_connector(self.puller, connector)
				with self.assertRaisesRegex(SymbolRollbackError, 'Unable to verify recorded finalized anchor'):
					asyncio.run(self.puller.sync_block_headers())
				self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})

	def test_public_sync_rejects_malformed_saved_block_evidence_without_deleting_history(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3])
		self._seed_rollback_preservation_rows(database, 2)
		database.upsert_sync_state(create_sync_state(last_synced_height=3))
		before_state = self._capture_preserved_state()

		# Act / Assert:
		for case_name, malformed_block in self._invalid_block_responses(2):
			with self.subTest(case=case_name):
				connector = NodeBlockEvidenceConnector(
					3,
					{},
					block_response_overrides={
						1: create_node_block(1),
						2: malformed_block,
						3: create_node_block(3)
					},
					finalized_height=3)
				set_symbol_connector(self.puller, connector)
				with self.assertRaisesRegex(SymbolRollbackError, 'Unable to verify saved block range'):
					asyncio.run(self.puller.sync_block_headers())
				self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})

	def test_public_sync_rejects_malformed_uncheckpointed_dirty_block_evidence(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1])
		self._seed_rollback_preservation_rows(database, 1)
		database.upsert_sync_state(create_uncheckpointed_sync_state(
			1,
			status='unhealthy'))
		before_state = self._capture_preserved_state()

		# Act / Assert:
		for case_name, malformed_block in self._invalid_block_responses(1):
			with self.subTest(case=case_name):
				connector = NodeBlockEvidenceConnector(
					1,
					{},
					block_response_overrides={1: malformed_block},
					finalized_height=1)
				set_symbol_connector(self.puller, connector)
				with self.assertRaisesRegex(SymbolRollbackError, 'Unable to verify latest node finalized block'):
					asyncio.run(self.puller.sync_block_headers())
				self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})

	def test_public_sync_rejects_malformed_chain_info_hash_variants_before_cap_or_sync_writes(self):
		# Arrange: finalized height five is above cap three, with a checkpoint at height two.
		before, expected = self._prepare_saved_chain_info_rejection(
			[1, 2], create_checkpoint_sync_state(1, 2), preservation_height=2)
		hash_error = ('Symbol block hash must contain exactly 64 hexadecimal characters',)
		invalid_hashes = (
			('null', {'hash': None}, (), ValueError, hash_error),
			('integer type', {'hash': 1}, (), ValueError, hash_error),
			('bytes type', {'hash': b'A' * 32}, (), ValueError, hash_error),
			('empty', {'hash': ''}, (), ValueError, hash_error),
			('short', {'hash': 'A' * 63}, (), ValueError, hash_error),
			('long', {'hash': 'A' * 65}, (), ValueError, hash_error),
			('nonhex', {'hash': 'Z' * 64}, (), ValueError, hash_error),
			('nonascii', {'hash': 'Ａ' * 64}, (), ValueError, hash_error),
			('missing', {}, ('hash',), KeyError, ('hash',))
		)
		for cap in (None, 3):
			for case_name, fields, omitted_fields, cause_type, cause_args in invalid_hashes:
				with self.subTest(cap=cap, case=case_name):
					# Arrange:
					connector = ChainInfoOverrideConnector(
						5, {}, finalized_height=5, finalized_fields=fields, omitted_finalized_fields=omitted_fields)

					# Act / Assert:
					self._assert_chain_info_rejected_before_writes(
						connector, cap, before, expected,
						'Malformed Symbol finalized block in chain info', cause_type, cause_args, ['chain/info'])

	def test_public_sync_preserves_uncheckpointed_dirty_range_when_chain_info_hash_is_null(self):
		# Arrange:
		before, expected = self._prepare_saved_chain_info_rejection(
			[1], create_uncheckpointed_sync_state(1, status='unhealthy'), preservation_height=1)
		connector = ChainInfoOverrideConnector(1, {}, finalized_height=1, finalized_fields={'hash': None})

		# Act / Assert:
		self._assert_chain_info_rejected_before_writes(
			connector, None, before, expected,
			'Malformed Symbol finalized block in chain info', ValueError,
			('Symbol block hash must contain exactly 64 hexadecimal characters',), ['chain/info'])

	def test_public_sync_preserves_recorded_anchor_when_node_finality_regresses(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		self._seed_rollback_preservation_rows(database, 3)
		database.upsert_sync_state(create_checkpoint_sync_state(5, 5))
		before_state = self._capture_preserved_state()
		connector = FakeConnector(5, {}, block_by_height={5: create_node_block(5)}, finalized_height=2)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(SymbolRollbackError, 'Node finalized height is below the recorded finalized height'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})

		# Arrange: the node presents a linked alternative branch ending at a different hash for anchor five.
		fork_blocks = create_linked_node_blocks(3, 'CDE')
		forked_connector = ChainInfoOverrideConnector(
			5,
			{},
			block_by_height={1: create_node_block(1), 2: create_node_block(2), **fork_blocks},
			finalized_height=5,
			finalized_fields={'hash': fork_blocks[5]['meta']['hash']})

		# Act / Assert:
		with self.assertRaisesRegex(SymbolRollbackError, 'Recorded finalized anchor hash does not match node block'):
			self._sync_with_connector(forked_connector)

		# Assert: the second failure also retains all rows, the anchor, and the dirty marker.
		self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})

	def test_public_sync_preserves_dirty_state_when_finality_regresses_without_checkpoint(self):
		# Arrange: a partial state with a recorded anchor and no published tip must fail closed.
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		self._seed_rollback_preservation_rows(database, 3)
		database.upsert_sync_state(create_sync_state(
			finalized_height=5,
			finalized_hash=create_block_hash(5),
			last_synced_height=None,
			last_synced_block_hash=None,
			dirty_state_from_height=1,
			status='unhealthy'))
		before_domain_state = self._capture_preserved_state()
		regressed_connector = FakeConnector(
			5,
			{},
			block_by_height={5: create_node_block(5)},
			finalized_height=2)

		# Act / Assert:
		with self.assertRaisesRegex(SymbolRollbackError, 'Node finalized height is below the recorded finalized height'):
			self._sync_with_connector(regressed_connector)

		# Assert: the incomplete checkpoint and dirty marker remain unchanged.
		self._assert_preserved_state(before_domain_state, {**before_domain_state.sync_state, 'status': 'unhealthy'})

	def test_public_sync_repairs_physical_tail_after_checkpoint_reduced_by_cap(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		self._seed_rollback_preservation_rows(database, 3)
		orphan_address = Network.TESTNET.public_key_to_address(PublicKey('A' * 64)).bytes
		orphan_account_row, orphan_mosaic_rows = create_account_row(
			create_account_item(orphan_address.hex().upper()),
			self.puller.symbol_facade.network,
			3,
			NATIVE_MOSAIC_ID,
			6)
		database.upsert_account_current_state(orphan_account_row, orphan_mosaic_rows)
		database.upsert_multisig(orphan_address, {
			'address': orphan_address,
			'min_approval': 1,
			'min_removal': 1,
			'cosignatory_addresses': [],
			'multisig_addresses': [],
			'updated_at_height': 3
		})
		database.upsert_receipts_for_height(3, create_receipt_rows(create_statement_item(
			3,
			{
				'version': 1,
				'type': ReceiptType.HARVEST_FEE.value,
				'targetAddress': orphan_address.hex().upper(),
				'mosaicId': NATIVE_MOSAIC_ID,
				'amount': '17'
			},
			'old-only-receipt')), 0)
		unrelated_address = Network.TESTNET.public_key_to_address(PublicKey('F' * 64)).bytes
		unrelated_account_row, unrelated_mosaic_rows = create_account_row(
			create_account_item(unrelated_address.hex().upper()),
			self.puller.symbol_facade.network,
			99,
			NATIVE_MOSAIC_ID,
			6)
		database.upsert_account_current_state(unrelated_account_row, unrelated_mosaic_rows)
		database.upsert_multisig(unrelated_address, {
			'address': unrelated_address,
			'min_approval': 2,
			'min_removal': 1,
			'cosignatory_addresses': [],
			'multisig_addresses': [],
			'updated_at_height': 1
		})
		seed_healthy_refresh_state(database, 'physical-tail-test', 5)
		database.upsert_sync_state(create_checkpoint_sync_state(1, 5))
		matching_connector = FakeConnector(
			5,
			{},
			block_by_height={height: create_node_block(height) for height in range(1, 6)},
			finalized_height=5)
		set_symbol_connector(self.puller, matching_connector)

		# Act: the cap moves the checkpoint to two while retaining physical rows three through five.
		asyncio.run(self.puller.sync_block_headers(max_height=2))
		checkpoint_state = database.get_sync_state()
		self.assertEqual(2, checkpoint_state['last_synced_height'])
		self.assertEqual(2, checkpoint_state['finalized_height'])
		self.assertEqual(create_block_hash(2), bytes(checkpoint_state['finalized_hash']))
		self.assertEqual([1, 2, 3, 4, 5], self._fetch_block_heights(database))

		# Arrange: the uncapped node now has a fork beginning at three.
		fork_blocks = create_linked_node_blocks(3, 'CDE')
		forked_connector = ChainInfoOverrideConnector(
			5,
			{
				2: [fork_blocks[3], fork_blocks[4], fork_blocks[5]],
				3: [fork_blocks[4], fork_blocks[5]]
			},
			block_by_height={1: create_node_block(1), 2: create_node_block(2), **fork_blocks},
			finalized_height=5,
			account_by_address={str(Address(orphan_address)): None},
			finalized_fields={'hash': fork_blocks[5]['meta']['hash']})
		cursor = database.connection.cursor()
		cursor.execute('SELECT to_jsonb(row) FROM symbol_accounts AS row WHERE address = %s', (unrelated_address,))
		unrelated_account_before = cursor.fetchone()[0]
		cursor.execute(
			'SELECT to_jsonb(row) FROM symbol_account_mosaics AS row WHERE address = %s',
			(unrelated_address,))
		unrelated_mosaic_before = cursor.fetchall()
		cursor.execute('SELECT to_jsonb(row) FROM symbol_multisig AS row WHERE address = %s', (unrelated_address,))
		unrelated_multisig_before = cursor.fetchone()[0]

		# Act:
		self._sync_with_connector(forked_connector)

		# Assert: saved rows beyond the checkpoint were checked, repaired, and synchronized from the fork.
		self.assertEqual([1, 2, 3, 4, 5], self._fetch_block_heights(database))
		self.assertEqual(bytes.fromhex('C' * 64), self._fetch_block_hash(database, 3))
		self.assertEqual(bytes.fromhex('D' * 64), self._fetch_block_hash(database, 4))
		self.assertEqual(bytes.fromhex('E' * 64), self._fetch_block_hash(database, 5))
		self.assertEqual([], self._fetch_receipts(database))
		cursor.execute('SELECT hash FROM symbol_transactions WHERE height = 3')
		self.assertEqual([], cursor.fetchall())
		cursor.execute('SELECT to_jsonb(row) FROM symbol_accounts AS row WHERE address = %s', (orphan_address,))
		self.assertIsNone(cursor.fetchone())
		cursor.execute('SELECT to_jsonb(row) FROM symbol_account_mosaics AS row WHERE address = %s', (orphan_address,))
		self.assertEqual([], cursor.fetchall())
		cursor.execute('SELECT to_jsonb(row) FROM symbol_multisig AS row WHERE address = %s', (orphan_address,))
		self.assertIsNone(cursor.fetchone())
		cursor.execute('SELECT to_jsonb(row) FROM symbol_accounts AS row WHERE address = %s', (unrelated_address,))
		self.assertEqual(unrelated_account_before, cursor.fetchone()[0])
		cursor.execute(
			'SELECT to_jsonb(row) FROM symbol_account_mosaics AS row WHERE address = %s',
			(unrelated_address,))
		self.assertEqual(unrelated_mosaic_before, cursor.fetchall())
		cursor.execute('SELECT to_jsonb(row) FROM symbol_multisig AS row WHERE address = %s', (unrelated_address,))
		self.assertEqual(unrelated_multisig_before, cursor.fetchone()[0])
		self.assertEqual(5, database.get_sync_state()['last_synced_height'])
		self.assertEqual('healthy', database.get_sync_state()['status'])
		self.assertEqual('stale', database.get_account_refresh_state()['status'])
		self.assertEqual(2, forked_connector.paths.count('accounts'))
		self.assertEqual(
			1,
			forked_connector.paths.count(f'accounts/{Address(orphan_address)}'))

	def test_public_sync_keeps_matching_physical_tail_without_rollback(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		self._seed_rollback_preservation_rows(database, 3)
		database.upsert_sync_state(create_checkpoint_sync_state(1, 5))
		seed_healthy_refresh_state(database, 'matching-tail-test', 5)
		capped_connector = FakeConnector(
			5,
			{},
			block_by_height={height: create_node_block(height) for height in range(1, 6)},
			finalized_height=5)
		set_symbol_connector(self.puller, capped_connector)
		asyncio.run(self.puller.sync_block_headers(max_height=2))

		matching_blocks = [create_node_block(height) for height in range(3, 6)]
		matching_connector = FakeConnector(
			5,
			{2: matching_blocks},
			block_by_height={height: create_node_block(height) for height in range(1, 6)},
			finalized_height=5)

		# Act:
		with patch.object(
			database,
			'repair_rollback_from_height',
			wraps=database.repair_rollback_from_height) as rollback_write:
			self._sync_with_connector(matching_connector)

		# Assert: the retained tail matches the node and no destructive rollback write occurs.
		self.assertEqual(0, rollback_write.call_count)
		self.assertEqual([1, 2, 3, 4, 5], self._fetch_block_heights(database))
		self.assertEqual(create_block_hash(3), self._fetch_block_hash(database, 3))
		self.assertEqual('healthy', database.get_sync_state()['status'])
		self.assertEqual('healthy', database.get_account_refresh_state()['status'])
		self.assertEqual(1, matching_connector.paths.count('blocks/5'))

	def test_public_sync_preserves_physical_history_when_finalized_hash_disagrees_with_block(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		self._seed_rollback_preservation_rows(database, 3)
		seed_healthy_refresh_state(database, 'finality-preservation', 5)
		database.upsert_sync_state(create_checkpoint_sync_state(1, 5))
		cap_connector = FakeConnector(
			5, {}, block_by_height={height: create_node_block(height) for height in range(1, 6)}, finalized_height=5)
		set_symbol_connector(self.puller, cap_connector)
		asyncio.run(self.puller.sync_block_headers(max_height=2))
		before_state = self._capture_preserved_state()
		fork_blocks = create_linked_node_blocks(3, 'CDE')
		connector = ChainInfoOverrideConnector(
			5,
			{2: [fork_blocks[3], fork_blocks[4], fork_blocks[5]]},
			block_by_height={1: create_node_block(1), 2: create_node_block(2), **fork_blocks},
			finalized_height=5,
			finalized_fields={'hash': 'A' * 64})
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(SymbolRollbackError, 'Node finalized block hash does not match chain info'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert: finalized evidence is checked before the earlier fork can delete saved state.
		self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
		self.assertEqual([1, 2, 3, 4, 5], self._fetch_block_heights(database))
		self.assertEqual(1, connector.paths.count('blocks/5'))
		self.assertEqual('healthy', database.get_account_refresh_state()['status'])
		self.assertEqual('finality-preservation', database.get_account_refresh_state()['last_successful_run_id'])
		self.assertEqual(5, database.get_account_refresh_state()['last_completed_height'])

	def test_public_sync_preserves_physical_history_when_finalized_block_evidence_is_unavailable_or_malformed(self):
		for case_name, block_response, expected_error in (
			('request failure', RuntimeError('block lookup failed'), 'Unable to verify latest node finalized block'),
			('malformed height', {'block': {'height': 4}, 'meta': {'hash': f'{5:064X}'}},
				'Unable to verify latest node finalized block'),
			('malformed hash', {'block': {'height': 5}, 'meta': {'hash': 'bad'}},
				'Unable to verify latest node finalized block')
		):
			with self.subTest(case_name=case_name):
				# Arrange:
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				self._seed_blocks(database, [1, 2, 3, 4, 5])
				self._seed_rollback_preservation_rows(database, 3)
				database.upsert_sync_state(create_checkpoint_sync_state(1, 5))
				seed_healthy_refresh_state(database, 'finality-preservation', 5)
				cap_connector = FakeConnector(
					5,
					{},
					block_by_height={height: create_node_block(height) for height in range(1, 6)},
					finalized_height=5)
				set_symbol_connector(self.puller, cap_connector)
				asyncio.run(self.puller.sync_block_headers(max_height=2))
				before_state = self._capture_preserved_state()
				fork_blocks = create_linked_node_blocks(3, 'CDE')
				block_overrides = {1: create_node_block(1), 2: create_node_block(2), **fork_blocks, 5: block_response}
				connector = NodeBlockEvidenceConnector(
					5,
					{2: [fork_blocks[3], fork_blocks[4], fork_blocks[5]]},
					block_response_overrides=block_overrides,
					finalized_height=5)
				set_symbol_connector(self.puller, connector)

				# Act / Assert:
				with self.assertRaisesRegex(SymbolRollbackError, expected_error):
					asyncio.run(self.puller.sync_block_headers())

				# Assert:
				self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
				self.assertEqual([1, 2, 3, 4, 5], self._fetch_block_heights(database))
				self.assertEqual(1, connector.paths.count('blocks/5'))
				self.assertEqual([], [path for path in connector.paths if path.startswith('blocks?pageSize=')])
				self.assertEqual('healthy', database.get_account_refresh_state()['status'])
				self.assertEqual('finality-preservation', database.get_account_refresh_state()['last_successful_run_id'])

	def test_public_sync_reconciles_physical_tail_when_uncapped_node_is_shorter_than_saved_tip(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		self._seed_rollback_preservation_rows(database, 5)
		orphan_address = Network.TESTNET.public_key_to_address(PublicKey('A' * 64)).bytes
		orphan_account_row, orphan_mosaic_rows = create_account_row(
			create_account_item(orphan_address.hex().upper()), self.puller.symbol_facade.network, 5, NATIVE_MOSAIC_ID, 6)
		database.upsert_account_current_state(orphan_account_row, orphan_mosaic_rows)
		database.upsert_multisig(orphan_address, {
			'address': orphan_address, 'min_approval': 1, 'min_removal': 1,
			'cosignatory_addresses': [], 'multisig_addresses': [], 'updated_at_height': 5
		})
		database.upsert_receipts_for_height(5, create_receipt_rows(create_statement_item(
			5,
			{
				'version': 1, 'type': ReceiptType.HARVEST_FEE.value,
				'targetAddress': orphan_address.hex().upper(), 'mosaicId': NATIVE_MOSAIC_ID, 'amount': '17'
			},
			'old-only-shortening-receipt')), 0)
		unrelated_address = Network.TESTNET.public_key_to_address(PublicKey('F' * 64)).bytes
		unrelated_account_row, unrelated_mosaic_rows = create_account_row(
			create_account_item(unrelated_address.hex().upper()), self.puller.symbol_facade.network, 99, NATIVE_MOSAIC_ID, 6)
		database.upsert_account_current_state(unrelated_account_row, unrelated_mosaic_rows)
		database.upsert_multisig(unrelated_address, {
			'address': unrelated_address, 'min_approval': 2, 'min_removal': 1,
			'cosignatory_addresses': [], 'multisig_addresses': [], 'updated_at_height': 1
		})
		seed_healthy_refresh_state(database, 'shortening-test', 5)
		database.upsert_sync_state(create_checkpoint_sync_state(1, 5))
		capped_connector = FakeConnector(
			5, {}, block_by_height={height: create_node_block(height) for height in range(1, 6)}, finalized_height=5)
		set_symbol_connector(self.puller, capped_connector)
		asyncio.run(self.puller.sync_block_headers(max_height=2))
		short_connector = FakeConnector(
			4,
			{},
			block_by_height={height: create_node_block(height) for height in range(1, 5)},
			finalized_height=2,
			account_by_address={str(Address(orphan_address)): None})
		set_symbol_connector(self.puller, short_connector)
		cursor = database.connection.cursor()
		cursor.execute('SELECT to_jsonb(row) FROM symbol_accounts AS row WHERE address = %s', (unrelated_address,))
		unrelated_account_before = cursor.fetchone()[0]
		cursor.execute('SELECT to_jsonb(row) FROM symbol_account_mosaics AS row WHERE address = %s', (unrelated_address,))
		unrelated_mosaics_before = cursor.fetchall()
		cursor.execute('SELECT to_jsonb(row) FROM symbol_multisig AS row WHERE address = %s', (unrelated_address,))
		unrelated_multisig_before = cursor.fetchone()[0]

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([1, 2, 3, 4], self._fetch_block_heights(database))
		self.assertIsNone(database.get_block_hash(5))
		cursor.execute('SELECT id FROM symbol_receipts WHERE height = 5')
		self.assertEqual([], cursor.fetchall())
		cursor.execute('SELECT hash FROM symbol_transactions WHERE height = 5')
		self.assertEqual([], cursor.fetchall())
		cursor.execute('SELECT to_jsonb(row) FROM symbol_accounts AS row WHERE address = %s', (orphan_address,))
		self.assertIsNone(cursor.fetchone())
		cursor.execute('SELECT to_jsonb(row) FROM symbol_account_mosaics AS row WHERE address = %s', (orphan_address,))
		self.assertEqual([], cursor.fetchall())
		cursor.execute('SELECT to_jsonb(row) FROM symbol_multisig AS row WHERE address = %s', (orphan_address,))
		self.assertIsNone(cursor.fetchone())
		self.assertEqual(1, short_connector.paths.count(f'accounts/{Address(orphan_address)}'))
		cursor.execute('SELECT to_jsonb(row) FROM symbol_accounts AS row WHERE address = %s', (unrelated_address,))
		self.assertEqual(unrelated_account_before, cursor.fetchone()[0])
		cursor.execute('SELECT to_jsonb(row) FROM symbol_account_mosaics AS row WHERE address = %s', (unrelated_address,))
		self.assertEqual(unrelated_mosaics_before, cursor.fetchall())
		cursor.execute('SELECT to_jsonb(row) FROM symbol_multisig AS row WHERE address = %s', (unrelated_address,))
		self.assertEqual(unrelated_multisig_before, cursor.fetchone()[0])
		sync_state = database.get_sync_state()
		self.assertEqual(4, sync_state['last_synced_height'])
		self.assertEqual(create_block_hash(4), bytes(sync_state['last_synced_block_hash']))
		self.assertEqual('healthy', sync_state['status'])
		self.assertIsNone(sync_state['dirty_state_from_height'])
		self.assertEqual('stale', database.get_account_refresh_state()['status'])
		self.assertEqual('shortening-test', database.get_account_refresh_state()['last_successful_run_id'])
		self.assertEqual(5, database.get_account_refresh_state()['last_completed_height'])

	def test_public_sync_truncates_physical_tail_when_node_tip_matches_checkpoint(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		database.upsert_sync_state(create_checkpoint_sync_state(1, 5))
		cap_connector = FakeConnector(
			5, {}, block_by_height={height: create_node_block(height) for height in range(1, 6)}, finalized_height=5)
		set_symbol_connector(self.puller, cap_connector)
		asyncio.run(self.puller.sync_block_headers(max_height=2))
		short_connector = FakeConnector(
			2, {}, block_by_height={1: create_node_block(1), 2: create_node_block(2)}, finalized_height=2)
		set_symbol_connector(self.puller, short_connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([1, 2], self._fetch_block_heights(database))
		sync_state = database.get_sync_state()
		self.assertEqual(2, sync_state['last_synced_height'])
		self.assertEqual(create_block_hash(2), bytes(sync_state['last_synced_block_hash']))
		self.assertEqual('healthy', sync_state['status'])
		self.assertIsNone(sync_state['dirty_state_from_height'])
		self.assertEqual([], [path for path in short_connector.paths if path.startswith('blocks?pageSize=')])

	def test_public_sync_checks_finality_beyond_cap_against_uncheckpointed_dirty_physical_tail(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		database.upsert_sync_state(create_uncheckpointed_sync_state(
			5,
			status='unhealthy'))
		before_state = self._capture_preserved_state()
		fork_blocks = {height: create_node_block(height) for height in range(1, 5)}
		connector = ChainInfoOverrideConnector(
			4,
			{},
			block_by_height=fork_blocks,
			finalized_height=4,
			finalized_fields={'hash': 'A' * 64})
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(SymbolRollbackError, 'Node finalized block hash does not match chain info'):
			asyncio.run(self.puller.sync_block_headers(max_height=2))

		# Assert:
		self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
		self.assertEqual([1, 2, 3, 4, 5], self._fetch_block_heights(database))
		self.assertEqual(1, connector.paths.count('blocks/4'))

	def test_public_sync_accepts_integer_block_evidence_height(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3])
		self._seed_rollback_preservation_rows(database, 2)
		database.upsert_sync_state(create_sync_state(last_synced_height=3))
		block_responses = {height: create_node_block(height) for height in (1, 2, 3)}
		for height, block_response in block_responses.items():
			block_response['block']['height'] = height
		connector = NodeBlockEvidenceConnector(
			3,
			{},
			block_response_overrides=block_responses,
			finalized_height=3)
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		self.assertEqual('healthy', database.get_sync_state()['status'])
		self.assertEqual(f'{3:064X}', connector.block_response_overrides[3]['meta']['hash'])

	def test_public_sync_preserves_history_when_capped_rollback_tip_lookup_fails(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		self._seed_rollback_preservation_rows(database, 2)
		database.upsert_sync_state(create_sync_state(last_synced_height=5))
		before_state = self._capture_preserved_state()
		connector = FakeConnector(
			5,
			{},
			block_by_height={1: create_node_block(1), 2: create_node_block(2, block_hash='A' * 64), 5: create_node_block(5)},
			finalized_height=5)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with patch.object(database, 'get_max_block_height', side_effect=RuntimeError('persisted tip unavailable')):
			with self.assertRaisesRegex(
				SymbolRollbackError,
				'Unable to verify persisted block range before capped rollback') as exception_context:
				asyncio.run(self.puller.sync_block_headers(max_height=3))

		# Assert:
		self.assertIsInstance(exception_context.exception.__cause__, RuntimeError)
		self.assertEqual('persisted tip unavailable', str(exception_context.exception.__cause__))
		self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
		self.assertEqual([1, 2, 3, 4, 5], self._fetch_block_heights(database))

	def test_public_sync_preserves_clean_physical_tail_when_tip_lookup_fails(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3, 4, 5])
		self._seed_rollback_preservation_rows(database, 3)
		database.upsert_sync_state(create_sync_state(last_synced_height=2))
		before_state = self._capture_preserved_state()
		connector = FakeConnector(5, {}, block_by_height={1: create_node_block(1)}, finalized_height=5)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with patch.object(database, 'get_max_block_height', side_effect=RuntimeError('persisted tip unavailable')):
			with self.assertRaisesRegex(SymbolRollbackError, 'Unable to verify persisted saved block range') as error:
				asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual('persisted tip unavailable', str(error.exception.__cause__))
		self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})

	def test_public_sync_marks_uncheckpointed_dirty_range_unhealthy_when_saved_block_fetch_fails(self):
		# Arrange:
		database = self._seed_uncheckpointed_dirty_range([1])
		connector = FakeConnector(
			3,
			{},
			block_by_height={1: RuntimeError('dirty saved block unavailable')},
			finalized_height=3)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(SymbolRollbackError, 'Unable to verify persisted dirty block range'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([1], self._fetch_block_heights(database))
		self.assertEqual('unhealthy', database.get_sync_state()['status'])

	def test_public_sync_replays_uncheckpointed_dirty_tail_when_node_is_shorter(self):
		# Arrange:
		database = self._seed_uncheckpointed_dirty_range([1, 2, 3])
		blocks = [create_node_block(1), create_node_block(2)]
		connector = FakeConnector(
			2,
			{0: blocks},
			block_by_height={1: blocks[0], 2: blocks[1]},
			finalized_height=1)
		set_symbol_connector(self.puller, connector)

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1, 2], self._fetch_block_heights(database))
		sync_state = database.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(2, sync_state['last_synced_height'])
		self.assertIsNone(sync_state['dirty_state_from_height'])

	def test_public_sync_rejects_uncheckpointed_dirty_repair_with_unconfirmed_retained_parent(self):
		cases = (
			('mismatched parent', [1, 2, 3], {2: 'D' * 64}, 3, 3),
			('missing parent', [1, 3], {}, 3, 3),
			('shortened repair boundary', [1, 2, 3, 4, 5], {2: 'D' * 64}, 5, 2)
		)
		for case_name, saved_heights, saved_hashes, dirty_height, node_height in cases:
			with self.subTest(case=case_name):
				# Arrange:
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				self._seed_blocks(database, saved_heights, saved_hashes)
				self._seed_rollback_preservation_rows(database, saved_heights[-1])
				seed_healthy_refresh_state(database, 'dirty-parent', saved_heights[-1])
				database.upsert_sync_state(create_uncheckpointed_sync_state(
					dirty_height,
					status='unhealthy'))
				before_state = self._capture_preserved_state()
				node_blocks = {height: create_node_block(height) for height in range(1, node_height + 1)}
				if 'missing parent' != case_name:
					node_blocks[2] = create_node_block(2, block_hash='B' * 64)
				if 3 <= node_height:
					node_blocks[3] = create_node_block(3, previous_hash='B' * 64) \
						if 'missing parent' != case_name else create_node_block(3)
				connector = ChainInfoOverrideConnector(
					node_height, {}, block_by_height=node_blocks, finalized_height=node_height,
					finalized_fields={'hash': node_blocks[node_height]['meta']['hash']} if 2 == node_height else {})
				set_symbol_connector(self.puller, connector)

				# Act:
				with self.assertRaises(SymbolRollbackError) as exception_context:
					asyncio.run(self.puller.sync_block_headers())

				# Assert: the node's parent cannot authorize removal of a different or missing saved parent.
				self.assertIn('Unable to verify retained dirty parent', str(exception_context.exception))
				self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
				self.assertEqual([], [path for path in connector.paths if path.startswith('blocks?pageSize=')])

	def test_public_sync_rejects_unavailable_or_malformed_uncheckpointed_dirty_parent(self):
		malformed_parent = create_node_block(2)
		malformed_parent['meta']['hash'] = 'Z' * 64
		for case_name, parent_response in (
			('unavailable', RuntimeError('dirty parent unavailable')),
			('malformed', malformed_parent)
		):
			with self.subTest(case=case_name):
				# Arrange:
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				self._seed_blocks(database, [1, 2, 3])
				self._seed_rollback_preservation_rows(database, 3)
				seed_healthy_refresh_state(database, 'dirty-parent-response', 3)
				database.upsert_sync_state(create_uncheckpointed_sync_state(
					3,
					status='unhealthy'))
				before_state = self._capture_preserved_state()
				connector = NodeBlockEvidenceConnector(
					3,
					{},
					block_by_height={3: create_node_block(3)},
					block_response_overrides={2: parent_response},
					finalized_height=3)
				set_symbol_connector(self.puller, connector)

				# Act:
				with self.assertRaises(SymbolRollbackError) as exception_context:
					asyncio.run(self.puller.sync_block_headers())

				# Assert:
				self.assertIn('Unable to verify persisted dirty block range', str(exception_context.exception))
				self.assertIsInstance(exception_context.exception.__cause__, RuntimeError if 'unavailable' == case_name else ValueError)
				self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
				self.assertEqual([], [path for path in connector.paths if path.startswith('blocks?pageSize=')])

	def test_public_sync_retries_uncheckpointed_dirty_tail_with_matching_retained_parent(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3])
		database.upsert_sync_state(create_uncheckpointed_sync_state(
			3,
			status='unhealthy'))
		blocks = {height: create_node_block(height) for height in (1, 2, 3)}
		connector = FakeConnector(3, {2: [blocks[3]]}, block_by_height=blocks, finalized_height=3)

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		sync_state = database.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(3, sync_state['finalized_height'])
		self.assertEqual(3, sync_state['last_synced_height'])
		self.assertIsNone(sync_state['dirty_state_from_height'])
		self.assertEqual(1, connector.paths.count('blocks/2'))

	def test_public_sync_shortens_uncheckpointed_dirty_tail_after_confirming_retained_parent(self):
		for node_height in (2, 3):
			with self.subTest(node_height=node_height):
				# Arrange: shortening moves the repair boundary before dirty height five.
				database = self.puller.symbol_db
				drop_symbol_block_tables_if_present(database)
				database.create_tables()
				self._seed_blocks(database, [1, 2, 3, 4, 5])
				database.upsert_sync_state(create_uncheckpointed_sync_state(
					5,
					status='unhealthy'))
				blocks = {height: create_node_block(height) for height in range(1, node_height + 1)}
				connector = FakeConnector(node_height, {}, block_by_height=blocks, finalized_height=2)

				# Act:
				self._sync_with_connector(connector)

				# Assert:
				self.assertEqual(list(range(1, node_height + 1)), self._fetch_block_heights(database))
				sync_state = database.get_sync_state()
				self.assertEqual('healthy', sync_state['status'])
				self.assertEqual(2, sync_state['finalized_height'])
				self.assertEqual(node_height, sync_state['last_synced_height'])
				self.assertIsNone(sync_state['dirty_state_from_height'])
				self.assertEqual(1, connector.paths.count('blocks/2'))
				self.assertEqual(1 if 3 == node_height else 0, connector.paths.count('blocks/3'))
				self.assertEqual([], [path for path in connector.paths if path.startswith('blocks?pageSize=')])

	def test_public_sync_repairs_uncheckpointed_dirty_tail_with_missing_hash_rows_from_marker(self):
		# Arrange: the next persisted block exposes a missing height at the dirty boundary.
		database = self._seed_uncheckpointed_dirty_range([2])
		blocks = [create_node_block(height) for height in (1, 2, 3)]
		connector = FakeConnector(
			3,
			{0: blocks},
			block_by_height=dict(enumerate(blocks, 1)),
			finalized_height=2)
		set_symbol_connector(self.puller, connector)

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		self.assertEqual('healthy', database.get_sync_state()['status'])
		self.assertEqual(3, database.get_sync_state()['last_synced_height'])

	def test_public_sync_replays_dirty_marker_when_hash_scan_omits_a_saved_tail_row(self):
		# Arrange: this models a read race where a hash scan misses a row still present in storage.
		database = self._seed_uncheckpointed_dirty_range([1, 2])
		blocks = [create_node_block(1), create_node_block(2), create_node_block(3)]
		connector = FakeConnector(
			3,
			{0: blocks, 1: blocks[1:]},
			block_by_height=dict(enumerate(blocks, 1)),
			finalized_height=3)
		set_symbol_connector(self.puller, connector)

		# Act:
		with patch.object(database, 'get_block_hashes', return_value=iter([(1, create_block_hash(1))])):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		self.assertEqual('healthy', database.get_sync_state()['status'])
		self.assertIsNone(database.get_sync_state()['dirty_state_from_height'])

	def test_rollback_fetch_failure_keeps_old_branch_for_retry(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2, 3])
		sync_state = create_sync_state(last_synced_height=3, last_synced_block_hash=create_block_hash(3))
		failing_connector = FakeConnector(
			3,
			{},
			account_by_address={self._beneficiary_address_text(): RuntimeError('account fetch failed')})
		set_symbol_connector(self.puller, failing_connector)

		# Act / Assert:
		with self.assertRaisesRegex(RuntimeError, '^account fetch failed$'):
			asyncio.run(self.puller._repair_from_height(2, sync_state, 3))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([1, 2, 3], self._fetch_block_heights(database))
		failed_state = database.get_sync_state()
		self.assertEqual('unhealthy', failed_state['status'])
		self.assertEqual(1, failed_state['finalized_height'])

		# Act: retry with a complete node response.
		retry_connector = FakeConnector(3, {}, finalized_height=3)
		set_symbol_connector(self.puller, retry_connector)
		asyncio.run(self.puller._repair_from_height(2, sync_state, 3))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([1], self._fetch_block_heights(database))
		self.assertEqual('repairing', database.get_sync_state()['status'])

	def test_rollback_database_failure_rolls_back_deletions_and_keeps_retry_anchor(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1, 2])
		sync_state = create_sync_state(last_synced_height=2, last_synced_block_hash=create_block_hash(2))
		database.upsert_sync_state(sync_state)
		refresh_entries = RollbackRefreshEntries(account_entries=[{
			'address': bytes.fromhex(BENEFICIARY_ADDRESS),
			'account_row': {},
			'mosaic_rows': [],
			'overwrite_is_harvesting_active': True,
			'multisig_row': None
		}])

		# Act / Assert:
		with self.assertRaises(KeyError):
			database.repair_rollback_from_height(2, {**sync_state, 'status': 'repairing'}, refresh_entries)

		# Assert:
		self.assertEqual([1, 2], self._fetch_block_heights(database))
		persisted_state = database.get_sync_state()
		self.assertEqual('healthy', persisted_state['status'])
		self.assertEqual(1, persisted_state['finalized_height'])

	def test_sync_block_headers_keeps_checkpoint_and_marker_when_new_finalized_block_hash_is_missing(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1)]}, finalized_height=1)
		database = self.puller.symbol_db
		with _replace_symbol_database(self.puller, MissingNewFinalizedBlockHashDatabase(database)):
			# Act / Assert:
			with self.assertRaisesRegex(SymbolRollbackError, 'Finalized block is missing from local database'):
				self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1], self._fetch_block_heights(database))
		sync_state = database.get_sync_state()
		self.assertEqual('unhealthy', sync_state['status'])
		self.assertIsNone(sync_state['last_synced_height'])
		self.assertIsNone(sync_state['last_synced_block_hash'])
		self.assertEqual(1, sync_state['dirty_state_from_height'])

		# Act: the ordinary dirty repair path rechecks and republishes the batch.
		restart_puller = create_symbol_puller(self.config_ini, 'testnet', connector=connector)
		with restart_puller.symbol_db:
			asyncio.run(restart_puller.sync_block_headers())
			restarted_sync_state = restart_puller.symbol_db.get_sync_state()

		# Assert:
		self.assertEqual(1, restarted_sync_state['last_synced_height'])
		self.assertEqual(create_block_hash(1), bytes(restarted_sync_state['last_synced_block_hash']))
		self.assertIsNone(restarted_sync_state['dirty_state_from_height'])

	def test_sync_block_headers_keeps_previous_watermark_when_next_run_parent_hash_mismatches(self):
		# Arrange:
		first_connector = FakeConnector(1, {0: [create_node_block(1)]})

		# Act:
		self._sync_with_connector(first_connector)

		# Assert:
		first_state = self._fetch_complete_batch_state()
		self.assertEqual(1, self.puller.symbol_db.get_sync_state()['last_synced_height'])

		# Arrange:
		second_connector = FakeConnector(
			2,
			{1: [create_node_block(2, previous_hash='A' * 64)]},
			block_by_height={1: create_node_block(1)})
		set_symbol_connector(self.puller, second_connector)

		# Act / Assert:
		with self.assertRaisesRegex(
			ValueError,
			f'Symbol block chain mismatch at height 2: expected previous hash {1:064X}, got {"A" * 64}'
		):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual(first_state, self._fetch_complete_batch_state())
		self.assertEqual([
			'chain/info',
			'blocks/1',
			'blocks?pageSize=100&offset=1&orderBy=height'
		], second_connector.paths)

	def test_sync_block_headers_persists_importance_block_fields(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(
			1,
			votingEligibleAccountsCount=4,
			harvestingEligibleAccountsCount='17',
			totalVotingBalance='19000235663367',
			previousImportanceBlockHash='86' * 32
		)]})

		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		result = self._fetch_importance_block_fields(self.puller.symbol_db, 1)

		self.assertEqual(4, result[0])
		self.assertEqual(17, result[1])
		self.assertEqual(19000235663367, result[2])
		self.assertEqual(bytes.fromhex('86' * 32), bytes(result[3]))

	def test_sync_block_headers_paginates_by_offset(self):
		# Arrange:
		first_page = [create_node_block(height) for height in range(1, 101)]
		second_page = [create_node_block(101)]
		connector = FakeConnector(101, {0: first_page, 100: second_page})

		# Act:
		_, sync_state = self._sync_with_connector(connector)

		# Assert:
		self.assertIn(
			'blocks?pageSize=100&offset=0&orderBy=height',
			connector.paths
		)
		self.assertIn(
			'blocks?pageSize=100&offset=100&orderBy=height',
			connector.paths
		)
		self.assertEqual(101, sync_state['last_synced_height'])

	def test_sync_block_headers_fetches_multiple_pages_in_single_batch(self):
		# Arrange: 3 pages (offsets 0, 100, 200) within one batch
		first_page = [create_node_block(height) for height in range(1, 101)]
		second_page = [create_node_block(height) for height in range(101, 201)]
		third_page = [create_node_block(201)]
		connector = FakeConnector(
			201,
			{0: first_page, 100: second_page, 200: third_page}
		)

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector)

		# Assert:
		self._assert_sync_request_counts(connector, block_page_count=3, batch_count=1)
		self.assertEqual(list(range(1, 202)), block_heights)
		self.assertEqual(201, sync_state['last_synced_height'])

	def test_sync_block_headers_splits_into_multiple_batches(self):
		# Arrange: 11 pages (offsets 0..1000) requires 2 batches when concurrency=10;
		# last page is short so the early-return path in batch 2 is exercised
		total_pages = BLOCK_PAGE_FETCH_CONCURRENCY + 1
		chain_height = total_pages * 100 - 50
		pages = {
			offset: [
				create_node_block(height)
				for height in range(
					offset + 1,
					min(offset + 101, chain_height + 1)
				)
			]
			for offset in range(0, chain_height, 100)
		}
		connector = FakeConnector(chain_height, pages)

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector)

		# Assert:
		self._assert_sync_request_counts(connector, block_page_count=11, batch_count=2)
		self.assertEqual(list(range(1, chain_height + 1)), block_heights)
		self.assertEqual(chain_height, sync_state['last_synced_height'])
		self.assertEqual('healthy', sync_state['status'])

	def test_sync_block_headers_stops_at_max_height(self):
		# Arrange:
		connector = FakeConnector(
			101,
			{0: [create_node_block(height) for height in range(1, 101)]}
		)

		# Act:
		block_heights, sync_state = self._sync_with_connector(
			connector,
			max_height=2
		)

		# Assert:
		beneficiary_address_text = self._beneficiary_address_text()
		self.assertEqual([
			'chain/info',
			'network/properties',
			f'mosaics/{NATIVE_MOSAIC_ID}',
			'blocks?pageSize=100&offset=0&orderBy=height',
			transaction_path(1, 2),
			statement_path(1, 2),
			'accounts',
			f'account/{beneficiary_address_text}/multisig'
		], connector.paths)
		self.assertEqual([1, 2], block_heights)
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(2, sync_state['chain_height'])
		self.assertEqual(2, sync_state['last_synced_height'])

	def test_sync_block_headers_resumes_clean_checkpoint_to_max_height_below_node_height(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_blocks(database, [1])
		checkpoint_hash = create_block_hash(1)
		database.upsert_sync_state(create_checkpoint_sync_state(
			1, 1,
			chain_height=1,
			finalized_hash=checkpoint_hash,
			last_synced_block_hash=checkpoint_hash))
		connector = FakeConnector(
			3,
			{1: [create_node_block(2)]},
			block_by_height={1: create_node_block(1)},
			finalized_height=3)

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector, max_height=2)

		# Assert:
		self.assertEqual([1, 2], block_heights)
		self.assertEqual(2, sync_state['chain_height'])
		self.assertEqual(2, sync_state['last_synced_height'])
		self.assertEqual(create_block_hash(2), bytes(sync_state['last_synced_block_hash']))
		self.assertEqual(2, sync_state['finalized_height'])
		self.assertEqual(create_block_hash(2), bytes(sync_state['finalized_hash']))
		self.assertIsNone(sync_state['dirty_state_from_height'])
		self.assertIn('blocks?pageSize=100&offset=1&orderBy=height', connector.paths)

	def test_sync_block_headers_caps_finalization_to_max_height(self):
		# Arrange:
		connector = FakeConnector(
			5,
			{0: [create_node_block(height) for height in range(1, 6)]},
			finalized_height=5
		)

		# Act:
		_, sync_state = self._sync_with_connector(connector, max_height=2)

		# Assert:
		self.assertEqual(2, sync_state['chain_height'])
		self.assertEqual(2, sync_state['finalized_height'])
		self.assertEqual(
			create_block_hash(2),
			bytes(sync_state['finalized_hash'])
		)
		self.assertEqual(2, sync_state['finalized_epoch'])
		self.assertIsNone(sync_state['finalized_point'])
		self.assertEqual(2, sync_state['last_synced_height'])

	def test_sync_block_headers_publishes_core_finalization_epoch_for_capped_heights(self):
		# Arrange:
		cases = (
			(1, 1, '4'),
			(2, 2, '4'),
			(4, 2, '4'),
			(5, 3, '4'),
			(2, 2, str((1 << 64) - 1))
		)

		for max_height, expected_epoch, grouping in cases:
			with self.subTest(max_height=max_height, grouping=grouping):
				# Arrange:
				drop_symbol_block_tables_if_present(self.puller.symbol_db)
				self.puller.symbol_db.create_tables()
				node_finalized_height = max_height + 1
				connector = FakeConnector(
					node_finalized_height,
					create_multi_batch_block_pages(node_finalized_height),
					finalized_height=node_finalized_height,
					network_properties=create_network_properties(voting_set_grouping=grouping))

				# Act:
				_, sync_state = self._sync_with_connector(connector, max_height=max_height)

				# Assert:
				self.assertEqual(max_height, sync_state['last_synced_height'])
				self.assertEqual(max_height, sync_state['finalized_height'])
				self.assertEqual(
					create_block_hash(max_height),
					bytes(sync_state['finalized_hash'])
				)
				self.assertEqual(expected_epoch, sync_state['finalized_epoch'])
				self.assertIsNone(sync_state['finalized_point'])
				self.assertEqual('healthy', sync_state['status'])
				self.assertIsNone(sync_state['dirty_state_from_height'])

	def test_sync_block_headers_rejects_missing_or_invalid_grouping_when_finalization_is_capped(self):
		cases = (
			('missing', None, KeyError),
			('zero', '0', ValueError),
			('malformed', 'not-a-grouping', ValueError),
			('negative', '-1', ValueError),
			('null', None, ValueError),
			('boolean', True, ValueError),
			('fraction', 1.5, ValueError),
			('separator', '1_0', ValueError),
			('uint64 overflow', str(1 << 64), ValueError),
		)
		for case_name, grouping, cause_type in cases:
			with self.subTest(grouping=case_name):
				# Arrange:
				network_properties = create_network_properties()
				if 'missing' == case_name:
					del network_properties['chain']['votingSetGrouping']
				else:
					network_properties['chain']['votingSetGrouping'] = grouping
				connector = FakeConnector(
					2,
					{0: [create_node_block(1)]},
					finalized_height=2,
					network_properties=network_properties)
				puller = create_symbol_puller(self.config_ini, 'testnet', connector=connector)

				# Act:
				with puller.symbol_db:
					with self.assertRaises(SymbolRollbackError) as context:
						asyncio.run(puller.sync_block_headers(max_height=1))

					# Assert:
					self.assertEqual('Invalid capped Symbol finalization epoch', str(context.exception))
					self.assertIsInstance(context.exception.__cause__, cause_type)
					self.assertEqual(['chain/info', 'network/properties'], connector.paths)
					self.assertIsNone(puller.symbol_db.get_sync_state())
					self.assertEqual([], self._fetch_block_heights(puller.symbol_db))

	def test_sync_block_headers_calculates_finalization_epoch_at_each_capped_checkpoint(self):
		# Arrange:
		chain_height = 1002
		max_height = 1001
		first_checkpoint_height = BLOCK_PAGE_FETCH_CONCURRENCY * MAX_PAGE_SIZE
		connector = FakeConnector(
			chain_height,
			create_multi_batch_block_pages(chain_height),
			finalized_height=chain_height,
			network_properties=create_network_properties(voting_set_grouping='1000'))
		database = self.puller.symbol_db
		recording_database = RecordingCheckpointDatabase(database)

		# Act:
		with _replace_symbol_database(self.puller, recording_database):
			_, sync_state = self._sync_with_connector(connector, max_height=max_height)

		# Assert:
		self.assertEqual(
			[
				(first_checkpoint_height, first_checkpoint_height, 2, None),
				(max_height, max_height, 3, None)
			],
			[
				(
					state['last_synced_height'],
					state['finalized_height'],
					state['finalized_epoch'],
					state['finalized_point'])
				for state in recording_database.published_states
			])
		self.assertEqual(max_height, sync_state['last_synced_height'])
		self.assertEqual(max_height, sync_state['finalized_height'])
		self.assertEqual(create_block_hash(max_height), bytes(sync_state['finalized_hash']))
		self.assertEqual(3, sync_state['finalized_epoch'])
		self.assertIsNone(sync_state['finalized_point'])
		self.assertIsNone(sync_state['dirty_state_from_height'])

	def test_sync_block_headers_publishes_capped_epoch_without_new_blocks_on_same_limit_rerun(self):
		# Arrange:
		max_height = 1000
		self._seed_blocks(self.puller.symbol_db, range(1, max_height + 1))
		self.puller.symbol_db.upsert_sync_state(create_checkpoint_sync_state(
			max_height, max_height,
			chain_height=max_height,
			finalized_epoch=None,
			finalized_point=None))
		connector = FakeConnector(
			1005,
			{},
			block_by_height={1000: create_node_block(1000)},
			finalized_height=1005,
			network_properties=create_network_properties(voting_set_grouping='1000'))

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector, max_height=max_height)

		# Assert:
		self.assertEqual(list(range(1, max_height + 1)), block_heights)
		self.assertEqual(max_height, sync_state['last_synced_height'])
		self.assertEqual(max_height, sync_state['finalized_height'])
		self.assertEqual(create_block_hash(max_height), bytes(sync_state['finalized_hash']))
		self.assertEqual(2, sync_state['finalized_epoch'])
		self.assertIsNone(sync_state['finalized_point'])
		self.assertEqual(
			['chain/info', 'network/properties', f'mosaics/{NATIVE_MOSAIC_ID}', 'blocks/1000'],
			connector.paths)

	def test_sync_block_headers_continues_from_existing_sync_state(self):
		# Arrange:
		connector = FakeConnector(
			4,
			{2: [create_node_block(3), create_node_block(4)]},
			{1: create_node_block(1), 2: create_node_block(2)}
		)
		self._seed_blocks(self.puller.symbol_db, [1, 2])
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=2,
			last_synced_height=2,
			last_synced_block_hash=create_block_hash(2)
		))
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		block_heights = self._fetch_block_heights(self.puller.symbol_db)
		sync_state = self.puller.symbol_db.get_sync_state()

		beneficiary_address_text = self._beneficiary_address_text()
		self.assertEqual([
			'chain/info',
			'network/properties',
			f'mosaics/{NATIVE_MOSAIC_ID}',
			'blocks/1',
			'blocks/2',
			'blocks?pageSize=100&offset=2&orderBy=height',
			transaction_path(3, 4),
			statement_path(3, 4),
			'accounts',
			f'account/{beneficiary_address_text}/multisig'
		], connector.paths)
		self.assertEqual([1, 2, 3, 4], block_heights)
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(4, sync_state['chain_height'])
		self.assertEqual(4, sync_state['last_synced_height'])
		self.assertEqual(
			create_block_hash(4),
			bytes(sync_state['last_synced_block_hash'])
		)

	def test_sync_block_headers_rejects_cap_below_recorded_finalized_anchor(self):
		# Arrange:
		connector = FakeConnector(5, {}, block_by_height={5: create_node_block(5)}, finalized_height=5)
		self._seed_blocks(self.puller.symbol_db, range(1, 6))
		self.puller.symbol_db.upsert_sync_state(create_checkpoint_sync_state(
			5, 5,
			chain_height=5))
		before_state = self._capture_preserved_state()
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(SymbolRollbackError, 'max_height is below the recorded finalized height'):
			asyncio.run(self.puller.sync_block_headers(max_height=2))

		# Assert:
		self._assert_preserved_state(before_state, {**before_state.sync_state, 'status': 'unhealthy'})
		self.assertEqual([1, 2, 3, 4, 5], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(create_block_hash(5), self._fetch_block_hash(self.puller.symbol_db, 5))

	def test_sync_block_headers_rejects_missing_capped_finalization_hash(self):
		# Arrange:
		connector = FakeConnector(5, {}, finalized_height=5)
		set_symbol_connector(self.puller, connector)
		set_sync_block_pages(
			self.puller,
			AsyncMock(return_value=(None, None))
		)

		# Act / Assert:
		with self.assertRaisesRegex(
			ValueError,
			'Unable to determine finalized hash for height 2'
		):
			asyncio.run(self.puller.sync_block_headers(max_height=2))

		# Assert:
		self.assertIsNone(self.puller.symbol_db.get_sync_state())

	def test_get_receipt_rows_by_height_groups_rows_after_reading_all_pages(self):
		# Arrange:
		first_page = [
			create_amount_statement_item(1, 10),
			create_amount_statement_item(2, 20),
			*[
				create_statement_item(
					3,
					{'version': 1, 'type': ReceiptType.ADDRESS_ALIAS_RESOLUTION.value},
					f'statement-3-address-alias-{index}')
				for index in range(MAX_PAGE_SIZE - 2)
			]
		]
		connector = ResponseConnector({
			statement_path(1, 3, 1): {'data': first_page},
			statement_path(1, 3, 2): {'data': [create_amount_statement_item(2, 30)]}
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		rows_by_height = asyncio.run(self.puller._get_receipt_rows_by_height(1, 3))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([
			statement_path(1, 3, 1),
			statement_path(1, 3, 2)
		], connector.paths)
		self.assertEqual([1, 2], sorted(rows_by_height.keys()))
		self.assertEqual([10], [row['amount'] for row in rows_by_height[1]])
		self.assertEqual([20, 30], [row['amount'] for row in rows_by_height[2]])

	def test_sync_block_batch_upserts_empty_heights_and_writes_previously_fetched_receipts(self):
		# Arrange:
		self._seed_blocks(self.puller.symbol_db, [5, 6, 7])
		block_rows = [
			create_block_row(create_node_block(height), 100, self.puller.symbol_facade.network)
			for height in [5, 6, 7]
		]
		receipt_rows_by_height = {6: create_receipt_rows(create_amount_statement_item(6, 600))}

		# Act:
		self.puller._sync_block_batch(block_rows, {}, receipt_rows_by_height)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([
			(6, 'inflation', 'inflation', 6, 0, '72C0212E67A08BCE', 600)
		], self._fetch_receipts(self.puller.symbol_db))
		self.assertEqual(0, self._fetch_block_reward(self.puller.symbol_db, 5))
		self.assertEqual(600, self._fetch_block_reward(self.puller.symbol_db, 6))
		self.assertEqual(0, self._fetch_block_reward(self.puller.symbol_db, 7))

	def test_sync_block_headers_rejects_malformed_statement_page_response(self):
		# Arrange:
		connector = ResponseConnector({
			'chain/info': {
				'height': '1',
				'latestFinalizedBlock': {
					'finalizationEpoch': 4,
					'finalizationPoint': 5,
					'height': '1',
					'hash': f'{1:064X}'
				}
			},
			'network/properties': create_network_properties(),
			'blocks?pageSize=100&offset=0&orderBy=height': {'data': [create_node_block(1)]},
			transaction_path(1, 1): create_transaction_page([]),
			statement_path(1, 1): {'pagination': {'pageNumber': 1}}
		})

		# Act / Assert:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Malformed Symbol statement page response'
		)

	def test_calculate_block_reward_sums_only_inflation_receipts(self):
		# Arrange:
		receipts = [
			{'receipt_type': 'inflation', 'amount': 11},
			{'receipt_type': 'harvestFee', 'amount': 100},
			{'receipt_type': 'inflation', 'amount': 22}
		]

		# Act:
		block_reward = self.puller._calculate_block_reward(receipts)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(33, block_reward)

	def test_calculate_block_reward_returns_zero_when_inflation_receipts_are_absent(self):
		# Arrange:
		receipts = [
			{'receipt_type': 'harvestFee', 'amount': 100}
		]

		# Act:
		block_reward = self.puller._calculate_block_reward(receipts)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(0, block_reward)

	def test_sync_block_headers_does_not_advance_watermark_when_receipt_range_fetch_fails(self):
		# Arrange:
		connector = ResponseConnector({
			'chain/info': {
				'height': '1',
				'latestFinalizedBlock': {
					'finalizationEpoch': 4,
					'finalizationPoint': 5,
					'height': '1',
					'hash': f'{1:064X}'
				}
			},
			'network/properties': create_network_properties(),
			'blocks?pageSize=100&offset=0&orderBy=height': {'data': [create_node_block(1)]},
			transaction_path(1, 1): create_transaction_page([]),
			statement_path(1, 1): {
				'code': 'InternalError',
				'message': 'statement range failed'
			}
		})
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(NodeException, 'InternalError: statement range failed'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([], self._fetch_block_heights(self.puller.symbol_db))
		self.assertIsNone(self.puller.symbol_db.get_sync_state())
