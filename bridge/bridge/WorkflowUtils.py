from decimal import ROUND_DOWN, Decimal


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


class ConversionRateCalculator:
	"""Calculates and applies a token conversion rate."""

	def __init__(self, native_balance, wrapped_balance, unwrapped_balance):
		"""Creates a conversion rate calculator."""

		if native_balance:
			self._native_balance = Decimal(native_balance)
			self._wrapped_balance = Decimal(wrapped_balance)
			self._unwrapped_balance = Decimal(unwrapped_balance)
		else:
			self._native_balance = 1
			self._wrapped_balance = 1
			self._unwrapped_balance = 0

	def conversion_rate(self):
		"""Gets the conversion rate."""

		return (Decimal(self._wrapped_balance) - Decimal(self._unwrapped_balance)) / Decimal(self._native_balance)

	def to_wrapped_amount(self, amount):
		"""Calculates the number of wrapped tokens corresponding to specified number of native tokens."""

		return int((Decimal(amount) * self.conversion_rate()).quantize(1, rounding=ROUND_DOWN))

	def to_native_amount(self, amount):
		"""Calculates the number of native tokens corresponding to specified number of wrapped tokens."""

		return int((Decimal(amount) / self.conversion_rate()).quantize(1, rounding=ROUND_DOWN))
