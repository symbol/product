import asyncio
import runpy
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

from common.symbol.NodeConfiguration import SymbolNodeConfigurationError
from workflow_test_utils import create_symbol_facade_with_mock_db, create_symbol_main_args, parse_args_with_argv

from puller.workflows.sync_symbol_block import _create_node_config, main, parse_args


class SyncSymbolBlockTest(unittest.TestCase):
	def test_parse_args_requires_node_network_and_db_config(self):
		# Act + Assert:
		with self.assertRaises(SystemExit):
			parse_args_with_argv('sync_symbol_block.py', parse_args)

	def test_parse_args_with_required_values(self):
		# Act:
		args = parse_args_with_argv(
			'sync_symbol_block.py',
			parse_args,
			'--symbol-node', 'http://localhost:3000',
			'--network', 'mainnet',
			'--db-config', 'config.ini')

		# Assert:
		self.assertEqual(args.symbol_node, 'http://localhost:3000')
		self.assertEqual(args.network, 'mainnet')
		self.assertEqual(args.db_config, 'config.ini')
		self.assertIsNone(args.max_height)

	def test_parse_args_with_custom_values(self):
		# Act:
		args = parse_args_with_argv(
			'sync_symbol_block.py',
			parse_args,
			'--symbol-node', 'http://localhost:3000',
			'--network', 'testnet',
			'--db-config', 'test_config.ini',
			'--max-height', '1000')

		# Assert:
		self.assertEqual(args.symbol_node, 'http://localhost:3000')
		self.assertEqual(args.network, 'testnet')
		self.assertEqual(args.db_config, 'test_config.ini')
		self.assertEqual(1000, args.max_height)

	def test_parse_args_rejects_invalid_network(self):
		# Act + Assert:
		with self.assertRaises(SystemExit):
			parse_args_with_argv(
				'sync_symbol_block.py',
				parse_args,
				'--symbol-node', 'http://localhost:3000',
				'--db-config', 'test_config.ini',
				'--network', 'main')

	def test_parse_args_rejects_invalid_max_height(self):
		# Act + Assert:
		with self.assertRaises(SystemExit):
			parse_args_with_argv(
				'sync_symbol_block.py',
				parse_args,
				'--symbol-node', 'http://localhost:3000',
				'--network', 'testnet',
				'--db-config', 'test_config.ini',
				'--max-height', '0')

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
		self.assertEqual(
			frozenset({'localhost:7890'}),
			node_config.allowed_hosts)
		self.assertTrue(node_config.allow_loopback)
		self.assertFalse(node_config.allow_private)
		self.assertEqual(17, node_config.timeout_seconds)

	@patch('puller.workflows.sync_symbol_block.SymbolPuller')
	@patch('puller.workflows.sync_symbol_block.SymbolNodeConfiguration')
	@patch('puller.workflows.sync_symbol_block.parse_args')
	def test_main_creates_tables_and_syncs_block_headers(
		self,
		mock_parse_args,
		mock_symbol_node_config,
		mock_symbol_puller
	):
		# Arrange:
		mock_parse_args.return_value = create_symbol_main_args()
		mock_node_config = Mock()
		mock_symbol_node_config.from_app_config.return_value = mock_node_config
		mock_facade, mock_db = create_symbol_facade_with_mock_db(
			mock_symbol_puller)
		mock_facade.sync_block_headers = AsyncMock()

		with patch.dict('os.environ', {
			'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:7890',
			'SYMBOL_NODE_ALLOW_LOOPBACK': 'true',
			'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
			'SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS': '9'
		}, clear=True):
			# Act:
			asyncio.run(main())

		# Assert:
		self.assertEqual(1, mock_symbol_node_config.from_app_config.call_count)
		self.assertEqual(({
			'SYMBOL_NODE_URL': 'http://localhost:7890',
			'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:7890',
			'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
			'SYMBOL_NODE_ALLOW_LOOPBACK': 'true',
			'SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS': '9'
		},), mock_symbol_node_config.from_app_config.call_args.args)
		self.assertEqual(
			{},
			mock_symbol_node_config.from_app_config.call_args.kwargs)
		self.assertEqual(1, mock_symbol_puller.call_count)
		self.assertEqual((
			'http://localhost:7890',
			'test_config.ini',
			'testnet',
			mock_node_config
		), mock_symbol_puller.call_args.args)
		self.assertEqual({}, mock_symbol_puller.call_args.kwargs)
		self.assertEqual(1, mock_db.create_tables.call_count)
		self.assertEqual((), mock_db.create_tables.call_args.args)
		self.assertEqual({}, mock_db.create_tables.call_args.kwargs)
		self.assertEqual(1, mock_facade.sync_block_headers.await_count)
		self.assertEqual(
			(3000,),
			mock_facade.sync_block_headers.await_args.args)
		self.assertEqual({}, mock_facade.sync_block_headers.await_args.kwargs)

	@patch('asyncio.run')
	def test_main_guard_runs_main(self, mock_asyncio_run):
		# Arrange:
		mock_asyncio_run.side_effect = lambda coroutine: coroutine.close()

		workflow_path = Path(__file__).parents[2] / 'puller' / 'workflows' / 'sync_symbol_block.py'

		# Act:
		runpy.run_path(str(workflow_path), run_name='__main__')

		# Assert:
		self.assertEqual(1, mock_asyncio_run.call_count)
