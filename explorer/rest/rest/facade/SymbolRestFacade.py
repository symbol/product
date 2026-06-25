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

		return {
			'isHealthy': db_up and not errors,
			'dbUp': db_up,
			'backendSynced': False,
			'lastDBSyncedAt': None,
			'lastDBHeight': None,
			'errors': errors
		}
