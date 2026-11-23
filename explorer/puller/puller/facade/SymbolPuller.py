# pylint: disable=too-many-lines

import asyncio
import configparser
import json
import re
import time
import uuid
from collections import defaultdict, namedtuple
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from urllib.parse import urlparse

from common.symbol.NativeMosaic import normalize_mosaic_id, validate_native_mosaic_response
from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from common.symbol.ReceiptTypes import (
	INFLATION_RECEIPT_TYPE,
	MOSAIC_EXPIRED_RECEIPT_TYPE,
	NAMESPACE_DELETED_RECEIPT_TYPE,
	NAMESPACE_EXPIRED_RECEIPT_TYPE
)
from psycopg2 import Error as PsycopgError
from symbolchain.CryptoTypes import Hash256
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.sc import TransactionType
from symbolchain.symbol.Merkle import MerkleHashBuilder
from symbolchain.symbol.Network import Address, Network
from symbollightapi.model.Exceptions import CorruptDataException, NodeException
from zenlog import log

from puller.db.AccountRetentionConfiguration import ACCOUNT_RETENTION_TIME_BUDGET_SECONDS, create_retention_configuration
from puller.db.SymbolDatabase import (
	ForkCheckpointConflict,
	ReconciliationStatementError,
	RollbackHashLockEvidence,
	RollbackRefreshEntries,
	SymbolDatabase
)
from puller.facade.async_utils import CONTROL_FLOW_EXCEPTIONS, gather_in_chunks, log_cleanup_failure_safely, select_exception_by_priority
from puller.facade.ForkReconciliation import (
	MAX_COMMON_POINT_DEPTH,
	BlockDifference,
	EvidenceChanged,
	FinalizedBlock,
	ForkReconciliation,
	ReconciliationBudget,
	ReconciliationBudgetExceeded,
	ReconciliationRange,
	RecoveryStopped,
	ShorteningDeferred,
	SymbolRollbackError
)
from puller.facade.HashLockReplayProof import HashLockReplayProof
from puller.facade.RequestRateLimiter import RequestRateLimiter
from puller.facade.SymbolPullerConnector import SymbolPullerConnector
from puller.facade.SymbolSyncPerformance import SyncPerformance, request_category
from puller.model.symbol.Account import HARVESTING_ACTIVE_WINDOW_DAYS, create_account_row, create_multisig_row
from puller.model.symbol.Block import create_block_row
from puller.model.symbol.BlockCommitment import validate_block_commitment
from puller.model.symbol.ForkRecoveryStopReason import ForkRecoveryStopReason
from puller.model.symbol.format import is_exact_integer
from puller.model.symbol.Lock import (
	RollbackLockKeys,
	create_hash_lock_key,
	create_hash_lock_row,
	create_secret_lock_row,
	create_secret_lock_search_key_from_hex_secret,
	lock_hash_algorithm_label
)
from puller.model.symbol.Metadata import (
	METADATA_TRANSACTION_TYPE_LABELS,
	METADATA_TYPE_NUMBERS,
	canonical_metadata_hex,
	canonical_metadata_key,
	create_metadata_row,
	metadata_target_from_relations
)
from puller.model.symbol.Mosaic import create_mosaic_row
from puller.model.symbol.MosaicRestriction import (
	MOSAIC_RESTRICTION_ENTRY_TYPE_BY_TRANSACTION_TYPE,
	MosaicRestrictionEntryType,
	MosaicRestrictionKey,
	create_mosaic_restriction_key,
	create_mosaic_restriction_row,
	mosaic_restriction_entry_type_to_enum_value
)
from puller.model.symbol.Namespace import create_alias_name_rows, create_namespace_row
from puller.model.symbol.Receipt import create_receipt_rows
from puller.model.symbol.ReceiptCommitment import calculate_receipts_hash
from puller.model.symbol.Resolution import is_alias_mosaic_id, select_resolution_entry
from puller.model.symbol.Transaction import create_transaction_row, unique_address_rows
from puller.model.symbol.TransactionCommitment import UnboundAggregateReason, validate_transaction_commitments

DatabaseConfiguration = namedtuple('DatabaseConfiguration', ['database', 'user', 'password', 'host', 'port'])
TransactionSource = namedtuple('TransactionSource', ['primary_id', 'secondary_id'])
TransactionCountExpectation = namedtuple('TransactionCountExpectation', ['top_level_count', 'total_count'])
ResolutionStatements = namedtuple('ResolutionStatements', ['address', 'mosaic'])
ResolutionRequest = namedtuple('ResolutionRequest', ['height', 'kind'])
SyncChain = namedtuple('SyncChain', ('node_height', 'height', 'finalized', 'max_height'))
RecoveryCandidate = namedtuple('RecoveryCandidate', ('height', 'hash'))
ForkSyncPlan = namedtuple('ForkSyncPlan', (
	'reused_height', 'verified', 'continuity_height', 'repair_checkpoint', 'replacement_replay', 'hash_lock_replay'),
	defaults=(None,) * 6)
ForkRepairPlan = namedtuple('ForkRepairPlan', (
	'height', 'state', 'match', 'chain', 'shortening', 'finality_evidence', 'should_authenticate_replacement'))
ForkRecoveryRelease = namedtuple('ForkRecoveryRelease', ('stop_reason', 'proof'))
RecoveryFinalityEvidence = namedtuple('RecoveryFinalityEvidence', ('checkpoint', 'blocks'))
VerifiedFinalityRange = namedtuple('VerifiedFinalityRange', ('retained_height', 'replacement_blocks'))
RepairBoundaryEvidence = namedtuple('RepairBoundaryEvidence', (
	'shortening', 'fork_height', 'replay_common_height', 'blocks', 'replacement_blocks', 'has_hash_lock_replay'))
PreparedReplacement = namedtuple('PreparedReplacement', (
	'hash_lock_evidence', 'baseline_entries', 'scan', 'hash_lock_replay', 'has_hash_lock_proof'))
ReplacementScanScope = namedtuple('ReplacementScanScope', ('verifiable_receipts', 'has_hash_lock_proof'))
ReplacementReplay = namedtuple('ReplacementReplay', ('blocks', 'verifiable_receipts', 'finalized'))
HashLockReplay = namedtuple('HashLockReplay', ('keys', 'entries', 'transactions', 'receipts', 'proof'))
REPLACEMENT_SCAN_VERSION = 2
HASH_LOCK_REPLACEMENT_SCAN_VERSION = 3
MAX_PAGE_SIZE = 100
MAX_UINT64_VALUE = (1 << 64) - 1
MAX_UINT32_FINALIZATION = (1 << 32) - 1
MAX_POSTGRES_INT_VALUE = (1 << 31) - 1
ACCOUNT_BATCH_FETCH_SIZE = MAX_PAGE_SIZE
BLOCK_PAGE_FETCH_CONCURRENCY = 10
TRANSACTION_PAGE_FETCH_CONCURRENCY = 10
RESOLUTION_FETCH_CONCURRENCY = 10
METADATA_FETCH_CONCURRENCY = 10
LOCK_FETCH_CONCURRENCY = 10
MOSAIC_RESTRICTION_FETCH_CONCURRENCY = 10
DEFAULT_MAX_REQUESTS_PER_SECOND = 20
DEFAULT_MAX_TRANSACTIONS_PER_BATCH = 100_000
ACCOUNT_PAGE_SIZE = 100
NEMESIS_PREVIOUS_BLOCK_HASH = bytes(32)
# Namespace detail and account multisig fetches use one request per item in a max-size batch.
# Pin the pool to that application concurrency policy, even though aiohttp currently has the same default limit.
SYMBOL_HTTP_CONNECTION_POOL_LIMIT = max(
	BLOCK_PAGE_FETCH_CONCURRENCY,
	RESOLUTION_FETCH_CONCURRENCY,
	METADATA_FETCH_CONCURRENCY,
	LOCK_FETCH_CONCURRENCY,
	MOSAIC_RESTRICTION_FETCH_CONCURRENCY,
	MAX_PAGE_SIZE,
	ACCOUNT_BATCH_FETCH_SIZE)


def _get_symbol_network(network_type):
	if 'mainnet' == network_type:
		return Network.MAINNET
	if 'testnet' == network_type:
		return Network.TESTNET

	raise ValueError(f'Unsupported Symbol network "{network_type}". Supported values: mainnet, testnet')


def _raise_if_node_error(response, allow_not_found=False):
	if isinstance(response, dict) and 'code' in response and 'message' in response:
		if allow_not_found and 'ResourceNotFound' == response.get('code'):
			return

		raise NodeException(f'{response["code"]}: {response["message"]}')


def _is_not_found_response(response):
	return isinstance(response, dict) and 'ResourceNotFound' == response.get('code')


class FinalityAheadOfTip(SymbolRollbackError):
	"""Reported finality belongs to a view newer than the reported tip."""

	def __init__(self, finalized):
		super().__init__('Node finalized height exceeds node chain height')
		self.finalized = finalized


