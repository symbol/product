import datetime

from symbolchain.nem.NetworkTimestamp import NetworkTimestamp as NemNetworkTimestamp
from symbolchain.symbol.NetworkTimestamp import NetworkTimestamp as SymbolNetworkTimestamp

SYMBOL_TESTNET_EPOCH_TIME = datetime.datetime(2021, 11, 25, 14, 0, 47, tzinfo=datetime.timezone.utc)


class NetworkTimeConverter:
	"""Converts timestamps from network to UNIX times."""

	def __init__(self, network_name):
		"""Creates a converter."""

		self.is_testnet = 'testnet' == network_name

	def symbol_to_unix(self, timestamp):
		"""Converts a Symbol timestamp to a UNIX timestamp."""

		if self.is_testnet:
			return SymbolNetworkTimestamp(timestamp).to_datetime(SYMBOL_TESTNET_EPOCH_TIME).timestamp()

		return SymbolNetworkTimestamp(timestamp).to_datetime().timestamp()

	@staticmethod
	def nem_to_unix(timestamp):
		"""Converts a NEM timestamp to a UNIX timestamp."""

		return NemNetworkTimestamp(timestamp).to_datetime().timestamp()
