from collections import namedtuple
from enum import Enum

from common.symbol.NativeMosaic import normalize_mosaic_id

from rest.model.symbol.Block import SymbolBlockView

from .DatabaseConnection import DatabaseConnectionPool

BLOCK_COLUMNS = '''
	height,
	hash,
	previous_hash,
	timestamp,
	network_timestamp,
	total_fee,
	transactions_count,
	statements_count,
	difficulty,
	fee_multiplier,
	block_type,
	signer_address,
	beneficiary_address,
	signature,
	size,
	proof_gamma,
	proof_verification_hash,
	proof_scalar,
	state_hash,
	transactions_hash,
	receipts_hash,
	state_hash_sub_cache_roots,
	voting_eligible_accounts_count,
	harvesting_eligible_accounts_count,
	total_voting_balance,
	previous_importance_block_hash,
	block_reward
'''

SYNC_STATE_COLUMNS = [
	'status',
	'chain_height',
	'finalized_height',
	'finalized_hash',
	'finalized_epoch',
	'finalized_point',
	'last_synced_height',
	'last_synced_block_hash',
	'dirty_state_from_height',
	'updated_at'
]
READABLE_BLOCK_STATUSES = frozenset(['healthy', 'repairing'])
ReceiptQuery = namedtuple(
	'ReceiptQuery',
	['limit', 'offset', 'height', 'receipt_group', 'receipt_type', 'included_receipt_types', 'target_address', 'sender_address'],
	defaults=(10, 0, None, None, None, (), None, None))
ReceiptRecord = namedtuple(
	'ReceiptRecord',
	['height', 'receipt_type', 'receipt_group', 'version', 'sender_address', 'recipient_address', 'target_address',
		'mosaic_id', 'amount', 'artifact_id', 'mosaic_divisibility'])


class SymbolDataUnavailable(RuntimeError):
	"""Raised when Symbol block data is not safely readable."""


class SortOrder(str, Enum):
	ASC = 'ASC'
	DESC = 'DESC'


def _bytes_or_none(value):
	return bytes(value) if value else None


def _address(value):
	from symbolchain.symbol.Network import Address  # pylint: disable=import-outside-toplevel
	return str(Address(bytes(value)))


def _get_readable_height(sync_state):
	if not sync_state or sync_state.get('status') not in READABLE_BLOCK_STATUSES:
		return None

	last_synced_height = sync_state.get('last_synced_height')
	if not isinstance(last_synced_height, int) or last_synced_height < 1:
		return None

	dirty_state_from_height = sync_state.get('dirty_state_from_height')
	if dirty_state_from_height is not None:
		if not isinstance(dirty_state_from_height, int) or dirty_state_from_height < 1:
			return None
		last_synced_height = min(last_synced_height, dirty_state_from_height - 1)

	return last_synced_height if last_synced_height >= 1 else None


def _is_non_public_state(sync_state):
	return sync_state['status'] == 'repairing' or sync_state['dirty_state_from_height'] is not None


def _is_generic_receipt_range_unavailable(sync_state):
	"""Returns whether an unbounded receipt query can have an unsafe page boundary."""

	dirty_state_from_height = sync_state['dirty_state_from_height']
	if dirty_state_from_height is None:
		return sync_state['status'] == 'repairing'

	return dirty_state_from_height <= sync_state['last_synced_height']


def _create_sync_state(columns, result):
	if not result:
		return None

	return dict(zip(columns, result))


