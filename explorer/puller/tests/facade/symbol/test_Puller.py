import asyncio
import tempfile
from unittest import TestCase
from unittest.mock import AsyncMock, MagicMock, patch

from symbollightapi.model.Exceptions import NodeException

from puller.facade.SymbolPuller import SymbolPuller

from .puller_test_utils import NODE_URL, ResponseConnector, create_db_config, create_symbol_puller, temporary_symbol_puller


class SymbolPullerTest(TestCase):

	def test_create_default_puller_instance(self):
		# Arrange / Act:
		with temporary_symbol_puller() as puller:
			# Assert:
			self.assertEqual('mainnet', puller.symbol_facade.network.name)
			self.assertEqual('symbol', puller.symbol_db.db_config.database)
			self.assertIsNone(puller.symbol_db.connection)

	def test_create_testnet_puller_instance(self):
		# Arrange / Act:
		with temporary_symbol_puller(
			'testnet',
			request_timeout_seconds=15
		) as puller:
			# Assert:
			self.assertEqual(NODE_URL, puller.node_config.base_url)
			self.assertEqual('testnet', puller.symbol_facade.network.name)
			self.assertEqual('symbol', puller.symbol_db.db_config.database)
			self.assertIsNone(puller.symbol_db.connection)

	def test_initializes_with_custom_request_timeout(self):
		# Arrange / Act:
		connector = MagicMock()
		with temporary_symbol_puller(
			'testnet',
			request_timeout_seconds=15,
			connector=connector
		) as puller:
			# Assert:
			self.assertEqual(15, puller.node_config.timeout_seconds)
			self.assertEqual(puller.node_config.timeout_seconds, connector.timeout_seconds)

	def test_rejects_unsupported_network_type(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = create_db_config(temp_directory)

			# Act / Assert:
			with self.assertRaisesRegex(
				ValueError,
				'Unsupported Symbol network "main". '
				'Supported values: mainnet, testnet'
			):
				create_symbol_puller(db_config_path, 'main')

	def test_requires_symbol_db_config_section(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = create_db_config(
				temp_directory,
				include_symbol_db=False
			)

			# Act / Assert:
			with self.assertRaisesRegex(KeyError, 'symbol_db'):
				create_symbol_puller(db_config_path)

	def test_initializes_from_node_url_when_node_config_is_omitted(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = create_db_config(temp_directory)
			with patch(
				'common.symbol.NodeConfiguration.socket.getaddrinfo',
				return_value=[
					(None, None, None, None, ('93.184.216.34', 3000))
				]
			):
				# Act:
				puller = SymbolPuller(
					'http://example.com:3000',
					db_config_path,
					'testnet'
				)

			# Assert:
			self.assertEqual(
				'http://example.com:3000',
				puller.node_config.base_url
			)
			self.assertEqual(
				frozenset({'example.com:3000'}),
				puller.node_config.allowed_hosts
			)
			self.assertEqual('testnet', puller.symbol_facade.network.name)

	def test_get_symbol_node_validates_target(self):
		# Arrange:
		connector = ResponseConnector({
			'blocks?pageNumber=1&pageSize=100': {'ok': True}
		})
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			result = asyncio.run(puller.get_symbol_node(
				'/blocks?pageNumber=1&pageSize=100',
				'data',
				False
			))

		# Assert:
		self.assertEqual({'ok': True}, result)
		self.assertEqual(['blocks?pageNumber=1&pageSize=100'], connector.paths)

	def test_post_symbol_node_validates_target(self):
		# Arrange:
		connector = MagicMock()
		connector.post = AsyncMock(return_value={'ok': True})
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			result = asyncio.run(puller.post_symbol_node(
				'path',
				{'payload': 1},
				'data',
				False
			))

		# Assert:
		self.assertEqual({'ok': True}, result)
		connector.post.assert_awaited_once_with('path', {'payload': 1}, 'data', False)

	def test_post_symbol_node_retries_api_error_response(self):
		# Arrange:
		connector = MagicMock()
		connector.post = AsyncMock(side_effect=[
			{
				'code': 'InvalidArgument',
				'message': 'payload has an invalid format'
			},
			{'ok': True}
		])
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			result = asyncio.run(puller.post_symbol_node(
				'/transactions',
				{'payload': 'ABCD'}
			))

		# Assert:
		self.assertEqual({'ok': True}, result)
		self.assertEqual(2, connector.post.await_count)

	def test_get_symbol_node_retries_node_exception(self):
		# Arrange:
		connector = MagicMock()
		connector.get = AsyncMock(side_effect=[
			NodeException('Connection refused'),
			{'ok': True}
		])
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			result = asyncio.run(puller.get_symbol_node('/chain/info'))

		# Assert:
		self.assertEqual({'ok': True}, result)
		self.assertEqual(2, connector.get.await_count)

	def test_get_symbol_node_raises_after_max_retries(self):
		# Arrange:
		connector = MagicMock()
		connector.get = AsyncMock(
			side_effect=NodeException('Connection refused')
		)
		with temporary_symbol_puller(connector=connector) as puller:
			# Act / Assert:
			with self.assertRaisesRegex(NodeException, 'Connection refused'):
				asyncio.run(puller.get_symbol_node('/chain/info'))

		# Assert:
		self.assertEqual(3, connector.get.await_count)

	def test_get_symbol_node_retries_api_error_response(self):
		# Arrange:
		connector = MagicMock()
		connector.get = AsyncMock(side_effect=[
			{
				'code': 'InvalidArgument',
				'message': 'offset has an invalid format'
			},
			{'data': [], 'pagination': {'pageNumber': 1, 'pageSize': 100}}
		])
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			result = asyncio.run(puller.get_symbol_node(
				'/blocks?pageSize=100&offset=bad&orderBy=height'
			))

		# Assert:
		self.assertEqual(
			{'data': [], 'pagination': {'pageNumber': 1, 'pageSize': 100}},
			result
		)
		self.assertEqual(2, connector.get.await_count)

	def test_symbol_node_path_must_be_relative(self):
		# Arrange:
		connector = MagicMock()
		with temporary_symbol_puller(connector=connector) as puller:
			# Act / Assert:
			with self.assertRaisesRegex(
				ValueError,
				'Symbol node connector paths must be relative'
			):
				asyncio.run(puller.get_symbol_node('http://example.com/path'))

		# Assert:
		connector.get.assert_not_called()

	def test_symbol_node_path_must_not_include_fragments(self):
		# Arrange:
		connector = MagicMock()
		with temporary_symbol_puller(connector=connector) as puller:
			# Act / Assert:
			with self.assertRaisesRegex(
				ValueError,
				'Symbol node connector paths must not include fragments'
			):
				asyncio.run(puller.get_symbol_node('blocks#fragment'))

		# Assert:
		connector.get.assert_not_called()
