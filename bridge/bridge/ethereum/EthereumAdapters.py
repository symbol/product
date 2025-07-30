import datetime
from collections import namedtuple

from symbolchain.ByteArray import ByteArray

from .RpcUtils import parse_rpc_response_hex_bytes

EthereumNetworkTimestamp = namedtuple('EthereumNetworkTimestamp', ['timestamp'])


class EthereumAddress(ByteArray):
	"""Represents an Ethereum address."""

	SIZE = 20

	def __init__(self, address):
		"""Creates an address from a decoded or encoded address."""

		raw_bytes = address
		if isinstance(address, str):
			raw_bytes = parse_rpc_response_hex_bytes(address)

		super().__init__(self.SIZE, raw_bytes, EthereumAddress)

	def __str__(self):
		return f'0x{super().__str__()}'


class EthereumNetwork:
	"""Represents an Ethereum network."""

	def __init__(self, name):
		"""Creates a new network."""

		self.name = name
		self.network_timestamp_class = EthereumNetworkTimestamp

	@staticmethod
	def to_datetime(reference_network_timestamp):
		"""Converts a network timestamp to a datetime."""

		return datetime.datetime.fromtimestamp(reference_network_timestamp.timestamp, tz=datetime.timezone.utc)
