from collections import namedtuple
from contextlib import contextmanager
from enum import Enum

from zenlog import log

from rest.model.symbol.Block import SymbolBlockView
from rest.model.symbol.format import format_address
from rest.model.symbol.Receipt import ReceiptPage, ReceiptPosition

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

RECEIPT_COLUMNS = '''
	receipts.id,
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
	mosaics.divisibility AS mosaic_divisibility
'''
RECEIPT_RESULT_COLUMNS = (
	'id',
	'height',
	'receipt_type',
	'receipt_group',
	'version',
	'sender_address',
	'recipient_address',
	'target_address',
	'mosaic_id',
	'amount',
	'artifact_id',
	'mosaic_divisibility'
)

SYNC_STATE_COLUMNS = [
	'status',
	'chain_height',
	'finalized_height',
	'finalized_hash',
	'finalized_epoch',
	'finalized_point',
	'last_synced_height',
	'last_synced_block_hash',
	'chain_revision',
	'updated_at'
]
READABLE_BLOCK_STATUSES = frozenset(['healthy', 'repairing'])
RECEIPT_READABLE_STATUS = 'healthy'

ReceiptQuery = namedtuple('ReceiptQuery', [
	'limit',
	'cursor',
	'height',
	'receipt_group',
	'receipt_type',
	'included_receipt_types',
	'target_address',
	'sender_address'
])


class ReceiptDataUnavailableError(RuntimeError):
	"""Raised when the Symbol receipt snapshot is not readable."""


class ReceiptCursorStaleError(RuntimeError):
	"""Raised when a receipt cursor belongs to an older chain revision."""

	MESSAGE = 'Receipt cursor is stale'

	def __init__(self):
		super().__init__(self.MESSAGE)


class SortOrder(str, Enum):
	ASC = 'ASC'
	DESC = 'DESC'


def _bytes_or_none(value):
	return bytes(value) if value else None


def _is_block_data_readable(sync_state):
	return bool(sync_state and sync_state.get('status') in READABLE_BLOCK_STATUSES and sync_state.get('last_synced_height'))


def _create_sync_state(columns, result):
	if not result:
		return None

	return dict(zip(columns, result))


def _mark_broken_receipt_connection(connection_owner, message, error):
	"""Marks a receipt connection for discard and logs the cleanup failure."""

	connection_owner.mark_for_discard()
	log.error(f'{message}: {error}')


