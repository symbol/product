# pylint: disable=duplicate-code
import asyncio
import unittest

from workflow_test_utils import RecordingSymbolPullerFactory, create_symbol_environment

from puller.workflows.refresh_symbol_accounts import main, parse_args


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

	def test_main_creates_tables_and_refreshes_accounts(self):
		# Arrange:
		puller_factory = RecordingSymbolPullerFactory()
		argv = [
			'refresh_symbol_accounts.py',
			'--symbol-node', 'http://localhost:7890',
			'--network', 'testnet',
			'--db-config', 'test_config.ini'
		]
		environment = create_symbol_environment('9')

		# Act:
		asyncio.run(main(puller_factory, argv[1:], environment))

		# Assert:
		puller = puller_factory.puller
		self.assertEqual(1, puller.symbol_db.create_tables_call_count)
		self.assertEqual(1, puller.refresh_accounts_call_count)
