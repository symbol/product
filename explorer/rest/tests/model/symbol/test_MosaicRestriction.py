import pytest
from symbolchain.symbol.Network import Address, Network

from rest.db.SymbolDatabase import MosaicRestrictionRecord
from rest.model.symbol.MosaicRestriction import MosaicRestrictionEntryType, create_mosaic_restriction_dto
from rest.model.symbol.validation import SymbolDataInvalid

from ...test.SymbolMosaicRestrictionTestUtils import ADDRESS, MOSAIC_ID


@pytest.mark.parametrize('entry_type,rules,path,reason', [
	('address', [{'key': 'bad', 'value': '1'}], 'restrictions[0].key', 'expected uint64 decimal string'),
	('address', [{'key': '1', 'value': '18446744073709551615'}],
		'restrictions[0].value', 'address restriction value is a removal sentinel'),
	('address', [{'key': '1', 'value': '00018446744073709551615'}],
		'restrictions[0].value', 'address restriction value is a removal sentinel'),
	('address', [{'key': '1', 'value': '18446744073709551616'}], 'restrictions[0].value', 'uint64 value is out of range'),
	pytest.param(
		'address', [{'key': '1', 'value': '100000000000000000000'}],
		'restrictions[0].value', 'uint64 value is out of range', id='address-21-digit-value'),
	pytest.param('address', [{'key': '', 'value': '1'}], 'restrictions[0].key', 'expected uint64 decimal string', id='empty-key'),
	('address', [{'key': '00018446744073709551616', 'value': '1'}], 'restrictions[0].key', 'uint64 value is out of range'),
	('address', [{'key': '1'}], 'restrictions[0].value', 'field is required'),
	('address', [{'value': '1'}], 'restrictions[0].key', 'field is required'),
	pytest.param('address', {}, 'restrictions', 'expected array', id='address-empty-object'),
	('address', [1], 'restrictions[0]', 'expected object'),
	('global', [{'key': '1'}], 'restrictions[0].restriction', 'field is required'),
	('global', [{'key': '1', 'restriction': []}], 'restrictions[0].restriction', 'expected object'),
	('global', [{'key': '1', 'restriction': {}}], 'restrictions[0].restriction.referenceMosaicId', 'field is required'),
	('global', [{'key': '1', 'restriction': {'referenceMosaicId': 'E74B99BA41F4AFEE',
		'restrictionValue': '1', 'restrictionType': 1}}], 'restrictions[0].restriction.referenceMosaicId', 'invalid mosaic id'),
	('global', [{'key': '1', 'restriction': {'referenceMosaicId': '0000000000000000'}}],
		'restrictions[0].restriction.restrictionType', 'field is required'),
	('global', [{'key': '1', 'restriction': {'referenceMosaicId': '0000000000000000', 'restrictionType': 0}}],
		'restrictions[0].restriction.restrictionType', 'invalid restriction type'),
	('global', [{'key': '1', 'restriction': {'referenceMosaicId': '0000000000000000', 'restrictionType': True}}],
		'restrictions[0].restriction.restrictionType', 'invalid restriction type'),
	('global', [{'key': '1', 'restriction': {'referenceMosaicId': '0000000000000000', 'restrictionType': 1}}],
		'restrictions[0].restriction.restrictionValue', 'field is required'),
	('global', [{'key': '1', 'restriction': {'referenceMosaicId': '0000000000000000',
		'restrictionValue': 'bad', 'restrictionType': 1}}], 'restrictions[0].restriction.restrictionValue', 'expected uint64 decimal string'),
	('global', [{'key': '1', 'restriction': {'referenceMosaicId': '0000000000000000',
		'restrictionValue': '18446744073709551616', 'restrictionType': 1}}],
		'restrictions[0].restriction.restrictionValue', 'uint64 value is out of range')
])
def test_invalid_rules(entry_type, rules, path, reason):
	# Arrange:
	kind = MosaicRestrictionEntryType(entry_type)
	target = Address(ADDRESS).bytes if kind is MosaicRestrictionEntryType.ADDRESS else None
	row = MosaicRestrictionRecord(bytes([1]) * 32, MOSAIC_ID, kind, target, rules)

	# Act:
	with pytest.raises(SymbolDataInvalid) as error:
		create_mosaic_restriction_dto(row, Network.TESTNET)

	# Assert:
	assert f'mosaic_restrictions[{"01" * 32}].{path}' == error.value.field_path
	assert reason == error.value.reason


@pytest.mark.parametrize('column,value,path,reason', [
	('composite_hash', b'bad', 'mosaic_restrictions.composite_hash', 'invalid byte length'),
	('mosaic_id', '1F', f'mosaic_restrictions[{"01" * 32}].mosaic_id', 'invalid mosaic id'),
	('target_address', b'bad', f'mosaic_restrictions[{"01" * 32}].target_address', 'invalid byte length'),
	('target_address', Address('ND3I6ZLS22YLJIL7AIQHOAN34AOUSRNK6NTDVKQ').bytes,
		f'mosaic_restrictions[{"01" * 32}].target_address', 'invalid address')
])
def test_invalid_columns(column, value, path, reason):
	# Arrange:
	row = MosaicRestrictionRecord(bytes([1]) * 32, MOSAIC_ID, MosaicRestrictionEntryType.ADDRESS, Address(ADDRESS).bytes, [])
	row = row._replace(**{column: value})

	# Act:
	with pytest.raises(SymbolDataInvalid) as error:
		create_mosaic_restriction_dto(row, Network.TESTNET)

	# Assert:
	assert path == error.value.field_path
	assert reason == error.value.reason


@pytest.mark.parametrize('value', ['0', '000'])
def test_address_zero_values(value):
	# Arrange:
	row = MosaicRestrictionRecord(
		bytes([1]) * 32, MOSAIC_ID, MosaicRestrictionEntryType.ADDRESS, Address(ADDRESS).bytes, [{'key': '0', 'value': value}])

	# Act:
	result = create_mosaic_restriction_dto(row, Network.TESTNET)

	# Assert:
	assert f'0: {value}' == result['restrictions']
