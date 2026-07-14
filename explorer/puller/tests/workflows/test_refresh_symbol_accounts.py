# pylint: disable=duplicate-code
import asyncio
import os
import unittest

from common.symbol.NodeConfiguration import SymbolNodeConfigurationError

from puller.workflows.refresh_symbol_accounts import create_node_config, main, parse_args


class RecordingSymbolDatabase:
	def __init__(self):
		self.create_tables_call_count = 0

	def create_tables(self):
		self.create_tables_call_count += 1


class RecordingSymbolPuller:
	def __init__(self, *args, **kwargs):
		self.constructor_args = args
		self.constructor_kwargs = kwargs
		self.symbol_db = RecordingSymbolDatabase()
		self.refresh_accounts_call_count = 0

	def __enter__(self):
		return self

	def __exit__(self, *_):
		return None

	async def refresh_accounts(self):
		self.refresh_accounts_call_count += 1


class RecordingSymbolPullerFactory:
	def __init__(self):
		self.puller = None

	def __call__(self, *args, **kwargs):
		self.puller = RecordingSymbolPuller(*args, **kwargs)
		return self.puller


class RefreshSymbolAccountsTest(unittest.TestCase):
	def test_parse_args_requires_node_network_and_db_config(self):
		# Act + Assert:
		with self.assertRaises(SystemExit):
			parse_args([])

	def test_parse_args_with_required_values(self):
		# Act:
		args = parse_args([
			'--symbol-node', 'http://localhost:3000',
			'--network', 'mainnet',
			'--db-config', 'config.ini'])

		# Assert:
		self.assertEqual('http://localhost:3000', args.symbol_node)
		self.assertEqual('mainnet', args.network)
		self.assertEqual('config.ini', args.db_config)

	def test_parse_args_rejects_invalid_network(self):
		# Act + Assert:
		with self.assertRaises(SystemExit):
			parse_args([
				'--symbol-node', 'http://localhost:3000',
				'--db-config', 'test_config.ini',
				'--network', 'main'])

	def test_create_node_config_rejects_missing_allowed_hosts(self):
		# Arrange:
		environment = {}

		# Act + Assert:
		with self.assertRaisesRegex(
			SymbolNodeConfigurationError,
			'SYMBOL_NODE_ALLOWED_HOSTS is required'
		):
			create_node_config('http://localhost:7890', environment)

	def test_create_node_config_uses_symbol_node_environment(self):
		# Arrange:
		environment = {
			'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:7890',
			'SYMBOL_NODE_ALLOW_LOOPBACK': 'true',
			'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
			'SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS': '17'
		}

		# Act:
		node_config = create_node_config('http://localhost:7890', environment)

		# Assert:
		self.assertEqual('http://localhost:7890', node_config.base_url)
		self.assertEqual(frozenset({'localhost:7890'}), node_config.allowed_hosts)
		self.assertTrue(node_config.allow_loopback)
		self.assertFalse(node_config.allow_private)
		self.assertEqual(17, node_config.timeout_seconds)

	def test_create_node_config_defaults_to_process_environment(self):
		# Arrange:
		environment = {
			'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:7890',
			'SYMBOL_NODE_ALLOW_LOOPBACK': 'true',
			'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
			'SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS': '17'
		}
		previous_environment = {
			name: os.environ.get(name)
			for name in environment
		}

		# Act:
		try:
			for name, value in environment.items():
				os.environ[name] = value
			node_config = create_node_config('http://localhost:7890')
		finally:
			for name, value in previous_environment.items():
				if value is None:
					os.environ.pop(name, None)
				else:
					os.environ[name] = value

		# Assert:
		self.assertEqual('http://localhost:7890', node_config.base_url)
		self.assertEqual(frozenset({'localhost:7890'}), node_config.allowed_hosts)
		self.assertTrue(node_config.allow_loopback)
		self.assertFalse(node_config.allow_private)
		self.assertEqual(17, node_config.timeout_seconds)

	def test_main_creates_tables_and_refreshes_accounts(self):
		# Arrange:
		puller_factory = RecordingSymbolPullerFactory()
		argv = [
			'refresh_symbol_accounts.py',
			'--symbol-node', 'http://localhost:7890',
			'--network', 'testnet',
			'--db-config', 'test_config.ini'
		]
		environment = {
			'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:7890',
			'SYMBOL_NODE_ALLOW_LOOPBACK': 'true',
			'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
			'SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS': '9'
		}

		# Act:
		asyncio.run(main(puller_factory, argv[1:], environment))

		# Assert:
		puller = puller_factory.puller
		self.assertEqual(1, puller.symbol_db.create_tables_call_count)
		self.assertEqual(1, puller.refresh_accounts_call_count)
