from decimal import Decimal

from .ConversionRateCalculatorFactory import ConversionRateCalculator, ConversionRateCalculatorFactory

# region calculate_search_range


async def calculate_search_range(connector, database, config_extensions, start_height_override_property_name=None):
	"""
	Calculates a search range of blocks given a connector and a database.
	Start height is inclusive but end height is exclusive.
	"""

	chain_height = await connector.finalized_chain_height()
	end_height = chain_height + 1 + int(config_extensions.get('finalization_lookahead', 0))

	database_height = database.max_processed_height()
	start_height = database_height + 1

	if start_height_override_property_name:
		start_height = max(start_height, int(config_extensions.get(start_height_override_property_name, 0)))

	return (start_height, end_height)

# endregion


# region NativeConversionRateCalculatorFactory

class NativeConversionRateCalculatorFactory:
	"""Factory for creating native to native conversion rate calculators."""

	def __init__(self, databases, fee_multiplier):
		"""Creates a conversion rate calculator factory."""

		self._databases = databases
		self._fee_multiplier = fee_multiplier

	def _try_create_calculator(self, height):
		if height > self._databases.wrap_request.max_processed_height():
			return None

		return ConversionRateCalculator(self._fee_multiplier, Decimal(1), 0)

	def try_create_calculator(self, height):
		"""Tries to create a conversion rate calculator at a specified height."""

		calculator = self._try_create_calculator(height)
		if not calculator:
			return None

		return calculator

	def create_best_calculator(self):
		"""Creates a conversion rate calculator based on latest information."""

		height = self._databases.wrap_request.max_processed_height()
		calculator = self._try_create_calculator(height)
		calculator.height = height
		return calculator

# endregion


# region is_native_to_native_conversion, validate_strategy_configuration

def is_native_to_native_conversion(wrapped_facade):
	"""Determines if a native to native conversion is configured."""

	return not wrapped_facade.extract_mosaic_id().id


def validate_strategy_configuration(strategy_config, wrapped_facade):
	is_native_strategy = 'native' == strategy_config.mode
	if is_native_to_native_conversion(wrapped_facade):
		if not is_native_strategy:
			raise ValueError('wrapped token is native but native mode is not selected')
	else:
		if is_native_strategy:
			raise ValueError('wrapped token is not native but native mode is selected')

# endregion


# region create_conversion_rate_calculator_factory

def create_conversion_rate_calculator_factory(execution_context, databases, native_facade, wrapped_facade, fee_multiplier):
	# pylint: disable=invalid-name
	"""Creates an appropriate conversion rate calculator factory."""

	if is_native_to_native_conversion(wrapped_facade):
		if execution_context.is_unwrap_mode:
			raise ValueError('native to native conversions do not support unwrap mode')

		return NativeConversionRateCalculatorFactory(databases, fee_multiplier)

	if 'wrapped' == execution_context.strategy_mode:
		return NativeConversionRateCalculatorFactory(databases, Decimal(1))  # wrapped mode (1:1) uses fixed unity multiplier (1)

	return ConversionRateCalculatorFactory(databases, native_facade.extract_mosaic_id().formatted, execution_context.is_unwrap_mode)

# endregion
