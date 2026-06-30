from psycopg2 import Error as PsycopgError

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
	previous_importance_block_hash
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
	'updated_at'
]
LEGACY_SYNC_STATE_COLUMNS = [
	'status',
	'chain_height',
	'finalized_height',
	'finalized_hash',
	'last_synced_height',
	'last_synced_block_hash',
	'updated_at'
]
READABLE_BLOCK_STATUSES = frozenset(['healthy', 'repairing'])
UNDEFINED_COLUMN_SQLSTATE = '42703'


def _bytes_or_none(value):
	return bytes(value) if value else None


def _address(value):
	from symbolchain.symbol.Network import Address  # pylint: disable=import-outside-toplevel
	return str(Address(bytes(value)))


def _is_block_data_readable(sync_state):
	return bool(sync_state and sync_state.get('status') in READABLE_BLOCK_STATUSES and sync_state.get('last_synced_height'))


def _create_sync_state(columns, result):
	if not result:
		return None

	sync_state = dict(zip(columns, result))
	sync_state.setdefault('finalized_epoch', None)
	sync_state.setdefault('finalized_point', None)
	return sync_state


class SymbolDatabase(DatabaseConnectionPool):
	"""Database access for Symbol Explorer data."""

	def check_connection(self):
		"""Checks whether the configured Symbol database is reachable."""

		with self.connection() as connection:
			with connection.cursor() as cursor:
				cursor.execute('SELECT 1')
				return 1 == cursor.fetchone()[0]

	def get_sync_state(self):
		"""Gets the singleton Symbol sync state."""

		with self.connection() as connection:
			with connection.cursor() as cursor:
				try:
					cursor.execute(f'SELECT {", ".join(SYNC_STATE_COLUMNS)} FROM symbol_sync_state WHERE id = 1')
					result = cursor.fetchone()
				except PsycopgError as error:
					connection.rollback()
					if UNDEFINED_COLUMN_SQLSTATE != error.pgcode:
						raise

					cursor.execute(f'SELECT {", ".join(LEGACY_SYNC_STATE_COLUMNS)} FROM symbol_sync_state WHERE id = 1')
					result = cursor.fetchone()
					return _create_sync_state(LEGACY_SYNC_STATE_COLUMNS, result)

				return _create_sync_state(SYNC_STATE_COLUMNS, result)

	def get_block(self, height):
		"""Gets a Symbol block by height."""

		sync_state = self.get_sync_state()
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

		sync_state = self.get_sync_state()
		if not _is_block_data_readable(sync_state):
			return None

		return sync_state['last_synced_height']

	def get_blocks(self, limit, from_height, sort):
		"""Gets Symbol blocks using fromHeight cursor pagination."""

		sync_state = self.get_sync_state()
		if not _is_block_data_readable(sync_state):
			return None

		head_height = sync_state['last_synced_height']
		finalized_height = sync_state['finalized_height']
		order = sort.upper()
		if order not in ('ASC', 'DESC'):
			raise ValueError('Sort must be either ASC or DESC')

		start_height, end_height = self._calculate_height_range(head_height, limit, from_height, order)
		if not start_height:
			return []

		with self.connection() as connection:
			with connection.cursor() as cursor:
				cursor.execute(
					f'''
					SELECT {BLOCK_COLUMNS}
					FROM symbol_blocks
					WHERE height BETWEEN %s AND %s
					ORDER BY height {order}
					''',
					(min(start_height, end_height), max(start_height, end_height)))
				results = cursor.fetchall()

				return [self._create_block_view(result, finalized_height) for result in results]

	@staticmethod
	def _calculate_height_range(head_height, limit, from_height, sort):
		if 0 == limit:
			return None, None

		if from_height is not None and from_height < 1:
			raise ValueError('fromHeight must be greater than or equal to 1')

		if 'ASC' == sort.upper():
			start_height = from_height or 1
			if start_height > head_height:
				return None, None

			return start_height, min(head_height, start_height + limit - 1)

		start_height = from_height or head_height
		if start_height > head_height or start_height < 1:
			return None, None

		return start_height, max(1, start_height - limit + 1)

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
			is_finalized=bool(finalized_height and result[0] <= finalized_height)
		)
