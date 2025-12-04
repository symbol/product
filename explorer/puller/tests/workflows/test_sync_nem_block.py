import asyncio
import unittest
from collections import namedtuple
from unittest.mock import AsyncMock, Mock, patch

from puller.workflows.sync_nem_block import main, parse_args

DatabaseConfig = namedtuple('DatabaseConfig', ['database', 'user', 'password', 'host', 'port'])


class SyncNemBlockTest(unittest.TestCase):

	def test_parse_args_with_defaults(self):
		# Arrange + Act:
		with patch('sys.argv', ['sync_nem_block.py']):
			args = parse_args()

		# Assert:
		self.assertEqual(args.nem_node, 'http://localhost:7890')
		self.assertEqual(args.network, 'mainnet')
		self.assertEqual(args.db_config, 'config.ini')

	def test_parse_args_with_custom_values(self):
		# Arrange:
		test_args = [
			'sync_nem_block.py',
			'--nem-node', 'http://localhost:7890',
			'--network', 'testnet',
			'--db-config', 'test_config.ini'
		]

		# Act:
		with patch('sys.argv', test_args):
			args = parse_args()

		# Assert:
		self.assertEqual(args.nem_node, 'http://localhost:7890')
		self.assertEqual(args.network, 'testnet')
		self.assertEqual(args.db_config, 'test_config.ini')

	@patch('puller.workflows.sync_nem_block.NemPuller')
	@patch('puller.workflows.sync_nem_block.parse_args')
	def _run_main_test(self, mock_parse_args, mock_nem_puller, db_height):  # pylint: disable=no-self-use
		# Arrange:
		mock_args = Mock()
		mock_args.nem_node = 'http://localhost:7890'
		mock_args.network = 'testnet'
		mock_args.db_config = 'test_config.ini'
		mock_parse_args.return_value = mock_args

		mock_facade = Mock()
		mock_nem_puller.return_value = mock_facade

		mock_db = Mock()
		mock_facade.nem_db = mock_db
		mock_facade.nem_db.__enter__ = Mock(return_value=mock_db)
		mock_facade.nem_db.__exit__ = Mock(return_value=None)

		mock_connector = Mock()
		mock_facade.nem_connector = mock_connector
		mock_connector.chain_height = AsyncMock(return_value=10)

		mock_db.get_current_height.return_value = db_height
		mock_facade.sync_nemesis_block = AsyncMock()
		mock_facade.sync_blocks = AsyncMock()

		# Act:
		asyncio.run(main())

		# Assert:
		mock_nem_puller.assert_called_once_with('http://localhost:7890', 'test_config.ini', 'testnet')
		mock_db.create_tables.assert_called_once()
		mock_db.get_current_height.assert_called_once()
		mock_connector.chain_height.assert_called_once()
		mock_facade.sync_blocks.assert_called_once_with(1, 10)

		return mock_facade

	def test_sync_nemesis_block_when_db_empty(self):
		# Act:
		mock_facade = self._run_main_test(db_height=0)  # pylint: disable=no-value-for-parameter

		# Assert:
		mock_facade.sync_nemesis_block.assert_called_once()

	def test_can_skip_sync_nemesis_block_when_db_height_is_not_zero(self):
		# Act:
		mock_facade = self._run_main_test(db_height=1)  # pylint: disable=no-value-for-parameter

		# Assert:
		mock_facade.sync_nemesis_block.assert_not_called()
