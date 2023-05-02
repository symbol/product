import datetime

from symbolchain.NetworkTimestamp import NetworkTimestampDatetimeConverter

SYMBOL_TESTNET_EPOCH_TIME = datetime.datetime(2022, 10, 31, 21, 7, 47, tzinfo=datetime.timezone.utc)
SYMBOL_MAINNET_EPOCH_TIME = datetime.datetime(2021, 3, 16, 0, 6, 25, tzinfo=datetime.timezone.utc)
NEM_EPOCH_TIME = datetime.datetime(2015, 3, 29, 0, 6, 25, tzinfo=datetime.timezone.utc)


class NetworkTimeConverter:
	"""Converts timestamps from network to UNIX times."""

	def __init__(self, network_name):
		"""Creates a converter."""

		self.is_testnet = 'testnet' == network_name

	def symbol_to_unix(self, timestamp):
		"""Converts a Symbol timestamp to a UNIX timestamp."""

		if self.is_testnet:
			return NetworkTimestampDatetimeConverter(SYMBOL_TESTNET_EPOCH_TIME, 'milliseconds').to_datetime(timestamp).timestamp()

		return NetworkTimestampDatetimeConverter(SYMBOL_MAINNET_EPOCH_TIME, 'milliseconds').to_datetime(timestamp).timestamp()

	@staticmethod
	def nem_to_unix(timestamp):
		"""Converts a NEM timestamp to a UNIX timestamp."""

		return NetworkTimestampDatetimeConverter(NEM_EPOCH_TIME, 'seconds').to_datetime(timestamp).timestamp()
