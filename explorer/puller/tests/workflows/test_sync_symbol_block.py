import asyncio
import unittest

from workflow_test_utils import RecordingSymbolPullerFactory, create_symbol_environment

from puller.workflows.sync_symbol_block import main, parse_args


class SyncSymbolBlockTest(unittest.TestCase):
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
		self.assertEqual(args.symbol_node, 'http://localhost:3000')
		self.assertEqual(args.network, 'mainnet')
		self.assertEqual(args.db_config, 'config.ini')
		self.assertIsNone(args.max_height)
		self.assertIsNone(args.max_requests_per_second)

	def test_parse_args_with_custom_values(self):
		# Act:
		args = parse_args([
			'--symbol-node', 'http://localhost:3000',
			'--network', 'testnet',
			'--db-config', 'test_config.ini',
			'--max-height', '1000',
			'--max-requests-per-second', '25'])

		# Assert:
		self.assertEqual(args.symbol_node, 'http://localhost:3000')
		self.assertEqual(args.network, 'testnet')
		self.assertEqual(args.db_config, 'test_config.ini')
		self.assertEqual(args.max_height, 1000)
		self.assertEqual(args.max_requests_per_second, 25)

	def test_parse_args_rejects_invalid_network(self):
		# Act + Assert:
		with self.assertRaises(SystemExit):
			parse_args([
				'--symbol-node', 'http://localhost:3000',
				'--db-config', 'test_config.ini',
				'--network', 'main'])

	def test_parse_args_rejects_invalid_max_height(self):
		# Act + Assert:
		with self.assertRaises(SystemExit):
			parse_args([
				'--symbol-node', 'http://localhost:3000',
				'--network', 'testnet',
				'--db-config', 'test_config.ini',
				'--max-height', '0'])

	def test_parse_args_rejects_invalid_max_requests_per_second(self):
		# Act + Assert:
		with self.assertRaises(SystemExit):
			parse_args([
				'--symbol-node', 'http://localhost:3000',
				'--network', 'testnet',
				'--db-config', 'test_config.ini',
				'--max-requests-per-second', '0'])

	def test_main_forwards_custom_max_requests_per_second_to_symbol_puller(self):
		# Arrange:
		puller_factory = RecordingSymbolPullerFactory()
		argv = [
			'--symbol-node', 'http://localhost:7890',
			'--network', 'testnet',
			'--db-config', 'test_config.ini',
			'--max-height', '3000',
			'--max-requests-per-second', '25'
		]
		environment = create_symbol_environment('9')

		# Act:
		asyncio.run(main(puller_factory, argv, environment))

		# Assert:
		puller = puller_factory.puller
		self.assertEqual(25, puller.constructor_kwargs['max_requests_per_second'])
		self.assertEqual(1, puller.symbol_db.create_tables_call_count)
		self.assertEqual([3000], puller.synced_max_heights)

	def test_main_uses_symbol_puller_default_max_requests_per_second_when_omitted(self):
		# Arrange:
		puller_factory = RecordingSymbolPullerFactory()
		argv = [
			'--symbol-node', 'http://localhost:7890',
			'--network', 'testnet',
			'--db-config', 'test_config.ini'
		]
		environment = create_symbol_environment('9')

		# Act:
		asyncio.run(main(puller_factory, argv, environment))

		# Assert:
		puller = puller_factory.puller
		self.assertEqual({}, puller.constructor_kwargs)
		self.assertEqual(1, puller.symbol_db.create_tables_call_count)
		self.assertEqual([None], puller.synced_max_heights)
