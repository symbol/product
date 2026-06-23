import asyncio
import tempfile
from pathlib import Path
from unittest import TestCase
from unittest.mock import AsyncMock, patch

from puller.facade.SymbolPuller import SymbolPuller
from puller.model.symbol.NodeConfig import SymbolNodeConfig

_NODE_URL = 'http://127.0.0.1:3000'
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


def _create_symbol_puller(db_config_path, network_type='mainnet', request_timeout_seconds=10, node_url=_NODE_URL):
	node_config = SymbolNodeConfig.from_url(
		node_url,
		allow_loopback=True,
		timeout_seconds=request_timeout_seconds
	)

	return SymbolPuller(
		node_url,
		db_config_path,
		network_type,
		node_config
	)


class TestSymbolPuller(TestCase):
	def test_initializes_with_symbol_db_node_config_symbol_connector_and_symbol_facade(self):
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)

			puller = _create_symbol_puller(db_config_path, 'testnet', request_timeout_seconds=15)

		self.assertEqual(_NODE_URL, puller.node_config.base_url)
		self.assertEqual('testnet', puller.symbol_facade.network.name)
		self.assertEqual('symbol', puller.symbol_db.db_config.database)
		self.assertIsNone(puller.symbol_db.connection)

	def test_requires_symbol_db_config_section(self):
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory, include_symbol_db=False)

			with self.assertRaisesRegex(KeyError, 'symbol_db'):
				_create_symbol_puller(db_config_path)

	def test_validates_node_request_target(self):
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)
			puller = _create_symbol_puller(db_config_path)

		result = puller.validate_node_request_target(_NODE_URL)

		self.assertEqual(_NODE_URL, result)

	@patch('puller.facade.SymbolPuller.SymbolConnector')
	def test_get_symbol_node_validates_target(self, symbol_connector_factory):
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)
			puller = _create_symbol_puller(db_config_path)

		symbol_connector = symbol_connector_factory.return_value
		symbol_connector.get = AsyncMock(return_value={'ok': True})

		result = asyncio.run(puller.get_symbol_node('/blocks?pageNumber=1&pageSize=100', 'data', False))

		self.assertEqual({'ok': True}, result)
		symbol_connector.get.assert_awaited_once_with('blocks?pageNumber=1&pageSize=100', 'data', False)

	@patch('puller.facade.SymbolPuller.SymbolConnector')
	def test_post_symbol_node_validates_target(self, symbol_connector_factory):
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)
			puller = _create_symbol_puller(db_config_path)

		symbol_connector = symbol_connector_factory.return_value
		symbol_connector.post = AsyncMock(return_value={'ok': True})

		result = asyncio.run(puller.post_symbol_node('path', {'payload': 1}, 'data', False))

		self.assertEqual({'ok': True}, result)
		symbol_connector.post.assert_awaited_once_with('path', {'payload': 1}, 'data', False)

	@patch('puller.facade.SymbolPuller.SymbolConnector')
	def test_symbol_node_path_must_be_relative(self, symbol_connector_factory):
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)
			puller = _create_symbol_puller(db_config_path)

		with self.assertRaisesRegex(ValueError, 'Symbol node connector paths must be relative'):
			asyncio.run(puller.get_symbol_node('http://example.com/path'))

		symbol_connector_factory.return_value.get.assert_not_called()

	@patch('puller.facade.SymbolPuller.SymbolConnector')
	def test_symbol_node_path_must_not_include_fragments(self, symbol_connector_factory):
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)
			puller = _create_symbol_puller(db_config_path)

		with self.assertRaisesRegex(ValueError, 'Symbol node connector paths must not include fragments'):
			asyncio.run(puller.get_symbol_node('blocks#fragment'))

		symbol_connector_factory.return_value.get.assert_not_called()
