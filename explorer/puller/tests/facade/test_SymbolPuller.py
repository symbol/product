import asyncio
import tempfile
from pathlib import Path
from unittest import TestCase
from unittest.mock import AsyncMock, patch

from common.symbol.NodeConfiguration import SymbolNodeConfiguration

from puller.facade.SymbolPuller import SymbolPuller

NODE_URL = 'http://127.0.0.1:3000'


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


def _create_symbol_puller(db_config_path, network_type='mainnet', request_timeout_seconds=10, node_url=NODE_URL):
	node_config = SymbolNodeConfiguration.from_url(
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


class SymbolPullerTest(TestCase):
	def test_create_testnet_puller_instance(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)

			# Act:
			puller = _create_symbol_puller(db_config_path, 'testnet', request_timeout_seconds=15)

		# Assert:
		self.assertEqual(NODE_URL, puller.node_config.base_url)
		self.assertEqual('testnet', puller.symbol_facade.network.name)
		self.assertEqual('symbol', puller.symbol_db.db_config.database)
		self.assertIsNone(puller.symbol_db.connection)

	def test_rejects_unsupported_network_type(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)

			# Act + Assert:
			with self.assertRaisesRegex(ValueError, 'Unsupported Symbol network "main". Supported values: mainnet, testnet'):
				_create_symbol_puller(db_config_path, 'main')

	def test_requires_symbol_db_config_section(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory, include_symbol_db=False)

			# Act + Assert:
			with self.assertRaisesRegex(KeyError, 'symbol_db'):
				_create_symbol_puller(db_config_path)

	@patch('puller.facade.SymbolPuller.SymbolConnector')
	def test_get_symbol_node_validates_target(self, symbol_connector_factory):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)
			puller = _create_symbol_puller(db_config_path)

		symbol_connector = symbol_connector_factory.return_value
		symbol_connector.get = AsyncMock(return_value={'ok': True})

		# Act:
		result = asyncio.run(puller.get_symbol_node('/blocks?pageNumber=1&pageSize=100', 'data', False))

		# Assert:
		self.assertEqual({'ok': True}, result)
		symbol_connector.get.assert_awaited_once_with('blocks?pageNumber=1&pageSize=100', 'data', False)

	@patch('puller.facade.SymbolPuller.SymbolConnector')
	def test_post_symbol_node_validates_target(self, symbol_connector_factory):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)
			puller = _create_symbol_puller(db_config_path)

		symbol_connector = symbol_connector_factory.return_value
		symbol_connector.post = AsyncMock(return_value={'ok': True})

		# Act:
		result = asyncio.run(puller.post_symbol_node('path', {'payload': 1}, 'data', False))

		# Assert:
		self.assertEqual({'ok': True}, result)
		symbol_connector.post.assert_awaited_once_with('path', {'payload': 1}, 'data', False)

	@patch('puller.facade.SymbolPuller.SymbolConnector')
	def test_symbol_node_path_must_be_relative(self, symbol_connector_factory):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)
			puller = _create_symbol_puller(db_config_path)

		# Act + Assert:
		with self.assertRaisesRegex(ValueError, 'Symbol node connector paths must be relative'):
			asyncio.run(puller.get_symbol_node('http://example.com/path'))

		symbol_connector_factory.return_value.get.assert_not_called()

	@patch('puller.facade.SymbolPuller.SymbolConnector')
	def test_symbol_node_path_must_not_include_fragments(self, symbol_connector_factory):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_db_config(temp_directory)
			puller = _create_symbol_puller(db_config_path)

		# Act + Assert:
		with self.assertRaisesRegex(ValueError, 'Symbol node connector paths must not include fragments'):
			asyncio.run(puller.get_symbol_node('blocks#fragment'))

		symbol_connector_factory.return_value.get.assert_not_called()
