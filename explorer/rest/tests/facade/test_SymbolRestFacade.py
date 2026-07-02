from unittest import TestCase

from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from common.tests.PostgresTestUtils import create_unreachable_db_configuration
from psycopg2 import OperationalError

from rest.db.SymbolDatabase import SortOrder
from rest.facade.SymbolRestFacade import SymbolRestFacade

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

	@staticmethod
	def try_get_sync_state():
		return {
			'status': 'healthy',
			'chain_height': 10,
			'finalized_height': 8,
			'last_synced_height': 10,
			'updated_at': None
		}


class LaggingSymbolDatabase:
	@staticmethod
	def check_connection():
		return True

	@staticmethod
	def try_get_sync_state():
		return {
			'status': 'healthy',
			'chain_height': 10,
			'finalized_height': 8,
			'last_synced_height': 9,
			'updated_at': None
		}


class UnhealthySymbolDatabase:
	@staticmethod
	def check_connection():
		return True

	@staticmethod
	def try_get_sync_state():
		return {
			'status': 'unhealthy',
			'chain_height': 10,
			'finalized_height': 8,
			'last_synced_height': 10,
			'updated_at': None
		}


class RepairingSymbolDatabase:
	@staticmethod
	def check_connection():
		return True

	@staticmethod
	def try_get_sync_state():
		return {
			'status': 'repairing',
			'chain_height': 10,
			'finalized_height': 8,
			'last_synced_height': 9,
			'updated_at': None
		}


class SyncStateFailingSymbolDatabase:
	@staticmethod
	def check_connection():
		return True

	@staticmethod
	def try_get_sync_state():
		raise OperationalError('database unavailable')


class BlockView:
	@staticmethod
	def to_dict():
		return {'height': 1}

	@staticmethod
	def to_detail_dict():
		return {'height': 1, 'detail': True}


DEFAULT_BLOCKS = object()


class BlockSymbolDatabase:
	def __init__(self, head_height=6, blocks=DEFAULT_BLOCKS):
		self.head_height = head_height
		self.blocks = [BlockView()] if DEFAULT_BLOCKS is blocks else blocks
		self.limit = None
		self.from_height = None
		self.sort = None
		self.height = None

	def get_block_head_height(self):
		return self.head_height

	def get_blocks(self, from_height, limit, sort):
		self.from_height = from_height
		self.limit = limit
		self.sort = sort
		return self.blocks

	def get_block(self, height):
		self.height = height
		return BlockView() if 1 == height else None


class UnavailableBlockSymbolDatabase:
	@staticmethod
	def get_block_head_height():
		raise OperationalError('database unavailable')

	@staticmethod
	def get_blocks(_from_height, _limit, _sort):
		raise OperationalError('database unavailable')

	@staticmethod
	def get_block(_height):
		raise OperationalError('database unavailable')


class BlockReadFailingSymbolDatabase:
	@staticmethod
	def get_block_head_height():
		return 1

	@staticmethod
	def get_block(_height):
		raise OperationalError('database unavailable')


def _create_configured_facade():
	facade = SymbolRestFacade(
		create_unreachable_db_configuration(),
		_create_node_config())
	facade.symbol_db = HealthySymbolDatabase()
	facade.db_error = None
	return facade


def _create_facade_with_database(symbol_db):
	facade = SymbolRestFacade(
		create_unreachable_db_configuration(),
		_create_node_config())
	facade.symbol_db = symbol_db
	facade.db_error = None
	return facade


