import datetime
import unittest
from binascii import unhexlify

from bridge.ethereum.EthereumAdapters import EthereumAddress, EthereumNetwork, EthereumNetworkTimestamp


class EthereumAdaptersTest(unittest.TestCase):
	# region EthereumAddress

	def test_can_create_ethereum_address_from_string(self):
		# Act:
		address = EthereumAddress('0x0ff070994dd3fdB1441433c219A42286ef85290f')

		# Assert:
		self.assertEqual(unhexlify('0FF070994DD3FDB1441433C219A42286EF85290F'), address.bytes)
		self.assertEqual('0x0FF070994DD3FDB1441433C219A42286EF85290F', str(address))

	def test_can_create_ethereum_address_from_bytes(self):
		# Act:
		address = EthereumAddress(unhexlify('0FF070994DD3FDB1441433C219A42286EF85290F'))

		# Assert:
		self.assertEqual(unhexlify('0FF070994DD3FDB1441433C219A42286EF85290F'), address.bytes)
		self.assertEqual('0x0FF070994DD3FDB1441433C219A42286EF85290F', str(address))

	def test_ethereum_address_supports_comparisons(self):
		# Arrange:
		address = EthereumAddress('0x0ff070994dd3fdB1441433c219A42286ef85290f')

		# Act + Assert:
		self.assertEqual(address, EthereumAddress('0x0ff070994dd3fdB1441433c219A42286ef85290f'))
		self.assertEqual(address, EthereumAddress('0x0FF070994DD3FDB1441433C219A42286EF85290F'))

		self.assertNotEqual(EthereumAddress('0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97'), address)
		self.assertNotEqual(address, EthereumAddress('0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97'))

	# endregion

	# region EthereumNetwork

	def test_can_create_ethereum_network(self):
		# Act:
		network = EthereumNetwork('foobar')

		# Assert:
		self.assertEqual('foobar', network.name)
		self.assertEqual(EthereumNetworkTimestamp, network.network_timestamp_class)

	def test_can_convert_timestamp_to_datetime(self):
		# Arrange:
		network = EthereumNetwork('foobar')

		# Act:
		datetime_timestamp = network.to_datetime(EthereumNetworkTimestamp(0x66AA3553))

		# Assert:
		self.assertEqual(datetime.datetime(2024, 7, 31, 13, 0, 3, 0, datetime.timezone.utc), datetime_timestamp)

	# endregion
