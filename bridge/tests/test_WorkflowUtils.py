import tempfile
from decimal import Decimal

import pytest
from symbolchain.nem.Network import Network

from bridge.ConversionRateCalculatorFactory import ConversionRateCalculatorFactory
from bridge.db.Databases import Databases
from bridge.models.Constants import PrintableMosaicId
from bridge.WorkflowUtils import (
	NativeConversionRateCalculatorFactory,
	calculate_search_range,
	create_conversion_rate_calculator_factory,
	is_native_to_native_conversion
)

from .test.MockNetworkFacade import MockNemNetworkFacade

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


# region NativeConversionRateCalculatorFactory

def _create_databases(database_directory):
	# only wrap_request database is used or checked, so facades can be the same without any loss of generality
	return Databases(database_directory, MockNemNetworkFacade(), MockNemNetworkFacade())


def test_cannot_create_native_calculator_when_max_processed_height_is_less_than_target_height():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		with _create_databases(temp_directory) as databases:
			databases.create_tables()
			databases.wrap_request.set_max_processed_height(1002)

			factory = NativeConversionRateCalculatorFactory(databases, Decimal('2.5'))

			# Act + Assert:
			assert factory.try_create_calculator(1003) is None
			assert factory.try_create_calculator(2000) is None


def _assert_can_create_native_calculator_at_height(height):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		with _create_databases(temp_directory) as databases:
			databases.create_tables()
			databases.wrap_request.set_max_processed_height(1002)

			factory = NativeConversionRateCalculatorFactory(databases, Decimal('2.5'))

			# Act:
			calculator = factory.try_create_calculator(height)

			# Assert:
			assert 400000 == calculator(1000000)


def test_can_create_native_calculator_when_max_processed_height_is_at_least_target_height():
	_assert_can_create_native_calculator_at_height(1)
	_assert_can_create_native_calculator_at_height(1001)
	_assert_can_create_native_calculator_at_height(1002)

# endregion


# region is_native_to_native_conversion, create_conversion_rate_calculator_factory

class MockNetworkFacade:
	def __init__(self, mosaic_id):
		self._mosaic_id = mosaic_id

		self.network = Network.TESTNET

	def extract_mosaic_id(self):
		return PrintableMosaicId(self._mosaic_id, self._mosaic_id)


def test_is_native_to_native_conversion_when_network_facade_uses_currency_mosaic():
	assert is_native_to_native_conversion(MockNetworkFacade(''))


def test_is_not_native_to_native_conversion_when_network_facade_does_not_use_currency_mosaic():
	assert not is_native_to_native_conversion(MockNetworkFacade('alpha'))


def _set_max_processed_height(databases, height):
	databases.balance_change.set_max_processed_height(height)

	databases.wrap_request.set_max_processed_height(height)
	databases.wrap_request.set_block_timestamp(height, 2222)

	databases.unwrap_request.set_max_processed_height(height)
	databases.unwrap_request.set_block_timestamp(height, 2222)


def _assert_can_create_default_calculator_factory_when_wrapped_facade_does_not_use_currency_mosaic(is_unwrap_mode):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		with _create_databases(temp_directory) as databases:
			databases.create_tables()
			_set_max_processed_height(databases, 1000)

			# Act:
			factory = create_conversion_rate_calculator_factory(
				is_unwrap_mode,
				databases,
				MockNetworkFacade('alpha'),
				MockNetworkFacade('beta'),
				Decimal('2.5'))

			# Assert:
			assert isinstance(factory, ConversionRateCalculatorFactory)
			assert 'alpha' == factory._mosaic_id  # pylint: disable=protected-access
			assert is_unwrap_mode == factory._is_unwrap_mode  # pylint: disable=protected-access

			assert 1000000 == factory.try_create_calculator(1000)(1000000)


def test_can_create_default_calculator_factory_when_wrapped_facade_does_not_use_currency_mosaic_wrap_mode():
	_assert_can_create_default_calculator_factory_when_wrapped_facade_does_not_use_currency_mosaic(False)


def test_can_create_default_calculator_factory_when_wrapped_facade_does_not_use_currency_mosaic_unwrap_mode():
	_assert_can_create_default_calculator_factory_when_wrapped_facade_does_not_use_currency_mosaic(True)


def test_can_create_native_calculator_factory_when_wrapped_facade_uses_currency_mosaic():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		with _create_databases(temp_directory) as databases:
			databases.create_tables()
			_set_max_processed_height(databases, 1000)

			# Act:
			factory = create_conversion_rate_calculator_factory(
				False,
				databases,
				MockNetworkFacade('alpha'),
				MockNetworkFacade(''),
				Decimal('2.5'))

			# Assert:
			assert isinstance(factory, NativeConversionRateCalculatorFactory)
			assert Decimal('2.5') == factory._fee_multiplier  # pylint: disable=protected-access

			assert 400000 == factory.try_create_calculator(1000)(1000000)


def test_cannot_create_native_calculator_factory_when_wrapped_facade_uses_currency_mosaic_unwrap_mode():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		with _create_databases(temp_directory) as databases:
			databases.create_tables()

			# Act + Assert:
			with pytest.raises(ValueError, match='native to native conversions do not support unwrap mode'):
				create_conversion_rate_calculator_factory(
					True,
					databases,
					MockNetworkFacade('alpha'),
					MockNetworkFacade(''),
					Decimal('2.5'))

# endregion
