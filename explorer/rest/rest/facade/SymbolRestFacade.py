from psycopg2 import Error as PsycopgError
from zenlog import log

from rest.db.SymbolDatabase import SymbolDatabase
from rest.model.symbol.NodeConfig import SymbolNodeConfigError

DATABASE_UNAVAILABLE_MESSAGE = 'Symbol database is unavailable'


class SymbolRestFacade:
	"""Symbol Rest Facade."""

	def __init__(self, db_config=None, node_config=None, config_error=None):
		"""Creates a Symbol facade object."""

		self.symbol_db = None
		self.db_error = None
		if db_config:
			try:
				self.symbol_db = SymbolDatabase(db_config)
			except PsycopgError as error:
				log.error(f'Failed to initialize Symbol database: {error}')
				self.db_error = DATABASE_UNAVAILABLE_MESSAGE

		self.node_config = node_config
		self.config_error = str(config_error) if config_error else None

	def is_configured(self):
		"""Returns whether Symbol REST dependencies are configured."""

		return self.symbol_db is not None and self.node_config is not None and self.config_error is None

	def get_core_status(self):
		"""Returns Symbol backend core status without exposing raw config."""

		return {
			'isConfigured': self.is_configured(),
			'node': self.node_config.to_dict() if self.node_config else None
		}

	def get_health(self):
		"""Gets health of the Symbol backend core foundation."""

		errors = []
		db_up = False
		node_configured = self.node_config is not None

		if self.config_error:
			errors.append({
				'type': 'configuration',
				'message': self.config_error
			})

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
		else:
			errors.append({
				'type': 'configuration',
				'message': 'Symbol database is not configured'
			})

		if not node_configured:
			errors.append({
				'type': 'configuration',
				'message': 'Symbol node URL is not configured'
			})

		return {
			'isHealthy': db_up and node_configured and not errors,
			'dbUp': db_up,
			'nodeConfigured': node_configured,
			'backendSynced': False,
			'lastDBSyncedAt': None,
			'lastDBHeight': None,
			'errors': errors
		}

	def validate_node_request_target(self, request_url):
		"""Validates a future Symbol node request target against security policy."""

		if not self.node_config:
			raise SymbolNodeConfigError('Symbol node URL is not configured')

		return self.node_config.assert_request_allowed(request_url)
