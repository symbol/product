import asyncio
import tempfile
from pathlib import Path
from unittest import TestCase
from unittest.mock import AsyncMock, Mock, patch

from puller.facade.SymbolPuller import SymbolPuller


def _create_db_config(config_dir, include_symbol_db=True):
	db_config_path = Path(config_dir) / 'db_config.ini'
	with open(db_config_path, 'wt', encoding='utf8') as db_config_file:
		db_config_file.write('[nem_db]\n')
		db_config_file.write('database = nem\n')
		db_config_file.write('user = postgres\n')
		db_config_file.write('password = \n')
		db_config_file.write('host = 127.0.0.1\n')
		db_config_file.write('port = 5432\n')

		if include_symbol_db:
			db_config_file.write('[symbol_db]\n')
			db_config_file.write('database = symbol\n')
			db_config_file.write('user = postgres\n')
			db_config_file.write('password = \n')
			db_config_file.write('host = 127.0.0.1\n')
			db_config_file.write('port = 5433\n')

	return db_config_path


def _mock_address(address):
	return [(None, None, None, None, (address, 3000))]


class TestSymbolPuller(TestCase):
	@patch.dict('os.environ', {
		'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:3000',
		'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
		'SYMBOL_NODE_ALLOW_LOOPBACK': 'true',
		'SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS': '15'
	}, clear=True)
	@patch('puller.facade.SymbolPuller.SymbolFacade')
	@patch('puller.facade.SymbolPuller.SymbolConnector')
	@patch('puller.facade.SymbolPuller.SymbolDatabase')
	@patch('puller.model.symbol.NodeConfig.socket.getaddrinfo', return_value=_mock_address('127.0.0.1'))
	def test_initializes_with_symbol_db_node_config_symbol_connector_and_symbol_facade(
		self,
		_,
		database_factory,
		symbol_connector_factory,
		symbol_facade_factory
	):
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)

			puller = SymbolPuller('http://localhost:3000', db_config_path, 'testnet')

		self.assertEqual('http://localhost:3000', puller.node_config.base_url)
		symbol_connector_factory.assert_called_once_with('http://localhost:3000')
		self.assertEqual(15, symbol_connector_factory.return_value.timeout_seconds)
		symbol_facade_factory.assert_called_once_with('testnet')
		self.assertEqual(symbol_facade_factory.return_value, puller.symbol_facade)
		database_factory.assert_called_once()

	@patch.dict('os.environ', {
		'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:3000',
		'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
		'SYMBOL_NODE_ALLOW_LOOPBACK': 'true'
	}, clear=True)
	def test_requires_symbol_db_config_section(self):
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory, include_symbol_db=False)

			with self.assertRaisesRegex(KeyError, 'symbol_db'):
				SymbolPuller('http://localhost:3000', db_config_path)

	@patch.dict('os.environ', {
		'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:3000',
		'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
		'SYMBOL_NODE_ALLOW_LOOPBACK': 'true'
	}, clear=True)
	@patch('puller.facade.SymbolPuller.SymbolFacade')
	@patch('puller.facade.SymbolPuller.SymbolConnector')
	@patch('puller.facade.SymbolPuller.SymbolDatabase')
	def test_validates_node_request_target(self, database_factory, _, __):
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)
			puller = SymbolPuller('http://localhost:3000', db_config_path)

		puller.node_config = Mock(spec=['assert_request_allowed'])
		puller.node_config.assert_request_allowed.return_value = 'http://localhost:3000'

		result = puller.validate_node_request_target('http://localhost:3000')

		self.assertEqual('http://localhost:3000', result)
		puller.node_config.assert_request_allowed.assert_called_once_with('http://localhost:3000')
		database_factory.assert_called_once()

	@patch.dict('os.environ', {
		'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:3000',
		'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
		'SYMBOL_NODE_ALLOW_LOOPBACK': 'true'
	}, clear=True)
	@patch('puller.facade.SymbolPuller.SymbolFacade')
	@patch('puller.facade.SymbolPuller.SymbolConnector')
	@patch('puller.facade.SymbolPuller.SymbolDatabase')
	def test_get_symbol_node_validates_target(self, _, symbol_connector_factory, __):
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)
			puller = SymbolPuller('http://localhost:3000', db_config_path)

		puller.validate_node_request_target = Mock(return_value='http://localhost:3000/path')
		symbol_connector = symbol_connector_factory.return_value
		symbol_connector.get = AsyncMock(return_value={'ok': True})

		result = asyncio.run(puller.get_symbol_node('/blocks?pageNumber=1&pageSize=100', 'data', False))

		self.assertEqual({'ok': True}, result)
		puller.validate_node_request_target.assert_called_once_with('http://localhost:3000')
		symbol_connector.get.assert_awaited_once_with('blocks?pageNumber=1&pageSize=100', 'data', False)

	@patch.dict('os.environ', {
		'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:3000',
		'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
		'SYMBOL_NODE_ALLOW_LOOPBACK': 'true'
	}, clear=True)
	@patch('puller.facade.SymbolPuller.SymbolFacade')
	@patch('puller.facade.SymbolPuller.SymbolConnector')
	@patch('puller.facade.SymbolPuller.SymbolDatabase')
	def test_post_symbol_node_validates_target(self, _, symbol_connector_factory, __):
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)
			puller = SymbolPuller('http://localhost:3000', db_config_path)

		puller.validate_node_request_target = Mock(return_value='http://localhost:3000/path')
		symbol_connector = symbol_connector_factory.return_value
		symbol_connector.post = AsyncMock(return_value={'ok': True})

		result = asyncio.run(puller.post_symbol_node('path', {'payload': 1}, 'data', False))

		self.assertEqual({'ok': True}, result)
		puller.validate_node_request_target.assert_called_once_with('http://localhost:3000')
		symbol_connector.post.assert_awaited_once_with('path', {'payload': 1}, 'data', False)

	@patch.dict('os.environ', {
		'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:3000',
		'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
		'SYMBOL_NODE_ALLOW_LOOPBACK': 'true'
	}, clear=True)
	@patch('puller.facade.SymbolPuller.SymbolFacade')
	@patch('puller.facade.SymbolPuller.SymbolConnector')
	@patch('puller.facade.SymbolPuller.SymbolDatabase')
	def test_symbol_node_path_must_be_relative(self, _, symbol_connector_factory, __):
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)
			puller = SymbolPuller('http://localhost:3000', db_config_path)

		symbol_connector = symbol_connector_factory.return_value
		symbol_connector.get = AsyncMock()

		with self.assertRaisesRegex(ValueError, 'Symbol node connector paths must be relative'):
			asyncio.run(puller.get_symbol_node('http://example.com/path'))

		symbol_connector.get.assert_not_called()

	@patch.dict('os.environ', {
		'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:3000',
		'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
		'SYMBOL_NODE_ALLOW_LOOPBACK': 'true'
	}, clear=True)
	@patch('puller.facade.SymbolPuller.SymbolFacade')
	@patch('puller.facade.SymbolPuller.SymbolConnector')
	@patch('puller.facade.SymbolPuller.SymbolDatabase')
	def test_symbol_node_path_must_not_include_fragments(self, _, symbol_connector_factory, __):
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)
			puller = SymbolPuller('http://localhost:3000', db_config_path)

		symbol_connector = symbol_connector_factory.return_value
		symbol_connector.get = AsyncMock()

		with self.assertRaisesRegex(ValueError, 'Symbol node connector paths must not include fragments'):
			asyncio.run(puller.get_symbol_node('blocks#fragment'))

		symbol_connector.get.assert_not_called()
