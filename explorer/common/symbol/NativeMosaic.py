import string
from collections import namedtuple

# Symbol mosaic divisibility is 0 through 6 inclusive.
# Source: https://docs.symbol.dev/concepts/mosaic.html (verified 2026-08-05).
MAX_NATIVE_MOSAIC_DIVISIBILITY = 6


def normalize_native_mosaic_id(mosaic_id):
	"""Normalizes a Symbol mosaic id to an uppercase 16-character hex string."""

	if not isinstance(mosaic_id, str):
		raise ValueError('Native mosaic id must be a string')

	normalized_id = mosaic_id
	if normalized_id[:2].lower() == '0x':
		normalized_id = normalized_id[2:]
	normalized_id = normalized_id.replace("'", '')
	if len(normalized_id) != 16 or any(character not in string.hexdigits for character in normalized_id):
		raise ValueError('Native mosaic id must be a 16-character hexadecimal string')

	return normalized_id.upper()


def normalize_native_mosaic_divisibility(divisibility):
	"""Validates and normalizes a Symbol mosaic divisibility value."""

	if isinstance(divisibility, bool) or not isinstance(divisibility, int):
		raise ValueError('Native mosaic divisibility must be an integer')
	if not 0 <= divisibility <= MAX_NATIVE_MOSAIC_DIVISIBILITY:
		raise ValueError('Native mosaic divisibility must be between 0 and 6')

	return divisibility


def extract_native_mosaic_id(network_properties):
	"""Extracts and normalizes chain.currencyMosaicId from Node network properties."""

	try:
		return normalize_native_mosaic_id(network_properties['chain']['currencyMosaicId'])
	except (KeyError, TypeError) as error:
		raise ValueError('Network properties must include chain.currencyMosaicId') from error


class NativeMosaicInfo(namedtuple('NativeMosaicInfo', ['id', 'divisibility'])):
	"""Immutable, validated native mosaic identity and divisibility."""

	__slots__ = ()

	def __new__(cls, id, divisibility):  # pylint: disable=invalid-name,redefined-builtin
		return super().__new__(
			cls,
			normalize_native_mosaic_id(id),
			normalize_native_mosaic_divisibility(divisibility)
		)


def create_native_mosaic_info(network_properties, mosaic_definition):
	"""Builds native mosaic information from validated Node response shapes."""

	native_mosaic_id = extract_native_mosaic_id(network_properties)
	try:
		divisibility = mosaic_definition['mosaic']['divisibility']
	except (KeyError, TypeError) as error:
		raise ValueError('Mosaic response must include mosaic.divisibility') from error

	return NativeMosaicInfo(native_mosaic_id, divisibility)
