from collections import namedtuple
from datetime import datetime, timezone
from enum import Enum

from common.symbol.NativeMosaic import normalize_mosaic_id
from symbolchain.symbol.IdGenerator import is_mosaic_alias
from symbolchain.symbol.Network import Address
from zenlog import log

from rest.model.symbol.Block import SymbolBlockView
from rest.model.symbol.validation import SymbolDataInvalid

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


class SymbolMosaicAliasNotFound(RuntimeError):
	"""Raised when a requested current Mosaic alias cannot be resolved."""


class AccountSortField(str, Enum):
	"""Canonical ordering fields for the Symbol account list."""

	ID = 'ID'
	IMPORTANCE = 'IMPORTANCE'
	BALANCE = 'BALANCE'


class SortOrder(str, Enum):
	ASC = 'ASC'
	DESC = 'DESC'


TransactionQuery = namedtuple(
	'TransactionQuery',
	['limit', 'offset', 'height', 'transaction_types', 'address', 'signer_public_key', 'recipient_address',
		'transfer_mosaic_id', 'include_embedded'],
	defaults=(10, 0, None, (), None, None, None, None, False))
TransactionMosaicRecord = namedtuple(
	'TransactionMosaicRecord',
	['mosaic_id', 'amount', 'role', 'position', 'divisibility', 'alias_names'])
TransactionRecord = namedtuple(
	'TransactionRecord',
	['transaction_id', 'hash', 'is_embedded', 'aggregate_hash', 'embedded_index', 'height', 'transaction_type',
		'signer_address', 'recipient_address', 'effective_fee', 'timestamp', 'message_type', 'message_payload', 'mosaics'])
SymbolAccountRecord = namedtuple(
	'SymbolAccountRecord',
	['address', 'public_key', 'account_type', 'address_height', 'importance_percentage', 'linked_public_key',
		'node_public_key', 'vrf_public_key', 'voting_public_keys', 'activity_buckets', 'finalized_epoch', 'alias_names',
		'mosaics'])
AccountListQuery = namedtuple('AccountListQuery', ['sort_field', 'mosaic_id', 'limit', 'offset'])
AccountListRecord = namedtuple(
	'AccountListRecord',
	['address', 'public_key', 'account_type', 'importance_percentage', 'balance_mosaic_id', 'namespaces', 'mosaics'])
SymbolMosaicRecord = namedtuple(
	'SymbolMosaicRecord',
	['mosaic_id', 'amount', 'metadata_mosaic_id', 'divisibility', 'owner_address', 'alias_names'])
SymbolMultisigRecord = namedtuple(
	'SymbolMultisigRecord', ['min_approval', 'min_removal', 'cosignatory_addresses', 'multisig_addresses'])


def _bytes_or_none(value):
	return bytes(value) if value else None


def _address(value):
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


