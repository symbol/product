from unittest import TestCase

from common.symbol.NodeConfig import SymbolNodeConfiguration
from psycopg2 import OperationalError

from rest.facade.SymbolRestFacade import SymbolRestFacade

from ..test.PostgresTestUtils import create_unreachable_db_config
from ..test.SymbolHealthTestUtils import create_symbol_health

NODE_URL = 'http://127.0.0.1:3000'


def _create_node_config():
	return SymbolNodeConfiguration.from_url(NODE_URL, allow_loopback=True)


class FailingSymbolDatabase:
	@staticmethod
	def check_connection():
		raise OperationalError('database unavailable')


class HealthySymbolDatabase:
	@staticmethod
	def check_connection():
		return True


def _create_configured_facade():
	facade = SymbolRestFacade(create_unreachable_db_config(), _create_node_config())
	facade.symbol_db = HealthySymbolDatabase()
	facade.db_error = None
	return facade


class SymbolRestFacadeTest(TestCase):
	def test_rejects_missing_db_config(self):
		# Arrange:
		node_config = _create_node_config()

		# Act + Assert:
		with self.assertRaisesRegex(ValueError, 'Symbol database configuration is required'):
			SymbolRestFacade(None, node_config)

	def test_rejects_missing_node_config(self):
		# Act + Assert:
		with self.assertRaisesRegex(ValueError, 'Symbol node configuration is required'):
			SymbolRestFacade(create_unreachable_db_config(), None)

	def test_reports_configured_core_status_when_dependencies_are_available(self):
		# Arrange:
		facade = _create_configured_facade()

		# Act:
		result = facade.get_core_status()

		# Assert:
		self.assertTrue(facade.is_configured())
		self.assertEqual({
			'isConfigured': True,
			'node': {
				'baseUrl': NODE_URL,
				'allowPrivate': False,
				'allowLoopback': True,
				'timeoutSeconds': 10
			}
		}, result)

	def test_reports_healthy_core_when_dependencies_are_available(self):
		# Arrange:
		facade = _create_configured_facade()

		# Act:
		result = facade.get_health()

		# Assert:
		self.assertEqual(create_symbol_health(
			isHealthy=True,
			dbUp=True,
			nodeConfigured=True,
		), result)

	def test_reports_database_error(self):
		# Arrange:
		node_config = _create_node_config()
		facade = SymbolRestFacade(create_unreachable_db_config(), node_config)
		facade.symbol_db = FailingSymbolDatabase()
		facade.db_error = None

		# Act:
		result = facade.get_health()

		# Assert:
		self.assertEqual(
			create_symbol_health(
				nodeConfigured=True,
				errors=[{
					'type': 'database',
					'message': 'Symbol database is unavailable'
				}]
			),
			result
		)

	def test_reports_database_initialization_error(self):
		# Arrange:
		node_config = _create_node_config()

		# Act:
		facade = SymbolRestFacade(db_config=create_unreachable_db_config(), node_config=node_config)
		result = facade.get_health()

		# Assert:
		self.assertFalse(facade.is_configured())
		self.assertEqual(create_symbol_health(
			nodeConfigured=True,
			errors=[{
				'type': 'database',
				'message': 'Symbol database is unavailable'
			}]
		), result)
		self.assertNotIn('connection refused', str(result))
