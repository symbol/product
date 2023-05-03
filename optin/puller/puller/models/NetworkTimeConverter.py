from symbolchain.nem.Network import Network as NemNetwork
from symbolchain.symbol.Network import Network as SymbolNetwork


class NetworkTimeConverter:
	"""Converts timestamps from network to UNIX times."""

	def __init__(self, network_name):
		"""Creates a converter."""

		self.is_testnet = 'testnet' == network_name

	def symbol_to_unix(self, timestamp):
		"""Converts a Symbol timestamp to a UNIX timestamp."""

		if self.is_testnet:
			return SymbolNetwork.TESTNET.datetime_converter.to_datetime(timestamp).timestamp()

		return SymbolNetwork.MAINNET.datetime_converter.to_datetime(timestamp).timestamp()

	@staticmethod
	def nem_to_unix(timestamp):
		"""Converts a NEM timestamp to a UNIX timestamp."""

		return NemNetwork.MAINNET.datetime_converter.to_datetime(timestamp).timestamp()
