import re
from enum import Enum

from symbolchain.symbol.IdGenerator import is_mosaic_alias
from symbolchain.symbol.Network import Address

from rest.model.symbol.validation import UINT64_MAX, SymbolDataInvalid

OPERATORS = {
	1: 'Equal',
	2: 'Not Equal',
	3: 'Less Than',
	4: 'Less Than Or Equal',
	5: 'Greater Than',
	6: 'Greater Than Or Equal'
}


class MosaicRestrictionEntryType(Enum):
	"""REST's restriction entry kinds and PostgreSQL labels."""

	ADDRESS = 'address'
	GLOBAL = 'global'


def _mosaic_id(value, field_path):
	if not isinstance(value, str) or not re.fullmatch(r'[0-9A-Fa-f]{16}', value, re.ASCII):
		raise SymbolDataInvalid(field_path, 'invalid mosaic id')

	if is_mosaic_alias(int(value, 16)):
		raise SymbolDataInvalid(field_path, 'invalid mosaic id')

	return value.upper()


def _uint64(value, field_path):
	if not isinstance(value, str) or not re.fullmatch(r'[0-9]+', value, re.ASCII):
		raise SymbolDataInvalid(field_path, 'expected uint64 decimal string')

	# Match the Puller: arbitrarily many leading zeroes are accepted and retained for output.
	normalized = value.lstrip('0') or '0'
	if len(normalized) > 20 or int(normalized) > UINT64_MAX:
		raise SymbolDataInvalid(field_path, 'uint64 value is out of range')

	return int(normalized)


def _required(mapping, key, field_path):
	if key not in mapping:
		raise SymbolDataInvalid(field_path, 'field is required')

	return mapping[key]


def _format_restriction(rule, entry_type, mosaic_id, field_path):
	if not isinstance(rule, dict):
		raise SymbolDataInvalid(field_path, 'expected object')

	key_path = f'{field_path}.key'
	key = _required(rule, 'key', key_path)
	_uint64(key, key_path)
	if entry_type is MosaicRestrictionEntryType.ADDRESS:
		value_path = f'{field_path}.value'
		value = _required(rule, 'value', value_path)
		# Symbol core 3a509647a1a7fb20be0bdb5435d923cb073b2773:
		# restriction_mosaic/src/state/MosaicAddressRestriction.h/.cpp removes the key at UINT64_MAX.
		if UINT64_MAX == _uint64(value, value_path):
			raise SymbolDataInvalid(value_path, 'address restriction value is a removal sentinel')

		return f'{key}: {value}'

	detail_path = f'{field_path}.restriction'
	detail = _required(rule, 'restriction', detail_path)
	if not isinstance(detail, dict):
		raise SymbolDataInvalid(detail_path, 'expected object')

	reference_path = f'{detail_path}.referenceMosaicId'
	reference = _mosaic_id(_required(detail, 'referenceMosaicId', reference_path), reference_path)
	if reference == '0000000000000000':
		reference = mosaic_id

	operator_path = f'{detail_path}.restrictionType'
	operator = _required(detail, 'restrictionType', operator_path)
	if type(operator) is not int or operator not in OPERATORS:  # pylint: disable=unidiomatic-typecheck
		raise SymbolDataInvalid(operator_path, 'invalid restriction type')

	value_path = f'{detail_path}.restrictionValue'
	value = _required(detail, 'restrictionValue', value_path)
	_uint64(value, value_path)
	return f'{reference} Key {key} {OPERATORS[operator]} {value}'


def create_mosaic_restriction_dto(row, network):
	"""Creates the public representation from normalized, persisted restriction data."""

	composite_hash = bytes(row.composite_hash)
	if len(composite_hash) != 32:
		raise SymbolDataInvalid('mosaic_restrictions.composite_hash', 'invalid byte length')

	hash_text = composite_hash.hex().upper()
	field_path = f'mosaic_restrictions[{hash_text}]'
	mosaic_id = _mosaic_id(row.mosaic_id, f'{field_path}.mosaic_id')
	if not isinstance(row.restrictions, list):
		raise SymbolDataInvalid(f'{field_path}.restrictions', 'expected array')

	target_address = None
	if row.entry_type is MosaicRestrictionEntryType.ADDRESS:
		address_bytes = bytes(row.target_address)
		if len(address_bytes) != Address.SIZE:
			raise SymbolDataInvalid(f'{field_path}.target_address', 'invalid byte length')
		target_address = str(Address(address_bytes))
		if not network.is_valid_address_string(target_address):
			raise SymbolDataInvalid(f'{field_path}.target_address', 'invalid address')

	return {
		'compositeHash': hash_text,
		'mosaicId': mosaic_id,
		'entryType': (
			'Mosaic Address Restriction' if row.entry_type is MosaicRestrictionEntryType.ADDRESS else 'Mosaic Global Restriction'),
		'targetAddress': target_address,
		'restrictions': ', '.join(
			_format_restriction(rule, row.entry_type, mosaic_id, f'{field_path}.restrictions[{index}]')
			for index, rule in enumerate(row.restrictions))
	}
