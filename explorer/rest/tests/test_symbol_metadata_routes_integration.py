import tempfile

import pytest
from common.symbol.NativeMosaic import NativeMosaicInfo
from puller.model.symbol.Metadata import create_metadata_row

from rest import create_app
from rest.db.SymbolDatabase import MetadataQuery, SymbolDatabase
from rest.db.SymbolDatabaseCommon import SymbolDataUnavailable

from .test.EnvTestUtils import rest_settings_env
from .test.SymbolBlockTestUtils import create_symbol_block, create_symbol_sync_state
from .test.SymbolDatabaseTestUtils import PausingAfterSyncStateReadSymbolDatabase, read_during_database_snapshot, symbol_test_database
from .test.SymbolMosaicTestUtils import create_symbol_mosaic
from .test.SymbolNamespaceTestUtils import create_symbol_namespace
from .test.SymbolRestConfigTestUtils import write_symbol_rest_config

ADDRESS = bytes.fromhex('98FD35818960C7B18B72F49A5598FA9F712A354DB33EDE57')
OTHER = bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')
ADDRESS_TEXT = 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY'
OTHER_TEXT = 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI'
TARGET_ID = '00000000000000AF'
NATIVE = NativeMosaicInfo('72C0212E67A08BCE', 6)


def _row(number, kind, **overrides):
	return {
		'composite_hash': bytes([number]) * 32,
		'metadata_type': kind,
		'scoped_metadata_key': f'{number:016X}',
		'source_address': OTHER,
		'target_address': overrides.get('target', ADDRESS),
		'target_id': overrides.get('target_id'),
		'value_hex': overrides.get('value_hex', ''),
		'value_utf8': overrides.get('value', ''),
		'raw_payload': {},
		'updated_at_height': overrides.get('height', 10)
	}


def _seed(puller):
	with puller.connection.cursor() as cursor:
		cursor.execute(
			"INSERT INTO symbol_accounts (address, address_text, raw_payload, last_seen_height) VALUES (%s, %s, '{}', 1)",
			(ADDRESS, ADDRESS_TEXT))

	puller.connection.commit()
	mosaic = create_symbol_mosaic(TARGET_ID, 0)
	mosaic['expiration_height'] = 2
	puller.upsert_mosaic(mosaic)
	puller.upsert_namespace(create_symbol_namespace(TARGET_ID, end_height=2), [])
	for row in [
		_row(1, 'account', height=9, value='日本語', value_hex='e697a5e69cace8aa9e'),
		create_metadata_row({'metadataEntry': {
			'compositeHash': '02' * 32, 'metadataType': 1, 'scopedMetadataKey': '0000000000000002',
			'sourceAddress': OTHER.hex(), 'targetAddress': ADDRESS.hex(), 'targetId': TARGET_ID, 'value': 'ff00'
		}}, 10),
		_row(3, 'namespace', target_id=TARGET_ID),
		_row(4, 'mosaic', target=OTHER, target_id='00000000000000AA'),
		_row(5, 'account', height=11)
	]:
		puller.upsert_metadata(row)


def _expected(number, kind, target_id, value, value_hex):
	return {
		'scopedMetadataKey': f'{number:016X}', 'targetId': target_id, 'metadataType': kind,
		'senderAddress': OTHER_TEXT, 'targetAddress': ADDRESS_TEXT, 'value': value, 'valueHex': value_hex
	}


def _client(db_config):
	with tempfile.TemporaryDirectory() as directory:
		config_path = write_symbol_rest_config(directory, db_config, NATIVE.id)
		with rest_settings_env(config_path):
			app = create_app()

	return app.test_client()


@pytest.fixture(name='metadata_seeded')
def fixture_metadata_seeded():
	sync = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	with symbol_test_database(sync, [create_symbol_block(10)]) as (config, puller):
		_seed(puller)
		yield config, puller


def test_metadata_http_registration(metadata_seeded):
	# Arrange:
	config, _ = metadata_seeded
	client = _client(config)

	# Act:
	registered = {str(rule) for rule in client.application.url_map.iter_rules()}

	# Assert:
	assert {
		'/api/symbol/account/<address>/metadata', '/api/symbol/mosaic/<mosaic_id>/metadata',
		'/api/symbol/namespace/<name>/metadata'
	} <= registered


