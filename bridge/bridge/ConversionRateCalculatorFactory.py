from .WorkflowUtils import ConversionRateCalculator


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
		self._wrapped_adjustment = -1 if self._is_unwrap_mode else 0

	def _lookup_native_balance(self, native_height):
		return self._databases.balance_change.balance_at(native_height + self._native_adjustment, self._mosaic_id)

	def _lookup_wrapped_balance(self, timestamp):
		adjusted_timestamp = timestamp + self._native_adjustment
		return sum((
			self._databases.wrap_request.cumulative_net_amount_at(adjusted_timestamp),
			self._databases.wrap_request.cumulative_fees_paid_at(adjusted_timestamp)
		))

	def _lookup_unwrapped_balance(self, native_height, timestamp):
		transaction_hashes = list(self._databases.unwrap_request.payout_transaction_hashes_at(timestamp + self._wrapped_adjustment))
		filtered_transaction_hashes = list(self._databases.balance_change.filter_transactions_if_present(
			native_height + self._native_adjustment,
			self._mosaic_id,
			transaction_hashes))
		amount = self._databases.unwrap_request.sum_payout_transaction_amounts(filtered_transaction_hashes)
		return amount

	def try_create_calculator(self, height):
		"""Tries to create a conversion rate calculator at a specified height."""

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

		print(f'height {height}: native_balance {native_balance}, wrapped_balance {wrapped_balance}, unwrapped_balance {unwrapped_balance}')

		calculator = ConversionRateCalculator(native_balance, wrapped_balance, unwrapped_balance)
		return calculator.to_native_amount if self._is_unwrap_mode else calculator.to_wrapped_amount
