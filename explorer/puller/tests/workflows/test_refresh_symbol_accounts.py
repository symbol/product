# pylint: disable=duplicate-code
import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from common.symbol.NodeConfiguration import SymbolNodeConfigurationError
from workflow_test_utils import create_symbol_facade_with_mock_db, parse_args_with_argv

from puller.workflows.refresh_symbol_accounts import _create_node_config, main, parse_args


class RefreshSymbolAccountsTest(unittest.TestCase):
	def test_parse_args_requires_node_network_and_db_config(self):
		# Act + Assert:
		with self.assertRaises(SystemExit):
			parse_args_with_argv('refresh_symbol_accounts.py', parse_args)

	def test_parse_args_with_required_values(self):
		# Act:
		args = parse_args_with_argv(
			'refresh_symbol_accounts.py',
			parse_args,
			'--symbol-node', 'http://localhost:3000',
			'--network', 'mainnet',
			'--db-config', 'config.ini')

		# Assert:
		self.assertEqual(args.symbol_node, 'http://localhost:3000')
		self.assertEqual(args.network, 'mainnet')
		self.assertEqual(args.db_config, 'config.ini')

	def test_parse_args_rejects_invalid_network(self):
		# Act + Assert:
		with self.assertRaises(SystemExit):
			parse_args_with_argv(
				'refresh_symbol_accounts.py',
				parse_args,
				'--symbol-node', 'http://localhost:3000',
				'--db-config', 'test_config.ini',
				'--network', 'main')

	def test_create_node_config_rejects_missing_allowed_hosts(self):
		# Arrange:
		with patch.dict('os.environ', {}, clear=True):
			# Act + Assert:
			with self.assertRaisesRegex(
				SymbolNodeConfigurationError,
				'SYMBOL_NODE_ALLOWED_HOSTS is required'
			):
				_create_node_config('http://localhost:7890')

	def test_create_node_config_uses_symbol_node_environment(self):
		# Arrange:
		with patch.dict('os.environ', {
			'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:7890',
			'SYMBOL_NODE_ALLOW_LOOPBACK': 'true',
			'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
			'SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS': '17'
		}, clear=True):
			# Act:
			node_config = _create_node_config('http://localhost:7890')

		# Assert:
		self.assertEqual('http://localhost:7890', node_config.base_url)
		self.assertEqual(frozenset({'localhost:7890'}), node_config.allowed_hosts)
		self.assertTrue(node_config.allow_loopback)
		self.assertFalse(node_config.allow_private)
		self.assertEqual(17, node_config.timeout_seconds)

	def test_main_creates_tables_and_refreshes_accounts(self):
		# Arrange:
		with patch('puller.workflows.refresh_symbol_accounts.SymbolPuller') as mock_symbol_puller:
			mock_facade, mock_db = create_symbol_facade_with_mock_db(mock_symbol_puller)
			mock_facade.refresh_accounts = AsyncMock()

			with patch('sys.argv', [
				'refresh_symbol_accounts.py',
				'--symbol-node', 'http://localhost:7890',
				'--network', 'testnet',
				'--db-config', 'test_config.ini'
			]), patch.dict('os.environ', {
				'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:7890',
				'SYMBOL_NODE_ALLOW_LOOPBACK': 'true',
				'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
				'SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS': '9'
			}, clear=True):
				# Act:
				asyncio.run(main())

		# Assert:
		self.assertEqual(1, mock_db.create_tables.call_count)
		mock_facade.refresh_accounts.assert_awaited_once_with()