@pytest.mark.parametrize('path,expected', [
	(f'/api/symbol/account/{ADDRESS_TEXT}/metadata', [
		_expected(2, 'mosaic', TARGET_ID, '\ufffd\ufffd', 'FF00'),
		_expected(3, 'namespace', TARGET_ID, '', ''),
		_expected(1, 'account', None, '日本語', 'E697A5E69CACE8AA9E')]),
	(f'/api/symbol/account/{ADDRESS_TEXT}/metadata?metadataType=1', [
		_expected(2, 'mosaic', TARGET_ID, '\ufffd\ufffd', 'FF00')]),
	(f'/api/symbol/mosaic/{TARGET_ID}/metadata', [_expected(2, 'mosaic', TARGET_ID, '\ufffd\ufffd', 'FF00')]),
	(f'/api/symbol/namespace/{TARGET_ID}/metadata', [_expected(3, 'namespace', TARGET_ID, '', '')])
])
def test_metadata_http_success(metadata_seeded, path, expected):
	# Arrange:
	config, _ = metadata_seeded
	client = _client(config)

	# Act:
	response = client.get(path)

	# Assert:
	assert 200 == response.status_code
	assert expected == response.json


def test_targetid_override_rejected(metadata_seeded):
	# Arrange:
	config, _ = metadata_seeded
	client = _client(config)

	# Act:
	response = client.get(f'/api/symbol/mosaic/{TARGET_ID}/metadata?targetId=other')

	# Assert:
	assert 400 == response.status_code
	assert {'status': 400, 'message': 'Unsupported query parameter: targetId'} == response.json


@pytest.mark.parametrize('kind,path', [
	('account', f'/api/symbol/account/{OTHER_TEXT}/metadata'),
	('mosaic', '/api/symbol/mosaic/00000000000000BB/metadata'),
	('namespace', '/api/symbol/namespace/00000000000000BB/metadata')
])
def test_metadata_http_orphan_404(metadata_seeded, kind, path):
	# Arrange: a matching metadata row exists but the exact parent does not.
	config, puller = metadata_seeded
	client = _client(config)
	target_id = None if kind == 'account' else '00000000000000BB'
	orphan = _row(20, kind, target=OTHER, target_id=target_id, height=10)
	puller.upsert_metadata(orphan)
	with puller.connection.cursor() as cursor:
		cursor.execute('SELECT COUNT(*) FROM symbol_metadata WHERE composite_hash = %s', (orphan['composite_hash'],))
		assert (1,) == cursor.fetchone()

	# Act:
	response = client.get(path)

	# Assert:
	assert 404 == response.status_code
	assert {'status': 404, 'message': 'Resource not found'} == response.json


@pytest.mark.parametrize('path', [
	f'/api/symbol/account/{ADDRESS_TEXT}/metadata',
	f'/api/symbol/mosaic/{TARGET_ID}/metadata',
	f'/api/symbol/namespace/{TARGET_ID}/metadata'
])
def test_parent_without_metadata_empty(metadata_seeded, path):
	# Arrange: all three parents exist, with no metadata rows.
	config, puller = metadata_seeded
	with puller.connection.cursor() as cursor:
		cursor.execute('DELETE FROM symbol_metadata')

	puller.connection.commit()
	client = _client(config)

	# Act:
	response = client.get(path)

	# Assert:
	assert 200 == response.status_code
	assert [] == response.json


@pytest.mark.parametrize('field,stored_value', [
	('value_hex', 'secretpayload'),
	('source_address', bytes([0x98]) + bytes(23))
])
def test_metadata_http_corrupt(metadata_seeded, caplog, field, stored_value):
	# Arrange:
	config, puller = metadata_seeded
	with puller.connection.cursor() as cursor:
		cursor.execute(f'UPDATE symbol_metadata SET {field}=%s WHERE composite_hash=%s', (stored_value, bytes([2]) * 32))

	puller.connection.commit()
	client = _client(config)

	# Act:
	response = client.get(f'/api/symbol/mosaic/{TARGET_ID}/metadata')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json
	assert 'secretpayload' not in caplog.text
	assert 'ff00' not in caplog.text.lower()


