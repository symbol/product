import unittest

from bridge.nem.NemUtils import calculate_transfer_transaction_fee


class NemUtilsTest(unittest.TestCase):
	def test_can_calculate_xem_transfer_fee_without_message(self):
		self.assertEqual(50000 * 25, calculate_transfer_transaction_fee(500000))
		self.assertEqual(50000 * 25, calculate_transfer_transaction_fee(250000))
		self.assertEqual(50000 * 20, calculate_transfer_transaction_fee(200000))
		self.assertEqual(50000 * 20, calculate_transfer_transaction_fee(201111))
		self.assertEqual(50000 * 1, calculate_transfer_transaction_fee(10000))
		self.assertEqual(50000 * 1, calculate_transfer_transaction_fee(1))

	def test_can_calculate_xem_transfer_fee_with_message(self):
		self.assertEqual(50000 * 20, calculate_transfer_transaction_fee(200000, b''))
		self.assertEqual(50000 * 21, calculate_transfer_transaction_fee(200000, b'0' * 31))
		self.assertEqual(50000 * 22, calculate_transfer_transaction_fee(200000, b'0' * 32))
		self.assertEqual(50000 * 22, calculate_transfer_transaction_fee(200000, b'0' * 33))
		self.assertEqual(50000 * 30, calculate_transfer_transaction_fee(200000, b'0' * 319))
		self.assertEqual(50000 * 31, calculate_transfer_transaction_fee(200000, b'0' * 320))
		self.assertEqual(50000 * 31, calculate_transfer_transaction_fee(200000, b'0' * 321))
