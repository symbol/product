from common.symbol.NativeMosaic import NativeMosaicInfo
from psycopg2 import Error as PsycopgError
from symbolchain.sc import TransactionType
from symbollightapi.connector.SymbolConnector import SymbolConnector
from zenlog import log

from rest.db.SymbolDatabaseCommon import SymbolDataUnavailable
from rest.facade.SymbolTransactionNodeBacking import SymbolNodeNotFound, SymbolNodeUnavailable
from rest.facade.TtlCache import TtlCache
from rest.model.common import STATISTICS_CACHE_MAX_ENTRIES, STATISTICS_CACHE_TTL_SECONDS
from rest.model.format import format_timestamp
from rest.model.symbol.Account import SymbolAccountListView, SymbolAccountStatisticsView, SymbolAccountView
from rest.model.symbol.Block import SymbolBlockStatisticsView
from rest.model.symbol.HarvestingBalanceRange import HarvestingBalanceRange
from rest.model.symbol.Receipt import SymbolReceiptView
from rest.model.symbol.Transaction import SymbolTransactionDetailView, SymbolTransactionView
from rest.model.symbol.validation import SymbolDataInvalid

DATABASE_UNAVAILABLE_MESSAGE = 'Symbol database is unavailable'


class SymbolRestFacade:  # pylint: disable=too-many-instance-attributes
	"""Symbol Rest Facade."""

	# The facade owns independent REST dependencies, account settings and the statistics cache.
	def __init__(  # pylint: disable=too-many-arguments,too-many-positional-arguments
		self, symbol_db, node_config, native_mosaic_info, network, account_refresh_max_age_seconds=None,
		harvesting_active_window_days=None, harvesting_balance_range=None, node_backing=None):
		"""Creates a Symbol facade with its database, node dependencies, and account settings."""

		if symbol_db is None:
			raise ValueError('Symbol database is required')

		if node_config is None:
			raise ValueError('Symbol node configuration is required')
		if not isinstance(native_mosaic_info, NativeMosaicInfo):
			raise ValueError('Native mosaic information is required')

		if network is None:
			raise ValueError('Symbol network is required')

		self.symbol_db = symbol_db
		self.node_config = node_config
		self.native_mosaic_info = native_mosaic_info
		self.network = network
		self.account_refresh_max_age_seconds = account_refresh_max_age_seconds
		self.harvesting_active_window_days = harvesting_active_window_days
		self.harvesting_balance_range = harvesting_balance_range
		self.statistics_cache = TtlCache(STATISTICS_CACHE_TTL_SECONDS, STATISTICS_CACHE_MAX_ENTRIES)
		self.node_backing = node_backing
		self.symbol_connector = SymbolConnector(node_config.base_url)
		self.symbol_connector.timeout_seconds = node_config.timeout_seconds

	def get_health(self):
		"""Gets health of the Symbol backend core foundation."""

		errors = []
		db_up = False

		try:
			db_up = self.symbol_db.check_connection()
		except PsycopgError as error:
			log.error(f'Failed to check Symbol database health: {error}')
			errors.append({
				'type': 'database',
				'message': DATABASE_UNAVAILABLE_MESSAGE
			})

		backend_synced = False
		finalized_height = None
		last_db_synced_at = None
		last_db_height = None
		status = None
		if db_up and not errors:
			try:
				sync_state = self.symbol_db.try_get_sync_state()
			except PsycopgError as error:
				log.error(f'Failed to get Symbol database sync state: {error}')
				errors.append({
					'type': 'database',
					'message': DATABASE_UNAVAILABLE_MESSAGE
				})
				sync_state = None

			if sync_state:
				chain_height = sync_state.get('chain_height')
				finalized_height = sync_state['finalized_height']
				last_db_height = sync_state['last_synced_height']
				last_db_synced_at = format_timestamp(sync_state['updated_at'])
				status = sync_state['status']
				backend_synced = 'healthy' == status and last_db_height == chain_height
				if 'healthy' == status and not backend_synced:
					errors.append({
						'type': 'synchronization',
						'message': f'Symbol database height {last_db_height} does not match chain height {chain_height}'
					})
				elif 'unhealthy' == status:
					errors.append({
						'type': 'rollback',
						'message': 'Symbol backend is in an unhealthy rollback state'
					})
				elif 'healthy' != status:
					errors.append({
						'type': 'synchronization',
						'message': f'Symbol backend status is {status}'
					})

		return {
			'isHealthy': db_up and not errors,
			'dbUp': db_up,
			'finalizedHeight': finalized_height,
			'backendSynced': backend_synced,
			'lastDBSyncedAt': last_db_synced_at,
			'lastDBHeight': last_db_height,
			'status': status,
			'errors': errors
		}

	def get_blocks(self, from_height, limit, sort):
		"""Gets Symbol blocks."""

		blocks = self.symbol_db.get_blocks(from_height, limit, sort)
		return [block.to_dict(self.native_mosaic_info) for block in blocks]

	def get_block_statistics(self):
		"""Gets Symbol block statistics."""

		blocks = self.symbol_db.get_block_statistics()
		return SymbolBlockStatisticsView(blocks).to_dict(self.native_mosaic_info)

	def get_mosaics(self, limit, offset, sort):
		"""Gets a current mosaic page."""

		mosaics = self.symbol_db.get_mosaics(limit, offset, sort)
		return [mosaic.to_dict() for mosaic in mosaics]

	def get_namespaces(self, query):
		"""Gets a persisted Symbol namespace page."""

		namespaces = self.symbol_db.get_namespaces(query)
		return [namespace.to_dict() for namespace in namespaces]

	def try_get_namespace(self, namespace_id):
		"""Gets one persisted Symbol namespace detail DTO."""

		detail = self.symbol_db.try_get_namespace(namespace_id)
		if detail is None:
			return None

		result = detail.namespace.to_dict()
		result['subNamespaces'] = detail.sub_namespaces
		result['namespaceMosaics'] = [
			{
				'namespaceId': group.namespace_id,
				'namespaceName': group.namespace_name,
				'data': [
					{key: value for key, value in {
						**mosaic.view.to_dict(),
						'startTimestamp': format_timestamp(mosaic.start_timestamp)
					}.items() if key != 'registrationTimestamp'}
					for mosaic in group.data
				]
			}
			for group in detail.namespace_mosaics
		]
		return result

	def get_mosaic(self, mosaic_id):
		"""Gets a current mosaic by mosaic ID or namespace ID."""

		mosaic = self.symbol_db.get_mosaic(mosaic_id)

		return mosaic.to_dict() if mosaic else None

	def get_block(self, height):
		"""Gets a Symbol block by height."""

		block = self.symbol_db.get_block(height)

		return block.to_detail_dict(self.native_mosaic_info) if block else None

	def get_receipts(self, query):
		"""Gets a Symbol receipt page."""

		receipts = self.symbol_db.get_receipts(query)
		if receipts is None:
			return None

		return [SymbolReceiptView(**receipt._asdict()).to_dict(self.native_mosaic_info) for receipt in receipts]

	def get_transactions(self, query):
		"""Gets a confirmed transaction page."""

		transactions = self.symbol_db.get_transactions(query)
		return [SymbolTransactionView(transaction).to_dict(self.native_mosaic_info) for transaction in transactions]

	def get_transaction_statistics(self):
		"""Gets Symbol transaction statistics."""

		statistics = self.symbol_db.get_transaction_statistics(self.statistics_cache)
		return {
			'total': statistics.total,
			'last30Days': statistics.last30_day,
			'last24Hours': statistics.last24_hours,
			'averagePerBlock': statistics.average_per_block
		}

	def get_transaction_statistics_range(self, start_date, end_date, period_type):
		"""Gets transaction totals for the requested calendar range."""

		rows = self.symbol_db.get_transaction_statistics_range(start_date, end_date, period_type)
		return {
			'periodType': period_type.lower(),
			'data': [{'period': row.period, 'totalTransactions': row.total_transactions} for row in rows]
		}

	async def get_transaction_detail(self, transaction_hash):
		"""Gets a confirmed or Node-backed Symbol transaction detail DTO."""

		try:
			db_result = self.symbol_db.get_transaction_detail(bytes.fromhex(transaction_hash))
			if db_result.status == 'hit':
				return SymbolTransactionDetailView(db_result.record, 'confirmed').to_dict(self.native_mosaic_info, self.network)

			if db_result.status not in ('miss', 'confirmed_lag'):
				raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: confirmed row is not readable')

			status = await self.node_backing.get_status(transaction_hash)
			group = status['group']
			if group == 'confirmed':
				raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: confirmed transaction is not in the database')

			try:
				payload = await self.node_backing.get_transaction(group, transaction_hash)
			except SymbolNodeNotFound as error:
				# The transaction can leave this group after the status lookup.
				raise SymbolDataUnavailable('Symbol transaction detail data is unavailable: pending detail is missing') from error
			record = self.node_backing.to_detail_record(payload, group, transaction_hash)
			if record.transaction.transaction_type == TransactionType.AGGREGATE_BONDED.value:
				lock_payload = await self.node_backing.try_get_hash_lock(transaction_hash)
				record = record._replace(hash_lock=self.node_backing.to_hash_lock_record(lock_payload))
			record = self.symbol_db.supplement_transaction_detail(bytes.fromhex(transaction_hash), record)
			return SymbolTransactionDetailView(record, group).to_dict(self.native_mosaic_info, self.network)
		except (SymbolNodeUnavailable, SymbolDataInvalid) as error:
			raise SymbolDataUnavailable('Symbol transaction detail data is unavailable') from error

	def try_get_account(self, address=None, public_key=None):
		"""Gets a Symbol account detail DTO by address or public key."""

		account = self.symbol_db.try_get_account(address, public_key)
		return SymbolAccountView(account, self.network, self.native_mosaic_info).to_dict() if account else None

	def get_accounts(self, query):
		"""Gets snapshot-backed Symbol account list DTOs."""

		if self.account_refresh_max_age_seconds is None:
			raise ValueError('Symbol account refresh max age is required')
		if self.harvesting_active_window_days is None:
			raise ValueError('Symbol harvesting active window is required')

		accounts = self.symbol_db.get_account_list(
			query, self.account_refresh_max_age_seconds, self.harvesting_active_window_days)
		return [SymbolAccountListView(account, self.network, self.native_mosaic_info).to_dict() for account in accounts]

	def get_account_statistics(self):
		"""Gets aggregate statistics from the configured account refresh snapshot."""

		if self.account_refresh_max_age_seconds is None:
			raise ValueError('Symbol account refresh max age is required')

		if self.harvesting_active_window_days is None:
			raise ValueError('Symbol harvesting active window is required')

		if not isinstance(self.harvesting_balance_range, HarvestingBalanceRange):
			raise ValueError('Symbol harvesting balance range is required')

		statistics = self.symbol_db.get_account_statistics(
			self.account_refresh_max_age_seconds, self.harvesting_active_window_days, self.harvesting_balance_range)
		return SymbolAccountStatisticsView(statistics).to_dict()

	async def get_unconfirmed_transactions(self):
		"""Gets pending Symbol transactions in the shared Explorer transaction envelope."""

		unconfirmed_transactions = await self.symbol_connector.get_unconfirmed_transactions()

		views = self.symbol_db.get_unconfirmed_transactions(unconfirmed_transactions, self.network)
		return [view.to_dict() for view in views]
