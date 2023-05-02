import datetime
import unittest

from puller.models.NetworkTimeConverter import NetworkTimeConverter


class NetworkTimeConverterTest(unittest.TestCase):
	def test_can_convert_symbol_to_unix_time_mainnet(self):
		# Arrange:
		converter = NetworkTimeConverter('mainnet')

		# Act:
		unix_timestamp = converter.symbol_to_unix(15000)

		# Assert:
		self.assertEqual(datetime.datetime(2021, 3, 16, 0, 6, 25 + 15, tzinfo=datetime.timezone.utc).timestamp(), unix_timestamp)

	def test_can_convert_symbol_to_unix_time_testnet(self):
		# Arrange:
		converter = NetworkTimeConverter('testnet')

		# Act:
		unix_timestamp = converter.symbol_to_unix(15000)

		# Assert:
		self.assertEqual(datetime.datetime(2022, 10, 31, 21, 8, 2, tzinfo=datetime.timezone.utc).timestamp(), unix_timestamp)

	def test_can_convert_nem_to_unix_time_mainnet(self):
		# Arrange:
		converter = NetworkTimeConverter('mainnet')

		# Act:
		unix_timestamp = converter.nem_to_unix(15)

		# Assert:
		self.assertEqual(datetime.datetime(2015, 3, 29, 0, 6, 25 + 15, tzinfo=datetime.timezone.utc).timestamp(), unix_timestamp)

	def test_can_convert_nem_to_unix_time_testnet(self):
		# Arrange:
		converter = NetworkTimeConverter('testnet')

		# Act:
		unix_timestamp = converter.nem_to_unix(15)

		# Assert:
		self.assertEqual(datetime.datetime(2015, 3, 29, 0, 6, 25 + 15, tzinfo=datetime.timezone.utc).timestamp(), unix_timestamp)
