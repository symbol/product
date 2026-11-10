import re
from enum import Enum

from symbolchain.symbol.IdGenerator import is_mosaic_alias
from symbolchain.symbol.Network import Address

from rest.db.SymbolDatabaseCommon import SymbolDataUnavailable

OPERATORS = {
	1: 'Equal',
	2: 'Not Equal',
	3: 'Less Than',
	4: 'Less Than Or Equal',
	5: 'Greater Than',
	6: 'Greater Than Or Equal'
}
UINT64_MAX = '18446744073709551615'


class MosaicRestrictionEntryType(Enum):
	"""REST's restriction entry kinds and PostgreSQL labels."""

	ADDRESS = 'address'
	GLOBAL = 'global'


def _mosaic_id(value):
	if not isinstance(value, str) or not re.fullmatch(r'[0-9A-Fa-f]{16}', value, re.ASCII):
		raise ValueError('invalid mosaic id')

	if is_mosaic_alias(int(value, 16)):
		raise ValueError('invalid mosaic id')

	return value.upper()


def _uint64(value):
	if not isinstance(value, str) or not re.fullmatch(r'[0-9]+', value, re.ASCII):
		raise ValueError('invalid uint64')

	normalized = value.lstrip('0') or '0'
	if len(normalized) > len(UINT64_MAX) or (len(normalized) == len(UINT64_MAX) and normalized > UINT64_MAX):
		raise ValueError('invalid uint64')

	return value


def _format_restriction(rule, entry_type, mosaic_id):
	key = _uint64(rule['key'])
	if entry_type is MosaicRestrictionEntryType.ADDRESS:
		value = _uint64(rule['value'])
		if (value.lstrip('0') or '0') == UINT64_MAX:
			raise ValueError('invalid address restriction value')

		return f'{key}: {value}'

	detail = rule['restriction']
	reference = _mosaic_id(detail['referenceMosaicId'])
	if reference == '0000000000000000':
		reference = mosaic_id

	operator = detail['restrictionType']
	if type(operator) is not int or operator not in OPERATORS:  # pylint: disable=unidiomatic-typecheck
		raise ValueError('invalid restriction type')

	return f"{reference} Key {key} {OPERATORS[operator]} {_uint64(detail['restrictionValue'])}"


def create_mosaic_restriction_dto(row, network):
	"""Creates the public representation from normalized, persisted restriction data."""

	try:
		composite_hash = bytes(row.composite_hash)
		if len(composite_hash) != 32:
			raise ValueError('invalid restriction row')

		mosaic_id = _mosaic_id(row.mosaic_id)
		if not isinstance(row.restrictions, list):
			raise ValueError('invalid restrictions')

		target_address = None
		if row.entry_type is MosaicRestrictionEntryType.ADDRESS:
			target_address = str(Address(bytes(row.target_address)))
			if not network.is_valid_address_string(target_address):
				raise ValueError('invalid target address')

		return {
			'compositeHash': composite_hash.hex().upper(),
			'mosaicId': mosaic_id,
			'entryType': (
				'Mosaic Address Restriction' if row.entry_type is MosaicRestrictionEntryType.ADDRESS else 'Mosaic Global Restriction'),
			'targetAddress': target_address,
			'restrictions': ', '.join(_format_restriction(rule, row.entry_type, mosaic_id) for rule in row.restrictions)
		}
	except (TypeError, ValueError, KeyError, AttributeError) as error:
		raise SymbolDataUnavailable('Symbol mosaic restriction data is unavailable') from error