def test_metadata_http_repairing(metadata_seeded):
	# Arrange: a missing parent must not mask the repairing state.
	config, puller = metadata_seeded
	puller.upsert_sync_state(create_symbol_sync_state(last_synced_height=10, finalized_height=10, status='repairing'))
	client = _client(config)

	# Act:
	response = client.get('/api/symbol/mosaic/00000000000000BB/metadata')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_metadata_height_desc_hash_asc(metadata_seeded):
	# Arrange:
	config, puller = metadata_seeded
	# On equal heights, key order opposes composite hash order (02 before 03).
	with puller.connection.cursor() as cursor:
		cursor.execute(
			'UPDATE symbol_metadata SET scoped_metadata_key=%s WHERE composite_hash=%s',
			('000000000000000F', bytes([2]) * 32))
		cursor.execute(
			'UPDATE symbol_metadata SET scoped_metadata_key=%s WHERE composite_hash=%s',
			('0000000000000002', bytes([3]) * 32))

	puller.connection.commit()
	query = MetadataQuery('account', ADDRESS, None, 10, 0)
	with SymbolDatabase(config, NATIVE) as database:
		# Act:
		all_rows = database.try_get_related_metadata(query)

	# Assert: equal-height rows use composite hash as a tie-breaker.
	assert [
		('000000000000000F', TARGET_ID, 'mosaic', OTHER, ADDRESS, '\ufffd\ufffd', 'ff00'),
		('0000000000000002', TARGET_ID, 'namespace', OTHER, ADDRESS, '', ''),
		('0000000000000001', None, 'account', OTHER, ADDRESS, '日本語', 'e697a5e69cace8aa9e')
	] == [(row[0], row[1], row[2], bytes(row[3]), bytes(row[4]), row[5], row[6]) for row in all_rows]


def test_metadata_past_end_is_empty(metadata_seeded):
	# Arrange: the parent and matching rows exist, but offset 100 is beyond the last row.
	config, _ = metadata_seeded
	with SymbolDatabase(config, NATIVE) as database:
		# Act:
		rows = database.try_get_related_metadata(MetadataQuery('account', ADDRESS, None, 10, 100))

	# Assert:
	assert [] == rows


def test_metadata_insert_snapshot(metadata_seeded):
	# Arrange:
	config, puller = metadata_seeded
	with PausingAfterSyncStateReadSymbolDatabase(config, NATIVE) as reader:
		def update():
			puller.upsert_metadata(_row(6, 'account', height=10))

		# Act: the writer commits on a separate connection after the reader observes sync state.
		rows = read_during_database_snapshot(
			reader, lambda: reader.try_get_related_metadata(MetadataQuery('account', ADDRESS, None, 10, 0)), update)

	# Assert: the inserted row is absent and every original field retains snapshot order.
	actual = [(row[0], row[1], row[2], bytes(row[3]), bytes(row[4]), row[5], row[6]) for row in rows]
	assert [
		('0000000000000002', TARGET_ID, 'mosaic', OTHER, ADDRESS, '\ufffd\ufffd', 'ff00'),
		('0000000000000003', TARGET_ID, 'namespace', OTHER, ADDRESS, '', ''),
		('0000000000000001', None, 'account', OTHER, ADDRESS, '日本語', 'e697a5e69cace8aa9e')
	] == actual


@pytest.mark.parametrize('kind,target,column', [
	('account', ADDRESS, 'last_seen_height'),
	('mosaic', TARGET_ID, 'updated_at_height'),
	('namespace', TARGET_ID, 'updated_at_height')
])
def test_metadata_parent_snapshot(metadata_seeded, kind, target, column):
	# Arrange: a second connection will advance the parent's height beyond the readable watermark.
	config, puller = metadata_seeded
	table, key = {
		'account': ('symbol_accounts', 'address'),
		'mosaic': ('symbol_mosaics', 'mosaic_id'),
		'namespace': ('symbol_namespaces', 'namespace_id')
	}[kind]
	query = MetadataQuery(kind, target, None if kind == 'account' else kind, 10, 0)
	with PausingAfterSyncStateReadSymbolDatabase(config, NATIVE) as reader:
		def update():
			with puller.connection.cursor() as cursor:
				cursor.execute(f'UPDATE {table} SET {column} = %s WHERE {key} = %s', (11, target))

			puller.connection.commit()

		# Act: the writer commits only after the reader establishes its snapshot.
		rows = read_during_database_snapshot(reader, lambda: reader.try_get_related_metadata(query), update)

	with SymbolDatabase(config, NATIVE) as database:
		with pytest.raises(SymbolDataUnavailable) as error:
			database.try_get_related_metadata(query)

	# Assert: the old snapshot returns its page; a fresh read sees the unsafe parent.
	expected = {
		'account': [
			('0000000000000002', TARGET_ID, 'mosaic', OTHER, ADDRESS, '\ufffd\ufffd', 'ff00'),
			('0000000000000003', TARGET_ID, 'namespace', OTHER, ADDRESS, '', ''),
			('0000000000000001', None, 'account', OTHER, ADDRESS, '日本語', 'e697a5e69cace8aa9e')],
		'mosaic': [('0000000000000002', TARGET_ID, 'mosaic', OTHER, ADDRESS, '\ufffd\ufffd', 'ff00')],
		'namespace': [('0000000000000003', TARGET_ID, 'namespace', OTHER, ADDRESS, '', '')]
	}
	assert expected[kind] == [(row[0], row[1], row[2], bytes(row[3]), bytes(row[4]), row[5], row[6]) for row in rows]
	assert 'Symbol metadata data is unavailable' == str(error.value)


