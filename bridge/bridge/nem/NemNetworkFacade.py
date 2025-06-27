from symbolchain.nem.Network import Address, Network
from symbolchain.Network import NetworkLocator
from symbollightapi.connector.NemConnector import NemConnector

from .NemUtils import extract_wrap_request_from_transaction


class NemNetworkFacade:
	"""NEM network facade."""

	def __init__(self, network_name):
		"""Creates a NEM network facade."""

		self.network = NetworkLocator.find_by_name(Network.NETWORKS, network_name)

	@staticmethod
	def create_connector(endpoint):
		"""Creates a connector to the network."""

		return NemConnector(endpoint)

	@staticmethod
	def make_address(raw_address):
		"""Wraps a raw address into a typed address """

		return Address(raw_address)

	def extract_wrap_request_from_transaction(self, transaction_with_meta_json):  # pylint: disable=invalid-name
		"""Extracts a wrap request (or error) from a transaction ."""

		return [extract_wrap_request_from_transaction(self.network, transaction_with_meta_json)]
