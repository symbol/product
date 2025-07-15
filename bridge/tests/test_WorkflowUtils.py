from decimal import Decimal

from bridge.models.BridgeConfiguration import NetworkConfiguration
from bridge.WorkflowUtils import ConversionRateCalculator, calculate_search_range, extract_mosaic_id

# pylint: disable=invalid-name

# region extract_mosaic_id


def test_extract_mosaic_id_can_parse_default():
	# Arrange:
	config = NetworkConfiguration(*([None] * 4), {})

	# Act:
	mosaic_id = extract_mosaic_id(config)

	# Assert:
	assert mosaic_id.id is None
	assert 'currency' == mosaic_id.formatted


def test_extract_mosaic_id_can_parse_symbol_style_mosaic_id():
	# Arrange:
	config = NetworkConfiguration(*([None] * 4), {'mosaic_id': 'id:5D6CFC64A20E86E6'})

	# Act:
	mosaic_id = extract_mosaic_id(config)

	# Assert:
	assert 0x5D6CFC64A20E86E6 == mosaic_id.id
	assert '5D6CFC64A20E86E6' == mosaic_id.formatted


def test_extract_mosaic_id_can_parse_symbol_style_mosaic_id_with_currency_predicate_true():
	# Arrange:
	config = NetworkConfiguration(*([None] * 4), {'mosaic_id': 'id:5D6CFC64A20E86E6'})

	# Act:
	mosaic_id = extract_mosaic_id(config, lambda mosaic_id: 0x5D6CFC64A20E86E6 == mosaic_id)

	# Assert:
	assert mosaic_id.id is None
	assert '5D6CFC64A20E86E6' == mosaic_id.formatted


def test_extract_mosaic_id_can_parse_symbol_style_mosaic_id_with_currency_predicate_false():
	# Arrange:
	config = NetworkConfiguration(*([None] * 4), {'mosaic_id': 'id:5D6CFC64A20E86E6'})

	# Act:
	mosaic_id = extract_mosaic_id(config, lambda mosaic_id: 0x5D6CFC64A20E86E6 != mosaic_id)

	# Assert:
	assert 0x5D6CFC64A20E86E6 == mosaic_id.id
	assert '5D6CFC64A20E86E6' == mosaic_id.formatted


def test_extract_mosaic_id_can_parse_nem_style_mosaic_id():
	# Arrange:
	config = NetworkConfiguration(*([None] * 4), {'mosaic_id': 'foo:bar'})

	# Act:
	mosaic_id = extract_mosaic_id(config)

	# Assert:
	assert ('foo', 'bar') == mosaic_id.id
	assert 'foo:bar' == mosaic_id.formatted


def test_extract_mosaic_id_can_parse_nem_style_mosaic_id_with_currency_predicate_true():
	# Arrange:
	config = NetworkConfiguration(*([None] * 4), {'mosaic_id': 'foo:bar'})

	# Act:
	mosaic_id = extract_mosaic_id(config, lambda mosaic_id: ('foo', 'bar') == mosaic_id)

	# Assert:
	assert mosaic_id.id is None
	assert 'foo:bar' == mosaic_id.formatted


def test_extract_mosaic_id_can_parse_nem_style_mosaic_id_with_currency_predicate_false():
	# Arrange:
	config = NetworkConfiguration(*([None] * 4), {'mosaic_id': 'foo:bar'})

	# Act:
	mosaic_id = extract_mosaic_id(config, lambda mosaic_id: ('foo', 'bar') != mosaic_id)

	# Assert:
	assert ('foo', 'bar') == mosaic_id.id
	assert 'foo:bar' == mosaic_id.formatted

# endregion


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


async def test_calculate_search_range_returns_correct_range_using_default_chain_height():
	# Arrange:
	connector = MockConnector(2000, 1982)
	database = MockDatabase(777)

	# Act:
	height_range = await calculate_search_range(connector, database)

	# Assert:
	assert (778, 1983) == height_range


async def test_calculate_search_range_returns_correct_range_using_finalized_chain_height():
	# Arrange:
	connector = MockConnector(2000, 1982)
	database = MockDatabase(777)

	# Act:
	height_range = await calculate_search_range(connector, database, True)

	# Assert:
	assert (778, 1983) == height_range


async def test_calculate_search_range_returns_correct_range_using_chain_height():
	# Arrange:
	connector = MockConnector(2000, 1982)
	database = MockDatabase(777)

	# Act:
	height_range = await calculate_search_range(connector, database, False)

	# Assert:
	assert (778, 2001) == height_range

# endregion


# region ConversionRateCalculator

def _assert_conversion_rate_calculator_unity(native_balance, wrapped_balance, unwrapped_balance):
	# Arrange:
	calculator = ConversionRateCalculator(native_balance, wrapped_balance, unwrapped_balance)

	# Assert: wrapped token is equally valuable as native token
	assert Decimal(1) == calculator.conversion_rate()
	assert 1000 == calculator.to_native_amount(1000)
	assert 1000 == calculator.to_wrapped_amount(1000)


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


def test_conversion_rate_calculator_works_with_wrap_discount():
	_assert_conversion_rate_calculator_wrap_discount(10000, 14000, 2000)


def test_conversion_rate_calculator_works_with_wrap_discount_simulate_wrap():
	_assert_conversion_rate_calculator_wrap_discount(10000 + 1000, 14000 + 1200, 2000)


def test_conversion_rate_calculator_works_with_wrap_discount_simulate_unwrap():
	_assert_conversion_rate_calculator_wrap_discount(10000 - 1000, 14000, 2000 + 1200)

# endregion