class SymbolDatabase(DatabaseConnectionPool):
	"""Database access for Symbol Explorer data."""

	def check_connection(self):
		"""Checks whether the configured Symbol database is reachable and initialized."""

		return self.try_get_sync_state() is not None

	def try_get_sync_state(self):
		"""Gets the singleton Symbol sync state."""

		with self.connection() as connection:
			with connection.cursor() as cursor:
				cursor.execute(f'SELECT {", ".join(SYNC_STATE_COLUMNS)} FROM symbol_sync_state WHERE id = 1')
				result = cursor.fetchone()
				return _create_sync_state(SYNC_STATE_COLUMNS, result)

	def get_block(self, height):
		"""Gets a Symbol block by height."""

		sync_state = self.try_get_sync_state()
		if not _is_block_data_readable(sync_state):
			return None

		finalized_height = sync_state['finalized_height']

		with self.connection() as connection:
			with connection.cursor() as cursor:
				cursor.execute(f'SELECT {BLOCK_COLUMNS} FROM symbol_blocks WHERE height = %s', (height,))
				result = cursor.fetchone()

				return self._create_block_view(result, finalized_height) if result else None

	def get_block_head_height(self):
		"""Gets the latest synced height for the block list."""

		sync_state = self.try_get_sync_state()
		if not _is_block_data_readable(sync_state):
			return None

		return sync_state['last_synced_height']

	def get_receipts(self, query):
		"""Gets a readable Symbol receipt page from one consistent DB snapshot."""

		connection_owner = self.connection()
		with connection_owner as connection:
			with self._receipt_read_transaction(connection, connection_owner):
				with connection.cursor() as cursor:
					cursor.execute('''
						SELECT status, last_synced_height, chain_revision
						FROM symbol_sync_state
						WHERE id = 1
					''')
					sync_state = cursor.fetchone()
					if not sync_state or sync_state[0] != RECEIPT_READABLE_STATUS or sync_state[1] is None:
						raise ReceiptDataUnavailableError('Symbol backend data is unavailable')

					chain_revision = sync_state[2]
					if query.cursor and query.cursor.revision != chain_revision:
						raise ReceiptCursorStaleError()

					predicates = ['receipts.height <= %s']
					parameters = [sync_state[1]]
					if query.height is not None:
						predicates.append('receipts.height = %s')
						parameters.append(query.height)
					if query.receipt_group is not None:
						predicates.append('receipts.receipt_group = %s')
						parameters.append(query.receipt_group)
					if query.receipt_type is not None:
						predicates.append('receipts.receipt_type = %s')
						parameters.append(query.receipt_type)
					if query.included_receipt_types:
						predicates.append('receipts.receipt_type = ANY(%s::symbol_receipt_type[])')
						parameters.append(list(query.included_receipt_types))
					if query.target_address is not None:
						predicates.append('receipts.target_address = %s')
						parameters.append(query.target_address)
					if query.sender_address is not None:
						predicates.append('receipts.sender_address = %s')
						parameters.append(query.sender_address)
					if query.cursor:
						predicates.append('(receipts.height, receipts.id) < (%s, %s)')
						parameters.extend([query.cursor.height, query.cursor.id])

					parameters.append(query.limit + 1)
					cursor.execute(
						f'''
						SELECT {RECEIPT_COLUMNS}
						FROM symbol_receipts receipts
						LEFT JOIN symbol_mosaics mosaics ON mosaics.mosaic_id = receipts.mosaic_id
						WHERE {' AND '.join(predicates)}
						ORDER BY receipts.height DESC, receipts.id DESC
						LIMIT %s
						''',
						parameters)
					rows = [dict(zip(RECEIPT_RESULT_COLUMNS, row)) for row in cursor.fetchall()]
					has_next_page = len(rows) > query.limit
					items = tuple(rows[:query.limit])
					next_position = ReceiptPosition(items[-1]['height'], items[-1]['id']) if has_next_page else None
					return ReceiptPage(items, next_position, chain_revision)

	@staticmethod
	@contextmanager
	def _receipt_read_transaction(connection, connection_owner):
		"""Owns the transaction-local receipt snapshot and failure cleanup."""

		try:
			with connection.cursor() as cursor:
				cursor.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
			yield
		except BaseException:
			try:
				connection.rollback()
			except BaseException as cleanup_error:
				_mark_broken_receipt_connection(connection_owner, 'Failed to rollback receipt transaction', cleanup_error)
			raise
		try:
			connection.commit()
		except BaseException as cleanup_error:
			_mark_broken_receipt_connection(connection_owner, 'Failed to commit receipt transaction', cleanup_error)
			raise

	def get_blocks(self, from_height, limit, sort):
		"""Gets Symbol blocks using fromHeight cursor pagination."""

		sync_state = self.try_get_sync_state()
		if not _is_block_data_readable(sync_state):
			return None

		local_height = sync_state['last_synced_height']
		finalized_height = sync_state['finalized_height']
		if not isinstance(sort, SortOrder):
			raise ValueError('Sort must be either ASC or DESC')

		start_height, end_height = self._calculate_height_range(local_height, limit, from_height, sort)
		if start_height is None:
			return []

		with self.connection() as connection:
			with connection.cursor() as cursor:
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
	def _calculate_height_range(local_height, limit, from_height, sort):
		if 0 == limit:
			return None, None

		if from_height is not None and from_height < 1:
			raise ValueError('fromHeight must be greater than or equal to 1')

		if SortOrder.ASC == sort:
			start_height = from_height or 1
			if start_height > local_height:
				return None, None

			return start_height, min(local_height, start_height + limit - 1)

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
			harvester=format_address(result[11]),
			beneficiary_address=format_address(result[12]),
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
