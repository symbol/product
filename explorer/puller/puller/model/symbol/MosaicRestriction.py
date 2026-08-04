"""Normalization and validation for Symbol mosaic restriction current state."""

from collections import namedtuple
from enum import Enum

from symbolchain.sc import MosaicRestrictionType
from symbolchain.symbol.IdGenerator import is_mosaic_alias
from symbolchain.symbol.Network import Address

from puller.model.symbol.format import decoded_address_bytes_from_hex, hash_bytes_from_hex, is_hex_text

MOSAIC_ADDRESS_RESTRICTION_REMOVAL_SENTINEL = '18446744073709551615'


class MosaicRestrictionEntryType(Enum):
	"""The two Symbol mosaic restriction entry kinds."""

	ADDRESS = 'address'
	GLOBAL = 'global'


MosaicRestrictionKey = namedtuple(
	'MosaicRestrictionKey',
	['entry_type', 'mosaic_id', 'target_address'])

_ENTRY_TYPE_BY_NODE_VALUE = {0: MosaicRestrictionEntryType.ADDRESS, 1: MosaicRestrictionEntryType.GLOBAL}
_NODE_VALUE_BY_ENTRY_TYPE = {entry_type: node_value for node_value, entry_type in _ENTRY_TYPE_BY_NODE_VALUE.items()}


def mosaic_restriction_entry_type_from_node(value):  # pylint: disable=invalid-name
	"""Map the strict Symbol node entryType integer to the local enum."""

	if not isinstance(value, int) or isinstance(value, bool) or value not in _ENTRY_TYPE_BY_NODE_VALUE:
		raise ValueError(f'Unsupported Symbol mosaic restriction entry type {value}')

	return _ENTRY_TYPE_BY_NODE_VALUE[value]


def mosaic_restriction_entry_type_to_node(entry_type):  # pylint: disable=invalid-name
	"""Map the local enum to the strict Symbol node entryType integer."""

	if not isinstance(entry_type, MosaicRestrictionEntryType):
		raise ValueError(f'Unsupported Symbol mosaic restriction entry type {entry_type}')

	return _NODE_VALUE_BY_ENTRY_TYPE[entry_type]


def mosaic_restriction_entry_type_label(entry_type):
	"""Return the database enum label for a local entry type."""

	if not isinstance(entry_type, MosaicRestrictionEntryType):
		raise ValueError(f'Unsupported Symbol mosaic restriction entry type {entry_type}')

	return entry_type.value


def create_mosaic_restriction_key(entry_type, mosaic_id, target_address):
	"""Create a validated logical key for one persisted restriction entry."""

	if not isinstance(entry_type, MosaicRestrictionEntryType):
		raise ValueError(f'Unsupported Symbol mosaic restriction entry type {entry_type}')
	if not isinstance(mosaic_id, str) or len(mosaic_id) != 16 or not is_hex_text(mosaic_id):
		raise ValueError('Invalid Symbol mosaic restriction mosaicId')
	normalized_mosaic_id = mosaic_id.upper()
	if is_mosaic_alias(int(normalized_mosaic_id, 16)):
		raise ValueError('Alias Symbol mosaic restriction mosaicId is unresolved')

	if entry_type is MosaicRestrictionEntryType.GLOBAL:
		if target_address is not None:
			raise ValueError('Global Symbol mosaic restriction target_address must be null')
		return MosaicRestrictionKey(entry_type, normalized_mosaic_id, None)

	if not isinstance(target_address, bytes):
		raise ValueError('Address Symbol mosaic restriction target_address is invalid')
	try:
		normalized_address = Address(target_address).bytes
	except ValueError as exception:
		raise ValueError('Address Symbol mosaic restriction target_address is invalid') from exception
	if Address(normalized_address).is_alias():
		raise ValueError('Alias Symbol address mosaic restriction targetAddress is unresolved')
	return MosaicRestrictionKey(entry_type, normalized_mosaic_id, normalized_address)


def create_mosaic_restriction_row(item, observed_height):
	"""Validate one node wrapper and convert it to a persistence row."""

	if not isinstance(item, dict) or not isinstance(item.get('mosaicRestrictionEntry'), dict):
		raise ValueError('Malformed Symbol mosaic restriction response')
	if not isinstance(item.get('id'), str) or len(item['id']) != 24 or not is_hex_text(item['id']):
		raise ValueError('Invalid Symbol mosaic restriction id')
	entry = item['mosaicRestrictionEntry']
	composite_hash = hash_bytes_from_hex(entry, 'compositeHash', 'Symbol mosaic restriction')
	version = entry.get('version')
	if not isinstance(version, int) or isinstance(version, bool):
		raise ValueError('Invalid Symbol mosaic restriction version')
	entry_type = mosaic_restriction_entry_type_from_node(entry.get('entryType'))
	mosaic_id = _canonical_mosaic_id(entry, entry_type)
	target_address = _target_address(entry, entry_type)
	key = create_mosaic_restriction_key(entry_type, mosaic_id, target_address)
	restrictions = entry.get('restrictions')
	if not isinstance(restrictions, list):
		raise ValueError('Invalid Symbol mosaic restriction restrictions')
	for restriction in restrictions:
		_validate_restriction(restriction, entry_type)

	return {
		'composite_hash': composite_hash,
		'entry_type': key.entry_type,
		'mosaic_id': key.mosaic_id,
		'target_address': key.target_address,
		'restrictions': restrictions,
		'raw_payload': item,
		'updated_at_height': observed_height
	}