@pytest.mark.parametrize('kind,target,column,value', [
	('account', ADDRESS, 'last_seen_height', 11),
	('mosaic', TARGET_ID, 'start_height', 11),
	('mosaic', TARGET_ID, 'updated_at_height', 11),
	('namespace', TARGET_ID, 'start_height', 11),
	('namespace', TARGET_ID, 'updated_at_height', 11)
])
def test_metadata_future_parent(kind, target, column, value):
	# Arrange:
	sync = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	with symbol_test_database(sync, [create_symbol_block(10)]) as (config, puller):
		_seed(puller)
		table, key = {
			'account': ('symbol_accounts', 'address'), 'mosaic': ('symbol_mosaics', 'mosaic_id'),
			'namespace': ('symbol_namespaces', 'namespace_id')
		}[kind]
		with puller.connection.cursor() as cursor:
			cursor.execute(f'UPDATE {table} SET {column} = %s WHERE {key} = %s', (value, target))

		puller.connection.commit()
		with SymbolDatabase(config, NATIVE) as database:
			# Act:
			with pytest.raises(SymbolDataUnavailable) as error:
				database.try_get_related_metadata(MetadataQuery(kind, target, None if kind == 'account' else kind, 10, 0))

	# Assert:
	assert 'Symbol metadata data is unavailable' == str(error.value)


@pytest.mark.parametrize('overrides', [
	{'status': 'initialized'},
	{'status': 'unhealthy'},
	{'status': 'repairing'},
	{'dirty_state_from_height': 11},
	{'chain_height': 11},
	{'last_synced_height': None},
	{'last_synced_block_hash': None},
	{'chain_height': None}
])
def test_metadata_unavailable_state(overrides):
	# Arrange:
	sync = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	sync.update(overrides)
	with symbol_test_database(sync, [create_symbol_block(10)]) as (config, _):
		with SymbolDatabase(config, NATIVE) as database:
			# Act:
			with pytest.raises(SymbolDataUnavailable) as error:
				database.try_get_related_metadata(MetadataQuery('mosaic', TARGET_ID, 'mosaic', 10, 0))

	# Assert:
	assert 'Symbol namespace data is unavailable' == str(error.value)


def test_metadata_missing_sync():
	# Arrange:
	with symbol_test_database() as (config, _):
		with SymbolDatabase(config, NATIVE) as database:
			# Act:
			with pytest.raises(SymbolDataUnavailable) as error:
				database.try_get_related_metadata(MetadataQuery('namespace', TARGET_ID, 'namespace', 10, 0))

	# Assert:
	assert 'Symbol namespace data is unavailable' == str(error.value)


def test_metadata_page_filters():
	# Arrange:
	sync = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	with symbol_test_database(sync, [create_symbol_block(10)]) as (config, puller):
		_seed(puller)
		for row in (
			_row(6, 'account', height=8),
			_row(7, 'mosaic', target_id=TARGET_ID, height=8),
			_row(8, 'namespace', target_id=TARGET_ID, height=8),
			_row(9, 'namespace', target_id=TARGET_ID, height=11),
			_row(10, 'mosaic', target_id=TARGET_ID, height=11),
			_row(11, 'account', height=11),
			{**_row(12, 'account', target=OTHER), 'source_address': ADDRESS}
		):
			puller.upsert_metadata(row)

		with SymbolDatabase(config, NATIVE) as database:
			cases = (
				('account', ADDRESS, None, ('0000000000000003', TARGET_ID, 'namespace')),
				('account', ADDRESS, 'account', ('0000000000000006', None, 'account')),
				('account', ADDRESS, 'mosaic', ('0000000000000007', TARGET_ID, 'mosaic')),
				('account', ADDRESS, 'namespace', ('0000000000000008', TARGET_ID, 'namespace')),
				('mosaic', TARGET_ID, 'mosaic', ('0000000000000007', TARGET_ID, 'mosaic')),
				('namespace', TARGET_ID, 'namespace', ('0000000000000008', TARGET_ID, 'namespace'))
			)
			for kind, target, metadata_type, expected_identity in cases:
				# Act:
				rows = database.try_get_related_metadata(MetadataQuery(kind, target, metadata_type, 1, 1))
				actual = [(row[0], row[1], row[2], bytes(row[3]), bytes(row[4]), row[5], row[6]) for row in rows]

				# Assert:
				assert [(*expected_identity, OTHER, ADDRESS, '', '')] == actual
