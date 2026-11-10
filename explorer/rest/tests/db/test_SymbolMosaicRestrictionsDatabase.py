import pytest
from symbolchain.symbol.Network import Address

from rest.db.SymbolDatabase import MosaicRestrictionQuery, SymbolDatabase
from rest.db.SymbolDatabaseCommon import SymbolDataUnavailable
from rest.model.symbol.MosaicRestriction import MosaicRestrictionEntryType

from ..test.SymbolBlockTestUtils import create_symbol_sync_state
from ..test.SymbolDatabaseTestUtils import PausingAfterSyncStateReadSymbolDatabase, read_during_database_snapshot, symbol_test_database
from ..test.SymbolMosaicRestrictionTestUtils import (
	ADDRESS,
	FIRST_ADDRESS,
	LAST_ADDRESS,
	MOSAIC_ID,
	NATIVE,
	OTHER_ADDRESS,
	OTHER_ID,
	insert_restriction,
	restriction_rules,
	seed_restriction_rows
)
from ..test.SymbolMosaicTestUtils import create_symbol_mosaic

SYNC = create_symbol_sync_state(last_synced_height=10, finalized_height=10)


def test_fixed_order_and_watermark():
	# Arrange:
	sync = create_symbol_sync_state(last_synced_height=10, finalized_height=9, chain_height=12)
	with symbol_test_database(sync, mosaics=[create_symbol_mosaic(MOSAIC_ID, 0)]) as (config, puller):
		seed_restriction_rows(puller)
		with SymbolDatabase(config, NATIVE) as database:
			# Avoid an index scan accidentally supplying missing ORDER BY keys.
			with database.connection() as connection:
				with connection.cursor() as cursor:
					cursor.execute('SET enable_indexscan = off')
					cursor.execute('SET enable_indexonlyscan = off')
					cursor.execute('SET enable_bitmapscan = off')

				connection.commit()

			# Act:
			rows = database.try_get_mosaic_restrictions(MosaicRestrictionQuery())

	# Assert: each tuple independently fixes the row identity and every ordering key.
	actual = [
		(row.mosaic_id, row.entry_type, bytes(row.target_address) if row.target_address is not None else None,
			bytes(row.composite_hash)[0])
		for row in rows
	]
	assert [
		(MOSAIC_ID, MosaicRestrictionEntryType.ADDRESS, Address(FIRST_ADDRESS).bytes, 40),
		(MOSAIC_ID, MosaicRestrictionEntryType.ADDRESS, Address(ADDRESS).bytes, 30),
		(MOSAIC_ID, MosaicRestrictionEntryType.ADDRESS, Address(LAST_ADDRESS).bytes, 10),
		(MOSAIC_ID, MosaicRestrictionEntryType.GLOBAL, None, 20),
		(OTHER_ID, MosaicRestrictionEntryType.ADDRESS, Address(ADDRESS).bytes, 50),
		(OTHER_ID, MosaicRestrictionEntryType.ADDRESS, Address(OTHER_ADDRESS).bytes, 5),
		(OTHER_ID, MosaicRestrictionEntryType.GLOBAL, None, 2)
	] == actual


@pytest.mark.parametrize('limit,offset,expected', [(2, 2, [10, 20]), (10, 10000, [])])
def test_paging_filters_before_offset(limit, offset, expected):
	# Arrange:
	with symbol_test_database(SYNC) as (config, puller):
		seed_restriction_rows(puller)

		# Act:
		with SymbolDatabase(config, NATIVE) as database:
			page = database.try_get_mosaic_restrictions(MosaicRestrictionQuery(limit=limit, offset=offset))

	# Assert: filtering the unpublished row after offset=2 would return only 10.
	assert expected == [bytes(row.composite_hash)[0] for row in page]


def test_filters_combine_with_and():
	# Arrange:
	with symbol_test_database(SYNC) as (config, puller):
		seed_restriction_rows(puller)
		query = MosaicRestrictionQuery(
			mosaic_id=OTHER_ID, target_address=Address(ADDRESS).bytes, entry_type=MosaicRestrictionEntryType.ADDRESS)

		# Act:
		with SymbolDatabase(config, NATIVE) as database:
			rows = database.try_get_mosaic_restrictions(query)

	# Assert:
	assert [50] == [bytes(row.composite_hash)[0] for row in rows]


