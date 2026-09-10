import re
from collections import namedtuple

NativeMosaicInfo = namedtuple('NativeMosaicInfo', ['id', 'divisibility'])

# Evidence: symbol/symbol@39157e9dc373f1827b8428767111776edb256c8c,
# client/catapult/resources/config-network.properties sets
# [plugin:catapult.plugins.mosaic] maxMosaicDivisibility = 6. The corresponding
# MosaicDivisibilityValidator.cpp rejects values above that configured maximum.
MAX_NATIVE_MOSAIC_DIVISIBILITY = 6
_BARE_MOSAIC_ID_PATTERN = re.compile(r'[0-9A-Fa-f]{16}')
_NODE_MOSAIC_ID_PATTERN = re.compile(r"0x[0-9A-Fa-f]{4}'[0-9A-Fa-f]{4}'[0-9A-Fa-f]{4}'[0-9A-Fa-f]{4}")
_DECIMAL_PATTERN = re.compile(r'[0-9]+')


class NativeMosaicValidationError(ValueError):
	"""Raised when native mosaic metadata cannot be validated."""


def normalize_mosaic_id(value):
	"""Normalizes a bare or Symbol Node-formatted mosaic id to uppercase hex."""

	if not isinstance(value, str):
		raise NativeMosaicValidationError('Mosaic id must be a string')
	if _BARE_MOSAIC_ID_PATTERN.fullmatch(value):
		return value.upper()
	if _NODE_MOSAIC_ID_PATTERN.fullmatch(value):
		return value[2:].replace("'", '').upper()
	raise NativeMosaicValidationError('Mosaic id must be 16 hex digits or a grouped 0x mosaic id')


def normalize_divisibility(value):
	"""Normalizes and validates a native mosaic divisibility value."""

	if isinstance(value, bool):
		raise NativeMosaicValidationError('Mosaic divisibility must be an integer')
	if isinstance(value, int):
		divisibility = value
	elif isinstance(value, str) and _DECIMAL_PATTERN.fullmatch(value):
		divisibility = int(value)
	else:
		raise NativeMosaicValidationError('Mosaic divisibility must be a decimal integer')
	if divisibility < 0 or divisibility > MAX_NATIVE_MOSAIC_DIVISIBILITY:
		raise NativeMosaicValidationError('Mosaic divisibility exceeds the configured Symbol maximum')
	return divisibility


def create_native_mosaic_info(mosaic_id, divisibility):
	"""Creates immutable, normalized native mosaic metadata."""

	return NativeMosaicInfo(normalize_mosaic_id(mosaic_id), normalize_divisibility(divisibility))


def validate_native_mosaic_response(requested_id, response):
	"""Validates a Symbol Node mosaic response and binds it to the requested id."""

	normalized_requested_id = normalize_mosaic_id(requested_id)
	try:
		mosaic = response['mosaic']
		response_id = normalize_mosaic_id(mosaic['id'])
		divisibility = normalize_divisibility(mosaic['divisibility'])
	except (KeyError, TypeError) as error:
		raise NativeMosaicValidationError('Mosaic response is missing required fields') from error
	if response_id != normalized_requested_id:
		raise NativeMosaicValidationError('Mosaic response id does not match the requested id')
	return NativeMosaicInfo(normalized_requested_id, divisibility)