def _canonical_mosaic_id(entry, entry_type):
	value = entry.get('mosaicId')
	if not isinstance(value, str) or len(value) != 16 or not is_hex_text(value):
		raise ValueError(f'Invalid Symbol {entry_type.value} mosaic restriction mosaicId')
	canonical = value.upper()
	if is_mosaic_alias(int(canonical, 16)):
		raise ValueError('Alias Symbol mosaic restriction mosaicId is unresolved')
	return canonical


def _target_address(entry, entry_type):
	if entry_type is MosaicRestrictionEntryType.GLOBAL:
		if 'targetAddress' in entry:
			raise ValueError('Global Symbol mosaic restriction must not contain targetAddress')
		return None
	target_address = decoded_address_bytes_from_hex(entry, 'targetAddress', 'Symbol address mosaic restriction')
	if Address(target_address).is_alias():
		raise ValueError('Alias Symbol address mosaic restriction targetAddress is unresolved')
	return target_address


def _validate_restriction(restriction, entry_type):
	if not isinstance(restriction, dict):
		raise ValueError('Invalid Symbol mosaic restriction restriction')
	key = restriction.get('key')
	if not _is_decimal_u64(key):
		raise ValueError('Invalid Symbol mosaic restriction key')
	if entry_type is MosaicRestrictionEntryType.ADDRESS:
		value = restriction.get('value')
		if not _is_decimal_u64(value):
			raise ValueError('Invalid Symbol address mosaic restriction value')
		# Symbol core 3a509647a1a7fb20be0bdb5435d923cb073b2773:
		# client/catapult/plugins/txes/restriction_mosaic/src/state/MosaicAddressRestriction.h/.cpp
		# defines UINT64_MAX as the removal sentinel and deletes the key instead of storing it.
		if (value.lstrip('0') or '0') == MOSAIC_ADDRESS_RESTRICTION_REMOVAL_SENTINEL:
			raise ValueError('Invalid Symbol address mosaic restriction value')
		return

	nested = restriction.get('restriction')
	if not isinstance(nested, dict):
		raise ValueError('Invalid Symbol global mosaic restriction restriction')
	reference_mosaic_id = nested.get('referenceMosaicId')
	if not isinstance(reference_mosaic_id, str) or len(reference_mosaic_id) != 16 or not is_hex_text(reference_mosaic_id):
		raise ValueError('Invalid Symbol global mosaic restriction referenceMosaicId')
	try:
		reference_mosaic_id = reference_mosaic_id.upper()
		if int(reference_mosaic_id, 16) != 0 and is_mosaic_alias(int(reference_mosaic_id, 16)):
			raise ValueError
	except ValueError as exception:
		raise ValueError('Invalid Symbol global mosaic restriction referenceMosaicId') from exception
	if not _is_decimal_u64(nested.get('restrictionValue')):
		raise ValueError('Invalid Symbol global mosaic restriction restrictionValue')
	_validate_global_restriction_type(nested.get('restrictionType'))


def _validate_global_restriction_type(restriction_type):
	if not isinstance(restriction_type, int) or isinstance(restriction_type, bool):
		raise ValueError('Invalid Symbol global mosaic restriction restrictionType')
	try:
		validated_restriction_type = MosaicRestrictionType(restriction_type)
	except ValueError as exception:
		raise ValueError('Invalid Symbol global mosaic restriction restrictionType') from exception
	# Symbol core 3a509647a1a7fb20be0bdb5435d923cb073b2773:
	# client/catapult/plugins/txes/restriction_mosaic/src/state/MosaicGlobalRestriction.cpp
	# defines NONE as the deletion marker and removes the key instead of storing its rule.
	if MosaicRestrictionType.NONE == validated_restriction_type:
		raise ValueError('Invalid Symbol global mosaic restriction restrictionType')


def _is_decimal_u64(value):
	if not isinstance(value, str) or not value.isascii() or not value.isdecimal():
		return False
	normalized = value.lstrip('0') or '0'
	return len(normalized) < 20 or (
		len(normalized) == 20 and normalized <= '18446744073709551615')
