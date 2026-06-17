from unittest import TestCase
from unittest.mock import Mock

from psycopg2 import OperationalError

from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.model.symbol.NodeConfig import SymbolNodeConfigError

from ..test.PostgresTestUtils import PostgresTestDatabase, create_unreachable_db_config


def _create_node_config():
	node_config = Mock(spec=['to_dict', 'assert_request_allowed'])
	node_config.base_url = 'http://localhost:3000'
	node_config.to_dict.return_value = {'baseUrl': node_config.base_url}
	node_config.assert_request_allowed.return_value = node_config.base_url

	return node_config


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

	def test_reports_healthy_core_when_database_and_node_config_are_available(self):
		node_config = _create_node_config()

		with PostgresTestDatabase() as db_config:
			facade = SymbolRestFacade(db_config=db_config, node_config=node_config)

			self.assertTrue(facade.is_configured())
			self.assertEqual({
				'isConfigured': True,
				'node': {'baseUrl': 'http://localhost:3000'}
			}, facade.get_core_status())
			health = facade.get_health()
			self.assertTrue(health['isHealthy'])
			self.assertTrue(health['dbUp'])
			self.assertTrue(health['nodeConfigured'])
			self.assertFalse(health['backendSynced'])
			self.assertEqual([], health['errors'])

	def test_reports_database_error(self):
		node_config = _create_node_config()
		facade = SymbolRestFacade(db_config=None, node_config=node_config)
		facade.symbol_db = Mock()
		facade.symbol_db.check_connection.side_effect = OperationalError('database unavailable')

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
		node_config = _create_node_config()

		with PostgresTestDatabase() as db_config:
			facade = SymbolRestFacade(db_config=db_config, node_config=node_config, config_error=ValueError('bad config'))

			result = facade.get_health()

			self.assertFalse(result['isHealthy'])
			self.assertEqual([{
				'type': 'configuration',
				'message': 'bad config'
			}], result['errors'])

	def test_validates_node_request_target(self):
		node_config = _create_node_config()
		facade = SymbolRestFacade(db_config=None, node_config=node_config)

		result = facade.validate_node_request_target('http://localhost:3000')

		self.assertEqual('http://localhost:3000', result)
		node_config.assert_request_allowed.assert_called_once_with('http://localhost:3000')

	def test_rejects_node_request_validation_when_node_config_is_missing(self):
		facade = SymbolRestFacade()

		with self.assertRaisesRegex(SymbolNodeConfigError, 'Symbol node URL is not configured'):
			facade.validate_node_request_target('http://localhost:3000')