class SymbolDatabase(DatabaseConnectionPool):
	"""Database access for Symbol Explorer data."""

	def __init__(self, db_config, native_mosaic_info=None):
		"""Creates a Symbol database accessor with optional native mosaic information."""

		super().__init__(db_config)
		self.native_mosaic_info = native_mosaic_info

	def check_connection(self):
		"""Checks whether the configured Symbol database is reachable and initialized."""

		return self.try_get_sync_state() is not None

	def try_get_sync_state(self):
		"""Gets the singleton Symbol sync state."""

		with self.connection() as connection:
			with connection.cursor() as cursor:
				return self._fetch_sync_state(cursor)

	def get_block(self, height):
		"""Gets a Symbol block by height."""

		with self.connection() as connection:
			with connection.cursor() as cursor:
				self._start_read_transaction(cursor)
				sync_state = self._fetch_sync_state(cursor)
				readable_height = _get_readable_height(sync_state)
				if readable_height is None:
					raise SymbolDataUnavailable('Symbol block data is unavailable')
				if height > readable_height:
					# Clean state returns None outside the published range, so HTTP returns 404.
					# Dirty or repairing state raises because it cannot be safely served, so HTTP returns 503.
					if _is_non_public_state(sync_state):
						raise SymbolDataUnavailable('Symbol block data is unavailable')
					return None

				finalized_height = sync_state['finalized_height']
				cursor.execute(f'SELECT {BLOCK_COLUMNS} FROM symbol_blocks WHERE height = %s', (height,))
				result = cursor.fetchone()

				return self._create_block_view(result, finalized_height) if result else None

	def get_receipts(self, query):  # pylint: disable=too-many-branches
		"""Gets a validated receipt page from one repeatable-read database snapshot."""

		with self.connection() as connection:
			with connection.cursor() as cursor:
				self._start_read_transaction(cursor)
				sync_state = self._fetch_sync_state(cursor)
				readable_height = _get_readable_height(sync_state)
				if readable_height is None:
					raise SymbolDataUnavailable('Symbol receipt data is unavailable')

				if query.height is not None:
					if query.height > readable_height:
						if _is_non_public_state(sync_state):
							raise SymbolDataUnavailable('Symbol receipt data is unavailable')
						return None
					cursor.execute(
						'SELECT 1 FROM symbol_blocks WHERE height = %s AND height <= %s',
						(query.height, readable_height))
					if not cursor.fetchone():
						return None

				where_clauses = ['receipts.height <= sync_state.last_synced_height']
				parameters = []
				if query.height is not None:
					where_clauses.append('receipts.height = %s')
					parameters.append(query.height)
				if query.receipt_group is not None:
					where_clauses.append('receipts.receipt_group = %s::symbol_receipt_group')
					parameters.append(query.receipt_group)
				if query.receipt_type is not None:
					where_clauses.append('receipts.receipt_type = %s::symbol_receipt_type')
					parameters.append(query.receipt_type)
				if query.included_receipt_types:
					where_clauses.append('receipts.receipt_type = ANY(%s::symbol_receipt_type[])')
					parameters.append(list(query.included_receipt_types))
				if query.target_address is not None:
					where_clauses.append('receipts.target_address = %s')
					parameters.append(query.target_address)
				if query.sender_address is not None:
					where_clauses.append('receipts.sender_address = %s')
					parameters.append(query.sender_address)

				# Never filter dirty rows before OFFSET; unsafe generic pages are rejected below.
				cursor.execute(
					f'''
					SELECT
						receipts.height,
						receipts.receipt_type,
						receipts.receipt_group,
						receipts.version,
						receipts.sender_address,
						receipts.recipient_address,
						receipts.target_address,
						receipts.mosaic_id,
						receipts.amount,
						receipts.artifact_id,
						mosaics.divisibility
					FROM symbol_receipts AS receipts
					JOIN symbol_sync_state AS sync_state ON sync_state.id = 1
					LEFT JOIN symbol_mosaics AS mosaics ON mosaics.mosaic_id = receipts.mosaic_id
					WHERE {' AND '.join(where_clauses)}
					ORDER BY receipts.height DESC, receipts.id DESC
					LIMIT %s OFFSET %s
					''',
					(*parameters, query.limit, query.offset))
				results = [ReceiptRecord(*result) for result in cursor.fetchall()]

				if any(receipt.height > readable_height for receipt in results):
					raise SymbolDataUnavailable('Symbol receipt data is unavailable')
				if query.height is None and _is_generic_receipt_range_unavailable(sync_state):
					raise SymbolDataUnavailable('Symbol receipt data is unavailable')
				if _is_non_public_state(sync_state) and self._requires_current_receipt_metadata(results):
					raise SymbolDataUnavailable('Symbol receipt data is unavailable')

				return results

	def _requires_current_receipt_metadata(self, receipts):
		"""Returns whether a receipt page depends on current non-native metadata."""

		for receipt in receipts:
			if receipt.mosaic_id is None:
				continue
			if self.native_mosaic_info and normalize_mosaic_id(receipt.mosaic_id) == self.native_mosaic_info.id:
				continue
			return True

		return False

	def get_blocks(self, from_height, limit, sort):
		"""Gets Symbol blocks using fromHeight cursor pagination."""

		if not isinstance(sort, SortOrder):
			raise ValueError('Sort must be either ASC or DESC')

		with self.connection() as connection:
			with connection.cursor() as cursor:
				self._start_read_transaction(cursor)
				sync_state = self._fetch_sync_state(cursor)
				readable_height = _get_readable_height(sync_state)
				if readable_height is None:
					raise SymbolDataUnavailable('Symbol block data is unavailable')

				local_height = sync_state['last_synced_height']
				finalized_height = sync_state['finalized_height']
				is_non_public = _is_non_public_state(sync_state)
				if is_non_public and from_height is not None and from_height > readable_height:
					raise SymbolDataUnavailable('Symbol block data is unavailable')
				start_height, end_height = self._calculate_height_range(
					local_height,
					limit,
					from_height,
					sort,
					should_clamp_to_local_height=not is_non_public)
				if start_height is None:
					return []
				if end_height > readable_height:
					raise SymbolDataUnavailable('Symbol block data is unavailable')

				cursor.execute(
					f'''
					SELECT {BLOCK_COLUMNS}
					FROM symbol_blocks
					WHERE height BETWEEN %s AND %s
					ORDER BY height {sort.value}
					''',
					(start_height, end_height))
				results = cursor.fetchall()

				return [self._create_block_view(result, finalized_height) for result in results]

	@staticmethod
	def _start_read_transaction(cursor):
		cursor.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')

	@staticmethod
	def _fetch_sync_state(cursor):
		cursor.execute(f'SELECT {", ".join(SYNC_STATE_COLUMNS)} FROM symbol_sync_state WHERE id = 1')
		return _create_sync_state(SYNC_STATE_COLUMNS, cursor.fetchone())

	@staticmethod
	def _calculate_height_range(local_height, limit, from_height, sort, should_clamp_to_local_height=True):
		if 0 == limit:
			return None, None

		if from_height is not None and from_height < 1:
			raise ValueError('fromHeight must be greater than or equal to 1')

		if SortOrder.ASC == sort:
			start_height = from_height or 1
			if start_height > local_height:
				return None, None

			end_height = start_height + limit - 1
			return start_height, min(local_height, end_height) if should_clamp_to_local_height else end_height

		start_height = from_height or local_height
		if start_height > local_height or start_height < 1:
			return None, None

		return max(1, start_height - limit + 1), start_height

	@staticmethod
	def _create_block_view(result, finalized_height):
		return SymbolBlockView(
			height=result[0],
			block_hash=_bytes_or_none(result[1]),
			previous_hash=_bytes_or_none(result[2]),
			timestamp=result[3],
			network_timestamp=result[4],
			total_fee=result[5],
			transaction_count=result[6],
			statement_count=result[7],
			difficulty=result[8],
			fee_multiplier=result[9],
			block_type=result[10],
			harvester=_address(result[11]),
			beneficiary_address=_address(result[12]),
			signature=_bytes_or_none(result[13]),
			size=result[14],
			proof_gamma=_bytes_or_none(result[15]),
			proof_verification_hash=_bytes_or_none(result[16]),
			proof_scalar=_bytes_or_none(result[17]),
			state_hash=_bytes_or_none(result[18]),
			transactions_hash=_bytes_or_none(result[19]),
			receipts_hash=_bytes_or_none(result[20]),
			state_hash_sub_cache_roots=result[21],
			voting_eligible_accounts_count=result[22],
			harvesting_eligible_accounts_count=result[23],
			total_voting_balance=result[24],
			previous_importance_block_hash=_bytes_or_none(result[25]),
			block_reward=result[26],
			is_finalized=bool(finalized_height and result[0] <= finalized_height)
		)
