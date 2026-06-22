from unittest import TestCase

from psycopg2 import OperationalError

from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.model.symbol.NodeConfig import SymbolNodeConfig, SymbolNodeConfigError

from ..test.PostgresTestUtils import create_unreachable_db_config

_NODE_URL = 'http://127.0.0.1:3000'


def _create_node_config():
	return SymbolNodeConfig.from_url(_NODE_URL, allow_loopback=True)


class _FailingSymbolDatabase:
	@staticmethod
	def check_connection():
		raise OperationalError('database unavailable')


class _HealthySymbolDatabase:
	@staticmethod
	def check_connection():
		return True


def _create_configured_facade(config_error=None):
	facade = SymbolRestFacade(db_config=None, node_config=_create_node_config(), config_error=config_error)
	facade.symbol_db = _HealthySymbolDatabase()
	return facade


class TestSymbolRestFacade(TestCase):
	def test_reports_disabled_health_when_dependencies_are_missing(self):
		facade = SymbolRestFacade()

		result = facade.get_health()

		self.assertEqual({
			'isHealthy': False,
			'dbUp': False,
			'nodeConfigured': False,
			'backendSynced': False,
			'lastDBSyncedAt': None,
			'lastDBHeight': None,
			'errors': [
				{
					'type': 'configuration',
					'message': 'Symbol database is not configured'
				},
				{
					'type': 'configuration',
					'message': 'Symbol node URL is not configured'
				}
			]
		}, result)

	def test_reports_configured_core_status_when_dependencies_are_available(self):
		facade = _create_configured_facade()

		result = facade.get_core_status()

		self.assertTrue(facade.is_configured())
		self.assertEqual({
			'isConfigured': True,
			'node': {
				'baseUrl': _NODE_URL,
				'allowPrivate': False,
				'allowLoopback': True,
				'timeoutSeconds': 10
			}
		}, result)

	def test_reports_healthy_core_when_dependencies_are_available(self):
		facade = _create_configured_facade()

		result = facade.get_health()

		self.assertEqual({
			'isHealthy': True,
			'dbUp': True,
			'nodeConfigured': True,
			'backendSynced': False,
			'lastDBSyncedAt': None,
			'lastDBHeight': None,
			'errors': []
		}, result)

	def test_reports_database_error(self):
		node_config = _create_node_config()
		facade = SymbolRestFacade(db_config=None, node_config=node_config)
		facade.symbol_db = _FailingSymbolDatabase()

		self.assertEqual({
			'isHealthy': False,
			'dbUp': False,
			'nodeConfigured': True,
			'backendSynced': False,
			'lastDBSyncedAt': None,
			'lastDBHeight': None,
			'errors': [{
				'type': 'database',
				'message': 'Symbol database is unavailable'
			}]
		}, facade.get_health())

	def test_reports_database_initialization_error(self):
		node_config = _create_node_config()

		facade = SymbolRestFacade(db_config=create_unreachable_db_config(), node_config=node_config)

		self.assertFalse(facade.is_configured())
		self.assertEqual({
			'isHealthy': False,
			'dbUp': False,
			'nodeConfigured': True,
			'backendSynced': False,
			'lastDBSyncedAt': None,
			'lastDBHeight': None,
			'errors': [{
				'type': 'database',
				'message': 'Symbol database is unavailable'
			}]
		}, facade.get_health())
		self.assertNotIn('connection refused', str(facade.get_health()))

	def test_reports_configuration_error(self):
		facade = _create_configured_facade(config_error=ValueError('bad config'))

		result = facade.get_health()

		self.assertFalse(facade.is_configured())
		self.assertEqual({
			'isHealthy': False,
			'dbUp': True,
			'nodeConfigured': True,
			'backendSynced': False,
			'lastDBSyncedAt': None,
			'lastDBHeight': None,
			'errors': [{
				'type': 'configuration',
				'message': 'bad config'
			}]
		}, result)

	def test_validates_node_request_target(self):
		node_config = _create_node_config()
		facade = SymbolRestFacade(db_config=None, node_config=node_config)

		result = facade.validate_node_request_target(_NODE_URL)

		self.assertEqual(_NODE_URL, result)

	def test_rejects_node_request_validation_when_node_config_is_missing(self):
		facade = SymbolRestFacade()

		with self.assertRaisesRegex(SymbolNodeConfigError, 'Symbol node URL is not configured'):
			facade.validate_node_request_target('http://localhost:3000')
