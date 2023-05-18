from enum import Enum

from symbolchain.BufferReader import BufferReader
from symbolchain.BufferWriter import BufferWriter

from .Exceptions import CorruptDataException


class PacketType(Enum):
	"""Symbol packet types."""

	# Undefined packet.
	UNDEFINED = 0

	# Chain statistics packet.
	CHAIN_STATISTICS = 5

	# Finalization statistics packet.
	FINALIZATION_STATISTICS = 0x132

	# Node information packet.
	# Alternative name: NODE_DISCOVERY_PULL_PING.
	NODE_INFORMATION = 0x111

	# Node peers packet.
	# Alternative name: NODE_DISCOVERY_PULL_PEERS.
	PEERS = 0x113


class PacketHeader:
	"""Symbol packet header."""

	def __init__(self, size=8, packet_type=PacketType.UNDEFINED):
		"""Creates a default packet header."""

		self.size = size
		self.packet_type = packet_type

	def serialize(self):
		"""Serializes this packet header to a bytes buffer."""

		writer = BufferWriter()
		writer.write_int(self.size, 4)
		writer.write_int(self.packet_type.value, 4)
		return writer.buffer

	@staticmethod
	def deserialize_from_buffer(buffer, expected_packet_type=None):
		"""Deserializes a packet header from a bytes buffer."""

		reader = BufferReader(buffer)
		size = reader.read_int(4)
		packet_type = PacketType(reader.read_int(4))

		if expected_packet_type is not None and expected_packet_type != packet_type:
			raise CorruptDataException(f'received packet with type {packet_type} but expected {expected_packet_type}')

		return PacketHeader(size, packet_type)
