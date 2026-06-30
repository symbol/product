import asyncio
import tempfile
from unittest import TestCase
from unittest.mock import AsyncMock, patch

from symbollightapi.model.Exceptions import NodeException

from puller.facade.SymbolPuller import SymbolPuller

from .puller_test_utils import NODE_URL, _create_db_config, _create_symbol_puller, _temporary_symbol_puller


class SymbolPullerTest(TestCase):

	def test_create_default_puller_instance(self):
		# Arrange / Act:
		with _temporary_symbol_puller() as puller:
			# Assert:
			self.assertEqual('mainnet', puller.symbol_facade.network.name)
			self.assertEqual('symbol', puller.symbol_db.db_config.database)
			self.assertIsNone(puller.symbol_db.connection)

	def test_create_testnet_puller_instance(self):
		# Arrange / Act:
		with _temporary_symbol_puller(
			'testnet',
			request_timeout_seconds=15
		) as puller:
			# Assert:
			self.assertEqual(NODE_URL, puller.node_config.base_url)
			self.assertEqual('testnet', puller.symbol_facade.network.name)
			self.assertEqual('symbol', puller.symbol_db.db_config.database)
			self.assertIsNone(puller.symbol_db.connection)

	@patch('puller.facade.SymbolPuller.SymbolConnector')
	def test_initializes_with_custom_request_timeout(
		self,
		symbol_connector_factory
	):
		# Arrange / Act:
		with _temporary_symbol_puller(
			'testnet',
			request_timeout_seconds=15
		) as puller:
			self.assertEqual(15, puller.node_config.timeout_seconds)

		# Assert:
		self.assertEqual(
			15,
			symbol_connector_factory.return_value.timeout_seconds
		)

	def test_rejects_unsupported_network_type(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)

			# Act / Assert:
			with self.assertRaisesRegex(
				ValueError,
				'Unsupported Symbol network "main". '
				'Supported values: mainnet, testnet'
			):
				_create_symbol_puller(db_config_path, 'main')

	def test_requires_symbol_db_config_section(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(
				temp_directory,
				include_symbol_db=False
			)

			# Act / Assert:
			with self.assertRaisesRegex(KeyError, 'symbol_db'):
				_create_symbol_puller(db_config_path)

	def test_initializes_from_node_url_when_node_config_is_omitted(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)
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

	@patch('puller.facade.SymbolPuller.SymbolConnector')
	def test_get_symbol_node_validates_target(self, symbol_connector_factory):
		# Arrange:
		with _temporary_symbol_puller() as puller:
			symbol_connector = symbol_connector_factory.return_value
			symbol_connector.get = AsyncMock(return_value={'ok': True})

			# Act:
			result = asyncio.run(puller.get_symbol_node(
				'/blocks?pageNumber=1&pageSize=100',
				'data',
				False
			))

		# Assert:
		self.assertEqual({'ok': True}, result)
		symbol_connector.get.assert_awaited_once_with(
			'blocks?pageNumber=1&pageSize=100',
			'data',
			False
		)

	@patch('puller.facade.SymbolPuller.SymbolConnector')
	def test_post_symbol_node_validates_target(self, symbol_connector_factory):
		# Arrange:
		with _temporary_symbol_puller() as puller:
			symbol_connector = symbol_connector_factory.return_value
			symbol_connector.post = AsyncMock(return_value={'ok': True})

			# Act:
			result = asyncio.run(puller.post_symbol_node(
				'path',
				{'payload': 1},
				'data',
				False
			))

		# Assert:
		self.assertEqual({'ok': True}, result)
		symbol_connector.post.assert_awaited_once_with(
			'path',
			{'payload': 1},
			'data',
			False
		)

	@patch('asyncio.sleep')
	@patch('puller.facade.SymbolPuller.SymbolConnector')
	def test_post_symbol_node_retries_api_error_response(
		self,
		symbol_connector_factory,
		mock_sleep
	):
		# Arrange:
		with _temporary_symbol_puller() as puller:
			symbol_connector = symbol_connector_factory.return_value
			symbol_connector.post = AsyncMock(side_effect=[
				{
					'code': 'InvalidArgument',
					'message': 'payload has an invalid format'
				},
				{'ok': True}
			])
			mock_sleep.return_value = AsyncMock()

			# Act:
			result = asyncio.run(puller.post_symbol_node(
				'/transactions',
				{'payload': 'ABCD'}
			))

		# Assert:
		self.assertEqual({'ok': True}, result)
		self.assertEqual(2, symbol_connector.post.await_count)
		mock_sleep.assert_called_once_with(2)

	@patch('asyncio.sleep')
	@patch('puller.facade.SymbolPuller.SymbolConnector')
	def test_get_symbol_node_retries_node_exception(
		self,
		symbol_connector_factory,
		mock_sleep
	):
		# Arrange:
		with _temporary_symbol_puller() as puller:
			symbol_connector = symbol_connector_factory.return_value
			symbol_connector.get = AsyncMock(side_effect=[
				NodeException('Connection refused'),
				{'ok': True}
			])
			mock_sleep.return_value = AsyncMock()

			# Act:
			result = asyncio.run(puller.get_symbol_node('/chain/info'))

		# Assert:
		self.assertEqual({'ok': True}, result)
		self.assertEqual(2, symbol_connector.get.await_count)
		mock_sleep.assert_called_once_with(2)

	@patch('asyncio.sleep')
	@patch('puller.facade.SymbolPuller.SymbolConnector')
	def test_get_symbol_node_raises_after_max_retries(
		self,
		symbol_connector_factory,
		mock_sleep
	):
		# Arrange:
		with _temporary_symbol_puller() as puller:
			symbol_connector = symbol_connector_factory.return_value
			symbol_connector.get = AsyncMock(
				side_effect=NodeException('Connection refused')
			)
			mock_sleep.return_value = AsyncMock()

			# Act / Assert:
			with self.assertRaisesRegex(NodeException, 'Connection refused'):
				asyncio.run(puller.get_symbol_node('/chain/info'))

		# Assert:
		self.assertEqual(3, symbol_connector.get.await_count)
		self.assertEqual(2, mock_sleep.call_count)

	@patch('asyncio.sleep')
	@patch('puller.facade.SymbolPuller.SymbolConnector')
	def test_get_symbol_node_retries_api_error_response(
		self,
		symbol_connector_factory,
		mock_sleep
	):
		# Arrange:
		with _temporary_symbol_puller() as puller:
			symbol_connector = symbol_connector_factory.return_value
			symbol_connector.get = AsyncMock(side_effect=[
				{
					'code': 'InvalidArgument',
					'message': 'offset has an invalid format'
				},
				{'data': [], 'pagination': {'pageNumber': 1, 'pageSize': 100}}
			])
			mock_sleep.return_value = AsyncMock()

			# Act:
			result = asyncio.run(puller.get_symbol_node(
				'/blocks?pageSize=100&offset=bad&orderBy=height'
			))

		# Assert:
		self.assertEqual(
			{'data': [], 'pagination': {'pageNumber': 1, 'pageSize': 100}},
			result
		)
		self.assertEqual(2, symbol_connector.get.await_count)
		mock_sleep.assert_called_once_with(2)

	@patch('puller.facade.SymbolPuller.SymbolConnector')
	def test_symbol_node_path_must_be_relative(self, symbol_connector_factory):
		# Arrange:
		with _temporary_symbol_puller() as puller:
			# Act / Assert:
			with self.assertRaisesRegex(
				ValueError,
				'Symbol node connector paths must be relative'
			):
				asyncio.run(puller.get_symbol_node('http://example.com/path'))

			# Assert:
			symbol_connector_factory.return_value.get.assert_not_called()

	@patch('puller.facade.SymbolPuller.SymbolConnector')
	def test_symbol_node_path_must_not_include_fragments(
		self,
		symbol_connector_factory
	):
		# Arrange:
		with _temporary_symbol_puller() as puller:
			# Act / Assert:
			with self.assertRaisesRegex(
				ValueError,
				'Symbol node connector paths must not include fragments'
			):
				asyncio.run(puller.get_symbol_node('blocks#fragment'))

			# Assert:
			symbol_connector_factory.return_value.get.assert_not_called()
