import tempfile
import unittest
from decimal import Decimal

from bridge.ConversionRateCalculatorFactory import ConversionRateCalculator, ConversionRateCalculatorFactory
from bridge.db.Databases import Databases

from .test.BridgeTestUtils import HASHES
from .test.DatabaseTestUtils import add_requests_unwrap, add_requests_wrap, add_transfers
from .test.MockNetworkFacade import MockNemNetworkFacade


def _create_databases(database_directory):
	# use same native and wrapped networks to make tests eaiser to follow
	# with same network, network timestamps can be used directly without needing to be normalized to different network epohchs
	return Databases(database_directory, MockNemNetworkFacade(), MockNemNetworkFacade())


class ConversionRateCalculatorFactoryTest(unittest.TestCase):  # pylint: disable=too-many-public-methods
	@staticmethod
	def _calculate(calculator, amount, is_unwrap_mode):
		calculator_func = calculator.to_conversion_function(is_unwrap_mode)
		return calculator_func(amount)

	# region ConversionRateCalculator

	def _assert_conversion_rate_calculator_unity(self, native_balance, wrapped_balance, unwrapped_balance):
		# Arrange:
		calculator = ConversionRateCalculator(native_balance, wrapped_balance, unwrapped_balance)

		# Assert: wrapped token is equally valuable as native token
		self.assertEqual(Decimal(1), calculator.conversion_rate())
		self.assertEqual(1000, calculator.to_native_amount(1000))
		self.assertEqual(1000, calculator.to_wrapped_amount(1000))

		self.assertEqual(1000, calculator.to_conversion_function(True)(1000))
		self.assertEqual(1000, calculator.to_conversion_function(False)(1000))

		self.assertEqual(native_balance, calculator.native_balance)
		self.assertEqual(wrapped_balance, calculator.wrapped_balance)
		self.assertEqual(unwrapped_balance, calculator.unwrapped_balance)

	def test_conversion_rate_calculator_works_with_unity(self):
		self._assert_conversion_rate_calculator_unity(10000, 12000, 2000)

	def test_conversion_rate_calculator_works_with_unity_simulate_wrap(self):
		self._assert_conversion_rate_calculator_unity(10000 + 1000, 12000 + 1000, 2000)

	def test_conversion_rate_calculator_works_with_unity_simulate_unwrap(self):
		self._assert_conversion_rate_calculator_unity(10000 - 1000, 12000, 2000 + 1000)

	def _assert_conversion_rate_calculator_wrap_premium(self, native_balance, wrapped_balance, unwrapped_balance):
		# Arrange:
		calculator = ConversionRateCalculator(native_balance, wrapped_balance, unwrapped_balance)

		# Assert: wrapped token is more valuable than native token
		self.assertEqual(Decimal(5) / Decimal(6), calculator.conversion_rate())
		self.assertEqual(1200, calculator.to_native_amount(1000))
		self.assertEqual(1000, calculator.to_wrapped_amount(1200))

		self.assertEqual(1200, calculator.to_conversion_function(True)(1000))
		self.assertEqual(1000, calculator.to_conversion_function(False)(1200))

		self.assertEqual(native_balance, calculator.native_balance)
		self.assertEqual(wrapped_balance, calculator.wrapped_balance)
		self.assertEqual(unwrapped_balance, calculator.unwrapped_balance)

	def test_conversion_rate_calculator_works_with_wrap_premium(self):
		self._assert_conversion_rate_calculator_wrap_premium(12000, 12000, 2000)

	def test_conversion_rate_calculator_works_with_wrap_premium_simulate_wrap(self):
		self._assert_conversion_rate_calculator_wrap_premium(12000 + 1200, 12000 + 1000, 2000)

	def test_conversion_rate_calculator_works_with_wrap_premium_simulate_unwrap(self):
		self._assert_conversion_rate_calculator_wrap_premium(12000 - 1200, 12000, 2000 + 1000)

	def _assert_conversion_rate_calculator_wrap_discount(self, native_balance, wrapped_balance, unwrapped_balance):
		# Arrange:
		calculator = ConversionRateCalculator(native_balance, wrapped_balance, unwrapped_balance)

		# Assert: wrapped token is less valuable than native token
		self.assertEqual(Decimal(6) / Decimal(5), calculator.conversion_rate())
		self.assertEqual(1000, calculator.to_native_amount(1200))
		self.assertEqual(1200, calculator.to_wrapped_amount(1000))

		self.assertEqual(1000, calculator.to_conversion_function(True)(1200))
		self.assertEqual(1200, calculator.to_conversion_function(False)(1000))

		self.assertEqual(native_balance, calculator.native_balance)
		self.assertEqual(wrapped_balance, calculator.wrapped_balance)
		self.assertEqual(unwrapped_balance, calculator.unwrapped_balance)

	def test_conversion_rate_calculator_works_with_wrap_discount(self):
		self._assert_conversion_rate_calculator_wrap_discount(10000, 14000, 2000)

	def test_conversion_rate_calculator_works_with_wrap_discount_simulate_wrap(self):
		self._assert_conversion_rate_calculator_wrap_discount(10000 + 1000, 14000 + 1200, 2000)

	def test_conversion_rate_calculator_works_with_wrap_discount_simulate_unwrap(self):
		self._assert_conversion_rate_calculator_wrap_discount(10000 - 1000, 14000, 2000 + 1200)

	def test_conversion_rate_calculator_with_zero_native_balance_is_treated_as_unity(self):
		# Arrange:
		calculator = ConversionRateCalculator(0, 0, 0)

		# Assert: wrapped token is equally valuable as native token
		self.assertEqual(Decimal(1), calculator.conversion_rate())
		self.assertEqual(1000, calculator.to_native_amount(1000))
		self.assertEqual(1000, calculator.to_wrapped_amount(1000))

		self.assertEqual(1000, calculator.to_conversion_function(True)(1000))
		self.assertEqual(1000, calculator.to_conversion_function(False)(1000))

		self.assertEqual(1, calculator.native_balance)
		self.assertEqual(1, calculator.wrapped_balance)
		self.assertEqual(0, calculator.unwrapped_balance)

	# endregion

	# region try_create_calculator - empty

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

	# region try_create_calculator - preconditions not met

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

	# region try_create_calculator - wrap

	def test_can_create_calculator_for_initial_wrap(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				add_transfers(databases.balance_change, [
					(1111, 300, None)
				])
				databases.balance_change.set_max_processed_height(1111)

				add_requests_wrap(databases.wrap_request, [
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
				self.assertEqual(1000000, self._calculate(calculator, 1000000, False))

				self.assertEqual(1, calculator.native_balance)
				self.assertEqual(1, calculator.wrapped_balance)
				self.assertEqual(0, calculator.unwrapped_balance)

	def test_can_create_calculator_for_multiple_wraps(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				add_transfers(databases.balance_change, [
					(1111, 300, None),
					(1111, 200, None),
					(2222, 100, None),
					(2222, 200, None)
				])
				databases.balance_change.set_max_processed_height(2222)

				add_requests_wrap(databases.wrap_request, [
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
				self.assertEqual(1000000, self._calculate(calculator, 1000000, False))

				self.assertEqual(500, calculator.native_balance)
				self.assertEqual(500, calculator.wrapped_balance)
				self.assertEqual(0, calculator.unwrapped_balance)

	def test_can_create_calculator_for_wrap_after_donation(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				add_transfers(databases.balance_change, [
					(1111, 200, None),
					(2222, 1000, None),
					(3333, 300, None)
				])
				databases.balance_change.set_max_processed_height(3333)

				add_requests_wrap(databases.wrap_request, [
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
				self.assertEqual(166666, self._calculate(calculator, 1000000, False))
				self.assertEqual(200, self._calculate(calculator, 1200, False))

				self.assertEqual(1200, calculator.native_balance)
				self.assertEqual(200, calculator.wrapped_balance)
				self.assertEqual(0, calculator.unwrapped_balance)

	# endregion

	# region try_create_calculator - unwrap

	def test_can_create_calculator_for_initial_unwrap(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				add_transfers(databases.balance_change, [
					(1111, 300, None)
				])
				databases.balance_change.set_max_processed_height(3333)

				add_requests_wrap(databases.wrap_request, [
					(1111, 297, 3)
				])
				databases.wrap_request.set_max_processed_height(3333)
				databases.wrap_request.set_block_timestamp(1111, 10000)
				databases.wrap_request.set_block_timestamp(2222, 20000)
				databases.wrap_request.set_block_timestamp(3333, 30000)

				add_requests_unwrap(databases.unwrap_request, [
					(800, 300, HASHES[0])
				])
				databases.unwrap_request.set_max_processed_height(800)
				databases.unwrap_request.set_block_timestamp(700, 15000)
				databases.unwrap_request.set_block_timestamp(800, 25000)

				factory = ConversionRateCalculatorFactory(databases, 'foo:bar', True)

				# Act:
				calculator = factory.try_create_calculator(800)

				# Assert:
				self.assertEqual(1000000, self._calculate(calculator, 1000000, True))

				self.assertEqual(300, calculator.native_balance)
				self.assertEqual(300, calculator.wrapped_balance)
				self.assertEqual(0, calculator.unwrapped_balance)

	def test_can_create_calculator_for_multiple_unwraps(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				add_transfers(databases.balance_change, [
					(1111, 300, None),
					(1111, 200, None),
					(1500, -100, HASHES[0]),
					(1500, -200, HASHES[1]),
					(2222, 100, None),
					(2222, 200, None)
				])
				databases.balance_change.set_max_processed_height(3333)

				add_requests_wrap(databases.wrap_request, [
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

				add_requests_unwrap(databases.unwrap_request, [
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
				self.assertEqual(1000000, self._calculate(calculator, 1000000, True))

				self.assertEqual(500, calculator.native_balance)
				self.assertEqual(800, calculator.wrapped_balance)
				self.assertEqual(300, calculator.unwrapped_balance)

	def test_can_create_calculator_for_unwrap_after_donation(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				add_transfers(databases.balance_change, [
					(1111, 200, None),
					(2222, 1000, None),
					(3333, 300, None)
				])
				databases.balance_change.set_max_processed_height(4444)

				add_requests_wrap(databases.wrap_request, [
					(1111, 198, 2),
					(3333, 99, 1)
				])
				databases.wrap_request.set_max_processed_height(4444)
				databases.wrap_request.set_block_timestamp(1111, 8000)
				databases.wrap_request.set_block_timestamp(2222, 9000)
				databases.wrap_request.set_block_timestamp(3333, 10000)
				databases.wrap_request.set_block_timestamp(4444, 12000)

				add_requests_unwrap(databases.unwrap_request, [
					(900, 300, HASHES[0])
				])
				databases.unwrap_request.set_max_processed_height(900)
				databases.unwrap_request.set_block_timestamp(800, 10500)
				databases.unwrap_request.set_block_timestamp(900, 11500)

				factory = ConversionRateCalculatorFactory(databases, 'foo:bar', True)

				# Act:
				calculator = factory.try_create_calculator(900)

				# Assert:
				self.assertEqual(5000000, self._calculate(calculator, 1000000, True))
				self.assertEqual(1500, self._calculate(calculator, 300, True))

				self.assertEqual(1500, calculator.native_balance)
				self.assertEqual(300, calculator.wrapped_balance)
				self.assertEqual(0, calculator.unwrapped_balance)

	# endregion

	# region create_best_calculator - empty

	def _assert_can_create_best_calculator_when_databases_are_empty(self, is_unwrap_mode):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				factory = ConversionRateCalculatorFactory(databases, 'foo:bar', is_unwrap_mode)

				# Act:
				calculator = factory.create_best_calculator()

				# Assert:
				self.assertEqual(1000000, self._calculate(calculator, 1000000, is_unwrap_mode))

				self.assertEqual(0, calculator.height)
				self.assertEqual(1, calculator.native_balance)
				self.assertEqual(1, calculator.wrapped_balance)
				self.assertEqual(0, calculator.unwrapped_balance)

	def test_can_create_best_calculator_when_databases_are_empty_wrap_mode(self):
		self._assert_can_create_best_calculator_when_databases_are_empty(False)

	def test_can_create_best_calculator_when_databases_are_empty_unwrap_mode(self):
		self._assert_can_create_best_calculator_when_databases_are_empty(True)

	# endregion

	# region create_best_calculator - not empty

	def test_can_create_best_calculator_when_wrap_request_is_ahead_wrap_mode(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				add_transfers(databases.balance_change, [
					(1111, 200, None),
					(2222, 1000, None),  # donation
					(3333, 50, None),
					(4444, 400, None),  # donation
				])
				databases.balance_change.set_max_processed_height(3333)

				add_requests_wrap(databases.wrap_request, [
					(1111, 198, 2),
					(3333, 297, 3)
				])
				databases.wrap_request.set_max_processed_height(4444)
				databases.wrap_request.set_block_timestamp(1111, 8000)
				databases.wrap_request.set_block_timestamp(2222, 9000)
				databases.wrap_request.set_block_timestamp(3333, 10000)
				databases.wrap_request.set_block_timestamp(4444, 11000)

				databases.unwrap_request.set_max_processed_height(700)
				databases.unwrap_request.set_block_timestamp(700, 10000)

				factory = ConversionRateCalculatorFactory(databases, 'foo:bar', False)

				# Act:
				calculator = factory.create_best_calculator()

				# Assert: wrap_request is at height 4444 but lcd height is 3333
				self.assertEqual(166666, self._calculate(calculator, 1000000, False))

				self.assertEqual(3333, calculator.height)
				self.assertEqual(1200, calculator.native_balance)  # 200 + 1000
				self.assertEqual(200, calculator.wrapped_balance)  # 200
				self.assertEqual(0, calculator.unwrapped_balance)

				# Sanity:
				self.assertIsNone(factory.try_create_calculator(4444))
				self.assertIsNotNone(factory.try_create_calculator(3333))

	def test_can_create_best_calculator_when_wrap_request_is_ahead_unwrap_mode(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with _create_databases(temp_directory) as databases:
				databases.create_tables()
				add_transfers(databases.balance_change, [
					(1111, 200, None),
					(2222, 1000, None),  # donation
					(3333, 300, None),
					(3500, -600, HASHES[0]),
					(3500, -300, HASHES[1]),
					(4000, -60, HASHES[2]),
					(4444, 400, None),  # donation
				])
				databases.balance_change.set_max_processed_height(4000)

				add_requests_wrap(databases.wrap_request, [
					(1111, 198, 2),
					(3333, 49, 1)
				])
				databases.wrap_request.set_max_processed_height(4444)
				databases.wrap_request.set_block_timestamp(1111, 8000)
				databases.wrap_request.set_block_timestamp(2222, 9000)
				databases.wrap_request.set_block_timestamp(3333, 10000)
				databases.wrap_request.set_block_timestamp(3500, 10200)
				databases.wrap_request.set_block_timestamp(4000, 10800)
				databases.wrap_request.set_block_timestamp(4444, 11000)

				add_requests_unwrap(databases.unwrap_request, [
					(700, 100, HASHES[0]),
					(750, 50, HASHES[1]),
					(800, 10, HASHES[2])
				])
				databases.unwrap_request.set_max_processed_height(800)
				databases.unwrap_request.set_block_timestamp(700, 10100)
				databases.unwrap_request.set_block_timestamp(750, 10150)
				databases.unwrap_request.set_block_timestamp(770, 10400)
				databases.unwrap_request.set_block_timestamp(800, 11000)

				factory = ConversionRateCalculatorFactory(databases, 'foo:bar', True)

				# Act:
				calculator = factory.create_best_calculator()

				# Assert: unwrap_request is at height 800 but lcd height is 770
				self.assertEqual(5999999, self._calculate(calculator, 1000000, True))

				self.assertEqual(770, calculator.height)
				self.assertEqual(600, calculator.native_balance)  # 200 + 1000 + 300 - 600 - 300
				self.assertEqual(250, calculator.wrapped_balance)  # 200 + 50
				self.assertEqual(150, calculator.unwrapped_balance)  # 100 + 50

				# Sanity:
				self.assertIsNone(factory.try_create_calculator(800))
				self.assertIsNotNone(factory.try_create_calculator(770))

	# endregion

	# region integration - wrap/unwrap

	def test_can_create_calculator_for_wrap_unwrap_integration_1(self):
		def run_test_case(is_unwrap_mode, try_create_height, expected_rate):
			# Arrange:
			with tempfile.TemporaryDirectory() as temp_directory:
				with _create_databases(temp_directory) as databases:
					databases.create_tables()
					add_transfers(databases.balance_change, [
						(2559077, 1000, None),
						(2559094, 2000, None),
						(2559141, -400, HASHES[0]),
						(2559141, -1000, HASHES[1])
					])
					databases.balance_change.set_max_processed_height(2560000)

					add_requests_wrap(databases.wrap_request, [
						(2559077, 999, 1),  # amounts are net of fees
						(2559094, 1998, 2)
					])
					databases.wrap_request.set_max_processed_height(2560000)
					databases.wrap_request.set_block_timestamp(2559077, 1000)
					databases.wrap_request.set_block_timestamp(2559094, 1500)
					databases.wrap_request.set_block_timestamp(2559194, 3500)
					databases.wrap_request.set_block_timestamp(2560000, 10000)

					add_requests_unwrap(databases.unwrap_request, [
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
					self.assertEqual(expected_rate, self._calculate(calculator, 1000000, is_unwrap_mode))

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
					add_transfers(databases.balance_change, [
						(2564052, 100000000, None),
						(2564053, 400000000, None),
						(2564053, 300000000, None),
						(2564053, 200000000, None),
						(2564060, -1000000000, HASHES[0])
					])
					databases.balance_change.set_max_processed_height(2564061)

					add_requests_wrap(databases.wrap_request, [
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

					add_requests_unwrap(databases.unwrap_request, [
						(192728, 1000000000, HASHES[0])
					])
					databases.unwrap_request.set_max_processed_height(193000)
					databases.unwrap_request.set_block_timestamp(192728, 1100)
					databases.unwrap_request.set_block_timestamp(193000, 4000)

					factory = ConversionRateCalculatorFactory(databases, 'foo:bar', is_unwrap_mode)

					# Act:
					calculator = factory.try_create_calculator(try_create_height)

					# Assert:
					self.assertEqual(expected_rate, self._calculate(calculator, 1000000, is_unwrap_mode))

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
					add_transfers(databases.balance_change, [
						(2566248, 300000000, None),
						(2566250, -300000000, HASHES[0]),
						(2566257, 200000000, None)
					])
					databases.balance_change.set_max_processed_height(2566300)

					add_requests_wrap(databases.wrap_request, [
						(2566248, 299950000, 50000),  # amounts are net of fees
						(2566257, 199950000, 50000)
					])
					databases.wrap_request.set_max_processed_height(2566300)
					databases.wrap_request.set_block_timestamp(2566248, 1000)
					databases.wrap_request.set_block_timestamp(2566250, 1500)
					databases.wrap_request.set_block_timestamp(2566257, 3000)
					databases.wrap_request.set_block_timestamp(2566300, 3500)

					add_requests_unwrap(databases.unwrap_request, [
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
					self.assertEqual(expected_rate, self._calculate(calculator, 1000000, is_unwrap_mode))

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
					add_transfers(databases.balance_change, [
						(1111, 200, None),
						(2222, 1000, None),
						(3333, 300, None),
						(4444, -1200, HASHES[0])
					])
					databases.balance_change.set_max_processed_height(4444)

					add_requests_wrap(databases.wrap_request, [
						(1111, 196, 4),
						(3333, 49, 1)
					])
					databases.wrap_request.set_max_processed_height(4444)
					databases.wrap_request.set_block_timestamp(1111, 8000)
					databases.wrap_request.set_block_timestamp(2222, 9000)
					databases.wrap_request.set_block_timestamp(3333, 10000)
					databases.wrap_request.set_block_timestamp(4444, 12000)

					add_requests_unwrap(databases.unwrap_request, [
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
					self.assertEqual(expected_rate, self._calculate(calculator, 1000000, is_unwrap_mode))

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
