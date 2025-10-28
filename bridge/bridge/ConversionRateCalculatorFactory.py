import logging
from decimal import ROUND_DOWN, Decimal


class ConversionRateCalculator:
	"""Calculates and applies a token conversion rate."""

	def __init__(self, native_balance, wrapped_balance, unwrapped_balance):
		"""Creates a conversion rate calculator."""

		if native_balance:
			self.native_balance = Decimal(native_balance)
			self.wrapped_balance = Decimal(wrapped_balance)
			self.unwrapped_balance = Decimal(unwrapped_balance)
		else:
			self.native_balance = Decimal(1)
			self.wrapped_balance = Decimal(1)
			self.unwrapped_balance = Decimal(0)

	def conversion_rate(self):
		"""Gets the conversion rate."""

		return (Decimal(self.wrapped_balance) - Decimal(self.unwrapped_balance)) / Decimal(self.native_balance)

	def to_wrapped_amount(self, amount):
		"""Calculates the number of wrapped tokens corresponding to specified number of native tokens."""

		return int((Decimal(amount) * self.conversion_rate()).quantize(1, rounding=ROUND_DOWN))

	def to_native_amount(self, amount):
		"""Calculates the number of native tokens corresponding to specified number of wrapped tokens."""

		return int((Decimal(amount) / self.conversion_rate()).quantize(1, rounding=ROUND_DOWN))

	def to_conversion_function(self, is_unwrap_mode):
		"""Returns the appropriate conversion function for the specified unwrap mode."""

		return self.to_native_amount if is_unwrap_mode else self.to_wrapped_amount


class ConversionRateCalculatorFactory:
	"""Factory for creating conversion rate calculators."""

	def __init__(self, databases, mosaic_id, is_unwrap_mode):
		"""Creates a conversion rate calculator factory."""

		self._databases = databases
		self._mosaic_id = mosaic_id
		self._is_unwrap_mode = is_unwrap_mode

		# when calculating rate at height H, timestamp T, use sums from height H-1, timestamp T-1
		# only the lookups for the network corresponding to `height` should be adjusted
		self._native_adjustment = 0 if self._is_unwrap_mode else -1

	def _lookup_native_balance(self, native_height):
		return self._databases.balance_change.balance_at(native_height + self._native_adjustment, self._mosaic_id)

	def _lookup_wrapped_balance(self, timestamp):
		adjusted_timestamp = timestamp + self._native_adjustment
		return self._databases.wrap_request.cumulative_gross_amount_at(adjusted_timestamp)

	def _lookup_unwrapped_balance(self, native_height, timestamp):
		transaction_hashes = list(self._databases.unwrap_request.payout_transaction_hashes_at(timestamp))
		filtered_transaction_hashes = list(self._databases.balance_change.filter_transactions_if_present(
			native_height + self._native_adjustment,
			self._mosaic_id,
			transaction_hashes))
		amount = self._databases.unwrap_request.sum_payout_transaction_amounts(filtered_transaction_hashes)
		return amount

	def _try_create_calculator(self, height):
		native_height = height
		if self._is_unwrap_mode:
			# height is from wrapped blockchain: (1) get wrapped block timestamp, (2) find last native block prior to timestamp
			timestamp = self._databases.unwrap_request.lookup_block_timestamp(height)
			native_height = self._databases.wrap_request.lookup_block_height(timestamp)

		# use the timestamp of the native block in calculations
		timestamp = self._databases.wrap_request.lookup_block_timestamp(native_height)
		if not timestamp:
			return None

		required_conditions = [
			self._databases.balance_change.is_synced_at_height(native_height),
			self._databases.wrap_request.is_synced_at_timestamp(timestamp),
			self._databases.unwrap_request.is_synced_at_timestamp(timestamp)
		]
		if not all(required_conditions):
			return None

		native_balance = self._lookup_native_balance(native_height)
		wrapped_balance = self._lookup_wrapped_balance(timestamp)
		unwrapped_balance = self._lookup_unwrapped_balance(native_height, timestamp)

		return ConversionRateCalculator(native_balance, wrapped_balance, unwrapped_balance)

	def try_create_calculator(self, height):
		"""Tries to create a conversion rate calculator at a specified height."""

		calculator = self._try_create_calculator(height)
		if not calculator:
			return None

		logger = logging.getLogger(__name__)
		logger.debug(''.join([
			f'height {height}:',
			f' native_balance {calculator.native_balance},',
			f' wrapped_balance {calculator.wrapped_balance},',
			f' unwrapped_balance {calculator.unwrapped_balance}'
		]))

		return calculator

	def create_best_calculator(self):
		"""Creates a conversion rate calculator based on latest information."""

		if self._is_unwrap_mode:
			max_processed_height = self._databases.unwrap_request.max_processed_height()
		else:
			max_processed_height = self._databases.wrap_request.max_processed_height()

		while max_processed_height:
			calculator = self._try_create_calculator(max_processed_height)
			if calculator:
				calculator.height = max_processed_height  # pylint: disable=attribute-defined-outside-init
				return calculator

			max_processed_height -= 1

		calculator = ConversionRateCalculator(0, 0, 0)
		calculator.height = 0  # pylint: disable=attribute-defined-outside-init
		return calculator