@pytest.mark.parametrize('query,expected', [
	(MosaicRestrictionQuery(entry_type=MosaicRestrictionEntryType.GLOBAL), [20, 2]),
	(MosaicRestrictionQuery(target_address=Address(ADDRESS).bytes), [30, 50]),
	(MosaicRestrictionQuery(mosaic_id=MOSAIC_ID, should_check_parent=True), [40, 30, 10, 20])
])
def test_database_filters_match_rows(query, expected):
	# Arrange:
	with symbol_test_database(SYNC, mosaics=[create_symbol_mosaic(MOSAIC_ID, 0)]) as (config, puller):
		seed_restriction_rows(puller)

		# Act:
		with SymbolDatabase(config, NATIVE) as database:
			rows = database.try_get_mosaic_restrictions(query)

	# Assert:
	assert expected == [bytes(row.composite_hash)[0] for row in rows]


def test_expired_mosaic_is_parent():
	# Arrange:
	mosaic = create_symbol_mosaic(MOSAIC_ID, 0)
	mosaic['expiration_height'] = 2
	with symbol_test_database(SYNC, mosaics=[mosaic]) as (config, _):
		# Act:
		with SymbolDatabase(config, NATIVE) as database:
			rows = database.try_get_mosaic_restrictions(MosaicRestrictionQuery(mosaic_id=MOSAIC_ID, should_check_parent=True))

	# Assert:
	assert [] == rows


@pytest.mark.parametrize('state', [
	None,
	{**SYNC, 'last_synced_height': None},
	{**SYNC, 'status': 'repairing'},
	{**SYNC, 'status': 'unhealthy'},
	{**SYNC, 'dirty_state_from_height': 11},
	{**SYNC, 'dirty_state_from_height': 1}
])
@pytest.mark.parametrize('should_check_parent', [True, False])
def test_rejects_unreadable_sync_state(state, should_check_parent):
	# Arrange: an otherwise readable row makes a missing state guard observable for cross-search.
	with symbol_test_database(state) as (config, puller):
		insert_restriction(puller, 1, MOSAIC_ID, 'address', ADDRESS, [], 10)
		query = MosaicRestrictionQuery(
			mosaic_id=MOSAIC_ID if should_check_parent else None, should_check_parent=should_check_parent)
		with SymbolDatabase(config, NATIVE) as database:
			# Act:
			with pytest.raises(SymbolDataUnavailable) as error:
				database.try_get_mosaic_restrictions(query)

	# Assert:
	assert 'Symbol account data is unavailable' == str(error.value)


@pytest.mark.parametrize('column', ['start_height', 'updated_at_height'])
def test_parent_above_watermark(column):
	# Arrange:
	mosaic = create_symbol_mosaic(MOSAIC_ID, 0)
	mosaic[column] = 11
	with symbol_test_database(SYNC, mosaics=[mosaic]) as (config, _):
		with SymbolDatabase(config, NATIVE) as database:
			# Act:
			with pytest.raises(SymbolDataUnavailable) as error:
				database.try_get_mosaic_restrictions(MosaicRestrictionQuery(mosaic_id=MOSAIC_ID, should_check_parent=True))

	# Assert:
	assert 'Symbol mosaic restriction data is unavailable' == str(error.value)


@pytest.mark.parametrize('start_height,updated_height', [(10, 10), (1, 10)])
def test_reads_parent_at_watermark(start_height, updated_height):
	# Arrange:
	mosaic = create_symbol_mosaic(MOSAIC_ID, 0)
	mosaic['start_height'] = start_height
	mosaic['updated_at_height'] = updated_height
	with symbol_test_database(SYNC, mosaics=[mosaic]) as (config, puller):
		insert_restriction(puller, 1, MOSAIC_ID, 'address', ADDRESS, [], 10)

		# Act:
		with SymbolDatabase(config, NATIVE) as database:
			rows = database.try_get_mosaic_restrictions(MosaicRestrictionQuery(mosaic_id=MOSAIC_ID, should_check_parent=True))

	# Assert:
	assert [1] == [bytes(row.composite_hash)[0] for row in rows]


def test_concurrent_snapshot():
	# Arrange:
	with symbol_test_database(SYNC, mosaics=[create_symbol_mosaic(MOSAIC_ID, 0)]) as (config, puller):
		insert_restriction(puller, 1, MOSAIC_ID, 'address', ADDRESS, restriction_rules())
		with PausingAfterSyncStateReadSymbolDatabase(config, NATIVE) as database:
			def update():
				with puller.connection.cursor() as cursor:
					cursor.execute("UPDATE symbol_sync_state SET status = 'repairing' WHERE id = 1")
					cursor.execute('DELETE FROM symbol_mosaic_restrictions')
					cursor.execute('DELETE FROM symbol_mosaics WHERE mosaic_id = %s', (MOSAIC_ID,))

				puller.connection.commit()

			# Act:
			rows = read_during_database_snapshot(
				database, lambda: database.try_get_mosaic_restrictions(
					MosaicRestrictionQuery(mosaic_id=MOSAIC_ID, should_check_parent=True)), update)

	# Assert:
	assert [1] == [bytes(row.composite_hash)[0] for row in rows]
