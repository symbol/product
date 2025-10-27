import datetime
from collections import namedtuple
from decimal import Decimal

from .ConversionRateCalculatorFactory import ConversionRateCalculator, ConversionRateCalculatorFactory

PrepareSendResult = namedtuple('PrepareSendResult', ['error_message', 'fee_multiplier', 'transfer_amount'])


# region calculate_search_range


async def calculate_search_range(connector, database, config_extensions, start_height_override_property_name=None):
	"""
	Calculates a search range of blocks given a connector and a database.
	Start height is inclusive but end height is exclusive.
	"""

	chain_height = await connector.finalized_chain_height()
	database_height = database.max_processed_height()
	
	start_height = max(database_height + 1, int(config_extensions.get(start_height_override_property_name, 0)))
	end_height = chain_height + 1 + int(config_extensions.get('finalization_lookahead', 0))

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


# region is_native_to_native_conversion, validate_global_configuration

def is_native_to_native_conversion(wrapped_facade):
	"""Determines if a native to native conversion is configured."""

	return not wrapped_facade.extract_mosaic_id().id


def validate_global_configuration(global_config, wrapped_facade):
	is_swap_strategy = 'swap' == global_config.mode
	if is_native_to_native_conversion(wrapped_facade):
		if not is_swap_strategy:
			raise ValueError('wrapped token is native but swap mode is not selected')
	else:
		if is_swap_strategy:
			raise ValueError('wrapped token is not native but swap mode is selected')

# endregion


# region create_conversion_rate_calculator_factory

def create_conversion_rate_calculator_factory(execution_context, databases, native_facade, wrapped_facade, fee_multiplier):
	# pylint: disable=invalid-name
	"""Creates an appropriate conversion rate calculator factory."""

	if is_native_to_native_conversion(wrapped_facade):
		if execution_context.is_unwrap_mode:
			raise ValueError('native to native conversions do not support unwrap mode')

		return NativeConversionRateCalculatorFactory(databases, fee_multiplier)

	if 'wrap' == execution_context.strategy_mode:
		return NativeConversionRateCalculatorFactory(databases, Decimal(1))  # wrapped mode (1:1) uses fixed unity multiplier (1)

	return ConversionRateCalculatorFactory(databases, native_facade.extract_mosaic_id().formatted, execution_context.is_unwrap_mode)

# endregion


# region prepare_send

def prepare_send(network, request, conversion_function, fee_multiplier):
	"""Performs basic calculations and validation prior to sending a payout transaction."""

	def make_error(error_message):
		return PrepareSendResult(error_message, None, None)

	if not fee_multiplier:
		fee_multiplier = Decimal('1')
	else:
		if fee_multiplier < Decimal('0'):
			raise ValueError('fee_multiplier must be non-negative')

		fee_multiplier *= Decimal(conversion_function(10 ** 12)) / Decimal(10 ** 12)

	transfer_amount = conversion_function(request.amount)

	max_transfer_amount = int(network.config.extensions.get('max_transfer_amount', 0))
	if max_transfer_amount and transfer_amount > max_transfer_amount:
		return make_error(f'gross transfer amount {transfer_amount} exceeds max transfer amount {max_transfer_amount}')

	return PrepareSendResult(None, fee_multiplier, transfer_amount)

# endregion


# region check_expiry

def check_expiry(config_extensions, database, request):
	"""Determines if the specified request is expired (timed out)."""

	request_lifetime_hours = int(config_extensions.get('request_lifetime_hours', 0))
	if request_lifetime_hours:
		request_timestamp = database.lookup_block_timestamp(request.transaction_height)
		request_datetime = datetime.datetime.fromtimestamp(request_timestamp, datetime.timezone.utc)
		if (datetime.datetime.now(datetime.timezone.utc) - request_datetime) > datetime.timedelta(hours=request_lifetime_hours):
			return f'request timestamp {request_datetime} is more than {request_lifetime_hours} in the past'

	return None

# endregion
