from symbolchain.Network import NetworkLocator
from symbolchain.symbol.IdGenerator import generate_mosaic_alias_id
from symbolchain.symbol.Network import Address, Network
from symbollightapi.connector.SymbolConnector import SymbolConnector

from .SymbolUtils import extract_wrap_request_from_transaction


class SymbolNetworkFacade:
	"""Symbol network facade."""

	def __init__(self, network_name):
		"""Creates a Symbol network facade."""

		self.network = NetworkLocator.find_by_name(Network.NETWORKS, network_name)
		self.currency_mosaic_ids = []

	def is_currency_mosaic_id(self, mosaic_id):
		"""Determines if a mosaic id represents the network currency mosaic id."""

		return mosaic_id in self.currency_mosaic_ids

	async def load_currency_mosaic_ids(self, endpoint):
		"""Loads currency mosaic ids."""

		connector = self.create_connector(endpoint)
		currency_mosaic_id = await connector.currency_mosaic_id()

		self.currency_mosaic_ids = [
			currency_mosaic_id,
			generate_mosaic_alias_id('symbol.xym')
		]

	@staticmethod
	def create_connector(endpoint):
		"""Creates a connector to the network."""

		return SymbolConnector(endpoint)

	@staticmethod
	def make_address(raw_address):
		"""Wraps a raw address into a typed address """

		return Address(raw_address)

	def extract_wrap_request_from_transaction(self, transaction_with_meta_json):  # pylint: disable=invalid-name
		"""Extracts a wrap request (or error) from a transaction ."""

		return extract_wrap_request_from_transaction(self.network, self.is_currency_mosaic_id, transaction_with_meta_json)
