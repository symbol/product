import tempfile
import unittest

from symbolchain.CryptoTypes import Hash256, PrivateKey

from bridge.ConversionRateCalculatorFactory import ConversionRateCalculatorFactory
from bridge.db.Databases import Databases
from bridge.db.WrapRequestDatabase import PayoutDetails
from bridge.models.WrapRequest import WrapRequest

from .test.BridgeTestUtils import HASHES
from .test.MockNetworkFacade import MockNemNetworkFacade

# region test helpers


def _create_databases(database_directory):
	# use same native and wrapped networks to make tests eaiser to follow
	# with same network, network timestamps can be used directly without needing to be normalized to different network epohchs
	return Databases(database_directory, MockNemNetworkFacade(), MockNemNetworkFacade())


def _add_requests_wrap(database, request_tuples):
	for (height, amount, fee) in request_tuples:
		transaction_hash = Hash256(PrivateKey.random().bytes)
		request = WrapRequest(height, transaction_hash, -1, transaction_hash, 0, 'tbd')
		database.add_request(request)

		payout_transaction_hash = Hash256(PrivateKey.random().bytes)
		database.mark_payout_sent(request, PayoutDetails(payout_transaction_hash, amount, fee, 0))


def _add_requests_unwrap(database, request_tuples):
	for (height, amount, raw_payout_transaction_hash) in request_tuples:
		transaction_hash = Hash256(PrivateKey.random().bytes)
		request = WrapRequest(height, transaction_hash, -1, transaction_hash, amount, 'tbd')
		database.add_request(request)

		if raw_payout_transaction_hash:
			database.mark_payout_sent(request, PayoutDetails(Hash256(raw_payout_transaction_hash), 0, 0, 0))


def _add_transfers(database, transfer_tuples):
	for (height, amount, raw_transaction_hash) in transfer_tuples:
		transaction_hash = Hash256(raw_transaction_hash) if raw_transaction_hash else Hash256.zero()
		database.add_transfer(height, 'foo:bar', amount, transaction_hash)
		database.add_transfer(height, 'foo:other', 2 * amount, transaction_hash)  # should be ignored by mosaic filtering

# endregion


