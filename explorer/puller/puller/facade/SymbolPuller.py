import configparser
from collections import namedtuple
from urllib.parse import urlparse

from common.symbol.NodeConfig import SymbolNodeConfiguration
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.symbol.Network import Network
from symbollightapi.connector.SymbolConnector import SymbolConnector

from puller.db.SymbolDatabase import SymbolDatabase

DatabaseConfig = namedtuple('DatabaseConfig', ['database', 'user', 'password', 'host', 'port'])


def _get_symbol_network(network_type):
	if 'mainnet' == network_type:
		return Network.MAINNET
	if 'testnet' == network_type:
		return Network.TESTNET

	raise ValueError(f'Unsupported Symbol network "{network_type}". Supported values: mainnet, testnet')


class SymbolPuller:
	"""Facade for pulling data from Symbol network."""

	def __init__(self, node_url, config_file, network_type='mainnet', node_config=None):
		"""Creates a Symbol puller facade object."""

		config = configparser.ConfigParser()
		config.read(config_file)

		db_config = config['symbol_db']

		network = _get_symbol_network(network_type)

		self.symbol_db = SymbolDatabase(DatabaseConfig(**db_config))
		self.node_config = node_config or SymbolNodeConfiguration.from_url(node_url)
		symbol_node_endpoint = self.node_config.assert_request_allowed(self.node_config.base_url)
		self._symbol_connector = SymbolConnector(symbol_node_endpoint)
		self._symbol_connector.timeout_seconds = self.node_config.timeout_seconds
		self.symbol_facade = SymbolFacade(str(network))

	def validate_node_request_target(self, request_url):
		"""Validates a future Symbol node request target against security policy."""

		return self.node_config.assert_request_allowed(request_url)

	def _validate_symbol_node_path(self, url_path):
		parsed_url = urlparse(url_path)
		if parsed_url.scheme or parsed_url.netloc:
			raise ValueError('Symbol node connector paths must be relative')
		if parsed_url.fragment:
			raise ValueError('Symbol node connector paths must not include fragments')

		normalized_path = url_path.lstrip('/')
		self.validate_node_request_target(self.node_config.base_url)

		return normalized_path

	async def get_symbol_node(self, url_path, property_name=None, not_found_as_error=True):
		"""Validates and dispatches a Symbol node GET request."""

		return await self._symbol_connector.get(
			self._validate_symbol_node_path(url_path),
			property_name,
			not_found_as_error
		)

	async def post_symbol_node(self, url_path, request_payload, property_name=None, not_found_as_error=True):
		"""Validates and dispatches a Symbol node POST request."""

		return await self._symbol_connector.post(
			self._validate_symbol_node_path(url_path),
			request_payload,
			property_name,
			not_found_as_error
		)
