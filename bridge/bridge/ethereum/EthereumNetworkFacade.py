from collections import namedtuple

from web3 import Web3

from ..models.Constants import PrintableMosaicId
from .EthereumAdapters import EthereumAddress, EthereumNetwork
from .EthereumConnector import EthereumConnector
from .EthereumUtils import extract_wrap_request_from_transaction

EthereumSdkFacade = namedtuple('EthereumSdkFacade', ['network'])


class EthereumNetworkFacade:
	"""Ethereum network facade."""

	def __init__(self, config):
		"""Creates an Ethereum network facade."""

		self.config = config
		self.network = EthereumNetwork(config.network)
		self.rosetta_network_id = None
		self.sdk_facade = EthereumSdkFacade(self.network)
		self.bridge_address = EthereumAddress(config.bridge_address)
		self.transaction_search_address = EthereumAddress(self.config.extensions['mosaic_id'])  # search the contract address

		self.token_precision = None

	async def init(self):
		"""Downloads information from the network to initialize the facade."""

		connector = self.create_connector()
		self.token_precision = await connector.token_precision(self.config.extensions['mosaic_id'])

	def extract_mosaic_id(self):
		"""
		Extracts the wrapped mosaic id from config and converts it into both a printable version
		and a version that can be passed to network facades as arguments.
		"""

		config_mosaic_id = self.config.extensions['mosaic_id']
		return PrintableMosaicId(config_mosaic_id, config_mosaic_id)

	def create_connector(self, **_kwargs):
		"""Creates a connector to the network."""

		is_finalization_supported = 'True' == self.config.extensions.get('is_finalization_supported', 'True')
		return EthereumConnector(self.config.endpoint, is_finalization_supported)

	@staticmethod
	def make_address(raw_address):
		"""Wraps a raw address into a typed address """

		return EthereumAddress(raw_address)

	@staticmethod
	def is_valid_address(raw_address):
		"""Checks if an address is valid and belongs to this network."""

		is_valid = Web3.is_address(raw_address)
		return (is_valid, raw_address if is_valid else None)

	def extract_wrap_request_from_transaction(self, is_valid_address, transaction_with_meta_json, _mosaic_id=None):
		# pylint: disable=invalid-name
		"""Extracts a wrap request (or error) from a transaction ."""

		wrap_request = extract_wrap_request_from_transaction(is_valid_address, self.bridge_address, transaction_with_meta_json)
		return [wrap_request] if wrap_request else []