class SymbolPuller:  # pylint: disable=too-many-instance-attributes
	"""Facade for pulling data from Symbol network."""

	def __init__(  # pylint: disable=too-many-arguments,too-many-positional-arguments,too-many-locals
		self,
		node_url,
		config_file,
		network_type='mainnet',
		node_config=None,
		max_requests_per_second=DEFAULT_MAX_REQUESTS_PER_SECOND,
		rate_limiter=None,
		time_source=time.monotonic,
		performance_logger=log,
		connector_factory=SymbolPullerConnector,
		cleanup_logger=log,
		max_transactions_per_batch=DEFAULT_MAX_TRANSACTIONS_PER_BATCH,
		retention_time_source=None,
		retention_time_budget_seconds=ACCOUNT_RETENTION_TIME_BUDGET_SECONDS,
		retention_logger=log,
		reconciliation_budget_factory=ReconciliationBudget
	):
		"""Creates a Symbol puller facade object."""

		if not is_exact_integer(max_transactions_per_batch) or max_transactions_per_batch < 1:
			raise ValueError('max_transactions_per_batch must be greater than or equal to 1')

		config = configparser.ConfigParser()
		config.read(config_file)

		db_config = config['symbol_db']

		self._time_source = time_source
		self._performance_logger = performance_logger
		self._cleanup_logger = cleanup_logger
		self._active_performance = None
		self._reconciliation_budget = None
		self._reconciliation_budget_factory = reconciliation_budget_factory
		self.symbol_db = SymbolDatabase(
			DatabaseConfiguration(**db_config),
			commit_observer=self._record_commit,
			time_source=time_source,
			retention_time_source=retention_time_source,
			retention_time_budget_seconds=retention_time_budget_seconds,
			retention_logger=retention_logger,
			retention_config=create_retention_configuration(
				config['symbol_account_retention'] if config.has_section('symbol_account_retention') else None))
		self.node_config = node_config or SymbolNodeConfiguration.from_url(node_url)
		symbol_node_endpoint = self.node_config.assert_request_allowed(self.node_config.base_url)
		self._symbol_connector = connector_factory(
			symbol_node_endpoint,
			self.node_config.timeout_seconds,
			SYMBOL_HTTP_CONNECTION_POOL_LIMIT)
		self.symbol_facade = SymbolFacade(_get_symbol_network(network_type))
		self._retry_delay = 2
		self._rate_limiter = rate_limiter or RequestRateLimiter(max_requests_per_second, time_source=time_source)
		self._max_transactions_per_batch = max_transactions_per_batch
		self._native_mosaic_info = None
		self._network_properties = None

	def _record_performance(self, method_name, *args):
		if self._active_performance is None:
			return

		try:
			getattr(self._active_performance, method_name)(*args)
		except Exception:  # pylint: disable=broad-exception-caught
			# Metrics must not alter synchronization or exception propagation.
			return

	def _record_commit(self, elapsed_seconds, succeeded):
		self._record_performance('record_commit', elapsed_seconds, succeeded)

	def _log_performance_event(self, performance, event_name, status, exception=None):
		try:
			event = performance.event(event_name, status, exception)
			self._performance_logger.info(json.dumps(event, sort_keys=True, separators=(',', ':')))
		except Exception:  # pylint: disable=broad-exception-caught
			# Event construction or logging failure must never replace the synchronization result.
			pass

	async def __aenter__(self):
		"""Enters the puller lifecycle and opens its factory-created node session."""

		try:
			await self._symbol_connector.open()
			self.symbol_db.__enter__()
			return self
		except BaseException as primary_error:  # pylint: disable=broad-exception-caught
			try:
				await self._symbol_connector.close()
			except BaseException as cleanup_error:  # pylint: disable=broad-exception-caught
				selected_error = select_exception_by_priority(primary_error, cleanup_error)
				if selected_error is primary_error:
					if isinstance(cleanup_error, CONTROL_FLOW_EXCEPTIONS):
						raise primary_error from cleanup_error
					log_cleanup_failure_safely(
						self._cleanup_logger,
						f'Failed to close Symbol node session after lifecycle failure: {cleanup_error}')
				else:
					raise cleanup_error
			raise

	async def __aexit__(self, exc_type, exc_value, traceback):
		"""Exits the puller lifecycle without masking an operation or cleanup failure."""

		primary_error = exc_value
		cleanup_error = None
		control_flow_error = None
		try:
			self.symbol_db.__exit__(exc_type, exc_value, traceback)
		except CONTROL_FLOW_EXCEPTIONS as error:
			control_flow_error = select_exception_by_priority(control_flow_error, error)
		except BaseException as error:  # pylint: disable=broad-exception-caught
			cleanup_error = error

		try:
			await self._symbol_connector.close()
		except CONTROL_FLOW_EXCEPTIONS as error:
			control_flow_error = select_exception_by_priority(control_flow_error, error)
		except BaseException as error:  # pylint: disable=broad-exception-caught
			if cleanup_error is None:
				cleanup_error = error
			else:
				log_cleanup_failure_safely(
					self._cleanup_logger,
					f'Failed to close Symbol node session after database cleanup failure: {error}')

		return self._resolve_lifecycle_exit(primary_error, control_flow_error, cleanup_error)

	def _resolve_lifecycle_exit(self, primary_error, control_flow_error, cleanup_error):
		if control_flow_error is not None:
			if select_exception_by_priority(primary_error, control_flow_error) is primary_error:
				if cleanup_error is not None:
					log_cleanup_failure_safely(
						self._cleanup_logger,
						f'Failed to clean up Symbol puller after operation failure: {cleanup_error}')
				return False
			if cleanup_error is not None:
				log_cleanup_failure_safely(
					self._cleanup_logger,
					f'Failed to clean up Symbol puller during interruption: {cleanup_error}')
			raise control_flow_error

		if primary_error is not None:
			if cleanup_error is not None:
				log_cleanup_failure_safely(
					self._cleanup_logger,
					f'Failed to clean up Symbol puller after operation failure: {cleanup_error}')
			return False

		if cleanup_error is not None:
			raise cleanup_error

		return False

	def _validate_symbol_node_path(self, url_path):
		parsed_url = urlparse(url_path)
		if parsed_url.scheme or parsed_url.netloc:
			raise ValueError('Symbol node connector paths must be relative')
		if parsed_url.fragment:
			raise ValueError('Symbol node connector paths must not include fragments')

		normalized_path = url_path.lstrip('/')
		self.node_config.assert_request_allowed(self.node_config.base_url)

		return normalized_path

	async def _retry_operation(  # pylint: disable=too-many-arguments,too-many-positional-arguments
		self,
		operation,
		description,
		retries=3,
		not_found_as_error=True,
		method='GET',
		category='other'
	):
		"""Retries a Symbol node operation with exponential backoff."""

		for attempt_index in range(retries):
			try:
				wait_seconds = await self._rate_limiter.wait_for_turn()
				self._record_performance('record_rate_limit_wait', wait_seconds or 0)
				if self._reconciliation_budget is not None:
					self._reconciliation_budget.charge_attempt()

				self._record_performance('record_request_attempt', method, category)
				response = await operation()
				_raise_if_node_error(response, allow_not_found=not not_found_as_error)
				if not isinstance(response, dict) or 'code' not in response or 'message' not in response:
					self._record_performance('record_request_success')
				return response
			except NodeException as error:
				attempt = attempt_index + 1
				if retries == attempt:
					log.error(f'Failed {description} after {retries} attempts: {error}')
					raise

				wait_time = self._retry_delay * (2 ** attempt_index)
				self._record_performance('record_retry')
				log.warning(f'Error {description} (attempt {attempt}/{retries}): {error}. Retrying in {wait_time}s...')
				await asyncio.sleep(wait_time)

	async def get_symbol_node(self, url_path, property_name=None, not_found_as_error=True):
		"""Validates and dispatches a Symbol node GET request."""

		normalized_path = self._validate_symbol_node_path(url_path)
		return await self._retry_operation(
			lambda: self._symbol_connector.get(normalized_path, property_name, not_found_as_error),
			f'fetching Symbol node path {normalized_path}',
			not_found_as_error=not_found_as_error,
			method='GET',
			category=request_category('GET', normalized_path)
		)

	async def post_symbol_node(self, url_path, request_payload, property_name=None, not_found_as_error=True):
		"""Validates and dispatches a Symbol node POST request."""

		normalized_path = self._validate_symbol_node_path(url_path)
		return await self._retry_operation(
			lambda: self._symbol_connector.post(normalized_path, request_payload, property_name, not_found_as_error),
			f'posting Symbol node path {normalized_path}',
			not_found_as_error=not_found_as_error,
			method='POST',
			category=request_category('POST', normalized_path)
		)

	async def sync_block_headers(self, max_height=None):
		"""Synchronizes Symbol block headers under database workflow exclusion."""

		with self.symbol_db.workflow_lock():
			if max_height is not None:
				self._validate_sync_cap(max_height)

			self.symbol_db.create_tables()
			await self._sync_block_headers_with_performance(max_height)
			self._prune_account_refresh_generations()

	async def recover_fork(self, candidate_height, candidate_hash):
		"""Revalidates a retained candidate before reopening a terminal reconciliation stop."""

		if not is_exact_integer(candidate_height) or candidate_height < 0:
			raise ValueError('candidate_height must be a nonnegative block height')

		candidate = RecoveryCandidate(candidate_height, self._parse_node_block_hash(candidate_hash))
		with self.symbol_db.workflow_lock():
			recovery = self.symbol_db.try_get_fork_recovery_state()
			if not recovery or recovery['stop_reason'] != ForkRecoveryStopReason.EVIDENCE_INVALIDATED:
				raise SymbolRollbackError('Symbol recovery is not stopped by consecutive evidence invalidations')

			state = self._read_fork_sync_state() or self._empty_sync_state()
			chain = await self._read_sync_chain(None)
			release = await self._reconcile_fork(state, recovery, chain, candidate=candidate)
			self.symbol_db.reopen_fork_reconciliation(self._conditional_recovery_snapshot(state, recovery), release.stop_reason, release.proof)

	@staticmethod
	def _conditional_recovery_snapshot(state, recovery):
		return {
			'expected_revision': recovery['block_revision'],
			'expected_sync': (state['last_synced_height'], state['last_synced_block_hash'], state['dirty_state_from_height']),
			'invalidations': recovery['invalidations']
		}

	@staticmethod
	def _try_get_reopened_stop(recovery, is_repair_required):
		if recovery['legacy_tip'] is not None:
			return ForkRecoveryStopReason.MIGRATION_PENDING

		if recovery['resume_height'] is not None:
			return ForkRecoveryStopReason.RESUME_WAIT

		if is_repair_required:
			return ForkRecoveryStopReason.RECONCILIATION_WAIT

		return None

	def _validate_sync_cap(self, max_height):
		if not is_exact_integer(max_height) or max_height < 1:
			raise ValueError('max_height must be greater than or equal to 1')

		if max_height < self.symbol_db.get_maximum_finalized_sync_height():
			raise ValueError('max_height is below the recorded finalized height')

	async def _sync_block_headers_with_performance(self, max_height):
		performance = SyncPerformance(self._time_source)
		self._active_performance = performance
		try:
			await self._sync_block_headers(max_height)
			self._log_performance_event(performance, 'symbol_sync_completed', 'completed')
		except Exception as exception:
			performance.set_failed_phase()
			try:
				sync_state = self.symbol_db.get_sync_state()
				if sync_state:
					self._record_performance('set_last_completed_height', sync_state['last_synced_height'])

				if isinstance(exception, RecoveryStopped):
					self.symbol_db.stop_fork_recovery(exception.reason)
					log.warning(f'Symbol sync stopped ({exception.reason.value}): {exception}')
				elif sync_state and self._should_mark_unhealthy(sync_state, exception):
					self.symbol_db.mark_sync_unhealthy()
			except Exception as state_error:  # pylint: disable=broad-exception-caught
				# Preserve the primary failure if the best-effort failure-state update also fails.
				log.error(f'Failed to record Symbol sync failure: {state_error}')

			self._log_performance_event(performance, 'symbol_sync_failed', 'failed', exception)
			raise
		finally:
			self._active_performance = None

	def _should_mark_unhealthy(self, sync_state, exception):
		if isinstance(exception, FinalityAheadOfTip):
			if sync_state['dirty_state_from_height'] is not None or sync_state['status'] == 'repairing':
				return True

			recovery = self.symbol_db.try_get_fork_recovery_state()
			if recovery and recovery['resume_height'] is not None:
				return True

			height = exception.finalized.height
			saved_hash = self._get_saved_block_hash(height) if height <= (sync_state['last_synced_height'] or 0) else None
			return saved_hash is not None and saved_hash != exception.finalized.hash

		return any((
			isinstance(exception, (SymbolRollbackError, CorruptDataException)),
			sync_state['dirty_state_from_height'] is not None,
			'repairing' == sync_state['status']
		))

	async def _read_sync_chain(self, max_height):
		chain_info = await self.get_symbol_node('/chain/info')
		try:
			node_height = self._parse_node_height(chain_info['height'], 'Malformed Symbol chain height in chain info')
			block = chain_info['latestFinalizedBlock']
			finalized = FinalizedBlock(
				self._parse_node_height(block['height'], 'Malformed Symbol finalized height in chain info'),
				self._parse_node_block_hash(block['hash']),
				self._parse_node_finalization_number(block['finalizationEpoch'], 'finalizationEpoch'),
				self._parse_node_finalization_number(block['finalizationPoint'], 'finalizationPoint'))
			if node_height < 1 or finalized.height < 0:
				raise ValueError('Symbol chain or finalized height is outside the valid range')

			if finalized.height > MAX_UINT64_VALUE:
				raise ValueError('Symbol finalized height exceeds uint64')

			if node_height > MAX_UINT64_VALUE:
				raise ValueError('Symbol chain height exceeds uint64')

			if not finalized.height and finalized.hash != NEMESIS_PREVIOUS_BLOCK_HASH:
				raise ValueError('Symbol zero-height finalized block must have a zero hash')
		except (KeyError, TypeError, ValueError) as exception:
			raise SymbolRollbackError('Malformed Symbol finalized block in chain info') from exception

		if finalized.height > node_height:
			raise FinalityAheadOfTip(finalized)

		height = min(node_height, max_height) if max_height is not None else node_height
		if height > MAX_POSTGRES_INT_VALUE:
			raise SymbolRollbackError('Effective Symbol chain height exceeds PostgreSQL int range')

		if finalized.height <= height and max(finalized.epoch, finalized.point) > MAX_POSTGRES_INT_VALUE:
			raise SymbolRollbackError('Node finalization metadata exceeds PostgreSQL int range')

		return SyncChain(node_height, height, finalized, max_height)

	async def _sync_block_headers(self, max_height):  # pylint: disable=too-many-locals
		"""Runs one non-overlapping Symbol block synchronization attempt."""

		self._record_performance('set_phase', 'chain_info_fetch')
		chain = await self._read_sync_chain(max_height)
		try:
			self._record_performance('set_phase', 'network_properties_fetch')
			epoch_adjustment_seconds = self._parse_epoch_adjustment(await self._get_network_properties())
			self._record_performance('set_phase', 'native_mosaic_fetch')
			native_mosaic_info = await self._get_native_mosaic_info()
		except NodeException as exception:
			self._record_prerequisite_finality_conflict(chain, exception)
			raise

		self._record_performance('set_phase', 'sync_state_read')
		self.symbol_db.initialize_fork_recovery()
		state = self._read_fork_sync_state()
		recovery = self.symbol_db.try_get_fork_recovery_state()

		self._record_performance('set_phase', 'rollback_repair')
		plan = await self._reconcile_fork(state, recovery, chain)
		if plan.repair_checkpoint is not None:
			state, recovery = plan.repair_checkpoint

		resume_height = recovery['resume_height']
		self._guard_resume_height(resume_height, chain)

		current_height = state['last_synced_height'] or 0 if state else 0
		start_height = (plan.reused_height or min(current_height, chain.height)) + 1
		if resume_height is not None:
			# Page validation requires the first committed batch to begin at this height.
			start_height = resume_height

		self._active_performance.set_bounds(start_height, chain.height)
		checkpoint = {
			'state': state,
			'recovery': recovery,
			'chain': chain,
			'verified': plan.verified,
			'continuity_height': plan.continuity_height,
			'expected_revision': recovery['block_revision'],
			'replacement_replay': plan.replacement_replay,
			'hash_lock_replay': plan.hash_lock_replay
		}
		if start_height > chain.height:
			last_height = start_height - 1
			block_hash = self._get_saved_block_hash(last_height)
			self._record_performance('set_phase', 'sync_state_write')
			self._commit_fork_checkpoint(checkpoint, last_height, block_hash)
		else:
			# Reuse is itself a committed checkpoint before fetching any later blocks.
			if plan.reused_height is not None:
				last_height = start_height - 1
				block_hash = self._get_saved_block_hash(last_height) if last_height else None
				self._commit_fork_checkpoint(checkpoint, last_height, block_hash)

			self._record_performance('set_phase', 'block_sync')
			await self._sync_block_pages(start_height, chain.height, epoch_adjustment_seconds, native_mosaic_info, checkpoint)

		self.symbol_db.recover_abandoned_account_refresh()
		committed_height = checkpoint['state']['last_synced_height']
		self._record_performance('set_last_completed_height', committed_height)
		self._record_performance('set_phase', 'finalization_lock_cleanup')
		# Lock endpoints report the live tip. They cannot establish which lifetime exists at a capped checkpoint.
		if committed_height >= checkpoint['chain'].node_height:
			await self._sync_finalization_lock_cleanup(checkpoint['recovery']['verified_height'])

	def _record_prerequisite_finality_conflict(self, chain, failure):
		# A failed setup request cannot establish new history evidence. Classify
		# the observed F only within the saved clean range.
		if isinstance(failure, CorruptDataException) or not 0 < chain.finalized.height <= chain.height:
			return

		try:
			budget = self._reconciliation_budget_factory()
			with self.symbol_db.reconciliation_statements(budget.remaining_ms):
				recovery = self.symbol_db.try_get_fork_recovery_state()
				if not recovery or recovery['legacy_tip'] is not None or recovery['stop_reason'] is not None:
					return

				state = self._read_fork_sync_state()
				if not state or not state['last_synced_height'] or 'healthy' != state['status']:
					return

				saved_height = state['last_synced_height']
				dirty = state['dirty_state_from_height']
				clean_height = saved_height if dirty is None else min(saved_height, dirty - 1)
				comparable_height = min(clean_height, self._get_reconciliation_tip(dirty, chain.max_height))
				if chain.finalized.height > comparable_height:
					return

				self._check_verified_anchor(recovery, saved_height, dirty)
				has_conflict = self._has_retained_finalized_hash_conflict(recovery, chain, comparable_height)

			if has_conflict:
				self._record_rollback_failure(ForkRecoveryStopReason.RECONCILIATION_WAIT, failure)
		except Exception as error:  # pylint: disable=broad-exception-caught
			if isinstance(error, RecoveryStopped):
				if ForkRecoveryStopReason.VERIFIED_ANCHOR_CONFLICT == error.reason:
					self._record_rollback_failure(error.reason, failure)
					return

			log.error(f'Failed to classify a Symbol sync prerequisite failure: {error}')

	def _has_retained_finalized_hash_conflict(self, recovery, chain, retained_height):
		finalized = chain.finalized
		if not 0 < finalized.height <= min(retained_height, chain.height):
			return False

		local_hash = (
			recovery['verified_hash'] if finalized.height == recovery['verified_height'] else self._get_saved_block_hash(finalized.height))
		return local_hash != finalized.hash

	async def _reconcile_fork(self, state, recovery, chain, *, candidate=None):
		budget = self._reconciliation_budget_factory()
		try:
			with self.symbol_db.reconciliation_statements(budget.remaining_ms):
				return await self._prepare_fork_sync(state, recovery, chain, budget, candidate=candidate)
		except ReconciliationStatementError as exception:
			if exception.__cause__ is None:
				raise budget.exhausted() from exception

			raise RecoveryStopped(ForkRecoveryStopReason.RECONCILIATION_WAIT, 'Unable to verify saved block range') from exception.__cause__

	@staticmethod
	def _guard_resume_height(resume_height, chain):
		if resume_height is not None and chain.height < resume_height:
			raise RecoveryStopped(ForkRecoveryStopReason.RESUME_WAIT, f'Symbol repair awaits block {resume_height}')

	async def _prepare_fork_sync(
		self, state, recovery, chain, budget, *, candidate=None
	):  # pylint: disable=too-many-locals,too-many-branches,too-many-statements
		"""Lets a verified checkpoint, pinned comparison, or repair authorize forward sync."""

		if candidate is None:
			ForkReconciliation.check_invalidation_limit(recovery['invalidations'])

		state = state or self._empty_sync_state()
		legacy = recovery['legacy_tip'] is not None
		resume = recovery['resume_height']
		self._guard_resume_height(resume, chain)
		finalized = chain.finalized
		saved_height = state['last_synced_height'] or 0
		dirty = state['dirty_state_from_height']
		clean_saved_height = saved_height if dirty is None else min(saved_height, dirty - 1)
		verified_height = recovery['verified_height'] or 0
		published_height = state['finalized_height'] or 0
		if not legacy and finalized.height < verified_height:
			raise RecoveryStopped(ForkRecoveryStopReason.NODE_BEHIND_VERIFIED, 'Node finalized height is below the verified finalized height')

		physical = self._get_reconciliation_tip(dirty, chain.max_height)
		contiguous_tip = None
		if not legacy:
			self._check_verified_anchor(recovery, saved_height, dirty)
			if candidate is not None or recovery['block_revision'] != recovery['continuity_revision']:
				contiguous_tip = self._get_contiguous_reconciliation_tip(budget)
				if contiguous_tip < verified_height:
					raise RecoveryStopped(
						ForkRecoveryStopReason.VERIFIED_ANCHOR_CONFLICT,
						'Local contiguous Symbol history does not reach the verified finalized height')

		self._check_legacy_state(state, physical, legacy)

		async def read_block(height):
			return await self._read_reconciliation_block(height, budget)

		async def read_page(start, end):
			return await self._read_reconciliation_page(start, end, budget)

		# Observe contradictions before a node read can fail. Promotion still requires chain evidence.
		has_conflicting_history = physical < saved_height or (
			contiguous_tip is not None and contiguous_tip < saved_height) or (
			candidate is None and not legacy and self._has_retained_finalized_hash_conflict(recovery, chain, min(clean_saved_height, physical)))

		async def match_retained(height, expected_hash):
			nonlocal has_conflicting_history
			is_match = await self._matches_retained_block(height, expected_hash, read_block)
			# Matching a reusable checkpoint can extend the comparable range past the saved height.
			has_conflicting_history = has_conflicting_history or not is_match or (
				finalized.height > clean_saved_height and self._has_retained_finalized_hash_conflict(recovery, chain, height))
			return is_match

		if candidate is None and not legacy and not recovery['progress'] and (contiguous_tip is None or contiguous_tip >= saved_height):
			try:
				fast_plan = await self._try_short_reconciliation(state, recovery, chain, physical, read_block, match_retained=match_retained)
			except (CorruptDataException, KeyError, TypeError, ValueError, RuntimeError, PsycopgError) as exception:
				if isinstance(exception, RecoveryStopped):
					raise

				raise RecoveryStopped(ForkRecoveryStopReason.RECONCILIATION_WAIT, 'Unable to verify saved block range') from exception
			except NodeException as exception:
				if has_conflicting_history or dirty is not None or resume is not None:
					self._record_rollback_failure(recovery['stop_reason'] or ForkRecoveryStopReason.RECONCILIATION_WAIT, exception)

				raise

			if fast_plan is not None:
				budget.check_deadline()
				return fast_plan

		has_capped_dirty_tail = dirty is not None and chain.height < chain.node_height and chain.node_height >= dirty
		if has_capped_dirty_tail and resume is None:
			raise RecoveryStopped(ForkRecoveryStopReason.CAP_BLOCKS_DIRTY_REPAIR, 'max_height prevents safe repair of the persisted dirty range')

		comparison_tip = max(physical, saved_height)
		comparison_limit = chain.node_height if chain.node_height < physical else chain.height
		compare_end = min(comparison_tip, comparison_limit)
		search_start = min(clean_saved_height, compare_end)

		if legacy:
			if candidate is not None or recovery['block_revision'] != recovery['continuity_revision']:
				recovery = {**recovery, 'legacy_tip': self._get_contiguous_reconciliation_tip(budget)}

			search_start = min(search_start, finalized.height, recovery['legacy_tip'])
			if published_height:
				search_start = min(search_start, published_height)
		else:
			# A checkpoint certifies its prefix. If an administrator changed history
			# without leaving a writer marker, check the retained prefix before using it.
			if contiguous_tip is not None:
				search_start = min(search_start, contiguous_tip)

			search_start = max(search_start, verified_height)

		search_floor = max(verified_height, search_start - MAX_COMMON_POINT_DEPTH)
		if candidate is not None:
			self._check_recovery_candidate(candidate, verified_height, min(search_start, finalized.height))
			if candidate.height and not await self._matches_retained_block(candidate.height, candidate.hash, read_block):
				raise SymbolRollbackError('Symbol recovery candidate hash does not match the node block')

			# The candidate is part of the proof from the recorded anchor to raw finality.
			search_start = search_floor = verified_height

		scope = ReconciliationRange(
			search_start, search_floor, compare_end, candidate is not None or legacy or dirty is not None and dirty <= finalized.height,
			finalized, recovery['block_revision'])
		candidate_evidence = [candidate.height, candidate.hash.hex()] if candidate is not None else None
		admin = recovery['admin_progress']
		admin_progress = admin['proof'] if admin and admin['candidate'] == candidate_evidence else None
		verifier = ForkReconciliation(self.symbol_db, read_block, read_page, budget, should_persist=candidate is None)
		try:
			match = await self._verify_fork_match(verifier, recovery, scope, admin_progress)
			if candidate is not None and match.height < candidate.height:
				raise SymbolRollbackError('Symbol recovery candidate is not on the retained node branch')

			try:
				plan = await self._plan_fork_match(state, recovery, chain, physical=physical, match=match, read_block=read_block, budget=budget)
				is_repair_required = isinstance(plan, ForkRepairPlan)
				if is_repair_required:
					committed_recovery, replacement_replay, hash_lock_replay = await self._repair_from_height(
						plan, budget, verifier, should_commit=candidate is None)
					if candidate is None:
						return ForkSyncPlan(
							repair_checkpoint=(plan.state, committed_recovery),
							replacement_replay=replacement_replay, hash_lock_replay=hash_lock_replay)

				if candidate is None:
					return plan

				if not is_repair_required:
					finality_evidence = await self._pin_proven_finality(match, chain, read_block)
					await self._recheck_proven_finality(
						finality_evidence, chain, read_block, budget, VerifiedFinalityRange(match.height, {}))

				stop_reason = self._try_get_reopened_stop(recovery, is_repair_required)
				return ForkRecoveryRelease(stop_reason, verifier.admin_progress if stop_reason is not None else None)
			except EvidenceChanged:
				verifier.invalidate(recovery['invalidations'])
				raise
			except ShorteningDeferred:
				verifier.discard(recovery['invalidations'])
				raise
		except (ReconciliationBudgetExceeded, ReconciliationStatementError):
			if candidate is not None and verifier.admin_progress is not None:
				self._save_fork_admin_proof(state, recovery, {'candidate': candidate_evidence, 'proof': verifier.admin_progress})

			raise
		except (EvidenceChanged, ShorteningDeferred):
			if admin_progress is not None:
				self._save_fork_admin_proof(state, recovery, None)

			raise
		except (NodeException, FinalityAheadOfTip) as exception:
			if candidate is None:
				if has_conflicting_history or verifier.has_conflicting_history or isinstance(exception, CorruptDataException):
					self._record_rollback_failure(recovery['stop_reason'] or ForkRecoveryStopReason.RECONCILIATION_WAIT, exception)
				else:
					self._handle_transient_comparison_failure(state, recovery, verifier.saved_progress, exception)

			raise

	def _handle_transient_comparison_failure(self, state, recovery, progress, exception):
		if recovery['stop_reason'] is not None or state['dirty_state_from_height'] is not None or 'repairing' == state['status']:
			self._record_rollback_failure(recovery['stop_reason'] or ForkRecoveryStopReason.RECONCILIATION_WAIT, exception)
			return

		if 'healthy' != state['status'] or recovery['progress'] is not None or progress is None:
			return

		try:
			with self.symbol_db.independent_reconciliation():
				snapshot = self._conditional_recovery_snapshot(state, recovery)
				if not self.symbol_db.discard_transient_fork_progress(snapshot, progress):
					self.symbol_db.mark_sync_unhealthy()
		except Exception as error:  # pylint: disable=broad-exception-caught
			log.error(f'Failed to discard transient Symbol comparison: {error}')

	def _save_fork_admin_proof(self, state, recovery, proof):
		with self.symbol_db.independent_reconciliation():
			self.symbol_db.save_fork_admin_proof(self._conditional_recovery_snapshot(state, recovery), proof)

	@staticmethod
	async def _verify_fork_match(verifier, recovery, scope, admin_progress):
		try:
			return await verifier.verify(recovery, scope, admin_progress)
		except (CorruptDataException, KeyError, TypeError, ValueError, RuntimeError, PsycopgError) as exception:
			if isinstance(exception, RecoveryStopped):
				raise

			raise RecoveryStopped(ForkRecoveryStopReason.RECONCILIATION_WAIT, 'Unable to verify saved block range') from exception

	def _check_recovery_candidate(self, candidate, verified_height, search_start):
		if not verified_height <= candidate.height <= search_start:
			raise SymbolRollbackError('Symbol recovery candidate is outside the retained finalized range')

		local_hash = self._get_saved_block_hash(candidate.height) if candidate.height else NEMESIS_PREVIOUS_BLOCK_HASH
		if local_hash != candidate.hash:
			raise SymbolRollbackError('Symbol recovery candidate hash does not match the retained block')

	def _get_contiguous_reconciliation_tip(self, budget):
		with budget.exclude_time(), self.symbol_db.independent_reconciliation():
			return self.symbol_db.get_contiguous_block_tip()

	def _get_reconciliation_tip(self, dirty, max_height):
		try:
			return self.symbol_db.get_max_block_height() or 0
		except (PsycopgError, RuntimeError) as exception:
			if max_height is not None:
				message = 'Unable to verify persisted block range before capped rollback'
			elif dirty is not None:
				message = 'Unable to verify persisted dirty block range'
			else:
				message = 'Unable to verify persisted saved block range'

			raise RecoveryStopped(ForkRecoveryStopReason.RECONCILIATION_WAIT, message) from exception

	def _check_verified_anchor(self, recovery, saved_height, dirty):
		height = recovery['verified_height']
		if height > saved_height or dirty is not None and height >= dirty:
			raise RecoveryStopped(ForkRecoveryStopReason.VERIFIED_ANCHOR_CONFLICT, 'Verified finalization exceeds the saved clean checkpoint')

		if height and self._get_saved_block_hash(height) != recovery['verified_hash']:
			raise RecoveryStopped(ForkRecoveryStopReason.VERIFIED_ANCHOR_CONFLICT, 'Verified finalized hash is inconsistent in the local database')

	def _check_legacy_state(self, state, physical, legacy):
		if not legacy:
			return

		height = state['finalized_height']
		block_hash = state['finalized_hash']
		saved_height = state['last_synced_height'] or 0
		dirty = state['dirty_state_from_height']
		if height and not saved_height:
			raise RecoveryStopped(ForkRecoveryStopReason.LEGACY_CHECKPOINT_MISSING, 'Recorded finalized anchor is missing from local sync state')

		if height and (not block_hash or self._get_saved_block_hash(height) != block_hash):
			raise RecoveryStopped(
				ForkRecoveryStopReason.LEGACY_PUBLIC_HASH_CONFLICT,
				'Recorded finalized anchor is missing or inconsistent in local database')

		invalid_zero_anchor = 0 == height and block_hash != NEMESIS_PREVIOUS_BLOCK_HASH
		missing_anchor = height is None and (block_hash is not None or saved_height)
		untracked_history = not saved_height and physical and dirty is None
		if invalid_zero_anchor:
			raise RecoveryStopped(ForkRecoveryStopReason.LEGACY_CHECKPOINT_MISSING, 'Recorded zero-height finalized anchor has an inconsistent hash')

		if missing_anchor or untracked_history:
			raise RecoveryStopped(ForkRecoveryStopReason.LEGACY_CHECKPOINT_MISSING, 'Legacy Symbol history has no consistent checkpoint')

	async def _try_short_reconciliation(  # pylint: disable=too-many-arguments,too-many-return-statements
		self, state, recovery, chain, physical, read_block, *, match_retained
	):
		saved = state['last_synced_height'] or 0
		dirty = state['dirty_state_from_height']
		resume = recovery['resume_height']
		if dirty is not None or resume is not None or recovery['block_revision'] != recovery['continuity_revision']:
			return None

		if not physical and not saved:
			return ForkSyncPlan()

		reusable = recovery['reusable_height']
		if reusable and physical == reusable and chain.height <= saved < reusable <= chain.node_height \
			and await match_retained(saved, state['last_synced_block_hash']):
			await self._check_synced_finality(chain, saved, read_block, known_hash=state['last_synced_block_hash'])
			return ForkSyncPlan(continuity_height=recovery['continuity_height'])

		upper_checkpoint_in_range = reusable and saved < reusable == physical <= chain.height
		has_reusable_continuity = recovery['continuity_height'] == reusable
		can_reuse = upper_checkpoint_in_range and has_reusable_continuity
		if can_reuse:
			can_reuse = self._get_saved_block_hash(reusable) == recovery['reusable_hash']

		if can_reuse:
			if await match_retained(reusable, recovery['reusable_hash']):
				await self._check_synced_finality(chain, reusable, read_block, known_hash=recovery['reusable_hash'])
				return ForkSyncPlan(reused_height=reusable, continuity_height=reusable)

		if physical == saved <= chain.node_height and recovery['continuity_height'] == saved:
			if await match_retained(saved, state['last_synced_block_hash']):
				await self._check_synced_finality(chain, saved, read_block, known_hash=state['last_synced_block_hash'])
				return ForkSyncPlan(continuity_height=saved)

		return None

	async def _matches_retained_block(self, height, expected_hash, read_block):
		if self._get_saved_block_hash(height) != expected_hash:
			return False

		parent_hash = NEMESIS_PREVIOUS_BLOCK_HASH if 1 == height else self._get_saved_block_hash(height - 1)
		return (await read_block(height)) == (expected_hash, parent_hash)

	async def _check_synced_finality(self, chain, saved, read_block, *, known_hash=None):
		finalized = chain.finalized
		if 0 < finalized.height <= min(saved, chain.height):
			try:
				evidence = None if finalized.height == saved and known_hash is not None else await read_block(finalized.height)
				remote_hash = evidence[0] if evidence is not None else known_hash
			except (KeyError, TypeError, ValueError) as exception:
				raise RecoveryStopped(ForkRecoveryStopReason.RECONCILIATION_WAIT, 'Unable to verify saved block range') from exception

			if remote_hash != finalized.hash or self._get_saved_block_hash(finalized.height) != finalized.hash:
				raise RecoveryStopped(ForkRecoveryStopReason.FINALIZED_HASH_CONFLICT, 'Node finalized block hash does not match saved Symbol history')

			return evidence

		return None

	async def _plan_fork_match(
		self, state, recovery, chain, *, physical, match, read_block, budget
	):  # pylint: disable=too-many-arguments,too-many-branches,too-many-locals
		legacy = recovery['legacy_tip'] is not None
		published = state['finalized_height'] or 0
		saved = state['last_synced_height'] or 0
		dirty = state['dirty_state_from_height']
		fork = match.fork_height
		shortening = chain.node_height + 1 if chain.node_height < physical else None
		repair = min((height for height in (fork, shortening, dirty) if height is not None), default=None)
		generation_rollback_height = fork or repair
		if saved and repair is not None:
			# Replay any incompletely written prefix, while preserving generations before the actual fork.
			repair = min(repair, saved + 1)

		if legacy:
			if published > match.finalized.height and (fork is None or fork > match.finalized.height):
				raise RecoveryStopped(
					ForkRecoveryStopReason.LEGACY_NODE_BEHIND_PUBLIC,
					'Node finalization cannot justify changing the legacy public checkpoint')

			if repair is not None and repair <= published and not self._is_finalized_fork_boundary(match, repair):
				raise RecoveryStopped(ForkRecoveryStopReason.LEGACY_FORK_UNPROVEN, 'Node finalization does not establish the legacy rollback boundary')

			if saved and fork is not None and dirty is not None and dirty < fork:
				raise RecoveryStopped(ForkRecoveryStopReason.LEGACY_DIRTY_BEFORE_FORK, 'Legacy dirty writes precede the proven Symbol fork')

			if not saved and repair is not None and dirty is not None:
				retained_boundary = min(dirty, chain.node_height + 1) - 1
				if match.height < retained_boundary:
					raise RecoveryStopped(ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING, 'Unable to verify retained dirty parent')

			if chain.height < chain.finalized.height:
				raise RecoveryStopped(ForkRecoveryStopReason.MIGRATION_PENDING, 'max_height prevents verification of the legacy finalized checkpoint')

		if repair is None:
			synced_finality = None
			if not legacy or match.finalized.height != chain.finalized.height:
				synced_finality = await self._check_synced_finality(chain, min(match.height, saved), read_block)

			if match.finalized.height < chain.finalized.height <= chain.height:
				finality_evidence = await self._pin_proven_finality(match, chain, read_block, synced_finality)
				await self._recheck_proven_finality(
					finality_evidence, chain, read_block, budget, VerifiedFinalityRange(match.height, {}))

			verified = self._try_get_retained_finality(chain, match, min(saved, chain.height), recovery['verified_height'])
			if legacy and (verified is None or published > verified.height):
				raise RecoveryStopped(
					ForkRecoveryStopReason.LEGACY_CHECKPOINT_MISSING,
					'Legacy public finalization exceeds the verified saved checkpoint')

			continuity_height = match.height
			if legacy and recovery['legacy_tip'] >= saved and self._get_saved_block_hash(saved) == state['last_synced_block_hash']:
				continuity_height = max(continuity_height, saved)

			budget.check_deadline()
			return ForkSyncPlan(verified=verified, continuity_height=continuity_height)

		if chain.max_height is not None and physical > chain.max_height and repair <= physical:
			raise RecoveryStopped(ForkRecoveryStopReason.CAP_BLOCKS_DIRTY_REPAIR, 'Rollback would delete persisted blocks above max_height')

		observed_height = repair - 1
		synced_finality = None
		if not legacy or match.finalized.height != chain.finalized.height:
			synced_finality = await self._check_synced_finality(chain, observed_height, read_block)

		verified = self._try_get_retained_finality(chain, match, observed_height, recovery['verified_height'])
		finality_evidence = await self._pin_proven_finality(match, chain, read_block, synced_finality)
		repair_state = self._create_fork_repair_state(state, recovery, chain, observed_height, verified)
		repair_state['generation_rollback_height'] = generation_rollback_height
		should_authenticate_replacement = repair <= chain.height
		return ForkRepairPlan(repair, repair_state, match, chain, shortening, finality_evidence, should_authenticate_replacement)

	@staticmethod
	def _is_finalized_fork_boundary(match, repair):
		return repair == match.fork_height and match.difference == BlockDifference.HASH_MISMATCH and (
			repair <= match.finalized.height and match.has_finality_evidence)

	def _try_get_retained_finality(self, chain, match, retained_height, verified_height):
		if chain.height < chain.finalized.height or not match.has_finality_evidence:
			return None

		height = min(retained_height, match.height, match.finalized.height)
		if verified_height is not None and height <= verified_height:
			return None

		if height == match.finalized.height:
			return match.finalized

		block_hash = self._get_saved_block_hash(height) if height else NEMESIS_PREVIOUS_BLOCK_HASH
		return FinalizedBlock(height, bytes(block_hash), None, None)

	def _create_fork_repair_state(self, state, recovery, chain, retained_height, verified):
		verified = verified or self._recorded_finality(recovery)
		block_hash = self._get_saved_block_hash(retained_height) if retained_height else None
		resume_height = retained_height + 1 if retained_height < chain.node_height else None
		new_recovery = self._with_finality(
			recovery, verified, continuity_height=retained_height, reusable_height=None, reusable_hash=None,
			resume_height=resume_height, stop_reason=ForkRecoveryStopReason.RESUME_WAIT if resume_height is not None else None,
			expected_revision=recovery['block_revision'],
			expected_sync=(state['last_synced_height'], state['last_synced_block_hash'], state['dirty_state_from_height']))
		published = self._published_finality(state)
		if published.height is not None and published.height > retained_height:
			published = verified

		return {
			**state, 'status': 'repairing', 'chain_height': chain.height,
			'last_synced_height': retained_height or None, 'last_synced_block_hash': block_hash,
			'dirty_state_from_height': resume_height,
			**self._public_finality_fields(published),
			'fork_recovery': new_recovery
		}

	async def _recheck_fork_before_repair(self, plan, read_block, budget, replacement):  # pylint: disable=too-many-locals
		match = plan.match
		parent = plan.state['last_synced_block_hash'] or NEMESIS_PREVIOUS_BLOCK_HASH
		boundaries = {plan.height: (parent, None)}
		if match.fork_height is not None:
			boundaries[match.fork_height] = (match.hash, match.fork_hash)

		has_hash_lock_proof = replacement.has_hash_lock_proof
		replay_common_height = match.height if has_hash_lock_proof and plan.height <= match.height else None
		if has_hash_lock_proof and match.height:
			# Status and absence proofs depend on this common prefix, including matched blocks being replayed.
			common_parent = self._get_saved_block_hash(match.height - 1) if match.height > 1 else NEMESIS_PREVIOUS_BLOCK_HASH
			boundaries[match.height] = (common_parent, match.hash)

		checked_blocks = {}
		for height, (expected_parent, expected_hash) in boundaries.items():
			if height > 1:
				parent_evidence = await read_block(height - 1)
				if parent_evidence[0] != expected_parent:
					raise EvidenceChanged()

				checked_blocks[height - 1] = parent_evidence

			if height <= plan.chain.node_height:
				block_hash, previous_hash = await read_block(height)
				if previous_hash != expected_parent or expected_hash is not None and block_hash != expected_hash:
					raise EvidenceChanged()

				checked_blocks[height] = (block_hash, previous_hash)

		tip_height, tip_evidence = match.comparison_tip
		if tip_height:
			checked_blocks[tip_height] = tip_evidence

		replacement_blocks = self._get_replacement_boundary_pins(plan, replacement, checked_blocks)
		repair_evidence = RepairBoundaryEvidence(
			plan.shortening, match.fork_height, replay_common_height, {**checked_blocks, **replacement_blocks},
			replacement_blocks, has_hash_lock_proof)
		proven = VerifiedFinalityRange(min(plan.height - 1, match.height), replacement.scan['blocks'] if replacement.scan else {})
		return await self._recheck_proven_finality(
			plan.finality_evidence, plan.chain, read_block, budget, proven, repair_evidence=repair_evidence)

	def _get_replacement_boundary_pins(self, plan, replacement, checked_blocks):
		pins = {}
		scan = replacement.scan
		if scan is not None and plan.height <= scan['height']:
			pins[scan['height']] = tuple(bytes.fromhex(value) for value in scan['block'])
			for boundaries in (checked_blocks, plan.finality_evidence.blocks):
				self._check_replacement_boundaries(scan, boundaries)

			if not replacement.has_hash_lock_proof:
				for height in (plan.height, plan.match.fork_height, plan.match.comparison_tip[0]):
					if str(height) in scan['blocks']:
						pins[height] = checked_blocks[height]

		if replacement.has_hash_lock_proof and plan.match.height:
			pins[plan.match.height] = checked_blocks[plan.match.height]

		return pins

	@staticmethod
	def _check_replacement_boundaries(scan, boundaries):
		for height, expected in boundaries.items():
			block = scan['blocks'].get(str(height))
			if block is None:
				continue

			previous = scan['blocks'].get(str(height - 1))
			parent = previous[0] if previous is not None else scan['boundary'][1]
			if (bytes.fromhex(block[0]), bytes.fromhex(parent)) != expected:
				raise EvidenceChanged('Authenticated Symbol replacement disagrees with a reconciliation boundary')

	@staticmethod
	async def _pin_proven_finality(match, chain, read_block, synced_finality=None):
		evidence = {}
		fixed = match.finalized
		# A cap can exclude the current raw finality from this run's checkpoints.
		candidate = chain.finalized if chain.finalized.height <= chain.height else fixed
		if fixed.height:
			fixed_evidence = (fixed.hash, match.finalized_parent)
			if match.finalized_parent is None:
				# A common point above finality can bypass that block in the page proof.
				fixed_evidence = synced_finality if fixed.height == candidate.height else None
				fixed_evidence = fixed_evidence or await read_block(fixed.height)
				if fixed_evidence[0] != fixed.hash:
					raise EvidenceChanged('Node finalized block hash does not match chain info')

			evidence[fixed.height] = fixed_evidence

		if candidate.height > fixed.height:
			candidate_evidence = synced_finality or await read_block(candidate.height)
			if candidate_evidence[0] != candidate.hash:
				raise EvidenceChanged('Node finalized block hash does not match chain info')

			evidence[candidate.height] = candidate_evidence

		return RecoveryFinalityEvidence(candidate, evidence)

	async def _recheck_proven_finality(  # pylint: disable=too-many-arguments,too-many-locals
		self, evidence, chain, read_block, budget, proven, *, repair_evidence=None
	):
		candidate = evidence.checkpoint
		shortening = repair_evidence.shortening if repair_evidence is not None else None
		fork_height = repair_evidence.fork_height if repair_evidence is not None else None
		replay_common_height = repair_evidence.replay_common_height if repair_evidence is not None else None
		replacement_blocks = repair_evidence.replacement_blocks if repair_evidence is not None else {}
		has_hash_lock_proof = repair_evidence is not None and repair_evidence.has_hash_lock_replay
		replacement_tip = max(replacement_blocks, default=0)

		async def read_chain(previous_finalized):
			latest = await self._read_reconciliation_evidence(self._read_sync_chain(chain.max_height), budget)
			if shortening is not None and latest.node_height < shortening - 1:
				raise EvidenceChanged('Node chain tip changed before Symbol shortening repair')

			if fork_height is not None and latest.node_height < fork_height:
				raise EvidenceChanged('Node chain tip fell below the proven fork before Symbol repair')

			if replay_common_height is not None and latest.node_height < replay_common_height:
				raise EvidenceChanged('Node chain tip fell below the common block for replayed Symbol Hash Lock creations')

			if has_hash_lock_proof and latest.node_height < chain.node_height:
				raise EvidenceChanged('Node chain tip changed before Symbol Hash Lock recovery commit')

			if latest.node_height < replacement_tip:
				raise EvidenceChanged('Node chain tip fell below the authenticated Symbol replacement range')

			finalized = latest.finalized
			if chain.max_height is not None and chain.finalized.height <= chain.max_height < finalized.height:
				raise EvidenceChanged('Node finalization crossed max_height before Symbol recovery commit')

			if finalized.height < candidate.height or finalized.height == candidate.height and finalized.hash != candidate.hash:
				raise EvidenceChanged('Node finalized checkpoint changed before Symbol recovery commit')

			self._check_fresh_finality(previous_finalized, finalized, proven)
			return latest

		latest = await read_chain(chain.finalized)
		has_grown = shortening is not None and latest.node_height >= shortening
		lock_horizon_has_grown = has_hash_lock_proof and latest.node_height > chain.node_height
		while evidence.blocks or has_grown or replacement_blocks or has_hash_lock_proof:
			for height, expected in evidence.blocks.items():
				if (await read_block(height)) != expected:
					raise EvidenceChanged('Node finalized block evidence changed before Symbol recovery commit')

			if has_grown:
				for height, expected in repair_evidence.blocks.items():
					if (await read_block(height)) != expected:
						raise EvidenceChanged('Node fork boundary changed while the shortened Symbol tip grew')
			else:
				for height, expected in replacement_blocks.items():
					if (await read_block(height)) != expected:
						scope = 'Hash Lock recovery' if has_hash_lock_proof else 'replacement'
						raise EvidenceChanged(f'Node {scope} block evidence changed before Symbol repair')

			# A new finality point or newly reachable tail requires another evidence check.
			refreshed = await read_chain(latest.finalized)
			lock_horizon_has_grown = lock_horizon_has_grown or (has_hash_lock_proof and refreshed.node_height > chain.node_height)
			growth_seen_on_closing_read = not has_grown and shortening is not None and refreshed.node_height >= shortening
			if not growth_seen_on_closing_read and refreshed.finalized[:2] == latest.finalized[:2]:
				if has_grown:
					raise ShorteningDeferred()

				if lock_horizon_has_grown:
					raise RecoveryStopped(
						ForkRecoveryStopReason.RECONCILIATION_WAIT,
						'Node chain grew beyond the verified Symbol Hash Lock state range')

				return refreshed

			has_grown = has_grown or growth_seen_on_closing_read
			latest = refreshed

		return latest

	def _check_fresh_finality(self, initial, observed, proven):
		if observed.height < initial.height or observed.height == initial.height and observed.hash != initial.hash:
			raise EvidenceChanged('Node finalized checkpoint changed before Symbol recovery commit')

		if observed.height == initial.height:
			return

		block = proven.replacement_blocks.get(str(observed.height))
		if block is not None:
			expected_hash = bytes.fromhex(block[0])
		elif observed.height <= proven.retained_height:
			expected_hash = self._get_saved_block_hash(observed.height)
		else:
			raise RecoveryStopped(
				ForkRecoveryStopReason.RECONCILIATION_WAIT, 'Node advanced finality exceeds verified Symbol history')

		if observed.hash != expected_hash:
			raise EvidenceChanged('Node advanced finalized hash does not match verified Symbol history')

	async def _read_reconciliation_block(self, height, budget):
		return await self._read_reconciliation_evidence(self._get_node_block_evidence(height), budget)

	async def _read_reconciliation_page(self, start, end, budget):
		return await self._read_reconciliation_evidence(self._get_reconciliation_page(start, end), budget)

	async def _read_reconciliation_evidence(self, operation, budget):
		self._reconciliation_budget = budget
		try:
			return await budget.run(operation)
		finally:
			self._reconciliation_budget = None

	async def _get_reconciliation_page(self, start, end):
		blocks = await self._get_block_page(start - 1)
		return self._validate_reconciliation_page(start, end, blocks)

	def _validate_reconciliation_page(self, start, end, blocks):
		required = end - start + 1
		if not isinstance(blocks, list) or not required <= len(blocks) <= MAX_PAGE_SIZE:
			raise ValueError(f'Short or malformed Symbol block evidence page at height {start}')

		evidence = []
		for height, block in enumerate(blocks[:required], start):
			item = self._validate_node_block_evidence(height, block)
			if evidence and item[1] != evidence[-1][0] or 1 == height and item[1] != NEMESIS_PREVIOUS_BLOCK_HASH:
				raise EvidenceChanged()

			evidence.append(item)

		return evidence

	async def _get_node_block_evidence(self, height, expected_commitments=None):
		block_response = await self.get_symbol_node(f'/blocks/{height}')
		evidence = self._validate_node_block_evidence(height, block_response)
		if expected_commitments is not None:
			if evidence[0].hex() != expected_commitments[0]:
				raise EvidenceChanged()

			try:
				commitments = self._replay_block_commitments(block_response)
			except ValueError as exception:
				raise EvidenceChanged('Node Symbol replay block commitments changed before repair') from exception

			if commitments != expected_commitments:
				raise EvidenceChanged('Node Symbol replay block commitments changed before repair')

		return evidence

	def _read_fork_sync_state(self):
		state = self.symbol_db.get_sync_state()
		if state:
			for field in ('finalized_hash', 'last_synced_block_hash'):
				value = state[field]
				state[field] = bytes(value) if value is not None else None

		return state

	def _get_saved_block_hash(self, height):
		try:
			block_hash = self.symbol_db.get_block_hash(height)
		except PsycopgError as exception:
			raise RecoveryStopped(ForkRecoveryStopReason.RECONCILIATION_WAIT, 'Unable to verify saved block range') from exception

		return bytes(block_hash) if block_hash is not None else None

	@staticmethod
	def _empty_sync_state():
		return {
			'status': 'initialized', 'chain_height': None, 'last_synced_height': None, 'last_synced_block_hash': None,
			'dirty_state_from_height': None, 'finalized_height': None, 'finalized_hash': None,
			'finalized_epoch': None, 'finalized_point': None
		}

	@staticmethod
	def _recorded_finality(recovery):
		return FinalizedBlock(recovery['verified_height'], recovery['verified_hash'], recovery['verified_epoch'], recovery['verified_point'])

	@staticmethod
	def _published_finality(state):
		return FinalizedBlock(state['finalized_height'], state['finalized_hash'], state['finalized_epoch'], state['finalized_point'])

	@staticmethod
	def _with_finality(recovery, finalized, **fields):
		return {
			**recovery, **fields, 'verified_height': finalized.height, 'verified_hash': finalized.hash,
			'verified_epoch': finalized.epoch, 'verified_point': finalized.point
		}

	@staticmethod
	def _public_finality_fields(finalized):
		return dict(zip(('finalized_height', 'finalized_hash', 'finalized_epoch', 'finalized_point'), finalized))

	def _validate_node_block_evidence(self, height, block_response):
		"""Validates one block returned by a single-height or paginated request."""

		if not isinstance(block_response, dict):
			raise ValueError(f'Malformed Symbol block response at height {height}')

		if not isinstance(block_response.get('block'), dict) or not isinstance(block_response.get('meta'), dict):
			raise ValueError(f'Malformed Symbol block response at height {height}')

		response_height = self._parse_node_height(
			block_response['block']['height'], f'Malformed Symbol block response height at height {height}')
		if response_height != height:
			raise ValueError(f'Symbol block response height does not match requested height {height}')
		return (
			self._parse_node_block_hash(block_response['meta'].get('hash')),
			self._parse_node_block_hash(block_response['block'].get('previousBlockHash')))

	@staticmethod
	def _parse_node_height(height_value, error_message):
		if is_exact_integer(height_value):
			return int(height_value)

		if isinstance(height_value, str) and re.fullmatch(r'[0-9]+', height_value):
			return int(height_value)

		raise ValueError(error_message)

	@staticmethod
	def _parse_node_finalization_number(value, field_name):
		if not is_exact_integer(value) or not 0 <= value <= MAX_UINT32_FINALIZATION:
			raise ValueError(f'Symbol {field_name} must be a uint32 JSON integer')

		return value

	@staticmethod
	def _parse_node_block_hash(hash_text):
		if not isinstance(hash_text, str) or not re.fullmatch(r'[0-9a-fA-F]{64}', hash_text):
			raise ValueError('Symbol block hash must contain exactly 64 hexadecimal characters')

		return bytes.fromhex(hash_text)

	async def _scan_replacement(self, plan, budget, verifier, scope):  # pylint: disable=too-many-locals,too-many-branches
		"""Authenticates complete replacement pages before they can authorize deletion."""

		recovery = plan.state['fork_recovery']
		progress = verifier.saved_progress or verifier.admin_progress or {}
		parent = plan.state['last_synced_block_hash'] or NEMESIS_PREVIOUS_BLOCK_HASH
		chain = plan.chain
		boundary = [plan.height, parent.hex(), chain.max_height]
		tip = chain.node_height if scope.has_hash_lock_proof else chain.height
		scan_name = 'hash_lock_scan' if scope.has_hash_lock_proof else 'replacement_scan'
		# A saved Hash Lock scan must have checked whether unbound V1 payloads hide lock events.
		scan_version = HASH_LOCK_REPLACEMENT_SCAN_VERSION if scope.has_hash_lock_proof else REPLACEMENT_SCAN_VERSION
		committed_scan = (recovery['progress'] or {}).get('replacement_proof')
		scan = progress.get(scan_name)
		# A shorter reachable range can be reauthenticated against the committed overlap.
		if not scope.has_hash_lock_proof and scan is None and committed_scan and committed_scan['height'] <= tip:
			scan = committed_scan

		if scan and scan.get('header_version') == scan_version and scan['boundary'] == boundary:
			scan = deepcopy(scan)
			if scan['receipt_mode'] is not scope.verifiable_receipts:
				raise EvidenceChanged('Symbol verifiable receipt configuration changed during replay proof')

			if scan['height'] > tip or (scan.get('download') and scan['download']['end'] > tip):
				raise EvidenceChanged('Node chain tip fell below the scanned Symbol replacement block')

			if plan.height <= scan['height']:
				await self._read_reconciliation_evidence(self._recheck_saved_replacement_block(scan, scope.has_hash_lock_proof), budget)

			if not scope.verifiable_receipts and scan.get('statement_ranges') and 'statement_recheck' not in scan:
				scan['statement_recheck'] = sorted(int(height) for height in scan['statement_ranges'])
		else:
			scan = {
				'boundary': boundary, 'height': plan.height - 1, 'block': [parent.hex(), None],
				'blocks': {}, 'transactions': {}, 'receipts': {}, 'resolutions': {}, 'receipt_mode': scope.verifiable_receipts,
				'header_version': scan_version
			}

		def save():
			verifier.save_replacement_scan(scan_name, scan, recovery['invalidations'])

		while scan['height'] < tip:
			start = scan['height'] + 1
			download = scan.get('download')
			end = download['end'] if download else min(start + MAX_PAGE_SIZE - 1, tip)
			try:
				blocks = await self._read_reconciliation_evidence(self._get_block_page(start - 1), budget)
				evidence = self._validate_reconciliation_page(start, end, blocks)
				if evidence[0][1].hex() != scan['block'][0]:
					raise EvidenceChanged()

				page_blocks = self._read_replay_page_commitments(start, blocks[:len(evidence)], is_resuming=download is not None)
				anchor = [value.hex() for value in evidence[-1]]
				if download and (download['block'] != anchor or download['blocks'] != page_blocks):
					raise EvidenceChanged()

				if download is None:
					download = {
						'end': end, 'block': anchor, 'blocks': page_blocks, 'transactions': [], 'statements': [], 'resolutions': {}
					}
					scan['download'] = download
					save()

				transactions, receipts = await self._read_reconciliation_evidence(
					self._read_replacement_page(start, download, save, scope), budget)
			except (CorruptDataException, KeyError, TypeError, ValueError) as exception:
				evidence_name = 'Hash Lock replacement branch' if scope.has_hash_lock_proof else 'replacement branch'
				raise RecoveryStopped(
					ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING,
					f'Malformed Symbol {evidence_name} evidence: unverified transaction range on the replacement branch: {exception}'
				) from exception

			self._accept_replacement_page(scan, start, download, transactions, receipts)
			save()

		await self._recheck_saved_receiptless_pages(scan, budget, save)
		self._check_committed_replacement_scan(scan, committed_scan)
		return scan

	@staticmethod
	def _check_committed_replacement_scan(scan, previous):
		if previous is None:
			return

		previous_blocks = previous['blocks']
		if previous['receipt_mode'] != scan['receipt_mode'] or any(
			height in previous_blocks and previous_blocks[height] != block for height, block in scan['blocks'].items()
		):
			raise EvidenceChanged('Authenticated Symbol replacement evidence changed after repair')

	@staticmethod
	def _accept_replacement_page(scan, start, download, transactions, receipts):
		scan['blocks'].update(download['blocks'])
		scan['transactions'].update(transactions)
		scan['receipts'].update(receipts)
		if scan['receipt_mode']:
			scan['resolutions'].update(
				(height, statements) for height, statements in download['resolutions'].items() if height in transactions)
		else:
			scan.setdefault('statement_ranges', {})[str(start)] = download['end']

		scan.update(height=download['end'], block=download['block'])
		del scan['download']

	def _read_replay_page_commitments(self, start, blocks, *, is_resuming):
		try:
			return {str(height): self._replay_block_commitments(block) for height, block in enumerate(blocks, start)}
		except (KeyError, TypeError, ValueError) as exception:
			if is_resuming:
				raise EvidenceChanged() from exception

			raise

	async def _recheck_saved_receiptless_pages(self, scan, budget, save):
		pending = scan.get('statement_recheck', [])
		while pending:
			start = pending[0]
			end = scan['statement_ranges'][str(start)]
			try:
				if await self._read_reconciliation_evidence(self._get_transaction_statement_page(start, end, 1), budget):
					raise EvidenceChanged('Previously scanned Symbol receipts changed with verifiable receipts disabled')
			except (CorruptDataException, KeyError, TypeError, ValueError) as exception:
				raise EvidenceChanged('Invalid Symbol transaction statements while rechecking saved replacement proof') from exception

			pending.pop(0)
			save()

	async def _recheck_saved_replacement_block(self, scan, should_prove_locks):
		height = scan['height']
		try:
			evidence = await self._get_node_block_evidence(height, scan['blocks'][str(height)])
			if [value.hex() for value in evidence] != scan['block']:
				raise EvidenceChanged()
		except (EvidenceChanged, KeyError, TypeError, ValueError) as exception:
			scope = 'Hash Lock' if should_prove_locks else 'replacement'
			raise EvidenceChanged(f'Previously scanned Symbol {scope} replay block changed') from exception

	async def _read_verifiable_receipt_mode(self):
		value = (await self._get_network_properties()).get('chain', {}).get('enableVerifiableReceipts')
		if isinstance(value, bool):
			return value

		if value in ('true', 'false'):
			return value == 'true'

		return None

	def _replay_block_commitments(self, block):
		meta = block['meta']
		fields = block['block']
		top, total = meta['transactionsCount'], meta['totalTransactionsCount']
		if not all(is_exact_integer(count) for count in (top, total)) or not 0 <= top <= total:
			raise ValueError('Invalid Symbol transaction counts')

		block_hash = validate_block_commitment(block)
		transactions_root = self._parse_node_block_hash(fields['transactionsHash'])
		if bool(top) != any(transactions_root) or not top and total:
			raise ValueError(f'Symbol transaction counts contradict block transaction root at height {fields["height"]}')

		receipts_root = self._parse_node_block_hash(fields['receiptsHash'])
		return [block_hash.hex(), transactions_root.hex(), receipts_root.hex(), top, total]

	async def _read_replacement_page(self, start, download, save, scope):
		transactions = await self._download_replay_transactions(start, download, save) if scope.has_hash_lock_proof else {}
		end = download['end']
		if not scope.verifiable_receipts:
			self._check_receiptless_roots(download['blocks'])
			if await self._get_transaction_statement_page(start, end, 1):
				raise ValueError('Symbol replacement replay unexpectedly returned statements with verifiable receipts disabled')

			return transactions, {}

		await self._download_replay_transaction_statements(start, end, download, save)
		await self._check_receipt_commitments(download['blocks'], download['statements'], download['resolutions'], save)
		if not scope.has_hash_lock_proof:
			return {}, {}

		receipts = self._create_receipt_rows_by_height(download['statements'])
		return transactions, self._select_hash_lock_replay_receipts(receipts, transactions)

	async def _download_replay_transactions(self, start, download, save):
		end = download['end']
		counts = {int(height): TransactionCountExpectation(*block[3:]) for height, block in download['blocks'].items()}
		expected_total = sum(count.total_count for count in counts.values())
		items = download['transactions']
		while len(items) < expected_total:
			page_number = len(items) // MAX_PAGE_SIZE + 1
			page = await self._get_transaction_page(start, end, page_number)
			self._validate_transaction_page_count(page, page_number, self._expected_transaction_page_size(expected_total, page_number))
			items.extend(page)
			save()

		rows = self._create_transaction_rows_by_height(items, 0, counts)
		self._validate_replay_transaction_roots(download['blocks'], rows, should_verify_lock_evidence=True)
		return self._select_hash_lock_replay_transactions(rows)

	@staticmethod
	def _check_receiptless_roots(blocks):
		if any(block[2] != '0' * 64 for block in blocks.values()):
			raise ValueError('Nonzero Symbol receipts root with verifiable receipts disabled')

	def _validate_replay_transaction_roots(self, blocks, rows_by_height, *, should_verify_lock_evidence=False):
		# Core BlockUtils uses MerkleComponentHash in block order, including only top-level transactions.
		for height_text, (_, expected_root, *_) in blocks.items():
			height = int(height_text)
			all_rows = rows_by_height.get(height, ())
			rows = [row for row in all_rows if not row['is_embedded']]
			indexes = [row['raw_payload']['meta']['index'] for row in rows]
			if not all(is_exact_integer(index) for index in indexes):
				raise ValueError(f'Invalid Symbol transaction source at height {height}')

			if len(set(indexes)) != len(indexes):
				raise ValueError('Duplicate Symbol transaction source in Hash Lock replay')

			if sorted(indexes) != list(range(len(indexes))):
				raise ValueError(f'Non-contiguous Symbol transaction sources at height {height}')

			builder = MerkleHashBuilder()
			for row in sorted(rows, key=lambda item: item['block_index']):
				component_hash = self._parse_node_block_hash(row['raw_payload']['meta'].get('merkleComponentHash'))
				builder.update(Hash256(component_hash))

			if builder.final().bytes.hex() != expected_root:
				raise ValueError(f'Symbol transaction Merkle root does not match block at height {height}')

			try:
				commitments = validate_transaction_commitments(all_rows, self.symbol_facade.network.generation_hash_seed)
			except (KeyError, TypeError, ValueError) as exception:
				raise ValueError(f'Symbol transaction commitment failed at height {height}: {exception}') from exception

			if should_verify_lock_evidence:
				self._verify_replay_embedded_lock_evidence(all_rows, commitments.unbound_aggregate_reasons, height)

	@staticmethod
	def _verify_replay_embedded_lock_evidence(rows, reasons_by_hash, height):
		# Core b3222548d6c8 InvalidMerkleHashBuilder drops leaves in the first level.
		# An unmatched V1 root proves none of the embedded rows. Neither can establish lock absence.
		for reason in reasons_by_hash.values():
			if reason is not UnboundAggregateReason.AMBIGUOUS_LEGACY_PAYLOAD_SIZE:
				raise ValueError(
					f'Unbound Symbol legacy aggregate cannot prove absence of embedded lock evidence at height {height} ({reason.value})')

		# With payload-size ambiguity, only duplicates of visible leaves can be hidden.
		# Core's CompletedAggregateObserver uses the Bonded entity hash, independently of those duplicates.
		lock_types = (TransactionType.HASH_LOCK.value, TransactionType.SECRET_LOCK.value, TransactionType.SECRET_PROOF.value)
		if any(row['is_embedded'] and row['type'] in lock_types and row['aggregate_hash'] in reasons_by_hash for row in rows):
			raise ValueError(f'Unbound Symbol legacy aggregate contains embedded lock evidence at height {height}')

	async def _download_replay_transaction_statements(self, start, end, download, save):
		statements = download['statements']
		while not download.get('statements_complete'):
			page_number = len(statements) // MAX_PAGE_SIZE + 1
			page = await self._get_transaction_statement_page(start, end, page_number)
			statements.extend(page)
			download['statements_complete'] = len(page) < MAX_PAGE_SIZE
			save()

	async def _check_receipt_commitments(self, blocks, items, resolutions, save):
		grouped = defaultdict(list)
		for item in items:
			statement = item['statement']
			height = self._parse_node_height(statement['height'], 'Malformed Symbol transaction statement height')
			if str(height) not in blocks:
				raise ValueError(f'Symbol transaction statement height {height} is outside requested range')

			grouped[str(height)].append(statement)

		for height, (_, _, expected_root, *_) in blocks.items():
			statements = resolutions.setdefault(height, {})
			if expected_root == '0' * 64 and not grouped[height]:
				continue

			for kind in ('address', 'mosaic'):
				if kind not in statements:
					request = ResolutionRequest(int(height), kind)
					statements[kind] = await self._download_resolution_statements(request, statements, save)
					save()

			root = calculate_receipts_hash(grouped[height], statements.get('address', []), statements.get('mosaic', []))
			if root.hex() != expected_root:
				raise ValueError(f'Symbol receipts Merkle root does not match block at height {height}')

	@staticmethod
	def _resolution_entries(bodies):
		return {statement['unresolved'].upper(): statement['resolutionEntries'] for statement in bodies}

	@classmethod
	def _verified_resolution_entries(cls, resolutions):
		return {
			int(height): ResolutionStatements(
				cls._resolution_entries(statements.get('address', [])), cls._resolution_entries(statements.get('mosaic', [])))
			for height, statements in resolutions.items()
		}

	@staticmethod
	def _select_hash_lock_replay_transactions(rows):
		lock_types = (TransactionType.HASH_LOCK.value, TransactionType.AGGREGATE_BONDED.value)
		return {
			str(height): [row['raw_payload'] for row in sorted(events, key=lambda row: row['block_index'] if not row['is_embedded'] else -1)]
			for height, at_height in rows.items() if (events := [row for row in at_height if row['type'] in lock_types])
		}

	@staticmethod
	def _select_hash_lock_replay_receipts(rows, transactions):
		return {
			str(height): [
				[row['source_primary_id'], row['source_secondary_id'], row['raw_payload']]
				for row in sorted(at_height, key=lambda row: (row['source_primary_id'], row['source_secondary_id'], row['receipt_type']))
				if row['receipt_type'] in ('lockHashCreated', 'lockHashCompleted')
			]
			for height, at_height in rows.items() if str(height) in transactions
		}

	def _read_hash_lock_replay_events(self, scan):
		transactions = {
			int(height): [create_transaction_row(item, self.symbol_facade.network, 0) for item in items]
			for height, items in scan['transactions'].items()
		}
		receipts = {
			int(height): [
				row for primary, secondary, receipt in items
				for row in create_receipt_rows({
					'statement': {'height': height, 'source': {'primaryId': primary, 'secondaryId': secondary}, 'receipts': [receipt]}
				})
			] for height, items in scan['receipts'].items()
		}
		return transactions, receipts

	@staticmethod
	def _hash_lock_event_keys(rows_by_height):
		return {
			create_hash_lock_key(row['body']['hash'] if row['type'] == TransactionType.HASH_LOCK.value else row['hash'])
			for rows in rows_by_height for row in rows
		}

	def _cap_excludes_affected_hash_lock(self, plan, chain, evidence, canonical_keys, future_keys):
		verified_height = plan.state['fork_recovery']['verified_height'] or 0
		finalized_height = chain.finalized.height if chain.finalized.height <= chain.height else verified_height
		cleanup_keys = self.symbol_db.get_hash_lock_hashes_reaching_finalized_height(max(verified_height, finalized_height))
		rollback_keys = self.symbol_db.get_hash_lock_hashes_updated_from_height(plan.height)
		return bool(future_keys.intersection(evidence.keys.union(canonical_keys, cleanup_keys, rollback_keys)))

	@staticmethod
	def _hash_lock_alias_rows(rows_by_height):
		aliases = {}
		for height, rows in rows_by_height.items():
			for row in rows:
				if row['type'] != TransactionType.HASH_LOCK.value or row['is_embedded']:
					continue

				if is_alias_mosaic_id(row['body']['mosaicId']):
					aliases.setdefault(height, []).append(row)

		return aliases

	@staticmethod
	def _resolved_hash_lock_mosaics(alias_rows):
		return {
			str(height): [
				[row['block_index'], relation['mosaic_id'].upper()]
				for row in sorted(rows, key=lambda item: item['block_index'])
				for relation in row['mosaic_rows'] if ('hash_lock', 0) == (relation['role'], relation['position'])
			] for height, rows in alias_rows.items()
		}

	async def _resolve_hash_lock_replay_mosaics(self, transactions, scan):
		aliases = self._hash_lock_alias_rows(transactions)
		if not aliases:
			return {}

		try:
			if not scan['receipt_mode']:
				raise ValueError('Canonical receiptless Symbol Hash Lock requires a direct mosaic and a proven absent prior lock')

			await self._resolve_transaction_rows_for_batch(aliases, self._verified_resolution_entries(scan['resolutions']))
			return self._resolved_hash_lock_mosaics(aliases)
		except (CorruptDataException, KeyError, TypeError, ValueError) as exception:
			raise RecoveryStopped(
				ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING,
				f'Unable to resolve Symbol Hash Lock replay mosaic: {exception}') from exception

	@staticmethod
	def _replay_digest(value):
		return sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

	def _hash_lock_replay_proof(self, scan, proof, resolved_mosaics, through_height, retained_height):
		baseline = sorted(
			[state[0].hash.hex(), state[1].hex(), *state[2:]] for state in proof.states_at(retained_height))
		blocks = {
			height: self._replay_digest([
				commitments, scan['transactions'].get(height), scan['receipts'].get(height), resolved_mosaics.get(height), scan['receipt_mode'],
				*(['receiptless'] if not scan['receipt_mode'] and height in scan['transactions'] else [])
			])
			for height, commitments in scan['blocks'].items() if int(height) <= through_height
		}
		return {'baseline': self._replay_digest(baseline), 'blocks': blocks}

	def _replay_lock_lookup_pins(self, expected, proof):
		states = {state.key: [state.owner.hex(), *state[2:]] for state in expected.states}
		histories = proof.lookup_histories()
		return {
			key.hash.hex(): self._replay_digest([
				states.get(key), key in expected.prunable_keys,
				[[height, state.owner.hex(), *state[2:]] for height, state in histories.get(key, ())]
			]) for key in expected.keys
		}

	async def _read_replay_lock_entries(  # pylint: disable=too-many-arguments,too-many-locals
		self, scan, expected, chain, proof, *, budget, save
	):
		pins = self._replay_lock_lookup_pins(expected, proof)
		previous_pins = scan.get('lock_pins', {})
		responses = {
			key: response for key, response in scan.get('lock_responses', {}).items()
			if key in pins and previous_pins.get(key) == pins[key]
		}
		has_grown = scan.get('lock_lookup_height', chain.node_height) < chain.node_height
		scan.update(lock_pins=pins, lock_responses=responses, lock_lookup_height=chain.node_height)
		if responses and 'lock_recheck' not in scan:
			# Recheck saved results once, in bounded steps, before they can authorize repair.
			scan['lock_recheck'] = sorted(responses)

		pending = scan.get('lock_recheck', [])
		# An authenticated extension can add work without invalidating unrelated lookups.
		keys = sorted(expected.keys, key=lambda key: (has_grown and key.hash.hex() in responses, key))
		entries = []
		for key in keys:
			text = key.hash.hex()
			if text not in responses or text in pending:
				[entry] = await self._read_reconciliation_evidence(self._fetch_dirty_hash_locks([key], chain.node_height, expected), budget)
				responses[text] = entry['row']['raw_payload'] if 'row' in entry else None
				if text in pending:
					pending.remove(text)

				save()
			else:
				item = responses[text]
				entry = {'hash': key} if item is None else {'row': create_hash_lock_row(item, chain.node_height)}

			entries.append(entry)

		return entries

	@staticmethod
	def _hash_lock_entries_at(proof, height, latest_entries, finalized_height=None):  # pylint: disable=too-many-locals
		latest = {create_hash_lock_key(entry['row']['hash']): entry['row'] for entry in latest_entries if 'row' in entry}
		states = {state[0]: state[1:] for state in proof.states_at(height)}
		prunable = proof.prunable_at(height, finalized_height)
		entries = []
		for key in sorted(proof.keys):
			if key not in states or key in prunable and key not in latest:
				entries.append({'hash': key})
				continue

			owner, mosaic, amount, end, status = states[key]
			row = latest.get(key)
			if row and (row['owner_address'], row['mosaic_id'], row['amount'], row['end_height'], row['status']) == states[key]:
				entries.append({'row': {**row, 'updated_at_height': height}})
				continue

			# The node response is for its live tip. Preserve distinct, proven historical values during replay.
			entry = {'lock': {
				'hash': key.hash.hex().upper(), 'ownerAddress': owner.hex().upper(), 'mosaicId': mosaic,
				'amount': str(amount), 'endHeight': str(end), 'status': int(status == 'used')
			}}
			entries.append({'row': create_hash_lock_row(entry, height)})

		return entries

	def _get_rollback_hash_lock_evidence(self, plan, finalized_height, keys, *, verifiable):
		retained = min(plan.match.height, plan.height - 1)
		evidence = self.symbol_db.try_get_rollback_hash_lock_evidence(
			plan.height, retained, min(retained, finalized_height), replay_end=plan.match.height, additional_keys=keys,
			allow_receiptless_creations=verifiable is False)
		if evidence is None:
			raise RecoveryStopped(
				ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING,
				'Finalized rollback contains lock events whose pruned state cannot be reconstructed safely')

		return evidence

	async def _prepare_replacement(self, plan, budget, verifier):
		recovery = plan.state['fork_recovery']
		progress = recovery['progress'] or {}
		legacy_history_height = recovery['legacy_history_height']
		# A committed replay owns its evidence until a replacement checkpoint clears it.
		has_committed_lock_replay = 'replay_hash_lock_keys' in progress
		should_check_lock_evidence = has_committed_lock_replay or (
			recovery['legacy_lock_history'] and (legacy_history_height is None or plan.height <= legacy_history_height))
		evidence = RollbackHashLockEvidence()
		if not plan.should_authenticate_replacement and not should_check_lock_evidence:
			return PreparedReplacement(evidence, [], None, None, False)

		finalized_height = max(
			recovery['verified_height'] or 0, plan.match.finalized.height if plan.match.has_finality_evidence else 0)
		verifiable = await self._read_reconciliation_evidence(self._read_verifiable_receipt_mode(), budget)
		should_prove_locks = False
		if should_check_lock_evidence:
			evidence = self._get_rollback_hash_lock_evidence(
				plan, finalized_height, {create_hash_lock_key(key) for key in progress.get('replay_hash_lock_keys', ())}, verifiable=verifiable)
			should_prove_locks = bool(evidence.keys or evidence.has_incomplete_replay or has_committed_lock_replay)

		if not plan.should_authenticate_replacement and not should_prove_locks:
			return PreparedReplacement(evidence, [], None, None, False)

		if verifiable is None:
			raise RecoveryStopped(
				ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING, 'Unable to determine Symbol verifiable receipt configuration')

		scan = await self._scan_replacement(plan, budget, verifier, ReplacementScanScope(verifiable, should_prove_locks))
		prepared = PreparedReplacement(evidence, [], scan, None, should_prove_locks)
		if not should_prove_locks:
			return prepared

		return await self._prepare_hash_lock_replay(plan, budget, verifier, prepared)

	async def _prepare_hash_lock_replay(self, plan, budget, verifier, prepared):  # pylint: disable=too-many-locals
		recovery = plan.state['fork_recovery']
		chain = plan.chain
		scan, evidence = prepared.scan, prepared.hash_lock_evidence
		finalized_height = max(
			recovery['verified_height'] or 0, plan.match.finalized.height if plan.match.has_finality_evidence else 0)
		progress = recovery['progress'] or {}
		verifiable = scan['receipt_mode']
		transactions, receipts = self._read_hash_lock_replay_events(scan)
		canonical_keys = self._hash_lock_event_keys(rows for height, rows in transactions.items() if height <= chain.height)
		future_keys = self._hash_lock_event_keys(rows for height, rows in transactions.items() if height > chain.height)
		if future_keys and self._cap_excludes_affected_hash_lock(plan, chain, evidence, canonical_keys, future_keys):
			# A later reuse can also change the live DTO used by finalized-lock cleanup after a capped checkpoint.
			raise RecoveryStopped(
				ForkRecoveryStopReason.CAP_BLOCKS_DIRTY_REPAIR,
				'max_height excludes a verified Symbol Hash Lock replay event')

		transactions = {height: rows for height, rows in transactions.items() if height <= chain.height}
		if canonical_keys.difference(evidence.keys):
			evidence = self._get_rollback_hash_lock_evidence(plan, finalized_height, canonical_keys | evidence.keys, verifiable=verifiable)

		def save():
			verifier.save_replacement_scan('hash_lock_scan', scan, recovery['invalidations'])

		resolved_mosaics = await self._resolve_hash_lock_replay_mosaics(transactions, scan)
		proof = HashLockReplayProof(evidence.keys, evidence.states, evidence.prunable_keys, evidence.pruning_heights)
		receiptless_heights = () if verifiable else frozenset(int(height) for height in scan['transactions'])
		proof.apply_page(transactions, receipts, receiptless_heights=receiptless_heights)
		self._check_receiptless_hash_lock_proof(plan, chain, proof, evidence)
		proof_evidence = self._hash_lock_replay_proof(scan, proof, resolved_mosaics, chain.height, plan.height - 1)
		previous_proof = progress.get('replay_hash_lock_proof')
		if previous_proof and (
			previous_proof['baseline'] != proof_evidence['baseline'] or any(
				height in proof_evidence['blocks'] and digest != proof_evidence['blocks'][height]
				for height, digest in previous_proof['blocks'].items())
		):
			raise EvidenceChanged('Symbol Hash Lock restoration evidence changed after repair')

		finalized_height = self._get_replay_finalized_height(plan, scan, finalized_height)
		tip_evidence = evidence._replace(
			states=proof.states_at(chain.node_height), prunable_keys=proof.prunable_at(chain.node_height, finalized_height))
		try:
			latest = await self._read_replay_lock_entries(scan, tip_evidence, chain, proof, budget=budget, save=save)
		except (CorruptDataException, KeyError, TypeError, ValueError) as exception:
			raise RecoveryStopped(
				ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING, f'Invalid Symbol Hash Lock restoration response: {exception}') from exception

		baseline = self._hash_lock_entries_at(proof, plan.height - 1, latest)
		replay = None
		if str(chain.height) in scan['blocks']:
			replay = HashLockReplay(
				evidence.keys, self._hash_lock_entries_at(proof, chain.height, latest, min(chain.height, finalized_height)),
				scan['transactions'], scan['receipts'], proof_evidence)

		return prepared._replace(hash_lock_evidence=evidence, baseline_entries=baseline, hash_lock_replay=replay)

	@staticmethod
	def _get_replay_finalized_height(plan, scan, retained_finality):
		candidate = plan.finality_evidence.checkpoint
		block = scan['blocks'].get(str(candidate.height))
		if block is None or candidate.height <= retained_finality:
			return retained_finality

		# A resumed comparison can still be pinned below the latest candidate.
		# The authenticated suffix must agree with that candidate before it can authorize pruning.
		if candidate.hash.hex() != block[0]:
			raise EvidenceChanged('Symbol Hash Lock replay disagrees with the finalized checkpoint')

		return candidate.height

	def _check_receiptless_hash_lock_proof(self, plan, chain, proof, evidence):
		if not evidence.receiptless_creations.issubset(proof.receiptless_creations):
			raise RecoveryStopped(
				ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING,
				'Receiptless Symbol Hash Lock creation is missing from the verified replacement branch')

		if not proof.receiptless_creations:
			return

		keys = {key for _, key, _ in proof.receiptless_creations}
		if any(state.key in keys and state.end_height <= chain.node_height for state in proof.states_at(chain.node_height)):
			raise RecoveryStopped(
				ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING, 'Receiptless Symbol Hash Lock has reached its end height')

		if self.symbol_db.has_receiptless_lock_history_gap(plan.height - 1):
			raise RecoveryStopped(
				ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING, 'Retained Symbol history cannot prove receiptless Hash Lock creation')

	async def _repair_from_height(self, plan, budget, verifier, *, should_commit):
		height = plan.height

		if (plan.match.fork_height is not None or plan.shortening is not None) and self._has_rollback_artifact_gaps(height):
			raise RecoveryStopped(
				ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING,
				'Rollback contains namespace or mosaic events whose missing current state cannot be reconstructed safely')

		replacement = await self._prepare_replacement(plan, budget, verifier)
		budget.check_deadline()
		try:
			with budget.exclude_time(), self.symbol_db.reconciliation_statements(None):
				refresh_entries = await self._fetch_rollback_refresh_entries(
					height, height - 1, replacement.hash_lock_evidence, replacement.baseline_entries,
					should_allow_live_hash_locks=plan.chain.height == plan.chain.node_height)
		except (CorruptDataException, KeyError, TypeError, ValueError) as exception:
			if should_commit:
				self._record_rollback_failure(ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING, exception)

			raise
		except (NodeException, RecoveryStopped):
			raise
		except Exception as exception:
			if should_commit:
				self._record_rollback_failure(ForkRecoveryStopReason.RECONCILIATION_WAIT, exception)

			raise

		scan = replacement.scan

		async def read_block(block_height):
			expected = scan['blocks'].get(str(block_height)) if scan is not None else None
			return await self._read_reconciliation_evidence(self._get_node_block_evidence(block_height, expected), budget)

		try:
			latest = await self._recheck_fork_before_repair(plan, read_block, budget, replacement)
		except (CorruptDataException, KeyError, RuntimeError, TypeError, ValueError) as exception:
			if isinstance(exception, (RecoveryStopped, FinalityAheadOfTip)):
				raise

			raise RecoveryStopped(ForkRecoveryStopReason.RECONCILIATION_WAIT, 'Unable to recheck Symbol repair boundary') from exception

		budget.check_deadline()
		if not should_commit:
			return None, None, None

		replacement_replay = self._set_replacement_replay_progress(plan, replacement, latest.finalized)
		try:
			with self.symbol_db.reconciliation_statements(None):
				recovery = self.symbol_db.repair_rollback_from_height(height, plan.state, refresh_entries)
				return recovery, replacement_replay, replacement.hash_lock_replay
		except Exception as exception:
			self._record_rollback_failure(ForkRecoveryStopReason.RECONCILIATION_WAIT, exception)
			raise

	@staticmethod
	def _set_replacement_replay_progress(plan, replacement, finalized):
		scan = replacement.scan
		if scan is None or str(plan.chain.height) not in scan['blocks']:
			return None

		recovery = plan.state['fork_recovery']
		previous_scan = (recovery['progress'] or {}).get('replacement_proof')
		replay = replacement.hash_lock_replay
		progress = {}
		if previous_scan is not None:
			progress['replacement_proof'] = previous_scan

		if replay is None:
			# A narrower retry cannot remove authenticated pinning for the rest of an unfinished replacement.
			if previous_scan is None or scan['height'] > previous_scan['height']:
				progress['replacement_proof'] = {key: value for key, value in scan.items() if key != 'statement_recheck'}
		else:
			progress['replay_hash_lock_keys'] = [key.hash.hex() for key in sorted(replay.keys)]
			progress['replay_hash_lock_proof'] = replay.proof

		recovery['replay_progress'] = progress
		return ReplacementReplay(scan['blocks'], scan['receipt_mode'], finalized)

	def _has_rollback_artifact_gaps(self, height):
		try:
			return self.symbol_db.has_artifact_state_gaps(height)
		except (PsycopgError, RuntimeError) as exception:
			raise RecoveryStopped(
				ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING,
				'Unable to verify rollback namespace and mosaic state') from exception

	def _record_rollback_failure(self, reason, failure):
		try:
			with self.symbol_db.reconciliation_statements(None):
				self.symbol_db.stop_fork_recovery(reason)

			log.warning(f'Symbol sync stopped ({reason.value}): {failure}')
		except Exception as error:  # pylint: disable=broad-exception-caught
			log.error(f'Failed to record Symbol sync failure: {error}')

	async def _fetch_rollback_refresh_entries(  # pylint: disable=too-many-locals,too-many-arguments
		self, height, observed_height, hash_lock_evidence, baseline_entries, *, should_allow_live_hash_locks
	):
		hash_lock_keys = [
			key for key in self.symbol_db.get_hash_lock_hashes_updated_from_height(height) if key not in hash_lock_evidence.keys
		]
		if hash_lock_keys and not should_allow_live_hash_locks:
			raise RecoveryStopped(
				ForkRecoveryStopReason.CAP_BLOCKS_DIRTY_REPAIR, 'Live Symbol Hash Lock state cannot establish the capped repair baseline')

		account_addresses = self.symbol_db.get_rollback_account_addresses(height)
		account_addresses.extend(sorted(hash_lock_evidence.refund_owner_addresses.difference(account_addresses)))
		beneficiary_timestamps = self.symbol_db.get_rollback_beneficiary_timestamps(height, account_addresses)
		dirty_addresses = {
			Address(address): beneficiary_timestamps.get(address) or datetime.min.replace(tzinfo=timezone.utc)
			for address in account_addresses
		}
		if self._active_performance:
			self._record_performance('set_phase', 'native_mosaic_fetch')
		native_mosaic_info = await self._get_native_mosaic_info()
		account_entries = await self._fetch_rollback_accounts(dirty_addresses, observed_height, native_mosaic_info)
		namespace_ids = self.symbol_db.get_namespace_ids_updated_from_height(height)
		namespace_entries = await self._fetch_dirty_namespaces(namespace_ids, observed_height)
		mosaic_ids = self.symbol_db.get_mosaic_ids_updated_from_height(height)
		mosaic_ids.extend(self.symbol_db.get_rollback_inflation_mosaic_ids(height))
		mosaic_ids = list(dict.fromkeys(mosaic_ids))
		mosaic_entries = await self._fetch_dirty_mosaics(
			mosaic_ids, observed_height, should_confirm_missing_mosaics=True)
		metadata_keys = self._union_metadata_keys(
			self.symbol_db.get_metadata_keys_updated_from_height(height),
			self.symbol_db.get_confirmed_metadata_keys_since(height))
		metadata_entries = await self._fetch_dirty_metadata(metadata_keys, observed_height)
		secret_lock_keys = self.symbol_db.get_secret_lock_search_keys_updated_from_height(height)
		hash_lock_entries = baseline_entries + await self._fetch_dirty_hash_locks(hash_lock_keys, observed_height)
		secret_lock_entries = await self._fetch_dirty_secret_locks(secret_lock_keys, observed_height)
		# Restrictions need both current rows and persisted transaction child rows: an orphaned branch can
		# have deleted a current row before the rollback, leaving the transaction-derived logical key as
		# the only way to fetch and restore that state before the destructive rollback transaction.
		mosaic_restriction_keys = set(self.symbol_db.get_mosaic_restriction_keys_updated_from_height(height))
		mosaic_restriction_keys.update(self.symbol_db.get_confirmed_mosaic_restriction_keys_since(height))
		mosaic_restriction_entries = await self._fetch_dirty_mosaic_restrictions(
			list(mosaic_restriction_keys), observed_height)
		return RollbackRefreshEntries(
			namespace_entries,
			mosaic_entries,
			metadata_entries,
			hash_lock_entries,
			secret_lock_entries,
			mosaic_restriction_entries,
			account_entries)

	async def _fetch_rollback_accounts(  # pylint: disable=too-many-locals
		self, dirty_addresses, observed_height, native_mosaic_info):
		"""Fetches old-branch accounts with explicit not-found checks before rollback writes."""

		addresses = list(dirty_addresses)
		entries = []
		for chunk_start in range(0, len(addresses), ACCOUNT_BATCH_FETCH_SIZE):
			chunk = addresses[chunk_start:chunk_start + ACCOUNT_BATCH_FETCH_SIZE]
			response = await self.post_symbol_node('/accounts', {'addresses': [str(address) for address in chunk]})
			if not isinstance(response, list):
				raise ValueError('Malformed Symbol accounts batch response during rollback')
			account_items_by_address = {}
			requested_addresses = {requested.bytes for requested in chunk}
			for item in response:
				address = bytes.fromhex(item['account']['address'])
				if address not in requested_addresses or address in account_items_by_address:
					raise ValueError('Unexpected or duplicate Symbol account in rollback batch response')
				account_items_by_address[address] = item

			for address in chunk:
				address_bytes = address.bytes
				item = account_items_by_address.get(address_bytes)
				if item is None:
					item = await self.get_symbol_node(f'/accounts/{address}', not_found_as_error=False)
					if _is_not_found_response(item):
						entries.append({
							'address': address_bytes,
							'account_row': None,
							'mosaic_rows': [],
							'overwrite_is_harvesting_active': True,
							'multisig_row': None
						})
						continue
					if not isinstance(item, dict) or 'account' not in item:
						raise ValueError(f'Malformed Symbol account lookup response for {address}')
					if bytes.fromhex(item['account']['address']) != address_bytes:
						raise ValueError(f'Symbol account lookup returned a different address for {address}')

				multisig_response = await self.get_symbol_node(
					f'/account/{address}/multisig', not_found_as_error=False)
				is_valid_multisig_response = isinstance(multisig_response, dict) and isinstance(
					multisig_response.get('multisig'), dict)
				if not _is_not_found_response(multisig_response) and not is_valid_multisig_response:
					raise ValueError(f'Malformed Symbol multisig response for {address}')
				account_row, mosaic_rows = create_account_row(
					item,
					self.symbol_facade.network,
					observed_height,
					native_mosaic_info.id,
					native_mosaic_info.divisibility)
				harvested_block_timestamp = dirty_addresses[address]
				account_row['is_harvesting_active'] = self._is_harvested_block_within_active_window(
					harvested_block_timestamp)
				entries.append({
					'address': address_bytes,
					'account_row': account_row,
					'mosaic_rows': mosaic_rows,
					'overwrite_is_harvesting_active': True,
					'multisig_row': None if _is_not_found_response(multisig_response) else create_multisig_row(
						address_bytes,
						multisig_response['multisig'],
						observed_height)
				})

		return entries

	async def _sync_block_pages(  # pylint: disable=too-many-locals
		self,
		start_height,
		chain_height,
		epoch_adjustment_seconds,
		native_mosaic_info,
		checkpoint_state
	):
		last_synced_height = None
		last_synced_block_hash = None
		all_offsets = range(start_height - 1, chain_height, MAX_PAGE_SIZE)
		previous_block_hash = self._get_saved_block_hash(start_height - 1) if start_height > 1 else None

		for batch_start in range(0, len(all_offsets), BLOCK_PAGE_FETCH_CONCURRENCY):
			batch_offsets = all_offsets[batch_start:batch_start + BLOCK_PAGE_FETCH_CONCURRENCY]
			batch = self._active_performance.start_batch(
				batch_offsets[0] + 1,
				min(chain_height, batch_offsets[-1] + MAX_PAGE_SIZE))
			is_final_batch = False
			try:
				with batch.measure('block_fetch_ms', 'block_fetch'):
					pages = await asyncio.gather(*[self._get_block_page(offset) for offset in batch_offsets])

					batch_rows = []
					for offset, blocks in zip(batch_offsets, pages):
						if not blocks:
							raise ValueError(f'Expected Symbol blocks at offset {offset} before chain height {chain_height}')

						target_blocks = [block for block in blocks if int(block['block']['height']) <= chain_height]
						replacement = checkpoint_state['replacement_replay']
						if replacement is not None:
							self._check_replacement_replay_blocks(replacement, target_blocks)

						rows = [create_block_row(block, epoch_adjustment_seconds, self.symbol_facade.network) for block in target_blocks]
						if not rows:
							raise ValueError(
								f'Symbol block page at offset {offset} does not contain blocks at or below chain height {chain_height}')

						self._validate_block_page(rows, offset + 1)
						previous_block_hash = self._validate_block_chain(rows, previous_block_hash)
						last_row = rows[-1]
						if len(blocks) < MAX_PAGE_SIZE and last_row['height'] < chain_height:
							raise ValueError(
								f'Short Symbol block page ended at height {last_row["height"]} before chain height {chain_height}')

						batch_rows.extend(rows)
						batch.set_count('block_count', len(batch_rows))
						last_synced_height = last_row['height']
						last_synced_block_hash = last_row['hash']

						if len(blocks) < MAX_PAGE_SIZE:
							batch.set_range(batch_rows[0]['height'], batch_rows[-1]['height'])
							is_final_batch = True
							break
			except Exception as exception:
				# Ranges aren't known until the entire block-fetch window is available.
				self._active_performance.fail_batch(batch)
				self._log_performance_event(
					batch, 'symbol_sync_batch_failed', 'failed', exception)
				raise

			await self._sync_block_rows_in_ranges(
				batch_rows, epoch_adjustment_seconds, native_mosaic_info, checkpoint_state, batch)
			if is_final_batch:
				return last_synced_height, last_synced_block_hash

		return last_synced_height, last_synced_block_hash

	async def _sync_block_rows_in_ranges(
		self,
		block_rows,
		epoch_adjustment_seconds,
		native_mosaic_info,
		checkpoint_state,
		batch
	):
		"""Completes and checkpoints each transaction-count-limited block range."""

		block_ranges = self._split_block_rows_by_transaction_count(block_rows, self._max_transactions_per_batch)
		# Attribute the shared block-prefetch timing and request counts to the first range only.
		for range_index, range_rows in enumerate(block_ranges):
			if range_index:
				batch = self._active_performance.start_batch(
					range_rows[0]['height'], range_rows[-1]['height'])
			else:
				batch.set_range(range_rows[0]['height'], range_rows[-1]['height'])
			batch.set_count('block_count', len(range_rows))
			try:
				await self._sync_block_batch_with_dirty_state(
					range_rows, epoch_adjustment_seconds, native_mosaic_info, batch, checkpoint_state)
				if checkpoint_state['replacement_replay'] is None or range_rows[-1]['height'] == checkpoint_state['chain'].height:
					await self._checkpoint_sync_batch(range_rows, checkpoint_state, batch)
					self._record_performance('set_last_completed_height', batch.end_height)

				self._record_performance('complete_batch', batch)
				self._log_performance_event(
					batch, 'symbol_sync_batch_completed', 'completed')
			except Exception as exception:
				self._active_performance.fail_batch(batch)
				self._log_performance_event(
					batch, 'symbol_sync_batch_failed', 'failed', exception)
				raise

	@staticmethod
	def _split_block_rows_by_transaction_count(block_rows, max_transactions_per_batch=DEFAULT_MAX_TRANSACTIONS_PER_BATCH):
		"""Partitions contiguous block rows using their embedded-inclusive transaction counts."""

		if not block_rows:
			return []

		ranges = []
		current_range = []
		current_transaction_count = 0
		for row in block_rows:
			transaction_count = row['total_transactions_count']
			if current_range and current_transaction_count + transaction_count > max_transactions_per_batch:
				ranges.append(current_range)
				current_range = []
				current_transaction_count = 0

			current_range.append(row)
			current_transaction_count += transaction_count

		if current_range:
			ranges.append(current_range)

		return ranges

	async def _checkpoint_sync_batch(self, batch_rows, checkpoint_state, batch):
		"""Publishes a completely written batch before performance state or later work advances."""

		last_row = batch_rows[-1]
		batch.set_phase('checkpoint_commit')
		replacement = checkpoint_state['replacement_replay']
		if replacement is not None:
			chain = checkpoint_state['chain']
			budget = self._reconciliation_budget_factory()
			latest = await self._read_reconciliation_evidence(self._read_sync_chain(chain.max_height), budget)
			if latest.node_height < last_row['height']:
				raise EvidenceChanged('Node chain tip fell below the authenticated Symbol replacement range')

			cut = checkpoint_state['state']['last_synced_height'] or 0
			self._check_fresh_finality(replacement.finalized, latest.finalized, VerifiedFinalityRange(cut, replacement.blocks))
			checkpoint_state['chain'] = chain._replace(node_height=latest.node_height)

		self._commit_fork_checkpoint(checkpoint_state, last_row['height'], last_row['hash'], batch_rows[0]['height'])

	def _commit_fork_checkpoint(self, checkpoint, height, block_hash, batch_start=None):  # pylint: disable=too-many-locals
		chain = checkpoint['chain']
		state = checkpoint['state'] or self._empty_sync_state()
		recovery = checkpoint['recovery']
		finalized = chain.finalized
		previous_height = state['last_synced_height'] or 0
		verified = checkpoint['verified'] or self._recorded_finality(recovery)
		published = self._published_finality(state)
		if height and verified.height <= finalized.height <= height:
			if finalized.height:
				self._check_checkpoint_finality(finalized)

			verified = finalized
			if height == chain.height:
				published = finalized

		continuity = max(height, checkpoint['continuity_height'] or 0)
		reusable_height = recovery['reusable_height']
		reusable_hash = recovery['reusable_hash']
		if batch_start is not None:
			# Write intent invalidates the saved upper checkpoint in its own
			# transaction. This checkpoint must never copy it back from memory.
			if reusable_height is not None and batch_start <= reusable_height:
				reusable_height, reusable_hash = None, None
		else:
			was_lowered = height < previous_height <= continuity
			precedes_previous_tip = reusable_height is None or reusable_height < previous_height
			revision_matches = recovery['block_revision'] == recovery['continuity_revision']
			previous_tip_is_reusable = was_lowered and precedes_previous_tip and revision_matches
			if previous_tip_is_reusable:
				reusable_height, reusable_hash = previous_height, state['last_synced_block_hash']

		if reusable_height is not None and reusable_height <= height:
			reusable_height, reusable_hash = None, None

		new_recovery = self._with_finality(
			recovery, verified, continuity_height=continuity, resume_height=None, stop_reason=None,
			reusable_height=reusable_height, reusable_hash=reusable_hash,
			expected_revision=checkpoint['expected_revision'],
			expected_sync=(
				state['last_synced_height'], state['last_synced_block_hash'],
				state['dirty_state_from_height'] if checkpoint['replacement_replay'] is not None or batch_start is None else batch_start))
		new_state = {
			**self._public_finality_fields(published),
			'status': 'healthy', 'chain_height': chain.height, 'last_synced_height': height or None,
			'last_synced_block_hash': block_hash, 'dirty_state_from_height': None,
			'fork_recovery': new_recovery
		}
		try:
			committed_recovery = self.symbol_db.checkpoint_sync_state(new_state)
		except ValueError as exception:
			raise SymbolRollbackError(str(exception)) from exception

		checkpoint.update(state=new_state, recovery=committed_recovery, verified=None)

	def _check_checkpoint_finality(self, finalized):
		local_hash = self._get_saved_block_hash(finalized.height)
		if local_hash is None:
			raise RecoveryStopped(ForkRecoveryStopReason.FINALIZED_HASH_CONFLICT, 'Finalized block is missing from local database')

		if local_hash != finalized.hash:
			raise RecoveryStopped(ForkRecoveryStopReason.FINALIZED_HASH_CONFLICT, 'Finalized block hash does not match local database')

	async def _sync_block_batch_with_dirty_state(  # pylint: disable=too-many-locals,too-many-statements
		self,
		batch_rows,
		epoch_adjustment_seconds,
		native_mosaic_info,
		batch,
		checkpoint_state
	):
		observed_finalized_height = min(checkpoint_state['chain'].height, checkpoint_state['chain'].finalized.height)
		expected_transaction_counts = {
			row['height']: TransactionCountExpectation(row['transactions_count'], row['total_transactions_count'])
			for row in batch_rows
		}
		with batch.measure('transaction_fetch_ms', 'transaction_fetch'):
			transaction_rows_by_height = await self._get_transaction_rows_by_height(
				batch_rows[0]['height'],
				batch_rows[-1]['height'],
				epoch_adjustment_seconds,
				expected_transaction_counts,
				observed_finalized_height
			)
			batch.set_count('transaction_count', sum(len(rows) for rows in transaction_rows_by_height.values()))

		start, end = batch_rows[0]['height'], batch_rows[-1]['height']
		replacement = checkpoint_state['replacement_replay']
		replay = checkpoint_state['hash_lock_replay']
		blocks = {} if replacement is None else {str(row['height']): replacement.blocks[str(row['height'])] for row in batch_rows}
		if replacement is not None:
			try:
				self._validate_replay_transaction_roots(blocks, transaction_rows_by_height)
			except (KeyError, TypeError, ValueError) as exception:
				raise EvidenceChanged(str(exception)) from exception

		with batch.measure('receipt_fetch_ms', 'receipt_fetch'):
			statement_items = None
			if replacement is None:
				receipt_rows_by_height = await self._get_receipt_rows_by_height(start, end)
			elif replacement.verifiable_receipts:
				statement_items = await self._get_transaction_statement_items(start, end)
				receipt_rows_by_height = self._create_receipt_rows_by_height(statement_items)
			else:
				await self._verify_receiptless_replay_before_write(start, end, blocks, has_hash_lock_replay=replay is not None)
				receipt_rows_by_height = {}

			batch.set_count('receipt_count', sum(len(rows) for rows in receipt_rows_by_height.values()))

		if replay is not None:
			self._check_hash_lock_replay_events(replay, batch_rows, transaction_rows_by_height, receipt_rows_by_height)

		with batch.measure('resolution_fetch_ms', 'resolution_fetch'):
			await self._resolve_sync_batch_transactions(transaction_rows_by_height, blocks, statement_items)

		batch.set_phase('dirty_key_collection')
		dirty_addresses = self._collect_dirty_addresses_for_batch(
			batch_rows,
			transaction_rows_by_height,
			receipt_rows_by_height)
		batch.set_count('dirty_account_count', len(dirty_addresses))
		observed_height = max(row['height'] for row in batch_rows)
		with batch.measure('account_fetch_ms', 'account_fetch'):
			dirty_account_rows = await self._fetch_dirty_accounts_for_batch(
				dirty_addresses,
				observed_height,
				native_mosaic_info)
		dirty_namespace_ids = self._expand_dirty_namespace_ids(
			self._collect_dirty_namespace_ids_for_batch(transaction_rows_by_height, receipt_rows_by_height))
		batch.set_count('dirty_namespace_count', len(dirty_namespace_ids))
		with batch.measure('namespace_fetch_ms', 'namespace_fetch'):
			dirty_namespace_entries = await self._fetch_dirty_namespaces(dirty_namespace_ids, observed_height)
		dirty_mosaic_ids = self._collect_dirty_mosaic_ids_for_batch(transaction_rows_by_height, receipt_rows_by_height)
		batch.set_count('dirty_mosaic_count', len(dirty_mosaic_ids))
		with batch.measure('mosaic_fetch_ms', 'mosaic_fetch'):
			dirty_mosaic_entries = await self._fetch_dirty_mosaics(dirty_mosaic_ids, observed_height)
		dirty_metadata_keys = self._collect_dirty_metadata_keys_for_batch(transaction_rows_by_height)
		batch.set_count('dirty_metadata_count', len(dirty_metadata_keys))
		with batch.measure('metadata_fetch_ms', 'metadata_fetch'):
			dirty_metadata_entries = await self._fetch_dirty_metadata(dirty_metadata_keys, observed_height)
		dirty_lock_keys = self._collect_dirty_lock_keys_for_batch(transaction_rows_by_height)
		batch.set_count('dirty_hash_lock_count', len(dirty_lock_keys.hash_keys))
		batch.set_count('dirty_secret_lock_count', len(dirty_lock_keys.secret_keys))
		with batch.measure('hash_lock_fetch_ms', 'hash_lock_fetch'):
			hash_keys = dirty_lock_keys.hash_keys
			if replay is not None:
				hash_keys = hash_keys.difference(replay.keys)

			dirty_hash_lock_entries = await self._fetch_dirty_hash_locks(list(hash_keys), observed_height)
			if replay is not None and observed_height == checkpoint_state['chain'].height:
				dirty_hash_lock_entries.extend(replay.entries)

		with batch.measure('secret_lock_fetch_ms', 'secret_lock_fetch'):
			dirty_secret_lock_entries = await self._fetch_dirty_secret_locks(
				list(dirty_lock_keys.secret_keys), observed_height)
		dirty_mosaic_restriction_keys = self._collect_dirty_mosaic_restriction_keys_for_batch(
			transaction_rows_by_height)
		batch.set_count('dirty_mosaic_restriction_count', len(dirty_mosaic_restriction_keys))
		with batch.measure('mosaic_restriction_fetch_ms', 'mosaic_restriction_fetch'):
			dirty_mosaic_restriction_entries = await self._fetch_dirty_mosaic_restrictions(
				list(dirty_mosaic_restriction_keys), observed_height)
		with batch.measure('db_write_total_ms', 'db_write'):
			first_height = batch_rows[0]['height']
			state = checkpoint_state['state'] or self._empty_sync_state()
			watermark = (state['last_synced_height'], state['last_synced_block_hash'])
			expected = {
				'expected_revision': checkpoint_state['expected_revision'],
				'expected_sync': (*watermark, state['dirty_state_from_height'])
			}
			try:
				if replacement is None:
					self.symbol_db.mark_sync_write_intent(first_height, expected_checkpoint=expected)
					expected['expected_sync'] = (*watermark, first_height)

				with batch.measure('block_transaction_receipt_write_ms', 'db_write'):
					checkpoint_state['expected_revision'] = self._sync_block_batch(
						batch_rows, transaction_rows_by_height, receipt_rows_by_height, expected_checkpoint=expected)
			except ForkCheckpointConflict as exception:
				raise SymbolRollbackError(str(exception)) from exception

			with batch.measure('account_multisig_write_ms', 'db_write'):
				self._write_dirty_accounts_for_batch(dirty_account_rows)
			with batch.measure('current_state_write_ms', 'db_write'):
				self.symbol_db.apply_namespace_entries(dirty_namespace_entries)
				self._write_dirty_mosaics(dirty_mosaic_entries)
				self._write_dirty_metadata(dirty_metadata_entries)
				self._write_dirty_hash_locks(dirty_hash_lock_entries)
				self._write_dirty_secret_locks(dirty_secret_lock_entries)
				self._write_dirty_mosaic_restrictions(dirty_mosaic_restriction_entries)

	def _check_replacement_replay_blocks(self, replay, target_blocks):
		for block in target_blocks:
			height = str(int(block['block']['height']))
			try:
				commitments = self._replay_block_commitments(block)
			except ValueError as exception:
				raise EvidenceChanged(str(exception)) from exception

			if commitments != replay.blocks.get(height):
				raise EvidenceChanged('Symbol Hash Lock replay reached a different checkpoint block')

	def _check_hash_lock_replay_events(self, replay, batch_rows, transaction_rows_by_height, receipt_rows_by_height):
		start, end = batch_rows[0]['height'], batch_rows[-1]['height']
		expected_transactions = {height: rows for height, rows in replay.transactions.items() if start <= int(height) <= end}
		expected_receipts = {height: rows for height, rows in replay.receipts.items() if start <= int(height) <= end}
		transactions = self._select_hash_lock_replay_transactions(transaction_rows_by_height)
		receipts = self._select_hash_lock_replay_receipts(receipt_rows_by_height, transactions)
		if expected_transactions != transactions or expected_receipts != receipts:
			raise EvidenceChanged('Symbol Hash Lock replay events changed after repair')

	async def _verify_receiptless_replay_before_write(self, start, end, blocks, *, has_hash_lock_replay):
		try:
			self._check_receiptless_roots(blocks)
			if await self._get_transaction_statement_page(start, end, 1):
				scope = 'Hash Lock replay' if has_hash_lock_replay else 'replacement replay'
				raise EvidenceChanged(f'Receiptless Symbol {scope} unexpectedly returned statements')
		except (CorruptDataException, KeyError, TypeError, ValueError) as exception:
			raise EvidenceChanged(str(exception)) from exception

	async def _verify_replay_receipts_before_write(self, blocks, statement_items):
		resolutions = {}
		try:
			await self._check_receipt_commitments(blocks, statement_items, resolutions, lambda: None)
		except (KeyError, TypeError, ValueError) as exception:
			raise EvidenceChanged(str(exception)) from exception

		return self._verified_resolution_entries(resolutions)

	async def _resolve_sync_batch_transactions(self, transactions, blocks, statement_items):
		verified_statements = None
		if statement_items is not None:
			verified_statements = await self._verify_replay_receipts_before_write(blocks, statement_items)
		elif blocks:
			verified_statements = {height: ResolutionStatements({}, {}) for height in transactions}

		await self._resolve_transaction_rows_for_batch(transactions, verified_statements)

	async def _sync_finalization_lock_cleanup(self, finalized_height):
		"""Reconciles all current Lock rows whose end height has reached finalization."""

		hash_lock_keys = self.symbol_db.get_hash_lock_hashes_reaching_finalized_height(finalized_height)
		secret_lock_keys = self.symbol_db.get_secret_lock_search_keys_reaching_finalized_height(finalized_height)
		# Fetch every replacement before the first cleanup write so a failed request leaves all state untouched.
		try:
			hash_lock_entries = await self._fetch_dirty_hash_locks(hash_lock_keys, finalized_height)
			secret_lock_entries = await self._fetch_dirty_secret_locks(secret_lock_keys, finalized_height)
		except (KeyError, TypeError, ValueError) as exception:
			raise CorruptDataException(f'Invalid Symbol finalized lock response: {exception}') from exception

		self.symbol_db.apply_finalization_lock_entries(hash_lock_entries, secret_lock_entries)

	def _sync_block_batch(self, batch_rows, transaction_rows_by_height, receipt_rows_by_height, *, expected_checkpoint=None):
		"""Writes previously-fetched block, transaction, and receipt rows for one batch.

		The block write returns the revision created by its transaction. Later receipt writes update
		rewards only and leave the history revision unchanged.
		"""

		revision = self.symbol_db.upsert_blocks(batch_rows, expected_checkpoint=expected_checkpoint)
		self._upsert_transactions_for_batch(batch_rows, transaction_rows_by_height)
		self._upsert_receipts_for_batch(batch_rows, receipt_rows_by_height)
		return revision

	def _upsert_transactions_for_batch(self, block_rows, rows_by_height):
		for row in block_rows:
			self.symbol_db.upsert_transactions_for_height(row['height'], rows_by_height.get(row['height'], []))

	async def _get_transaction_rows_by_height(  # pylint: disable=too-many-locals
		self,
		start_height,
		end_height,
		epoch_adjustment_seconds,
		expected_transaction_counts,
		observed_finalized_height=None
	):
		# Source: _symbol/openapi/spec/schemas/Pagination.yml and TransactionPage.yml at 0f4c95e7098bbd84a8ceb9e2a101496bdfe662cf.
		# Symbol pagination exposes pageNumber/pageSize only; finalized ranges derive page count from block metadata.
		expected_total = sum(expectation.total_count for expectation in expected_transaction_counts.values())
		is_finalized_range = is_exact_integer(observed_finalized_height) and observed_finalized_height >= end_height
		page_results = {1: await self._get_transaction_page(start_height, end_height, 1)}
		if is_finalized_range:
			page_count = max(1, (expected_total + MAX_PAGE_SIZE - 1) // MAX_PAGE_SIZE)
			self._validate_transaction_page_count(page_results[1], 1, self._expected_transaction_page_size(expected_total, 1))
			if page_count > 1:
				await self._get_transaction_pages_bounded(
					start_height,
					end_height,
					expected_total,
					end_page_number=page_count,
					page_results=page_results)
		else:
			page_number = 1
			while len(page_results[page_number]) == MAX_PAGE_SIZE:
				page_number += 1
				page_results[page_number] = await self._get_transaction_page(start_height, end_height, page_number)
			page_count = len(page_results)

		items = [
			item
			for page_number in range(1, page_count + 1)
			for item in page_results[page_number]
		]
		if len(items) != expected_total:
			raise ValueError(f'Expected {expected_total} Symbol transactions, received {len(items)}')

		return self._create_transaction_rows_by_height(items, epoch_adjustment_seconds, expected_transaction_counts)

	def _create_transaction_rows_by_height(self, items, epoch_adjustment_seconds, expected_transaction_counts):
		rows_by_height = {}
		seen_transaction_keys = set()
		for item in items:
			if not isinstance(item, dict):
				raise ValueError('Malformed Symbol transaction item')

			row = create_transaction_row(item, self.symbol_facade.network, epoch_adjustment_seconds)
			transaction_key = self._transaction_identity(row)
			if transaction_key in seen_transaction_keys:
				raise ValueError(f'Duplicate Symbol transaction at height {row["height"]}')

			seen_transaction_keys.add(transaction_key)
			if row['height'] not in expected_transaction_counts:
				raise ValueError(f'Symbol transaction height {row["height"]} is outside requested range')

			rows_by_height.setdefault(row['height'], []).append(row)
			self._record_performance('add_count', 'transaction_count', 1)

		for height, expected_counts in expected_transaction_counts.items():
			rows_at_height = rows_by_height.get(height, [])
			actual_top_level_count = sum(not row['is_embedded'] for row in rows_at_height)
			if actual_top_level_count != expected_counts.top_level_count:
				raise ValueError(
					f'Expected {expected_counts.top_level_count} top-level Symbol transactions at height {height}, '
					f'received {actual_top_level_count}')
			if len(rows_at_height) != expected_counts.total_count:
				raise ValueError(
					f'Expected {expected_counts.total_count} total Symbol transactions at height {height}, '
					f'received {len(rows_at_height)}')

		return rows_by_height

	@staticmethod
	def _expected_transaction_page_size(expected_total, page_number):
		page_start = (page_number - 1) * MAX_PAGE_SIZE
		return max(0, min(MAX_PAGE_SIZE, expected_total - page_start))

	async def _get_transaction_page(self, start_height, end_height, page_number):
		response = await self.get_symbol_node(
			f'/transactions/confirmed?fromHeight={start_height}&toHeight={end_height}'
			f'&pageSize={MAX_PAGE_SIZE}&pageNumber={page_number}&order=asc&embedded=true'
		)
		if not isinstance(response, dict) or 'data' not in response or 'pagination' not in response:
			raise ValueError('Malformed Symbol transaction page response')

		items = response['data']
		pagination = response['pagination']
		if not isinstance(items, list) or not isinstance(pagination, dict):
			raise ValueError('Malformed Symbol transaction page response')
		if 'pageNumber' not in pagination or 'pageSize' not in pagination:
			raise ValueError('Malformed Symbol transaction pagination')
		if not is_exact_integer(pagination['pageNumber']) or not is_exact_integer(pagination['pageSize']):
			raise ValueError('Invalid Symbol transaction pagination')
		if pagination['pageNumber'] != page_number:
			raise ValueError(
				f'Symbol transaction page number {pagination["pageNumber"]} does not match requested page {page_number}')
		if pagination['pageSize'] != MAX_PAGE_SIZE:
			raise ValueError('Symbol transaction page size does not match requested page size')
		if len(items) > MAX_PAGE_SIZE:
			raise ValueError('Symbol transaction page data exceeds requested page size')

		return items

	@staticmethod
	def _validate_transaction_page_count(items, page_number, expected_count):
		if len(items) != expected_count:
			raise ValueError(
				f'Expected {expected_count} transactions on Symbol transaction page {page_number}, received {len(items)}')

	async def _get_transaction_pages_bounded(
		self,
		start_height,
		end_height,
		expected_total,
		end_page_number,
		page_results
	):
		next_page_number = 2
		allocation_lock = asyncio.Lock()

		async def fetch_pages():
			nonlocal next_page_number
			while True:
				async with allocation_lock:
					if next_page_number > end_page_number:
						return
					page_number = next_page_number
					next_page_number += 1

				items = await self._get_transaction_page(start_height, end_height, page_number)
				self._validate_transaction_page_count(
					items,
					page_number,
					self._expected_transaction_page_size(expected_total, page_number))
				page_results[page_number] = items

		worker_count = min(TRANSACTION_PAGE_FETCH_CONCURRENCY, end_page_number - 1)
		workers = [asyncio.create_task(fetch_pages()) for _ in range(worker_count)]
		try:
			await asyncio.gather(*workers)
		except BaseException:  # pylint: disable=broad-exception-caught
			await self._cancel_transaction_page_workers(workers)
			raise

	@staticmethod
	async def _cancel_transaction_page_workers(workers):
		for worker in workers:
			if not worker.done():
				worker.cancel()

		cleanup = asyncio.gather(*workers, return_exceptions=True)
		# Preserve the original page-fetch exception by draining workers despite one cancellation during cleanup.
		# Retry the shielded wait once; another cancellation during that retry propagates instead,
		# so worker collection is not guaranteed under repeated cancellation.
		try:
			await asyncio.shield(cleanup)
		except asyncio.CancelledError:
			await asyncio.shield(cleanup)

	@staticmethod
	def _transaction_identity(row):
		if row['is_embedded']:
			return 'embedded', row['aggregate_hash'], row['embedded_index']

		return 'top_level', row['hash']

	async def _get_block_page(self, offset):
		response = await self.get_symbol_node(f'/blocks?pageSize={MAX_PAGE_SIZE}&offset={offset}&orderBy=height')
		return self._get_node_page_data(response, 'Malformed Symbol block page response')

	async def _get_receipt_rows_by_height(self, start_height, end_height):
		return self._create_receipt_rows_by_height(await self._get_transaction_statement_items(start_height, end_height))

	async def _get_transaction_statement_items(self, start_height, end_height):
		statement_items = []
		page_number = 1
		while True:
			items = await self._get_transaction_statement_page(start_height, end_height, page_number)
			statement_items.extend(items)
			if len(items) < MAX_PAGE_SIZE:
				break

			page_number += 1

		return statement_items

	async def _get_transaction_statement_page(self, start_height, end_height, page_number):
		response = await self.get_symbol_node(
			f'/statements/transaction?fromHeight={start_height}&toHeight={end_height}'
			f'&pageSize={MAX_PAGE_SIZE}&pageNumber={page_number}'
		)
		items = self._get_node_page_data(response, 'Malformed Symbol statement page response')
		if not isinstance(items, list):
			raise ValueError('Malformed Symbol statement page response')

		return items

	@staticmethod
	def _create_receipt_rows_by_height(statement_items):
		rows_by_height = defaultdict(list)
		for statement_item in statement_items:
			for row in create_receipt_rows(statement_item):
				rows_by_height[row['height']].append(row)

		return dict(rows_by_height)

	async def _get_resolution_statements(self, request):
		return self._resolution_entries(await self._get_resolution_statement_bodies(request))

	async def _download_resolution_statements(self, request, state, save):
		downloads = state.setdefault('resolution_downloads', {})
		key = f'{request.kind}:{request.height}'
		progress = downloads.setdefault(key, {'page': 1, 'bodies': {}})
		bodies = await self._get_resolution_statement_bodies(request, progress=progress, save=save)
		# _check_receipt_commitments downloads one kind at a time for this height.
		del state['resolution_downloads']

		return bodies

	async def _get_resolution_statement_bodies(self, request, *, progress=None, save=None):
		bodies = {} if progress is None else progress['bodies']
		page_number = 1 if progress is None else progress['page']
		while True:
			response = await self.get_symbol_node(
				f'/statements/resolutions/{request.kind}?height={request.height}&pageSize={MAX_PAGE_SIZE}&pageNumber={page_number}'
			)
			items = self._get_node_page_data(response, f'Malformed Symbol {request.kind} resolution page response')
			for item in items:
				statement = item['statement']
				height = self._parse_node_height(statement['height'], f'Malformed Symbol {request.kind} resolution height')
				if height != request.height:
					raise ValueError(f'Symbol {request.kind} resolution at height {height} does not match requested height {request.height}')

				unresolved = statement['unresolved'].upper()
				if unresolved in bodies:
					raise ValueError(f'Duplicate Symbol {request.kind} resolution statement at height {height} for {unresolved}')

				bodies[unresolved] = statement

			if len(items) < MAX_PAGE_SIZE:
				return list(bodies.values())

			page_number += 1
			if progress is not None:
				progress['page'] = page_number
				save()

	@staticmethod
	def _get_node_page_data(response, error_message):
		if not isinstance(response, dict) or 'data' not in response:
			raise ValueError(error_message)

		return response['data']

	@staticmethod
	def _transaction_resolution_source(row, top_level_rows_by_hash):
		if not row['is_embedded']:
			return TransactionSource(row['block_index'] + 1, 0)

		parent_row = top_level_rows_by_hash.get(row['aggregate_hash'])
		if parent_row is None:
			raise ValueError(f'Missing aggregate transaction for embedded transaction at height {row["height"]}')

		return TransactionSource(parent_row['block_index'] + 1, row['embedded_index'] + 1)

	@staticmethod
	def _resolve_transaction_alias(statements, unresolved_hex, source, kind, height):
		if unresolved_hex not in statements:
			raise ValueError(f'Missing Symbol {kind} resolution at height {height} for unresolved {unresolved_hex}')

		resolved = select_resolution_entry(statements[unresolved_hex], source.primary_id, source.secondary_id)
		if resolved is None:
			raise ValueError(f'Missing Symbol {kind} resolution entry at height {height} for unresolved {unresolved_hex}')

		return resolved

	@staticmethod
	def _alias_values_for_transaction_row(row):
		addresses = [
			*(address_row['address'] for address_row in row['address_rows']),
			row['recipient_address'],
			row['target_address']
		]
		alias_addresses = {
			address
			for address in addresses
			if address is not None and Address(address).is_alias()
		}
		alias_mosaic_ids = {
			mosaic_row['mosaic_id']
			for mosaic_row in row['mosaic_rows']
			if is_alias_mosaic_id(mosaic_row['mosaic_id'])
		}
		return alias_addresses, alias_mosaic_ids

	@classmethod
	def _alias_values_for_transaction_rows(cls, transaction_rows):
		alias_addresses = set()
		alias_mosaic_ids = set()
		for row in transaction_rows:
			row_alias_addresses, row_alias_mosaic_ids = cls._alias_values_for_transaction_row(row)
			alias_addresses.update(row_alias_addresses)
			alias_mosaic_ids.update(row_alias_mosaic_ids)

		return alias_addresses, alias_mosaic_ids

	def _resolve_transaction_row(self, row, top_level_rows_by_hash, resolution_statements, height):
		alias_addresses, alias_mosaic_ids = self._alias_values_for_transaction_row(row)
		if not alias_addresses and not alias_mosaic_ids:
			return

		source = self._transaction_resolution_source(row, top_level_rows_by_hash)
		if alias_addresses:
			def _resolve_transaction_alias_address(address):
				resolved_hex = self._resolve_transaction_alias(
					resolution_statements.address,
					address.hex().upper(),
					source,
					'address',
					height)
				return bytes.fromhex(resolved_hex)

			for address_row in row['address_rows']:
				if address_row['address'] in alias_addresses:
					address_row['address'] = _resolve_transaction_alias_address(address_row['address'])
			row['address_rows'] = unique_address_rows(row['address_rows'])
			for field_name in ('recipient_address', 'target_address'):
				address = row[field_name]
				if address in alias_addresses:
					row[field_name] = _resolve_transaction_alias_address(address)

		if alias_mosaic_ids:
			def _resolve_transaction_alias_mosaic(mosaic_id):
				return self._resolve_transaction_alias(
					resolution_statements.mosaic,
					mosaic_id.upper(),
					source,
					'mosaic',
					height)

			for mosaic_row in row['mosaic_rows']:
				if mosaic_row['mosaic_id'] in alias_mosaic_ids:
					mosaic_row['mosaic_id'] = _resolve_transaction_alias_mosaic(mosaic_row['mosaic_id'])
				if 'metadata_target' == mosaic_row['role']:
					mosaic_row['mosaic_id'] = canonical_metadata_hex(mosaic_row['mosaic_id'], 'target id')

	async def _fetch_transaction_resolution_statements(self, transaction_rows_by_height):
		resolution_requests = []
		resolution_statements_by_height = {}
		for height, transaction_rows in transaction_rows_by_height.items():
			alias_addresses, alias_mosaic_ids = self._alias_values_for_transaction_rows(transaction_rows)
			if not alias_addresses and not alias_mosaic_ids:
				continue

			resolution_statements_by_height[height] = ResolutionStatements({}, {})
			if alias_addresses:
				resolution_requests.append(ResolutionRequest(height, 'address'))
			if alias_mosaic_ids:
				resolution_requests.append(ResolutionRequest(height, 'mosaic'))

		for batch_start in range(0, len(resolution_requests), RESOLUTION_FETCH_CONCURRENCY):
			batch_requests = resolution_requests[batch_start:batch_start + RESOLUTION_FETCH_CONCURRENCY]
			batch_statements = await asyncio.gather(*(
				self._get_resolution_statements(request)
				for request in batch_requests
			))
			for request, statements in zip(batch_requests, batch_statements):
				resolution_statements_by_height[request.height] = resolution_statements_by_height[request.height]._replace(
					**{request.kind: statements})

		return resolution_statements_by_height

	async def _resolve_transaction_rows_for_batch(self, transaction_rows_by_height, verified_statements=None):
		resolution_statements_by_height = verified_statements
		if resolution_statements_by_height is None:
			resolution_statements_by_height = await self._fetch_transaction_resolution_statements(transaction_rows_by_height)

		for height, transaction_rows in transaction_rows_by_height.items():
			if height not in resolution_statements_by_height:
				continue

			resolution_statements = resolution_statements_by_height[height]
			top_level_rows_by_hash = {
				row['hash']: row
				for row in transaction_rows
				if not row['is_embedded']
			}
			for row in transaction_rows:
				self._resolve_transaction_row(row, top_level_rows_by_hash, resolution_statements, height)

	@staticmethod
	def _calculate_block_reward(receipts):
		return sum(receipt['amount'] for receipt in receipts if INFLATION_RECEIPT_TYPE == receipt['receipt_type'])

	def _upsert_receipts_for_batch(self, block_rows, rows_by_height):
		for row in block_rows:
			receipt_rows = rows_by_height.get(row['height'], [])
			block_reward = self._calculate_block_reward(receipt_rows)
			self.symbol_db.upsert_receipts_for_height(row['height'], receipt_rows, block_reward)

	@staticmethod
	def _parse_epoch_adjustment(network_properties):
		raw_epoch_adjustment = network_properties['network']['epochAdjustment']
		raw_epoch_adjustment = str(raw_epoch_adjustment)
		return int(raw_epoch_adjustment[:-1] if raw_epoch_adjustment.endswith('s') else raw_epoch_adjustment)

	async def _get_network_properties(self):
		"""Gets and memoizes Symbol network properties for this puller instance."""

		if self._network_properties is None:
			self._network_properties = await self.get_symbol_node('/network/properties')

		return self._network_properties

	async def _get_native_mosaic_info(self):
		"""Gets and memoizes the native mosaic id and divisibility for this puller instance."""

		if self._native_mosaic_info:
			return self._native_mosaic_info

		network_properties = await self._get_network_properties()
		native_mosaic_id = normalize_mosaic_id(network_properties['chain']['currencyMosaicId'])
		mosaic_definition = await self.get_symbol_node(f'/mosaics/{native_mosaic_id}')
		self._native_mosaic_info = validate_native_mosaic_response(native_mosaic_id, mosaic_definition)

		return self._native_mosaic_info

	@staticmethod
	def _collect_dirty_addresses_for_batch(  # pylint: disable=too-many-branches
		block_rows,
		transaction_rows_by_height,
		receipt_rows_by_height
	):
		"""Collects unique dirty addresses touched by synced block, transaction, and receipt rows."""

		dirty_addresses = {}
		latest_block_by_beneficiary = {}
		for row in block_rows:
			current_row = latest_block_by_beneficiary.get(row['beneficiary_address'])
			if not current_row or (row['timestamp'], row['height']) > (current_row['timestamp'], current_row['height']):
				latest_block_by_beneficiary[row['beneficiary_address']] = row

		for address, block_row in latest_block_by_beneficiary.items():
			dirty_addresses[Address(address)] = {
				'is_beneficiary': True,
				'harvested_block_timestamp': block_row['timestamp']
			}

		for transaction_rows in transaction_rows_by_height.values():
			for transaction_row in transaction_rows:
				for address_row in transaction_row['address_rows']:
					# Address Restriction targets can have restriction state without account state, so keep the
					# transaction relation but do not require an account refresh for this role.
					if transaction_row['type'] in (
						TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value,
						TransactionType.MOSAIC_ADDRESS_RESTRICTION.value
					) and 'target' == address_row['role']:
						continue

					address = Address(address_row['address'])
					if address not in dirty_addresses:
						dirty_addresses[address] = {
							'is_beneficiary': False,
							'harvested_block_timestamp': None
						}

		for receipt_rows in receipt_rows_by_height.values():
			for receipt_row in receipt_rows:
				if 'balanceChange' == receipt_row['receipt_group']:
					receipt_addresses = [receipt_row['target_address']]
				elif 'balanceTransfer' == receipt_row['receipt_group']:
					receipt_addresses = [receipt_row['sender_address'], receipt_row['recipient_address']]
				else:
					continue

				for address in receipt_addresses:
					if address is not None:
						address = Address(address)
						if address not in dirty_addresses:
							dirty_addresses[address] = {
								'is_beneficiary': False,
								'harvested_block_timestamp': None
							}

		return dirty_addresses

	@staticmethod
	def _collect_dirty_namespace_ids_for_batch(transaction_rows_by_height, receipt_rows_by_height):
		"""Collects deduplicated namespace ids whose current state may have changed in a synced batch, in first-encounter order."""

		dirty_namespace_ids = {}
		for transaction_rows in transaction_rows_by_height.values():
			for transaction_row in transaction_rows:
				if TransactionType.NAMESPACE_REGISTRATION.value == transaction_row['type']:
					dirty_namespace_ids[transaction_row['body']['id']] = None
				elif transaction_row['type'] in (TransactionType.ADDRESS_ALIAS.value, TransactionType.MOSAIC_ALIAS.value):
					dirty_namespace_ids[transaction_row['body']['namespaceId']] = None

		for receipt_rows in receipt_rows_by_height.values():
			for receipt_row in receipt_rows:
				if receipt_row['receipt_type'] in (NAMESPACE_EXPIRED_RECEIPT_TYPE, NAMESPACE_DELETED_RECEIPT_TYPE):
					dirty_namespace_ids[receipt_row['artifact_id']] = None

		return list(dirty_namespace_ids)

	def _expand_dirty_namespace_ids(self, direct_namespace_ids):
		"""Preserves direct dirty first-encounter order and appends newly discovered root descendants.

		Namespace state is order-independent, but carrying transaction/receipt scan order through root expansion
		keeps namespace detail request chunks deterministic. A set would make request order implementation-dependent,
		while sorting would impose an unrelated namespace-ID priority.
		"""

		descendant_ids_by_root = self.symbol_db.get_namespace_ids_by_root_ids(direct_namespace_ids)
		namespace_ids = dict.fromkeys(direct_namespace_ids)
		for root_id in direct_namespace_ids:
			for namespace_id in descendant_ids_by_root.get(root_id, []):
				namespace_ids.setdefault(namespace_id, None)

		return list(namespace_ids)

	async def _fetch_dirty_namespaces(self, namespace_ids, observed_height):
		"""Fetches current namespace state and names for dirty namespace ids, processing ids in the given order."""

		if not namespace_ids:
			return []

		found_items_by_namespace_id = {}
		for chunk_start in range(0, len(namespace_ids), MAX_PAGE_SIZE):
			chunk = namespace_ids[chunk_start:chunk_start + MAX_PAGE_SIZE]
			for namespace_id, item in zip(chunk, await asyncio.gather(*(
				self.get_symbol_node(f'/namespaces/{namespace_id}', not_found_as_error=False)
				for namespace_id in chunk
			))):
				if not _is_not_found_response(item):
					found_items_by_namespace_id[namespace_id] = item

		level_ids = {}
		for item in found_items_by_namespace_id.values():
			for level_index in range(int(item['namespace']['depth'])):
				level_ids[item['namespace'][f'level{level_index}']] = None
		level_ids = list(level_ids)
		names_by_id = {}
		for chunk_start in range(0, len(level_ids), MAX_PAGE_SIZE):
			response = await self.post_symbol_node('/namespaces/names', {'namespaceIds': level_ids[chunk_start:chunk_start + MAX_PAGE_SIZE]})
			if not isinstance(response, list):
				raise ValueError('Malformed Symbol namespace names response')
			for name_entry in response:
				names_by_id[name_entry['id']] = name_entry['name']

		entries = []
		for namespace_id in namespace_ids:
			if namespace_id not in found_items_by_namespace_id:
				entries.append({'namespace_id': namespace_id})
				continue

			item = found_items_by_namespace_id[namespace_id]
			row = create_namespace_row(item, names_by_id, observed_height)
			entries.append({
				'row': row,
				'alias_rows': create_alias_name_rows(row)
			})

		return entries

	@staticmethod
	def _collect_dirty_mosaic_ids_for_batch(transaction_rows_by_height, receipt_rows_by_height):
		"""Collects deduplicated mosaic ids whose current state may have changed in a synced batch."""

		dirty_mosaic_ids = {}
		for transaction_rows in transaction_rows_by_height.values():
			for transaction_row in transaction_rows:
				if transaction_row['type'] == TransactionType.MOSAIC_DEFINITION.value:
					dirty_mosaic_ids[transaction_row['body']['id']] = None
				elif transaction_row['type'] == TransactionType.MOSAIC_SUPPLY_CHANGE.value:
					dirty_mosaic_ids[transaction_row['mosaic_rows'][0]['mosaic_id']] = None

		for receipt_rows in receipt_rows_by_height.values():
			for receipt_row in receipt_rows:
				if receipt_row['receipt_type'] == MOSAIC_EXPIRED_RECEIPT_TYPE:
					dirty_mosaic_ids[receipt_row['artifact_id']] = None

		return list(dirty_mosaic_ids)

	async def _fetch_dirty_mosaics(self, mosaic_ids, observed_height, should_confirm_missing_mosaics=False):
		"""Fetches current mosaic state in batches and returns ordered upsert/delete entries."""

		if not mosaic_ids:
			return []

		found_items_by_mosaic_id = {}
		for chunk_start in range(0, len(mosaic_ids), MAX_PAGE_SIZE):
			chunk = mosaic_ids[chunk_start:chunk_start + MAX_PAGE_SIZE]
			response = await self.post_symbol_node('/mosaics', {'mosaicIds': chunk})
			if not isinstance(response, list):
				raise ValueError('Malformed Symbol mosaics batch response')
			for item in response:
				mosaic_id = item['mosaic']['id']
				if should_confirm_missing_mosaics and (mosaic_id not in chunk or mosaic_id in found_items_by_mosaic_id):
					raise ValueError('Unexpected or duplicate Symbol mosaic in rollback batch response')
				found_items_by_mosaic_id[mosaic_id] = item

		entries = []
		for mosaic_id in mosaic_ids:
			mosaic_item = found_items_by_mosaic_id.get(mosaic_id)
			if mosaic_item is None and should_confirm_missing_mosaics:
				mosaic_item = await self._fetch_rollback_mosaic_by_id(mosaic_id)

			if mosaic_item is None:
				entries.append({'mosaic_id': mosaic_id})
			else:
				entries.append({'row': create_mosaic_row(mosaic_item, observed_height)})

		return entries

	async def _fetch_rollback_mosaic_by_id(self, mosaic_id):
		"""Confirms a missing batch mosaic before rollback may delete its current row."""

		if self._native_mosaic_info and mosaic_id == self._native_mosaic_info.id:
			raise ValueError('Native mosaic exists by singular lookup but is missing from Symbol mosaics batch response')

		mosaic_item = await self.get_symbol_node(f'/mosaics/{mosaic_id}', not_found_as_error=False)
		if _is_not_found_response(mosaic_item):
			return None
		if not isinstance(mosaic_item, dict) or not isinstance(mosaic_item.get('mosaic'), dict):
			raise ValueError(f'Malformed Symbol mosaic lookup response for {mosaic_id}')
		if mosaic_item['mosaic']['id'] != mosaic_id:
			raise ValueError(f'Symbol mosaic lookup returned a different id for {mosaic_id}')

		return mosaic_item

	def _write_dirty_mosaics(self, entries):
		"""Writes fetched mosaic current-state changes after namespace rows are persisted."""

		for entry in entries:
			if 'mosaic_id' in entry:
				self.symbol_db.delete_mosaic(entry['mosaic_id'])
			else:
				self.symbol_db.upsert_mosaic(entry['row'])

	@staticmethod
	def _collect_dirty_metadata_keys_for_batch(transaction_rows_by_height):
		"""Collects natural keys for exact-key metadata searches and deduplication.

		Empty exact-key searches must delete the local row, but supply no composite hash from the node.
		"""

		dirty_metadata_keys = {}
		for transaction_rows in transaction_rows_by_height.values():
			for transaction_row in transaction_rows:
				metadata_type = METADATA_TRANSACTION_TYPE_LABELS.get(transaction_row['type'])
				if metadata_type is None:
					continue

				metadata_target_rows = [
					mosaic_row
					for mosaic_row in transaction_row['mosaic_rows']
					if 'metadata_target' == mosaic_row['role']
				]
				body = transaction_row['body']
				target_id = metadata_target_from_relations(metadata_type, metadata_target_rows)
				if 'namespace' == metadata_type:
					target_id = body['targetNamespaceId']

				key = canonical_metadata_key({
					'metadata_type': metadata_type,
					'source_address': transaction_row['signer_address'],
					'target_address': transaction_row['target_address'],
					'scoped_metadata_key': body['scopedMetadataKey'],
					'target_id': target_id
				})
				key_identity = (
					key['metadata_type'],
					key['source_address'],
					key['target_address'],
					key['scoped_metadata_key'],
					key['target_id'])
				dirty_metadata_keys[key_identity] = key

		return list(dirty_metadata_keys.values())

	@staticmethod
	def _union_metadata_keys(*metadata_key_collections):
		metadata_keys = {}
		for collection in metadata_key_collections:
			for metadata_key in collection:
				metadata_key = canonical_metadata_key(metadata_key)
				identity = (
					metadata_key['metadata_type'],
					metadata_key['source_address'],
					metadata_key['target_address'],
					metadata_key['scoped_metadata_key'],
					metadata_key['target_id'])
				metadata_keys[identity] = metadata_key

		return list(metadata_keys.values())

	async def _fetch_dirty_metadata(self, metadata_keys, observed_height):
		"""Fetches metadata by exact natural key in bounded concurrent batches."""

		if not metadata_keys:
			return []

		async def fetch_entry(metadata_key):
			address = Address(metadata_key['source_address'])
			target_address = Address(metadata_key['target_address'])
			metadata_number = METADATA_TYPE_NUMBERS[metadata_key['metadata_type']]
			path = (
				f'/metadata?sourceAddress={address}&targetAddress={target_address}'
				f'&scopedMetadataKey={metadata_key["scoped_metadata_key"]}&metadataType={metadata_number}'
			)
			if metadata_key['target_id'] is not None:
				path += f'&targetId={metadata_key["target_id"]}'

			response = await self.get_symbol_node(path)
			items = self._get_node_page_data(response, 'Malformed Symbol metadata search response')
			if not isinstance(items, list):
				raise ValueError('Malformed Symbol metadata search data')
			if len(items) > 1:
				raise ValueError('Symbol metadata exact-key search returned multiple entries')
			if not items:
				return {'key': metadata_key}

			return {'row': create_metadata_row(items[0], observed_height)}

		return await gather_in_chunks(metadata_keys, METADATA_FETCH_CONCURRENCY, fetch_entry)

	def _write_dirty_metadata(self, entries):
		"""Writes fetched metadata current-state changes after all batch fetches complete."""

		for entry in entries:
			if 'key' in entry:
				self.symbol_db.delete_metadata_by_key(entry['key'])
			else:
				self.symbol_db.upsert_metadata(entry['row'])

	@staticmethod
	def _assert_resolved_transaction_address(address, field_name, collector_name):
		if address is not None and Address(address).is_alias():
			raise ValueError(
				f'Unresolved Symbol transaction {field_name} reached {collector_name} dirty-key collection')

	@staticmethod
	def _assert_resolved_transaction_mosaic_id(mosaic_id, field_name, collector_name):
		try:
			is_unresolved = not isinstance(mosaic_id, str) or is_alias_mosaic_id(mosaic_id)
		except (TypeError, ValueError):
			is_unresolved = True
		if is_unresolved:
			raise ValueError(
				f'Unresolved Symbol transaction {field_name} reached {collector_name} dirty-key collection')

	def _collect_dirty_lock_keys_for_batch(self, transaction_rows_by_height):
		"""Collects Hash and Secret Lock dirty keys from transactions in the current batch."""

		hash_keys = set()
		secret_keys = set()
		for transaction_rows in transaction_rows_by_height.values():
			for transaction_row in transaction_rows:
				transaction_type = transaction_row['type']
				body = transaction_row['body']
				if TransactionType.HASH_LOCK.value == transaction_type:
					self._assert_lock_mosaic_rows_resolved(transaction_row, 'hash_lock')
					hash_keys.add(create_hash_lock_key(body['hash']))
				elif TransactionType.AGGREGATE_BONDED.value == transaction_type:
					hash_keys.add(create_hash_lock_key(transaction_row['hash']))
				elif transaction_type in (TransactionType.SECRET_LOCK.value, TransactionType.SECRET_PROOF.value):
					if TransactionType.SECRET_LOCK.value == transaction_type:
						self._assert_lock_mosaic_rows_resolved(transaction_row, 'secret_lock')
					self._assert_resolved_transaction_address(transaction_row['recipient_address'], 'recipient_address', 'Lock')
					owner_address = transaction_row['signer_address'] if TransactionType.SECRET_LOCK.value == transaction_type else None
					self._assert_resolved_transaction_address(owner_address, 'signer_address', 'Lock')
					secret_keys.add(create_secret_lock_search_key_from_hex_secret(
						owner_address,
						transaction_row['recipient_address'],
						body['secret'],
						lock_hash_algorithm_label(body['hashAlgorithm'])))

		return RollbackLockKeys(hash_keys, secret_keys)

	@staticmethod
	def _assert_lock_mosaic_rows_resolved(transaction_row, role):
		for mosaic_row in transaction_row.get('mosaic_rows', []):
			if mosaic_row.get('role') == role and mosaic_row.get('position') == 0:
				SymbolPuller._assert_resolved_transaction_mosaic_id(mosaic_row.get('mosaic_id'), 'mosaic_id', 'Lock')

	@staticmethod
	def _collect_dirty_mosaic_restriction_keys_for_batch(transaction_rows_by_height):
		"""Collects resolved Mosaic Restriction logical keys touched by transactions."""

		dirty_keys = set()
		for transaction_rows in transaction_rows_by_height.values():
			for transaction_row in transaction_rows:
				transaction_type = transaction_row['type']
				entry_type = MOSAIC_RESTRICTION_ENTRY_TYPE_BY_TRANSACTION_TYPE.get(transaction_type)
				if entry_type is None:
					continue

				position_zero_rows = [
					mosaic_row
					for mosaic_row in transaction_row['mosaic_rows']
					if mosaic_row['role'] == 'restriction' and mosaic_row['position'] == 0
				]
				if len(position_zero_rows) != 1:
					raise ValueError(
						f'Invalid Symbol transaction restriction mosaic relation at height {transaction_row["height"]}')
				mosaic_id = position_zero_rows[0]['mosaic_id']
				SymbolPuller._assert_resolved_transaction_mosaic_id(
					mosaic_id, 'mosaic_id', 'Mosaic Restriction')
				mosaic_id = mosaic_id.upper()
				if entry_type is MosaicRestrictionEntryType.ADDRESS:
					address = transaction_row['target_address']
					SymbolPuller._assert_resolved_transaction_address(address, 'target_address', 'Mosaic Restriction')
				else:
					address = None

				dirty_keys.add(create_mosaic_restriction_key(entry_type, mosaic_id, address))

		return dirty_keys

	async def _fetch_dirty_hash_locks(self, hash_keys, observed_height, rollback_evidence=RollbackHashLockEvidence()):
		"""Fetches Hash Lock detail state in bounded concurrent batches."""

		async def fetch_entry(hash_key):
			path = f'/lock/hash/{hash_key.hash.hex().upper()}'
			response = await self.get_symbol_node(path, not_found_as_error=False)
			if _is_not_found_response(response):
				if hash_key in rollback_evidence.keys and hash_key not in rollback_evidence.prunable_keys:
					raise RecoveryStopped(
						ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING,
						'Symbol Hash Lock absence is not supported by the shared branch')

				return {'hash': hash_key}

			row = create_hash_lock_row(response, observed_height)
			if row['hash'] != hash_key.hash:
				raise ValueError('Symbol Hash Lock response hash does not match dirty key')

			if hash_key in rollback_evidence.keys and (
				hash_key, row['owner_address'], row['mosaic_id'], row['amount'], row['end_height'], row['status']
			) not in rollback_evidence.states:
				raise RecoveryStopped(
					ForkRecoveryStopReason.RESTORATION_EVIDENCE_MISSING,
					'Symbol Hash Lock response does not match a proven creation on the shared branch or its proven state')

			return {'row': row}

		return await gather_in_chunks(hash_keys, LOCK_FETCH_CONCURRENCY, fetch_entry)

	async def _fetch_dirty_secret_locks(self, search_keys, observed_height):
		"""Fetches and exactly filters paginated Secret Lock search results in bounded concurrent batches."""

		async def fetch_entry(search_key):
			page_number = 1
			matching_rows = []
			composite_hashes = set()
			while True:
				path = '/lock/secret?'
				if search_key.owner_address is not None:
					path += f'address={Address(search_key.owner_address)}&'
				path += f'secret={search_key.secret.hex().upper()}&pageSize={MAX_PAGE_SIZE}&pageNumber={page_number}'
				response = await self.get_symbol_node(path, not_found_as_error=False)
				if _is_not_found_response(response):
					items = []
				else:
					if not isinstance(response, dict) or not isinstance(response.get('data'), list):
						raise ValueError('Malformed Symbol Secret Lock search response')
					items = response['data']

				for item in items:
					row = create_secret_lock_row(item, observed_height)
					if row['composite_hash'] in composite_hashes:
						raise ValueError('Duplicate Symbol Secret Lock composite hash')
					composite_hashes.add(row['composite_hash'])
					if search_key.owner_address is not None and row['owner_address'] != search_key.owner_address:
						continue
					if row['recipient_address'] != search_key.recipient_address:
						continue
					if row['secret'] != search_key.secret:
						continue
					if row['hash_algorithm'] != search_key.hash_algorithm:
						continue
					matching_rows.append(row)

				if len(items) < MAX_PAGE_SIZE:
					return {'key': search_key, 'rows': matching_rows}

				page_number += 1

		return await gather_in_chunks(search_keys, LOCK_FETCH_CONCURRENCY, fetch_entry)

	async def _fetch_dirty_mosaic_restrictions(self, restriction_keys, observed_height):
		"""Fetches exact Mosaic Restriction state in bounded concurrent batches."""

		async def fetch_entry(restriction_key):
			entry_type = mosaic_restriction_entry_type_to_enum_value(restriction_key.entry_type)
			path = (
				f'/restrictions/mosaic?mosaicId={restriction_key.mosaic_id}'
				f'&entryType={entry_type}&pageSize={MAX_PAGE_SIZE}&pageNumber=1'
			)
			if restriction_key.entry_type is MosaicRestrictionEntryType.ADDRESS:
				path += f'&targetAddress={Address(restriction_key.target_address)}'

			response = await self.get_symbol_node(path)
			if not isinstance(response, dict) or not isinstance(response.get('pagination'), dict):
				raise ValueError('Malformed Symbol Mosaic Restriction search response')
			pagination = response['pagination']
			# A page-one request does not guarantee matching node pagination metadata. Treating an
			# incorrectly paged empty result as a deletion would destructively remove current state.
			page_number = pagination.get('pageNumber')
			page_size = pagination.get('pageSize')
			if not is_exact_integer(page_number) or page_number != 1 or not is_exact_integer(page_size) or page_size != MAX_PAGE_SIZE:
				raise ValueError('Invalid Symbol Mosaic Restriction search pagination')
			items = response.get('data')
			if not isinstance(items, list):
				raise ValueError('Malformed Symbol Mosaic Restriction search data')
			if len(items) > 1:
				raise ValueError('Symbol Mosaic Restriction exact-key search returned multiple entries')
			if not items:
				return {'key': restriction_key, 'rows': []}

			row = create_mosaic_restriction_row(items[0], observed_height)
			row_key = MosaicRestrictionKey(row['entry_type'], row['mosaic_id'], row['target_address'])
			if row_key != restriction_key:
				raise ValueError('Symbol Mosaic Restriction response does not match dirty key')
			return {'key': restriction_key, 'rows': [row]}

		return await gather_in_chunks(
			restriction_keys, MOSAIC_RESTRICTION_FETCH_CONCURRENCY, fetch_entry)

	def _write_dirty_hash_locks(self, entries):
		"""Writes fetched Hash Lock current-state changes after all batch fetches complete."""

		for entry in entries:
			if 'hash' in entry:
				self.symbol_db.delete_hash_lock(entry['hash'])
			else:
				self.symbol_db.upsert_hash_lock(entry['row'])

	def _write_dirty_secret_locks(self, entries):
		"""Replaces fetched Secret Lock logical keys after all batch fetches complete."""

		for entry in entries:
			self.symbol_db.replace_secret_locks(entry['key'], entry['rows'])

	def _write_dirty_mosaic_restrictions(self, entries):
		"""Replaces fetched Mosaic Restriction logical keys after all batch fetches complete."""

		for entry in entries:
			self.symbol_db.replace_mosaic_restrictions(entry['key'], entry['rows'])

	async def _fetch_dirty_accounts_for_batch(  # pylint: disable=too-many-locals
		self,
		dirty_addresses,
		observed_height,
		native_mosaic_info
	):
		"""Fetches current-state account and multisig rows touched by a synced block batch."""

		addresses = list(dirty_addresses.keys())

		dirty_account_rows = []
		for chunk_start in range(0, len(addresses), ACCOUNT_BATCH_FETCH_SIZE):
			chunk = addresses[chunk_start:chunk_start + ACCOUNT_BATCH_FETCH_SIZE]
			accounts_response = await self.post_symbol_node('/accounts', {
				'addresses': [str(address) for address in chunk]
			})
			if not isinstance(accounts_response, list):
				raise ValueError('Malformed Symbol accounts batch response')
			account_items_by_address = {
				Address(bytes.fromhex(item['account']['address'])): item
				for item in accounts_response
			}

			multisig_responses = await asyncio.gather(*(
				self.get_symbol_node(f'/account/{address}/multisig', not_found_as_error=False)
				for address in chunk
			))

			for address, multisig_response in zip(chunk, multisig_responses):
				if address not in account_items_by_address:
					raise ValueError(f'Missing Symbol accounts batch item for address {address}')

				item = account_items_by_address[address]
				account_row, mosaic_rows = create_account_row(
					item,
					self.symbol_facade.network,
					observed_height,
					native_mosaic_info.id,
					native_mosaic_info.divisibility)

				dirty_info = dirty_addresses[address]
				overwrite_is_harvesting_active = dirty_info['is_beneficiary'] and self._is_harvested_block_within_active_window(
					dirty_info['harvested_block_timestamp'])
				if overwrite_is_harvesting_active:
					account_row['is_harvesting_active'] = True

				address_bytes = address.bytes
				dirty_account_rows.append({
					'address': address_bytes,
					'account_row': account_row,
					'mosaic_rows': mosaic_rows,
					'overwrite_is_harvesting_active': overwrite_is_harvesting_active,
					'multisig_row': None if _is_not_found_response(multisig_response) else create_multisig_row(
						address_bytes,
						multisig_response['multisig'],
						observed_height)
				})

		return dirty_account_rows

	def _write_dirty_accounts_for_batch(self, dirty_account_rows):
		"""Writes fetched dirty account current-state rows after block rows are persisted."""

		for dirty_account_row in dirty_account_rows:
			self.symbol_db.upsert_account_current_state(
				dirty_account_row['account_row'],
				dirty_account_row['mosaic_rows'],
				overwrite_is_harvesting_active=dirty_account_row['overwrite_is_harvesting_active'])
			self.symbol_db.upsert_multisig(
				dirty_account_row['address'],
				dirty_account_row['multisig_row'])

	@staticmethod
	def _is_harvested_block_within_active_window(harvested_block_timestamp):
		cutoff_timestamp = datetime.now(timezone.utc) - timedelta(days=HARVESTING_ACTIVE_WINDOW_DAYS)
		if harvested_block_timestamp.tzinfo is None:
			harvested_block_timestamp = harvested_block_timestamp.replace(tzinfo=timezone.utc)

		return harvested_block_timestamp >= cutoff_timestamp

	async def refresh_accounts(self):
		"""Refreshes accounts under workflow exclusion unless recovery blocks writes."""

		with self.symbol_db.workflow_lock():
			self.symbol_db.create_tables()
			self.symbol_db.initialize_fork_recovery()
			recovery = self.symbol_db.try_get_fork_recovery_state()
			if recovery['stop_reason'] is not None:
				log.info(f"Symbol account refresh skipped ({recovery['stop_reason'].value})")
				return False

			await self._refresh_accounts()
			return True

	async def _refresh_accounts(self):  # pylint: disable=too-many-locals
		refresh_run_id = str(uuid.uuid4())
		started_at = datetime.now(timezone.utc)

		try:
			self.symbol_db.begin_account_refresh(refresh_run_id, started_at)
			chain_info = await self.get_symbol_node('/chain/info')
			snapshot_height = int(chain_info['height'])
			native_mosaic_info = await self._get_native_mosaic_info()
			cutoff_timestamp = started_at - timedelta(days=HARVESTING_ACTIVE_WINDOW_DAYS)
			recently_harvesting_addresses = self.symbol_db.get_recently_harvesting_addresses(cutoff_timestamp)

			account_search_order = 0
			page_number = 1
			while True:
				response = await self.get_symbol_node(
					f'/accounts?pageSize={ACCOUNT_PAGE_SIZE}&pageNumber={page_number}&orderBy=id&order=desc')
				items = self._get_node_page_data(response, 'Malformed Symbol accounts page response')
				account_entries = []
				for item in items:
					account_row, mosaic_rows = create_account_row(
						item,
						self.symbol_facade.network,
						snapshot_height,
						native_mosaic_info.id,
						native_mosaic_info.divisibility)
					account_row['is_harvesting_active'] = account_row['address'] in recently_harvesting_addresses
					account_entries.append({
						'refresh_run_id': refresh_run_id,
						'account_search_order': account_search_order,
						'account_row': account_row,
						'mosaic_rows': mosaic_rows,
						'snapshot_height': snapshot_height,
						'snapshot_at': started_at
					})
					account_search_order += 1

				self.symbol_db.upsert_account_refresh_page(account_entries, page_number)
				if len(items) < ACCOUNT_PAGE_SIZE:
					break

				page_number += 1

			self.symbol_db.finalize_account_refresh(
				refresh_run_id,
				native_mosaic_info.id,
				snapshot_height,
				datetime.now(timezone.utc))
		except Exception as exception:
			try:
				self.symbol_db.mark_account_refresh_failed(refresh_run_id, str(exception))
			except Exception as state_error:  # pylint: disable=broad-exception-caught
				# Preserve the original refresh failure when failure-state persistence also fails.
				log.error(f'Failed to record Symbol account refresh failure: {state_error}')

			raise

		self._prune_account_refresh_generations()

	def _prune_account_refresh_generations(self):
		try:
			self.symbol_db.prune_account_refresh_generations()
		except Exception as exception:  # pylint: disable=broad-exception-caught
			sqlstate = exception.pgcode if isinstance(exception, PsycopgError) else None  # pylint: disable=no-member
			log_cleanup_failure_safely(
				self._cleanup_logger, 'Symbol account snapshot retention failed after successful workflow: '
				f'error_type={type(exception).__name__} sqlstate={sqlstate}')

	@staticmethod
	def _validate_block_page(rows, expected_start_height):
		for index, row in enumerate(rows):
			expected_height = expected_start_height + index
			if row['height'] != expected_height:
				raise ValueError(f'Unexpected Symbol block height {row["height"]}; expected {expected_height}')

	@staticmethod
	def _validate_block_chain(rows, previous_block_hash):
		for row in rows:
			expected_hash = NEMESIS_PREVIOUS_BLOCK_HASH if 1 == row['height'] else bytes(previous_block_hash)
			actual_previous_hash = bytes(row['previous_hash'])
			if actual_previous_hash != expected_hash:
				raise ValueError(
					f'Symbol block chain mismatch at height {row["height"]}: '
					f'expected previous hash {expected_hash.hex().upper()}, got {actual_previous_hash.hex().upper()}'
				)

			previous_block_hash = row['hash']

		return previous_block_hash