class ConversionRateCalculatorFactoryTest(unittest.TestCase):
	# region empty

	def _assert_cannot_create_calculator_when_databases_are_empty(self, is_unwrap_mode):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				factory = ConversionRateCalculatorFactory(databases, 'foo:bar', is_unwrap_mode)

				# Act:
				calculator = factory.try_create_calculator(1111)

				# Assert:
				self.assertIsNone(calculator)

	def test_cannot_create_calculator_when_databases_are_empty_wrap_mode(self):
		self._assert_cannot_create_calculator_when_databases_are_empty(False)

	def test_cannot_create_calculator_when_databases_are_empty_unwrap_mode(self):
		self._assert_cannot_create_calculator_when_databases_are_empty(True)

	# endregion

	# region preconditions not met

	def _assert_cannot_create_calculator_when_balance_change_is_not_synced(self, is_unwrap_mode):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				factory = ConversionRateCalculatorFactory(databases, 'foo:bar', is_unwrap_mode)

				databases.balance_change.set_max_processed_height(1110)  # one block behind

				databases.wrap_request.set_max_processed_height(1111)
				databases.wrap_request.set_block_timestamp(1111, 10000)

				databases.unwrap_request.set_max_processed_height(700)
				databases.unwrap_request.set_block_timestamp(700, 10000)

				# Act:
				calculator = factory.try_create_calculator(1111)

				# Assert:
				self.assertIsNone(calculator)

	def test_cannot_create_calculator_when_balance_change_is_not_synced_wrap_mode(self):
		self._assert_cannot_create_calculator_when_balance_change_is_not_synced(False)

	def test_cannot_create_calculator_when_balance_change_is_not_synced_unwrap_mode(self):
		self._assert_cannot_create_calculator_when_balance_change_is_not_synced(True)

	def _assert_cannot_create_calculator_when_wrap_request_is_not_synced(self, is_unwrap_mode):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				factory = ConversionRateCalculatorFactory(databases, 'foo:bar', is_unwrap_mode)

				databases.balance_change.set_max_processed_height(1111)

				databases.wrap_request.set_max_processed_height(1110)  # one block behind
				databases.wrap_request.set_block_timestamp(1110, 10000)

				databases.unwrap_request.set_max_processed_height(700)
				databases.unwrap_request.set_block_timestamp(700, 10000)

				# Act:
				calculator = factory.try_create_calculator(1111)

				# Assert:
				self.assertIsNone(calculator)

	def test_cannot_create_calculator_when_wrap_request_is_not_synced_wrap_mode(self):
		self._assert_cannot_create_calculator_when_wrap_request_is_not_synced(False)

	def test_cannot_create_calculator_when_wrap_request_is_not_synced_unwrap_mode(self):
		self._assert_cannot_create_calculator_when_wrap_request_is_not_synced(True)

	def _assert_cannot_create_calculator_when_unwrap_request_is_not_synced(self, is_unwrap_mode):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				factory = ConversionRateCalculatorFactory(databases, 'foo:bar', is_unwrap_mode)

				databases.balance_change.set_max_processed_height(1111)

				databases.wrap_request.set_max_processed_height(1111)
				databases.wrap_request.set_block_timestamp(1111, 10000)

				databases.unwrap_request.set_max_processed_height(700)
				databases.unwrap_request.set_block_timestamp(700, 10000 - 1)  # one time unit behind

				# Act:
				calculator = factory.try_create_calculator(1111)

				# Assert:
				self.assertIsNone(calculator)

	def test_cannot_create_calculator_when_unwrap_request_is_not_synced_wrap_mode(self):
		self._assert_cannot_create_calculator_when_unwrap_request_is_not_synced(False)

	def test_cannot_create_calculator_when_unwrap_request_is_not_synced_unwrap_mode(self):
		self._assert_cannot_create_calculator_when_unwrap_request_is_not_synced(True)

	# endregion

	# region wrap

	def test_can_create_calculator_for_initial_wrap(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				_add_transfers(databases.balance_change, [
					(1111, 300, None)
				])
				databases.balance_change.set_max_processed_height(1111)

				_add_requests_wrap(databases.wrap_request, [
					(1111, 297, 3)
				])
				databases.wrap_request.set_max_processed_height(1111)
				databases.wrap_request.set_block_timestamp(1111, 10000)

				databases.unwrap_request.set_max_processed_height(700)
				databases.unwrap_request.set_block_timestamp(700, 10000)

				factory = ConversionRateCalculatorFactory(databases, 'foo:bar', False)

				# Act:
				calculator = factory.try_create_calculator(1111)

				# Assert:
				self.assertEqual(1000000, calculator(1000000))

	def test_can_create_calculator_for_multiple_wraps(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				_add_transfers(databases.balance_change, [
					(1111, 300, None),
					(1111, 200, None),
					(2222, 100, None),
					(2222, 200, None)
				])
				databases.balance_change.set_max_processed_height(2222)

				_add_requests_wrap(databases.wrap_request, [
					(1111, 297, 3),
					(1111, 198, 2),
					(2222, 99, 1),
					(2222, 198, 2)
				])
				databases.wrap_request.set_max_processed_height(2222)
				databases.wrap_request.set_block_timestamp(1111, 9000)
				databases.wrap_request.set_block_timestamp(2222, 10000)

				databases.unwrap_request.set_max_processed_height(700)
				databases.unwrap_request.set_block_timestamp(700, 10000)

				factory = ConversionRateCalculatorFactory(databases, 'foo:bar', False)

				# Act:
				calculator = factory.try_create_calculator(2222)

				# Assert:
				self.assertEqual(1000000, calculator(1000000))

	def test_can_create_calculator_for_wrap_after_donation(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				_add_transfers(databases.balance_change, [
					(1111, 200, None),
					(2222, 1000, None),
					(3333, 300, None)
				])
				databases.balance_change.set_max_processed_height(3333)

				_add_requests_wrap(databases.wrap_request, [
					(1111, 198, 2),
					(3333, 297, 3)
				])
				databases.wrap_request.set_max_processed_height(3333)
				databases.wrap_request.set_block_timestamp(1111, 8000)
				databases.wrap_request.set_block_timestamp(2222, 9000)
				databases.wrap_request.set_block_timestamp(3333, 10000)

				databases.unwrap_request.set_max_processed_height(700)
				databases.unwrap_request.set_block_timestamp(700, 10000)

				factory = ConversionRateCalculatorFactory(databases, 'foo:bar', False)

				# Act:
				calculator = factory.try_create_calculator(3333)

				# Assert:
				self.assertEqual(166666, calculator(1000000))
				self.assertEqual(200, calculator(1200))

	# endregion

	# region unwrap

	def test_can_create_calculator_for_initial_unwrap(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				_add_transfers(databases.balance_change, [
					(1111, 300, None)
				])
				databases.balance_change.set_max_processed_height(3333)

				_add_requests_wrap(databases.wrap_request, [
					(1111, 297, 3)
				])
				databases.wrap_request.set_max_processed_height(3333)
				databases.wrap_request.set_block_timestamp(1111, 10000)
				databases.wrap_request.set_block_timestamp(2222, 20000)
				databases.wrap_request.set_block_timestamp(3333, 30000)

				_add_requests_unwrap(databases.unwrap_request, [
					(800, 300, HASHES[0])
				])
				databases.unwrap_request.set_max_processed_height(800)
				databases.unwrap_request.set_block_timestamp(700, 15000)
				databases.unwrap_request.set_block_timestamp(800, 25000)

				factory = ConversionRateCalculatorFactory(databases, 'foo:bar', True)

				# Act:
				calculator = factory.try_create_calculator(800)

				# Assert:
				self.assertEqual(1000000, calculator(1000000))

	def test_can_create_calculator_for_multiple_unwraps(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				_add_transfers(databases.balance_change, [
					(1111, 300, None),
					(1111, 200, None),
					(1500, -100, HASHES[0]),
					(1500, -200, HASHES[1]),
					(2222, 100, None),
					(2222, 200, None)
				])
				databases.balance_change.set_max_processed_height(3333)

				_add_requests_wrap(databases.wrap_request, [
					(1111, 297, 3),
					(1111, 198, 2),
					(2222, 99, 1),
					(2222, 198, 2)
				])
				databases.wrap_request.set_max_processed_height(3333)
				databases.wrap_request.set_block_timestamp(1111, 9000)
				databases.wrap_request.set_block_timestamp(1500, 9500)
				databases.wrap_request.set_block_timestamp(2222, 10000)
				databases.wrap_request.set_block_timestamp(3333, 11000)

				_add_requests_unwrap(databases.unwrap_request, [
					(800, 100, HASHES[0]),
					(800, 200, HASHES[1]),
					(900, 150, HASHES[2]),
					(900, 250, HASHES[3])
				])
				databases.unwrap_request.set_max_processed_height(900)
				databases.unwrap_request.set_block_timestamp(800, 9500)
				databases.unwrap_request.set_block_timestamp(900, 10500)

				factory = ConversionRateCalculatorFactory(databases, 'foo:bar', True)

				# Act:
				calculator = factory.try_create_calculator(900)

				# Assert:
				self.assertEqual(1000000, calculator(1000000))

	def test_can_create_calculator_for_unwrap_after_donation(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				_add_transfers(databases.balance_change, [
					(1111, 200, None),
					(2222, 1000, None),
					(3333, 300, None)
				])
				databases.balance_change.set_max_processed_height(4444)

				_add_requests_wrap(databases.wrap_request, [
					(1111, 198, 2),
					(3333, 99, 1)
				])
				databases.wrap_request.set_max_processed_height(4444)
				databases.wrap_request.set_block_timestamp(1111, 8000)
				databases.wrap_request.set_block_timestamp(2222, 9000)
				databases.wrap_request.set_block_timestamp(3333, 10000)
				databases.wrap_request.set_block_timestamp(4444, 12000)

				_add_requests_unwrap(databases.unwrap_request, [
					(900, 300, HASHES[0])
				])
				databases.unwrap_request.set_max_processed_height(900)
				databases.unwrap_request.set_block_timestamp(800, 10500)
				databases.unwrap_request.set_block_timestamp(900, 11500)

				factory = ConversionRateCalculatorFactory(databases, 'foo:bar', True)

				# Act:
				calculator = factory.try_create_calculator(900)

				# Assert:
				self.assertEqual(5000000, calculator(1000000))
				self.assertEqual(1500, calculator(300))

	# endregion

	# region wrap/unwrap

	def test_can_create_calculator_for_wrap_unwrap_integration_1(self):
		def run_test_case(is_unwrap_mode, try_create_height, expected_rate):
			# Arrange:
			with tempfile.TemporaryDirectory() as temp_directory:
				with _create_databases(temp_directory) as databases:
					databases.create_tables()
					_add_transfers(databases.balance_change, [
						(2559077, 1000, None),
						(2559094, 2000, None),
						(2559141, -400, HASHES[0]),
						(2559141, -1000, HASHES[1])
					])
					databases.balance_change.set_max_processed_height(2560000)

					_add_requests_wrap(databases.wrap_request, [
						(2559077, 999, 1),  # amounts are net of fees
						(2559094, 1998, 2)
					])
					databases.wrap_request.set_max_processed_height(2560000)
					databases.wrap_request.set_block_timestamp(2559077, 1000)
					databases.wrap_request.set_block_timestamp(2559094, 1500)
					databases.wrap_request.set_block_timestamp(2559194, 3500)
					databases.wrap_request.set_block_timestamp(2560000, 10000)

					_add_requests_unwrap(databases.unwrap_request, [
						(190160, 400, HASHES[0]),
						(190160, 1000, HASHES[1]),
						(190172, 600, HASHES[2]),
						(190173, 1000, HASHES[3])
					])
					databases.unwrap_request.set_max_processed_height(190173)
					databases.unwrap_request.set_block_timestamp(190160, 2000)
					databases.unwrap_request.set_block_timestamp(190172, 3600)
					databases.unwrap_request.set_block_timestamp(190173, 4000)

					factory = ConversionRateCalculatorFactory(databases, 'foo:bar', is_unwrap_mode)

					# Act:
					calculator = factory.try_create_calculator(try_create_height)

					# Assert:
					self.assertEqual(expected_rate, calculator(1000000))

		test_case_tuples = [
			(False, 2559077, 1000000),  # 0 == native_balance
			(False, 2559094, 1000000),  # native_balance == wrapped_balance
			(True, 190160, 1000000),    # native_balance == wrapped_balance
			(True, 190172, 1000000),   # native_balance == wrapped_balance - unwrapped_balance
			(True, 190173, 1000000)    # native_balance == wrapped_balance - unwrapped_balance
		]

		for test_case_tuple in test_case_tuples:
			run_test_case(*test_case_tuple)

	def test_can_create_calculator_for_wrap_unwrap_integration_2(self):
		def run_test_case(is_unwrap_mode, try_create_height, expected_rate):
			# Arrange:
			with tempfile.TemporaryDirectory() as temp_directory:
				with _create_databases(temp_directory) as databases:
					databases.create_tables()
					_add_transfers(databases.balance_change, [
						(2564052, 100000000, None),
						(2564053, 400000000, None),
						(2564053, 300000000, None),
						(2564053, 200000000, None),
						(2564060, -1000000000, HASHES[0])
					])
					databases.balance_change.set_max_processed_height(2564061)

					_add_requests_wrap(databases.wrap_request, [
						(2564052, 99950000, 50000),  # amounts are net of fees
						(2564053, 399950000, 50000),
						(2564053, 299950000, 50000),
						(2564053, 199950000, 50000)
					])
					databases.wrap_request.set_max_processed_height(2564061)
					databases.wrap_request.set_block_timestamp(2564052, 1000)
					databases.wrap_request.set_block_timestamp(2564053, 1500)
					databases.wrap_request.set_block_timestamp(2564060, 3000)
					databases.wrap_request.set_block_timestamp(2564061, 3500)

					_add_requests_unwrap(databases.unwrap_request, [
						(192728, 1000000000, HASHES[0])
					])
					databases.unwrap_request.set_max_processed_height(193000)
					databases.unwrap_request.set_block_timestamp(192728, 1100)
					databases.unwrap_request.set_block_timestamp(193000, 4000)

					factory = ConversionRateCalculatorFactory(databases, 'foo:bar', is_unwrap_mode)

					# Act:
					calculator = factory.try_create_calculator(try_create_height)

					# Assert:
					self.assertEqual(expected_rate, calculator(1000000))

		test_case_tuples = [
			(False, 2564052, 1000000),  # 0 == native_balance
			(False, 2564053, 1000000),  # native_balance == wrapped_balance
			(False, 2564060, 1000000),  # native_balance == wrapped_balance
			(False, 2564061, 1000000),  # native_balance == wrapped_balance - unwrapped_balance
			(True, 192728, 1000000),    # native_balance == wrapped_balance
			(True, 193000, 1000000)     # native_balance == wrapped_balance - unwrapped_balance
		]

		for test_case_tuple in test_case_tuples:
			run_test_case(*test_case_tuple)

	def test_can_create_calculator_for_wrap_unwrap_integration_3(self):
		def run_test_case(is_unwrap_mode, try_create_height, expected_rate):
			# Arrange:
			with tempfile.TemporaryDirectory() as temp_directory:
				with _create_databases(temp_directory) as databases:
					databases.create_tables()
					_add_transfers(databases.balance_change, [
						(2566248, 300000000, None),
						(2566250, -300000000, HASHES[0]),
						(2566257, 200000000, None)
					])
					databases.balance_change.set_max_processed_height(2566300)

					_add_requests_wrap(databases.wrap_request, [
						(2566248, 299950000, 50000),  # amounts are net of fees
						(2566257, 199950000, 50000)
					])
					databases.wrap_request.set_max_processed_height(2566300)
					databases.wrap_request.set_block_timestamp(2566248, 1000)
					databases.wrap_request.set_block_timestamp(2566250, 1500)
					databases.wrap_request.set_block_timestamp(2566257, 3000)
					databases.wrap_request.set_block_timestamp(2566300, 3500)

					_add_requests_unwrap(databases.unwrap_request, [
						(193869, 300000000, HASHES[0]),
						(193900, 200000000, HASHES[1])
					])
					databases.unwrap_request.set_max_processed_height(193950)
					databases.unwrap_request.set_block_timestamp(193869, 1100)
					databases.unwrap_request.set_block_timestamp(193900, 3100)
					databases.unwrap_request.set_block_timestamp(193950, 4000)

					factory = ConversionRateCalculatorFactory(databases, 'foo:bar', is_unwrap_mode)

					# Act:
					calculator = factory.try_create_calculator(try_create_height)

					# Assert:
					self.assertEqual(expected_rate, calculator(1000000))

		test_case_tuples = [
			(False, 2566248, 1000000),  # 0 == native_balance
			(False, 2566250, 1000000),  # native_balance == wrapped_balance
			(False, 2566257, 1000000),  # 0 == native_balance
			(False, 2566300, 1000000),  # native_balance == wrapped_balance - unwrapped_balance
			(True, 193869, 1000000),    # native_balance == wrapped_balance
			(True, 193900, 1000000),    # native_balance == wrapped_balance - unwrapped_balance
			(True, 193950, 1000000)     # native_balance == wrapped_balance - unwrapped_balance
		]

		for test_case_tuple in test_case_tuples:
			run_test_case(*test_case_tuple)

	def test_can_create_calculator_for_wrap_unwrap_integration_donation(self):
		def run_test_case(is_unwrap_mode, try_create_height, expected_rate):
			# Arrange:
			with tempfile.TemporaryDirectory() as temp_directory:
				with _create_databases(temp_directory) as databases:
					databases.create_tables()
					_add_transfers(databases.balance_change, [
						(1111, 200, None),
						(2222, 1000, None),
						(3333, 300, None),
						(4444, -1200, HASHES[0])
					])
					databases.balance_change.set_max_processed_height(4444)

					_add_requests_wrap(databases.wrap_request, [
						(1111, 196, 4),
						(3333, 49, 1)
					])
					databases.wrap_request.set_max_processed_height(4444)
					databases.wrap_request.set_block_timestamp(1111, 8000)
					databases.wrap_request.set_block_timestamp(2222, 9000)
					databases.wrap_request.set_block_timestamp(3333, 10000)
					databases.wrap_request.set_block_timestamp(4444, 12000)

					_add_requests_unwrap(databases.unwrap_request, [
						(900, 200, HASHES[0])
					])
					databases.unwrap_request.set_max_processed_height(1000)
					databases.unwrap_request.set_block_timestamp(800, 10500)
					databases.unwrap_request.set_block_timestamp(900, 11500)
					databases.unwrap_request.set_block_timestamp(1000, 12000)

					factory = ConversionRateCalculatorFactory(databases, 'foo:bar', is_unwrap_mode)

					# Act:
					calculator = factory.try_create_calculator(try_create_height)

					# Assert:
					self.assertEqual(expected_rate, calculator(1000000))

		test_case_tuples = [
			(False, 1111, 1000000),
			(False, 2222, 1000000),
			(False, 3333, 166666),  # 200 / 1200
			(True, 900, 5999999),   # 1500 / 250
			(True, 1000, 5999999)   # 300 / 50
		]

		for test_case_tuple in test_case_tuples:
			run_test_case(*test_case_tuple)

	# endregion
