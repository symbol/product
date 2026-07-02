from psycopg2 import Error as PsycopgError
from zenlog import log

from rest.db.SymbolDatabase import SymbolDatabase

DATABASE_UNAVAILABLE_MESSAGE = 'Symbol database is unavailable'


class SymbolRestFacade:
	"""Symbol Rest Facade."""

	def __init__(self, db_config, node_config):
		"""Creates a Symbol facade object."""

		if db_config is None:
			raise ValueError('Symbol database configuration is required')
		if node_config is None:
			raise ValueError('Symbol node configuration is required')

		self.symbol_db = None
		self.db_error = None
		try:
			self.symbol_db = SymbolDatabase(db_config)
		except PsycopgError as error:
			log.error(f'Failed to initialize Symbol database: {error}')
			self.db_error = DATABASE_UNAVAILABLE_MESSAGE

		self.node_config = node_config

	def is_configured(self):
		"""Returns whether Symbol REST dependencies are configured."""

		return self.symbol_db is not None and self.node_config is not None

	def get_core_status(self):
		"""Returns Symbol backend core status without exposing raw config."""

		return {
			'isConfigured': self.is_configured(),
			'node': self.node_config.to_dict()
		}

	def is_database_available(self):
		"""Returns whether DB-backed Symbol REST data can be queried."""

		return self.symbol_db is not None

	def is_block_data_available(self):
		"""Returns whether block-backed Symbol REST data can be queried."""

		if not self.is_database_available():
			return False

		try:
			return self.symbol_db.get_block_head_height() is not None
		except PsycopgError:
			log.error('Failed to check Symbol block data availability')
			return False

	def get_health(self):
		"""Gets health of the Symbol backend core foundation."""

		errors = []
		db_up = False

		if self.db_error:
			errors.append({
				'type': 'database',
				'message': self.db_error
			})
		elif self.symbol_db:
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
				last_db_synced_at = sync_state['updated_at'].isoformat() if sync_state['updated_at'] else None
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

		if not self.is_database_available():
			return None

		try:
			local_height = self.symbol_db.get_block_head_height()
			if local_height is None:
				return None

			blocks = self.symbol_db.get_blocks(from_height, limit, sort)
			if blocks is None:
				return None

			return [block.to_dict() for block in blocks]
		except PsycopgError:
			log.error('Failed to get Symbol blocks')
			return None

	def get_block(self, height):
		"""Gets a Symbol block by height."""

		if not self.is_block_data_available():
			return None

		try:
			block = self.symbol_db.get_block(height)
		except PsycopgError:
			log.error('Failed to get Symbol block')
			return None

		return block.to_detail_dict() if block else None
