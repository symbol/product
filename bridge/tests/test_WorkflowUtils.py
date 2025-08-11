from decimal import Decimal

from bridge.WorkflowUtils import ConversionRateCalculator, calculate_search_range

# pylint: disable=invalid-name


# region calculate_search_range

class MockConnector:
	def __init__(self, chain_height, finalized_chain_height):
		self._chain_height = chain_height
		self._finalized_chain_height = finalized_chain_height

	async def chain_height(self):
		return self._chain_height

	async def finalized_chain_height(self):
		return self._finalized_chain_height


class MockDatabase:
	def __init__(self, max_processed_height):
		self._max_processed_height = max_processed_height

	def max_processed_height(self):
		return self._max_processed_height


async def _assert_calculate_search_range_returns_correct_range(expected_range, config_extensions, start_height_override_property_name):
	# Arrange:
	connector = MockConnector(2000, 1982)
	database = MockDatabase(777)

	# Act:
	search_range = await calculate_search_range(connector, database, config_extensions, start_height_override_property_name)

	# Assert:
	assert expected_range == search_range


async def test_calculate_search_range_returns_correct_range_with_no_adjustments():
	await _assert_calculate_search_range_returns_correct_range((778, 1983), {}, None)


async def test_calculate_search_range_returns_correct_range_with_start_height_adjustments():
	# Assert: calculated start height used because it is higher
	await _assert_calculate_search_range_returns_correct_range((778, 1983), {
		'start_height_override': 345
	}, 'start_height_override')

	# Assert: override start height used because it is higher
	await _assert_calculate_search_range_returns_correct_range((997, 1983), {
		'start_height_override': 997
	}, 'start_height_override')


async def test_calculate_search_range_returns_correct_range_with_end_height_adjustments():
	await _assert_calculate_search_range_returns_correct_range((778, 2033), {
		'finalization_lookahead': 50
	}, None)


async def test_calculate_search_range_returns_correct_range_with_start_height_and_end_height_adjustments():
	await _assert_calculate_search_range_returns_correct_range((997, 2033), {
		'finalization_lookahead': 50,
		'start_height_override': 997
	}, 'start_height_override')

# endregion


# region ConversionRateCalculator


def _assert_conversion_rate_calculator_unity(native_balance, wrapped_balance, unwrapped_balance):
	# Arrange:
	calculator = ConversionRateCalculator(native_balance, wrapped_balance, unwrapped_balance)

	# Assert: wrapped token is equally valuable as native token
	assert Decimal(1) == calculator.conversion_rate()
	assert 1000 == calculator.to_native_amount(1000)
	assert 1000 == calculator.to_wrapped_amount(1000)

	assert native_balance == calculator.native_balance
	assert wrapped_balance == calculator.wrapped_balance
	assert unwrapped_balance == calculator.unwrapped_balance


def test_conversion_rate_calculator_works_with_unity():
	_assert_conversion_rate_calculator_unity(10000, 12000, 2000)


def test_conversion_rate_calculator_works_with_unity_simulate_wrap():
	_assert_conversion_rate_calculator_unity(10000 + 1000, 12000 + 1000, 2000)


def test_conversion_rate_calculator_works_with_unity_simulate_unwrap():
	_assert_conversion_rate_calculator_unity(10000 - 1000, 12000, 2000 + 1000)


def _assert_conversion_rate_calculator_wrap_premium(native_balance, wrapped_balance, unwrapped_balance):
	# Arrange:
	calculator = ConversionRateCalculator(native_balance, wrapped_balance, unwrapped_balance)

	# Assert: wrapped token is more valuable than native token
	assert Decimal(5) / Decimal(6) == calculator.conversion_rate()
	assert 1200 == calculator.to_native_amount(1000)
	assert 1000 == calculator.to_wrapped_amount(1200)

	assert native_balance == calculator.native_balance
	assert wrapped_balance == calculator.wrapped_balance
	assert unwrapped_balance == calculator.unwrapped_balance


def test_conversion_rate_calculator_works_with_wrap_premium():
	_assert_conversion_rate_calculator_wrap_premium(12000, 12000, 2000)


def test_conversion_rate_calculator_works_with_wrap_premium_simulate_wrap():
	_assert_conversion_rate_calculator_wrap_premium(12000 + 1200, 12000 + 1000, 2000)


def test_conversion_rate_calculator_works_with_wrap_premium_simulate_unwrap():
	_assert_conversion_rate_calculator_wrap_premium(12000 - 1200, 12000, 2000 + 1000)


def _assert_conversion_rate_calculator_wrap_discount(native_balance, wrapped_balance, unwrapped_balance):
	# Arrange:
	calculator = ConversionRateCalculator(native_balance, wrapped_balance, unwrapped_balance)

	# Assert: wrapped token is less valuable than native token
	assert Decimal(6) / Decimal(5) == calculator.conversion_rate()
	assert 1000 == calculator.to_native_amount(1200)
	assert 1200 == calculator.to_wrapped_amount(1000)

	assert native_balance == calculator.native_balance
	assert wrapped_balance == calculator.wrapped_balance
	assert unwrapped_balance == calculator.unwrapped_balance


def test_conversion_rate_calculator_works_with_wrap_discount():
	_assert_conversion_rate_calculator_wrap_discount(10000, 14000, 2000)


def test_conversion_rate_calculator_works_with_wrap_discount_simulate_wrap():
	_assert_conversion_rate_calculator_wrap_discount(10000 + 1000, 14000 + 1200, 2000)


def test_conversion_rate_calculator_works_with_wrap_discount_simulate_unwrap():
	_assert_conversion_rate_calculator_wrap_discount(10000 - 1000, 14000, 2000 + 1200)


def test_conversion_rate_calculator_with_zero_native_balance_is_treated_as_unity():
	# Arrange:
	calculator = ConversionRateCalculator(0, 0, 0)

	# Assert: wrapped token is equally valuable as native token
	assert Decimal(1) == calculator.conversion_rate()
	assert 1000 == calculator.to_native_amount(1000)
	assert 1000 == calculator.to_wrapped_amount(1000)

	assert 1 == calculator.native_balance
	assert 1 == calculator.wrapped_balance
	assert 0 == calculator.unwrapped_balance

# endregion