def _is_generic_page_range_unavailable(sync_state):
	"""Returns whether an unbounded page query can have an unsafe boundary."""

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

	def __init__(self, db_config, native_mosaic_info=None, clock=None):
		"""Creates a Symbol database accessor with optional native mosaic information."""

		super().__init__(db_config)
		self.native_mosaic_info = native_mosaic_info
		self._clock = clock or (lambda: datetime.now(timezone.utc))
		self._is_closed = False

	def __enter__(self):
		"""Returns this database while its connection pool is managed by a context."""

		return self

	def __exit__(self, exception_type, _exception, _traceback):
		"""Closes the pool, preserving an active exception if ordinary cleanup fails."""

		try:
			self.close()
		except Exception as close_error:  # pylint: disable=broad-exception-caught
			if exception_type is None:
				raise

			log.error(f'Failed to close Symbol database after an operation failure: {close_error}')

	def close(self):
		"""Closes all connections owned by this Symbol database."""

		if self._is_closed:
			return

		self._pool.closeall()
		self._is_closed = True

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

	def get_receipts(self, query):
		"""Gets a validated receipt page from one repeatable-read database snapshot."""

		with self.connection() as connection:
			with connection.cursor() as cursor:
				self._start_read_transaction(cursor)
				sync_state = self._fetch_sync_state(cursor)
				readable_height = _get_readable_height(sync_state)
				if readable_height is None:
					raise SymbolDataUnavailable('Symbol receipt data is unavailable: sync state is unreadable')

				if query.height is not None:
					if query.height > readable_height:
						if _is_non_public_state(sync_state):
							raise SymbolDataUnavailable(
								'Symbol receipt data is unavailable: requested height is above the readable height '
								'in dirty or repairing state')
						return None
					cursor.execute(
						'SELECT 1 FROM symbol_blocks WHERE height = %s AND height <= %s',
						(query.height, readable_height))
					if not cursor.fetchone():
						return None

				where_clauses = ['receipts.height <= sync_state.last_synced_height']
				parameters = []
				filters = [
					(query.height, 'receipts.height = %s'),
					(query.receipt_group, 'receipts.receipt_group = %s::symbol_receipt_group'),
					(query.receipt_type, 'receipts.receipt_type = %s::symbol_receipt_type'),
					(query.target_address, 'receipts.target_address = %s'),
					(query.sender_address, 'receipts.sender_address = %s'),
				]
				for value, clause in filters:
					if value is not None:
						where_clauses.append(clause)
						parameters.append(value)

				if query.included_receipt_types:
					where_clauses.append('receipts.receipt_type = ANY(%s::symbol_receipt_type[])')
					parameters.append(list(query.included_receipt_types))

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
					raise SymbolDataUnavailable(
						'Symbol receipt data is unavailable: returned receipt row is above the readable height')
				if query.height is None and _is_generic_page_range_unavailable(sync_state):
					raise SymbolDataUnavailable(
						'Symbol receipt data is unavailable: unbounded receipt query range is unsafe')
				if _is_non_public_state(sync_state) and self._requires_current_receipt_metadata(results):
					raise SymbolDataUnavailable(
						'Symbol receipt data is unavailable: non-native mosaic metadata is unsafe '
						'in dirty or repairing state')

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

	def get_transactions(self, query):
		"""Gets a confirmed transaction page and its display relations from one database snapshot."""

		with self.connection() as connection:
			with connection.cursor() as cursor:
				self._start_read_transaction(cursor)
				sync_state = self._fetch_sync_state(cursor)
				readable_height = _get_readable_height(sync_state)
				if readable_height is None:
					raise SymbolDataUnavailable('Symbol transaction data is unavailable: sync state is unreadable')

				query = self._resolve_transfer_mosaic_id(cursor, query, sync_state)
				transaction_rows = self._fetch_transaction_rows(cursor, query, sync_state, readable_height)
				if not transaction_rows:
					return []

				return self._fetch_transaction_records(cursor, transaction_rows, sync_state)

	def get_account(self, address=None, public_key=None):
		"""Gets one current-state Symbol account and its detail relations."""

		with self.connection() as connection:
			with connection.cursor() as cursor:
				self._start_read_transaction(cursor)
				sync_state = self._fetch_sync_state(cursor)
				self._assert_account_state_readable(sync_state)
				if address is not None:
					cursor.execute(
						'''SELECT address, public_key, account_type, address_height, importance_percentage,
								linked_public_key, node_public_key, vrf_public_key, voting_public_keys, activity_buckets
							FROM symbol_accounts WHERE address = %s''',
						(address,))
				else:
					cursor.execute(
						'''SELECT address, public_key, account_type, address_height, importance_percentage,
								linked_public_key, node_public_key, vrf_public_key, voting_public_keys, activity_buckets
							FROM symbol_accounts WHERE public_key = %s''',
						(public_key,))
				account_row = cursor.fetchone()
				if not account_row:
					return None

				return self._fetch_account_record(cursor, account_row, sync_state['finalized_epoch'])

	def get_account_list(self, query, max_age_seconds):
		"""Gets a snapshot-backed Symbol account list and current display relations."""

		if self.native_mosaic_info is None:
			raise SymbolDataUnavailable('Symbol account list native mosaic is unavailable')

		with self.connection() as connection:
			with connection.cursor() as cursor:
				self._start_read_transaction(cursor)
				cursor.execute('SET TRANSACTION READ ONLY')
				sync_state = self._fetch_sync_state(cursor)
				self._assert_current_state_readable(sync_state)
				refresh_state = self._fetch_account_refresh_state(cursor)
				run_id = self._assert_account_refresh_readable(refresh_state, max_age_seconds)
				scope = self._account_list_scope(query)
				# Validate the whole required scope even when the requested page is empty.
				if scope is not None:
					self._assert_account_list_ranks(cursor, run_id, scope)

				page_addresses = self._fetch_account_list_page(cursor, run_id, query)
				if not page_addresses:
					return []

				account_rows = self._fetch_account_list_accounts(cursor, run_id, page_addresses)

				mosaic_rows = self._fetch_account_list_mosaics(cursor, run_id, page_addresses)
				namespaces = self._fetch_account_list_account_aliases(cursor, page_addresses)
				mosaic_aliases = self._fetch_account_list_mosaic_aliases(cursor, mosaic_rows)
				return self._create_account_list_records(
					query.mosaic_id or self.native_mosaic_info.id, page_addresses, account_rows, mosaic_rows, (namespaces, mosaic_aliases))

	@staticmethod
	def _fetch_account_refresh_state(cursor):
		cursor.execute(
			'''SELECT status, last_successful_run_id, last_completed_at
			FROM symbol_account_refresh_state WHERE id = 1''')
		row = cursor.fetchone()
		return dict(zip(('status', 'last_successful_run_id', 'last_completed_at'), row)) if row else None

	def _assert_account_refresh_readable(self, refresh_state, max_age_seconds):
		if not refresh_state or refresh_state['status'] != 'healthy':
			raise SymbolDataUnavailable('Symbol account refresh data is unavailable')

		run_id = refresh_state['last_successful_run_id']
		completed_at = refresh_state['last_completed_at']
		if not isinstance(run_id, str) or not run_id or completed_at is None:
			raise SymbolDataUnavailable('Symbol account refresh data is unavailable')

		completed_at = completed_at.replace(tzinfo=timezone.utc) if completed_at.tzinfo is None else completed_at
		now = self._clock()
		now = now.replace(tzinfo=timezone.utc) if now.tzinfo is None else now
		age = now - completed_at
		if age.total_seconds() > max_age_seconds:
			raise SymbolDataUnavailable('Symbol account refresh data is unavailable')

		return run_id

	def _account_list_scope(self, query):
		if query.sort_field in (AccountSortField.ID, AccountSortField.IMPORTANCE):
			return query.sort_field.value

		if query.sort_field == AccountSortField.BALANCE and query.mosaic_id == self.native_mosaic_info.id:
			return f'BALANCE:{query.mosaic_id}'

		# Custom balances read the same-run snapshot directly; custom ranks are not required.
		return None

	@staticmethod
	def _assert_account_list_ranks(cursor, run_id, scope):
		if scope == 'ID':
			expected_source = '''SELECT address, NULL::numeric AS value, NULL::varchar AS mosaic_id,
				row_number() OVER (ORDER BY account_search_order ASC, address ASC)-1 AS rank
				FROM symbol_account_refresh_accounts WHERE refresh_run_id = %s'''
			parameters = (run_id,)
		elif scope == 'IMPORTANCE':
			expected_source = '''SELECT address, importance_percentage AS value, NULL::varchar AS mosaic_id,
				row_number() OVER (ORDER BY importance_percentage DESC, address ASC)-1 AS rank
				FROM symbol_account_refresh_accounts WHERE refresh_run_id = %s'''
			parameters = (run_id,)
		else:
			mosaic_id = scope.split(':', 1)[1]
			expected_source = '''SELECT address, amount::numeric AS value, mosaic_id,
				row_number() OVER (ORDER BY amount DESC, address ASC)-1 AS rank
				FROM symbol_account_refresh_mosaics
				WHERE refresh_run_id = %s AND mosaic_id = %s'''
			parameters = (run_id, mosaic_id)

		cursor.execute(
			f'''WITH expected AS ({expected_source}), actual AS (
				SELECT rank, address, sort_value_numeric AS value, mosaic_id
				FROM symbol_account_list_ranks WHERE refresh_run_id = %s AND rank_scope = %s)
			SELECT NOT EXISTS (
				SELECT 1 FROM expected e FULL OUTER JOIN actual a USING (rank)
				WHERE e.address IS DISTINCT FROM a.address
				OR e.value IS DISTINCT FROM a.value
				OR e.mosaic_id IS DISTINCT FROM a.mosaic_id)''',
			parameters + (run_id, scope))
		if not cursor.fetchone()[0]:
			raise SymbolDataUnavailable('Symbol account list ranks are unavailable')

	def _fetch_account_list_page(self, cursor, run_id, query):
		if query.sort_field == AccountSortField.BALANCE and query.mosaic_id and query.mosaic_id != self.native_mosaic_info.id:
			cursor.execute(
				'''SELECT address FROM symbol_account_refresh_mosaics
				WHERE refresh_run_id = %s AND mosaic_id = %s
				ORDER BY amount DESC, address ASC LIMIT %s OFFSET %s''',
				(run_id, query.mosaic_id, query.limit, query.offset))
			return [bytes(row[0]) for row in cursor.fetchall()]

		scope = query.sort_field.value if query.sort_field != AccountSortField.BALANCE else f'BALANCE:{query.mosaic_id}'
		cursor.execute(
			'''SELECT address FROM symbol_account_list_ranks
			WHERE refresh_run_id = %s AND rank_scope = %s AND rank >= %s AND rank < %s
			ORDER BY rank''',
			(run_id, scope, query.offset, query.offset + query.limit))
		return [bytes(row[0]) for row in cursor.fetchall()]

	@staticmethod
	def _fetch_account_list_accounts(cursor, run_id, addresses):
		cursor.execute(
			'''SELECT address, public_key, account_type, importance_percentage
			FROM symbol_account_refresh_accounts
			WHERE refresh_run_id = %s AND address = ANY(%s::bytea[])''',
			(run_id, addresses))
		return {bytes(row[0]): (bytes(row[1]) if row[1] is not None else None, *row[2:]) for row in cursor.fetchall()}

	@staticmethod
	def _fetch_account_list_mosaics(cursor, run_id, addresses):
		cursor.execute(
			'''SELECT snapshot.address, snapshot.mosaic_id, snapshot.amount,
				mosaic.mosaic_id, mosaic.divisibility, mosaic.owner_address
			FROM symbol_account_refresh_mosaics AS snapshot
			LEFT JOIN symbol_mosaics AS mosaic ON mosaic.mosaic_id = snapshot.mosaic_id
			WHERE snapshot.refresh_run_id = %s AND snapshot.address = ANY(%s::bytea[])
			ORDER BY snapshot.address ASC, snapshot.mosaic_id ASC''',
			(run_id, addresses))
		return [(bytes(row[0]), *row[1:5], bytes(row[5]) if row[5] is not None else None) for row in cursor.fetchall()]

	@staticmethod
	def _fetch_account_list_account_aliases(cursor, addresses):
		for address in addresses:
			if len(address) != Address.SIZE:
				raise SymbolDataInvalid('accounts.address', 'invalid byte length')

		address_texts = [str(Address(address)) for address in addresses]
		cursor.execute(
			'''SELECT artifact_id, name FROM symbol_alias_names
			WHERE artifact_type = 'account' AND artifact_id = ANY(%s::varchar[])
			ORDER BY artifact_id ASC, name ASC''',
			(address_texts,))
		aliases = {address: [] for address in address_texts}
		for address, name in cursor.fetchall():
			aliases[address].append(name)
		return aliases

	@staticmethod
	def _fetch_account_list_mosaic_aliases(cursor, mosaic_rows):
		mosaic_ids = list({row[1] for row in mosaic_rows})
		if not mosaic_ids:
			return {}

		cursor.execute(
			'''SELECT artifact_id, name FROM symbol_alias_names
			WHERE artifact_type = 'mosaic' AND artifact_id = ANY(%s::varchar[])
			ORDER BY artifact_id ASC, name ASC''',
			(mosaic_ids,))
		aliases = {mosaic_id: [] for mosaic_id in mosaic_ids}
		for mosaic_id, name in cursor.fetchall():
			aliases[mosaic_id].append(name)
		return aliases

	@staticmethod
	def _create_account_list_records(balance_mosaic_id, addresses, account_rows, mosaic_rows, display_relations):
		namespaces, mosaic_aliases = display_relations
		mosaics_by_address = {address: [] for address in addresses}
		for row in mosaic_rows:
			mosaics_by_address[row[0]].append(SymbolMosaicRecord(*row[1:], tuple(mosaic_aliases.get(row[1], ()))))

		return [AccountListRecord(
			address, *account_rows[address], balance_mosaic_id,
			tuple(namespaces.get(str(Address(address)), ())), tuple(mosaics_by_address[address])) for address in addresses]

	def get_multisig(self, address):
		"""Gets one current-state Symbol multisig relation."""

		with self.connection() as connection:
			with connection.cursor() as cursor:
				self._start_read_transaction(cursor)
				sync_state = self._fetch_sync_state(cursor)
				self._assert_current_state_readable(sync_state)
				cursor.execute('SELECT 1 FROM symbol_accounts WHERE address = %s', (address,))
				if not cursor.fetchone():
					return None

				cursor.execute(
					'''SELECT min_approval, min_removal, cosignatory_addresses, multisig_addresses
					FROM symbol_multisig WHERE address = %s''',
					(address,))
				multisig_row = cursor.fetchone()
				if not multisig_row:
					return None

				return SymbolMultisigRecord(*multisig_row)

	@staticmethod
	def _assert_current_state_readable(sync_state):
		if not sync_state or sync_state.get('status') != 'healthy':
			raise SymbolDataUnavailable('Symbol account data is unavailable')

		last_synced_height = sync_state.get('last_synced_height')
		if isinstance(last_synced_height, bool) or not isinstance(last_synced_height, int) or last_synced_height < 1:
			raise SymbolDataUnavailable('Symbol account data is unavailable')
		if sync_state.get('dirty_state_from_height') is not None:
			raise SymbolDataUnavailable('Symbol account data is unavailable')

	@classmethod
	def _assert_account_state_readable(cls, sync_state):
		cls._assert_current_state_readable(sync_state)
		finalized_epoch = sync_state.get('finalized_epoch')
		if finalized_epoch is None:
			raise SymbolDataUnavailable('Symbol account data is unavailable')
		if isinstance(finalized_epoch, bool) or not isinstance(finalized_epoch, int) or finalized_epoch < 0 or finalized_epoch > 2147483647:
			raise SymbolDataInvalid('sync_state.finalized_epoch', 'invalid integer')

	@staticmethod
	def _fetch_account_record(cursor, account_row, finalized_epoch):
		address = bytes(account_row[0])
		if len(address) != Address.SIZE:
			raise SymbolDataInvalid('accounts.address', 'invalid byte length')

		address_text = str(Address(address))
		cursor.execute(
			'''SELECT account_mosaics.mosaic_id, account_mosaics.amount, mosaics.mosaic_id,
					mosaics.divisibility, mosaics.owner_address
			FROM symbol_account_mosaics AS account_mosaics
			LEFT JOIN symbol_mosaics AS mosaics ON mosaics.mosaic_id = account_mosaics.mosaic_id
			WHERE account_mosaics.address = %s
			ORDER BY account_mosaics.mosaic_id ASC''',
			(address,))
		mosaic_rows = cursor.fetchall()
		mosaic_ids = [row[0] for row in mosaic_rows]
		alias_names_by_mosaic = {mosaic_id: [] for mosaic_id in mosaic_ids}
		if mosaic_ids:
			cursor.execute(
				'''SELECT artifact_id, name FROM symbol_alias_names
				WHERE artifact_type = 'mosaic' AND artifact_id = ANY(%s::varchar[])
				ORDER BY artifact_id ASC, name ASC''',
				(mosaic_ids,))
			for mosaic_id, name in cursor.fetchall():
				alias_names_by_mosaic[mosaic_id].append(name)

		cursor.execute(
			'''SELECT name FROM symbol_alias_names
			WHERE artifact_type = 'account' AND artifact_id = %s
			ORDER BY name ASC''',
			(address_text,))
		account_aliases = [row[0] for row in cursor.fetchall()]
		mosaics = tuple(SymbolMosaicRecord(
			row[0], row[1], row[2], row[3], row[4], tuple(alias_names_by_mosaic[row[0]])) for row in mosaic_rows)

		return SymbolAccountRecord(
			address,
			account_row[1],
			account_row[2],
			account_row[3],
			account_row[4],
			account_row[5],
			account_row[6],
			account_row[7],
			account_row[8],
			account_row[9],
			finalized_epoch,
			tuple(account_aliases),
			mosaics)

	@staticmethod
	def _resolve_transfer_mosaic_id(cursor, query, sync_state):
		"""Resolves a current Mosaic alias in the transaction read snapshot."""

		transfer_mosaic_id = query.transfer_mosaic_id
		if transfer_mosaic_id is None or not is_mosaic_alias(int(transfer_mosaic_id, 16)):
			return query

		if _is_non_public_state(sync_state):
			raise SymbolDataUnavailable(
				'Symbol transaction data is unavailable: Mosaic alias state is unsafe in dirty or repairing state')

		cursor.execute(
			'''
			SELECT alias_type, alias_mosaic_id, start_height, end_height
			FROM symbol_namespaces
			WHERE namespace_id = %s AND alias_mosaic_id IS NOT NULL
			''',
			(transfer_mosaic_id.upper(),))
		result = cursor.fetchone()
		if not result or result[0] != 'mosaic':
			raise SymbolMosaicAliasNotFound('Requested Mosaic alias is not currently linked')

		resolved_mosaic_id, start_height, end_height = result[1:]

		latest_height = sync_state['last_synced_height']
		if start_height > latest_height or (end_height is not None and latest_height >= end_height):
			raise SymbolMosaicAliasNotFound('Requested Mosaic alias is not currently linked')

		return query._replace(transfer_mosaic_id=resolved_mosaic_id.upper())

	@staticmethod
	def _fetch_transaction_rows(cursor, query, sync_state, readable_height):
		if query.height is not None and query.height > readable_height:
			if _is_non_public_state(sync_state):
				raise SymbolDataUnavailable(
					'Symbol transaction data is unavailable: requested height is above the readable height '
					'in dirty or repairing state')

			return []

		if query.height is None and _is_generic_page_range_unavailable(sync_state):
			raise SymbolDataUnavailable(
				'Symbol transaction data is unavailable: generic transaction page crosses an unsafe boundary')

		where_clauses, parameters = SymbolDatabase._create_transaction_filter(query)
		cursor.execute(
			f'''
			SELECT
				transactions.id,
				transactions.hash,
				transactions.is_embedded,
				transactions.aggregate_hash,
				transactions.embedded_index,
				transactions.height,
				transactions.type,
				transactions.signer_address,
				transactions.recipient_address,
				transactions.effective_fee,
				transactions.timestamp,
				transactions.message_type,
				transactions.message_payload
			FROM symbol_transactions AS transactions
			JOIN symbol_sync_state AS sync_state ON sync_state.id = 1
			WHERE {' AND '.join(where_clauses)}
			ORDER BY transactions.height DESC, transactions.id DESC
			LIMIT %s OFFSET %s
			''',
			(*parameters, query.limit, query.offset))
		transaction_rows = cursor.fetchall()
		if any(not row[2] and row[9] is None for row in transaction_rows):
			raise SymbolDataUnavailable(
				'Symbol transaction data is unavailable: confirmed top-level effective fee is missing')

		return transaction_rows

	@staticmethod
	def _create_transaction_filter(query):
		where_clauses = ['transactions.height <= sync_state.last_synced_height']
		parameters = []
		filters = [
			(query.height, 'transactions.height = %s'),
			(query.address, '''EXISTS (
				SELECT 1 FROM symbol_transaction_addresses AS addresses
				WHERE addresses.transaction_id = transactions.id AND addresses.address = %s)'''),
			(query.signer_public_key, 'transactions.signer_public_key = %s'),
			(query.recipient_address, 'transactions.recipient_address = %s'),
			(query.transfer_mosaic_id, '''EXISTS (
				SELECT 1 FROM symbol_transaction_mosaics AS transfer_mosaics
				WHERE transfer_mosaics.transaction_id = transactions.id
					AND transfer_mosaics.mosaic_id = %s
					AND transfer_mosaics.role = 'transfer'::symbol_transaction_mosaic_role)'''),
		]
		for value, clause in filters:
			if value is not None:
				where_clauses.append(clause)
				parameters.append(value)

		if query.transaction_types:
			where_clauses.append('transactions.type = ANY(%s::integer[])')
			parameters.append(list(query.transaction_types))

		if not query.include_embedded:
			where_clauses.append('transactions.is_embedded = false')

		return where_clauses, parameters

	def _fetch_transaction_records(self, cursor, transaction_rows, sync_state):
		transaction_ids = [row[0] for row in transaction_rows]
		cursor.execute(
			'''
			SELECT transaction_id, mosaic_id, amount, role, position
			FROM symbol_transaction_mosaics
			WHERE transaction_id = ANY(%s::bigint[])
				AND role <> 'metadata_target'::symbol_transaction_mosaic_role
			ORDER BY transaction_id, position
			''',
			(transaction_ids,))
		transaction_mosaic_rows = cursor.fetchall()
		if _is_non_public_state(sync_state) and self._requires_current_transaction_metadata(transaction_mosaic_rows):
			raise SymbolDataUnavailable(
				'Symbol transaction data is unavailable: mosaic display depends on current state '
				'in dirty or repairing state')

		excluded_native_mosaic_id = None
		if _is_non_public_state(sync_state) and self.native_mosaic_info:
			excluded_native_mosaic_id = self.native_mosaic_info.id

		mosaic_state_by_id = SymbolDatabase._fetch_transaction_mosaic_state(
			cursor, transaction_mosaic_rows, excluded_native_mosaic_id)
		mosaics_by_transaction = SymbolDatabase._map_transaction_mosaics(
			transaction_ids, transaction_mosaic_rows, mosaic_state_by_id)
		return [TransactionRecord(*row, tuple(mosaics_by_transaction[row[0]])) for row in transaction_rows]

	def _requires_current_transaction_metadata(self, transaction_mosaic_rows):
		for row in transaction_mosaic_rows:
			if self.native_mosaic_info and normalize_mosaic_id(row[1]) == self.native_mosaic_info.id:
				continue

			return True

		return False

	@staticmethod
	def _fetch_transaction_mosaic_state(cursor, transaction_mosaic_rows, excluded_mosaic_id=None):
		mosaic_ids = list(dict.fromkeys(
			row[1] for row in transaction_mosaic_rows
			if excluded_mosaic_id is None or normalize_mosaic_id(row[1]) != excluded_mosaic_id))
		if not mosaic_ids:
			return {}

		cursor.execute(
			'''
			SELECT mosaic_id, divisibility, alias_names
			FROM symbol_mosaics
			WHERE mosaic_id = ANY(%s::varchar[])
			''',
			(mosaic_ids,))
		return {
			mosaic_id: (divisibility, alias_names)
			for mosaic_id, divisibility, alias_names in cursor.fetchall()
		}

	@staticmethod
	def _map_transaction_mosaics(transaction_ids, transaction_mosaic_rows, mosaic_state_by_id):
		mosaics_by_transaction = {transaction_id: [] for transaction_id in transaction_ids}
		for transaction_id, mosaic_id, amount, role, position in transaction_mosaic_rows:
			divisibility, alias_names = mosaic_state_by_id.get(mosaic_id, (None, None))
			mosaics_by_transaction[transaction_id].append(TransactionMosaicRecord(
				mosaic_id, amount, role, position, divisibility, alias_names))

		return mosaics_by_transaction

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