class SymbolRestFacadeTest(TestCase):  # pylint: disable=too-many-public-methods
	def test_rejects_missing_db_config(self):
		# Arrange:
		node_config = _create_node_config()

		# Act + Assert:
		with self.assertRaisesRegex(
			ValueError,
			'Symbol database configuration is required'
		):
			SymbolRestFacade(None, node_config)

	def test_rejects_missing_node_config(self):
		# Act + Assert:
		with self.assertRaisesRegex(
			ValueError,
			'Symbol node configuration is required'
		):
			SymbolRestFacade(create_unreachable_db_configuration(), None)

	def test_reports_configured_when_dependencies_are_available(self):
		# Arrange:
		facade = _create_configured_facade()

		# Act + Assert:
		self.assertTrue(facade.is_configured())

	def test_reports_configured_core_status_when_available(self):
		# Arrange:
		facade = _create_configured_facade()

		# Act:
		result = facade.get_core_status()

		# Assert:
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
		self.assertEqual({
			'isHealthy': True,
			'dbUp': True,
			'finalizedHeight': 8,
			'backendSynced': True,
			'lastDBSyncedAt': None,
			'lastDBHeight': 10,
			'status': 'healthy',
			'errors': []
		}, result)

	def test_reports_unsynced_when_healthy_state_is_behind_chain_height(self):
		# Arrange:
		facade = _create_facade_with_database(LaggingSymbolDatabase())

		# Act:
		result = facade.get_health()

		# Assert:
		self.assertEqual(create_symbol_health(
			dbUp=True,
			finalizedHeight=8,
			lastDBHeight=9,
			status='healthy',
			errors=[{
				'type': 'synchronization',
				'message': 'Symbol database height 9 does not match chain height 10'
			}]
		), result)

	def test_reports_database_error(self):
		# Arrange:
		facade = _create_facade_with_database(FailingSymbolDatabase())

		# Act + Assert:
		self.assertEqual(create_symbol_health(
			errors=[{
				'type': 'database',
				'message': 'Symbol database is unavailable'
			}]
		), facade.get_health())

	def test_reports_database_error_when_sync_state_read_fails(self):
		# Arrange:
		facade = _create_facade_with_database(SyncStateFailingSymbolDatabase())

		# Act:
		result = facade.get_health()

		# Assert:
		self.assertEqual(create_symbol_health(
			dbUp=True,
			errors=[{
				'type': 'database',
				'message': 'Symbol database is unavailable'
			}]
		), result)

	def test_reports_unconfigured_when_database_initialization_fails(self):
		# Arrange:
		node_config = _create_node_config()

		# Act:
		facade = SymbolRestFacade(
			db_config=create_unreachable_db_configuration(),
			node_config=node_config)

		# Assert:
		self.assertFalse(facade.is_configured())

	def test_reports_database_initialization_error(self):
		# Arrange:
		node_config = _create_node_config()
		facade = SymbolRestFacade(
			db_config=create_unreachable_db_configuration(),
			node_config=node_config)

		# Act:
		result = facade.get_health()

		# Assert:
		self.assertEqual(create_symbol_health(
			errors=[{
				'type': 'database',
				'message': 'Symbol database is unavailable'
			}]
		), result)

	def test_reports_unhealthy_rollback_state(self):
		# Arrange:
		facade = _create_facade_with_database(UnhealthySymbolDatabase())

		# Act:
		result = facade.get_health()

		# Assert:
		self.assertEqual(create_symbol_health(
			dbUp=True,
			finalizedHeight=8,
			lastDBHeight=10,
			status='unhealthy',
			errors=[{
				'type': 'rollback',
				'message': 'Symbol backend is in an unhealthy rollback state'
			}]
		), result)

	def test_reports_repairing_sync_state_as_unhealthy(self):
		# Arrange:
		facade = _create_facade_with_database(RepairingSymbolDatabase())

		# Act:
		result = facade.get_health()

		# Assert:
		self.assertEqual(create_symbol_health(
			dbUp=True,
			finalizedHeight=8,
			lastDBHeight=9,
			status='repairing',
			errors=[{
				'type': 'synchronization',
				'message': 'Symbol backend status is repairing'
			}]
		), result)

	def test_can_get_blocks(self):
		# Arrange:
		facade = _create_facade_with_database(BlockSymbolDatabase())

		# Act:
		result = facade.get_blocks(from_height=2, limit=1, sort=SortOrder.DESC)

		# Assert:
		self.assertEqual([{'height': 1}], result)

	def test_get_blocks_passes_cursor_query_to_database(self):
		# Arrange:
		symbol_db = BlockSymbolDatabase()
		facade = _create_facade_with_database(symbol_db)

		# Act:
		facade.get_blocks(from_height=2, limit=1, sort=SortOrder.DESC)

		# Assert:
		self.assertEqual(1, facade.symbol_db.limit)
		self.assertEqual(2, facade.symbol_db.from_height)
		self.assertEqual(SortOrder.DESC, facade.symbol_db.sort)

	def test_get_blocks_returns_none_when_database_is_unavailable(self):
		# Arrange:
		facade = SymbolRestFacade(
			create_unreachable_db_configuration(),
			_create_node_config())

		# Act + Assert:
		self.assertFalse(facade.is_database_available())
		self.assertIsNone(
			facade.get_blocks(from_height=None, limit=1, sort=SortOrder.DESC))

	def test_get_blocks_returns_none_when_backend_data_is_unavailable(self):
		# Arrange:
		facade = _create_facade_with_database(
			BlockSymbolDatabase(head_height=None))

		# Act + Assert:
		self.assertFalse(facade.is_block_data_available())
		self.assertIsNone(
			facade.get_blocks(from_height=None, limit=1, sort=SortOrder.DESC))

	def test_get_blocks_returns_none_when_database_read_fails(self):
		# Arrange:
		facade = _create_facade_with_database(UnavailableBlockSymbolDatabase())

		# Act + Assert:
		self.assertFalse(facade.is_block_data_available())
		self.assertIsNone(
			facade.get_blocks(from_height=None, limit=1, sort=SortOrder.DESC))

	def test_get_blocks_returns_none_when_database_returns_none(self):
		# Arrange:
		facade = _create_facade_with_database(BlockSymbolDatabase(blocks=None))

		# Act + Assert:
		self.assertIsNone(
			facade.get_blocks(from_height=None, limit=1, sort=SortOrder.DESC))

	def test_can_get_block_detail(self):
		# Arrange:
		facade = _create_facade_with_database(BlockSymbolDatabase())

		# Act + Assert:
		self.assertEqual({'height': 1, 'detail': True}, facade.get_block(1))

	def test_get_block_returns_none_when_missing(self):
		# Arrange:
		facade = _create_facade_with_database(BlockSymbolDatabase())

		# Act + Assert:
		self.assertIsNone(facade.get_block(2))

	def test_get_block_returns_none_when_database_is_unavailable(self):
		# Arrange:
		facade = SymbolRestFacade(
			create_unreachable_db_configuration(),
			_create_node_config())

		# Act + Assert:
		self.assertIsNone(facade.get_block(1))

	def test_get_block_returns_none_when_database_read_fails(self):
		# Arrange:
		facade = _create_facade_with_database(BlockReadFailingSymbolDatabase())

		# Act + Assert:
		self.assertTrue(facade.is_block_data_available())
		self.assertIsNone(facade.get_block(1))
