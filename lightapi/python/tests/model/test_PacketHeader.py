import unittest

from symbollightapi.model.Exceptions import CorruptDataException
from symbollightapi.model.PacketHeader import PacketHeader, PacketType


class PacketHeaderTest(unittest.TestCase):
	def test_can_create_default(self):
		# Act:
		header = PacketHeader()

		# Assert:
		self.assertEqual(8, header.size)
		self.assertEqual(PacketType.UNDEFINED, header.packet_type)

	def test_can_serialize(self):
		# Arrange:
		header = PacketHeader(40, PacketType.CHAIN_STATISTICS)

		# Act:
		buffer = header.serialize()

		# Assert:
		self.assertEqual(bytes([0x28, 0x00, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00]), buffer)

	def test_can_deserialize(self):
		# Arrange:
		buffer = bytes([0x28, 0x00, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00])

		# Act:
		header = PacketHeader.deserialize_from_buffer(buffer)

		# Assert:
		self.assertEqual(40, header.size)
		self.assertEqual(PacketType.CHAIN_STATISTICS, header.packet_type)

	def test_cannot_deserialize_when_packet_is_unexpected_type(self):
		# Arrange:
		buffer = bytes([0x28, 0x00, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00])

		# Act + Assert:
		with self.assertRaises(CorruptDataException):
			PacketHeader.deserialize_from_buffer(buffer, PacketType.UNDEFINED)
