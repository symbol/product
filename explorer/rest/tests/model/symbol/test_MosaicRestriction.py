import pytest
from symbolchain.symbol.Network import Address, Network

from rest.db.SymbolDatabase import MosaicRestrictionRecord
from rest.db.SymbolDatabaseCommon import SymbolDataUnavailable
from rest.model.symbol.MosaicRestriction import MosaicRestrictionEntryType, create_mosaic_restriction_dto

from ...test.SymbolMosaicRestrictionTestUtils import ADDRESS, MOSAIC_ID


@pytest.mark.parametrize('entry_type,rules', [
	('address', [{'key': 'bad', 'value': '1'}]),
	('address', [{'key': '1', 'value': '18446744073709551615'}]),
	('address', [{'key': '1', 'value': '00018446744073709551615'}]),
	('address', [{'key': '1', 'value': '18446744073709551616'}]),
	pytest.param('address', [{'key': '1', 'value': '100000000000000000000'}], id='address-21-digit-value'),
	pytest.param('address', [{'key': '', 'value': '1'}], id='address-empty-key'),
	('address', [{'key': '00018446744073709551616', 'value': '1'}]),
	('address', [{'key': '1'}]),
	pytest.param('address', {}, id='address-empty-object'),
	('address', [1]),
	('global', [{'key': '1', 'restriction': {'referenceMosaicId': '0000000000000000',
		'restrictionValue': 'bad', 'restrictionType': 1}}]),
	('global', [{'key': '1', 'restriction': {'referenceMosaicId': '0000000000000000',
		'restrictionValue': '18446744073709551616', 'restrictionType': 1}}]),
	('global', [{'key': '1', 'restriction': {'referenceMosaicId': 'E74B99BA41F4AFEE',
		'restrictionValue': '1', 'restrictionType': 1}}]),
	('global', [{'key': '1', 'restriction': {'referenceMosaicId': '0000000000000000',
		'restrictionValue': '1', 'restrictionType': 0}}]),
	('global', [{'key': '1', 'restriction': {'referenceMosaicId': '0000000000000000',
		'restrictionValue': '1', 'restrictionType': True}}]),
	('global', [{'key': '1', 'restriction': {}}])
])
def test_invalid_rules_raise_unavailable(entry_type, rules):
	# Arrange:
	kind = MosaicRestrictionEntryType(entry_type)
	target = Address(ADDRESS).bytes if kind is MosaicRestrictionEntryType.ADDRESS else None
	row = MosaicRestrictionRecord(bytes([1]) * 32, MOSAIC_ID, kind, target, rules)

	# Act:
	with pytest.raises(SymbolDataUnavailable) as error:
		create_mosaic_restriction_dto(row, Network.TESTNET)

	# Assert:
	assert 'Symbol mosaic restriction data is unavailable' == str(error.value)


@pytest.mark.parametrize('column,value', [
	('composite_hash', b'bad'),
	('mosaic_id', '1F'),
	('target_address', b'bad'),
	('target_address', Address('ND3I6ZLS22YLJIL7AIQHOAN34AOUSRNK6NTDVKQ').bytes)
])
def test_invalid_columns_unavailable(column, value):
	# Arrange:
	row = MosaicRestrictionRecord(bytes([1]) * 32, MOSAIC_ID, MosaicRestrictionEntryType.ADDRESS, Address(ADDRESS).bytes, [])
	row = row._replace(**{column: value})

	# Act:
	with pytest.raises(SymbolDataUnavailable) as error:
		create_mosaic_restriction_dto(row, Network.TESTNET)

	# Assert:
	assert 'Symbol mosaic restriction data is unavailable' == str(error.value)
