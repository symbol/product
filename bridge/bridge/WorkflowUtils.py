from collections import namedtuple
from decimal import ROUND_DOWN, Decimal

PrintableMosaicId = namedtuple('PrintableMosaicId', ['args', 'formatted'])


def extract_mosaic_id(config, is_currency_mosaic_id=None):
	"""
	Extracts the wrapped mosaic id from config and converts it into both a printable version
	and a version that can be passed to network facades as arguments.
	"""

	mosaic_id = config.extensions.get('mosaic_id', None)
	if not mosaic_id:
		return PrintableMosaicId((), 'currency')

	mosaic_id_parts = tuple(mosaic_id.split(':'))
	if 'id' == mosaic_id_parts[0]:
		mosaic_id_args = (int(mosaic_id_parts[1], 16),)
		if is_currency_mosaic_id and is_currency_mosaic_id(mosaic_id_args[0]):
			mosaic_id_args = ()

		return PrintableMosaicId(mosaic_id_args, mosaic_id_parts[1])

	if is_currency_mosaic_id and is_currency_mosaic_id(mosaic_id_parts):
		mosaic_id_parts = ()

	return PrintableMosaicId(mosaic_id_parts, mosaic_id)


async def calculate_search_range(connector, database, use_finalized_chain_height=True):
	"""
	Calculates a search range of blocks given a connector and a database.
	Start height is inclusive but end height is exclusive.
	"""

	chain_height = await (connector.finalized_chain_height if use_finalized_chain_height else connector.chain_height)()
	end_height = chain_height + 1

	database_height = database.max_processed_height()
	start_height = database_height + 1

	return (start_height, end_height)


class ConversionRateCalculator:
	"""Calculates and applies a token conversion rate."""

	def __init__(self, native_balance, wrapped_balance, unwrapped_balance):
		"""Creates a conversion rate calculator."""

		self._native_balance = Decimal(native_balance)
		self._wrapped_balance = Decimal(wrapped_balance)
		self._unwrapped_balance = Decimal(unwrapped_balance)

	def conversion_rate(self):
		"""Gets the conversion rate."""

		return (Decimal(self._wrapped_balance) - Decimal(self._unwrapped_balance)) / Decimal(self._native_balance)

	def to_wrapped_amount(self, amount):
		"""Calculates the number of wrapped tokens corresponding to specified number of native tokens."""

		return int((Decimal(amount) * self.conversion_rate()).quantize(1, rounding=ROUND_DOWN))

	def to_native_amount(self, amount):
		"""Calculates the number of native tokens corresponding to specified number of wrapped tokens."""

		return int((Decimal(amount) / self.conversion_rate()).quantize(1, rounding=ROUND_DOWN))
