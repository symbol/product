# pylint: disable=too-many-lines  # Namespace list and detail share one HTTP/PostgreSQL integration fixture.
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import pytest
from common.symbol.NativeMosaic import NativeMosaicInfo
from puller.db.SymbolDatabase import SymbolDatabase as PullerSymbolDatabase
from symbolchain.symbol.Network import Address, Network

from rest import create_app
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.routes.symbol import setup_symbol_routes

from .test.EnvTestUtils import rest_settings_env
from .test.SymbolBlockTestUtils import create_symbol_block, create_symbol_sync_state
from .test.SymbolDatabaseTestUtils import PausingAfterSyncStateReadSymbolDatabase, read_during_database_snapshot, symbol_test_database
from .test.SymbolMosaicTestUtils import create_symbol_mosaic
from .test.SymbolNamespaceTestUtils import DEFAULT_NAMESPACE_OWNER as OWNER
from .test.SymbolNamespaceTestUtils import (
	call_with_timeout,
	create_ancestor_cycle_namespaces,
	create_namespace_descendant_rows,
	create_namespace_root_child_rows,
	create_namespace_sibling_rows,
	create_symbol_namespace,
	expected_symbol_namespace_child_dto
)

_namespace = create_symbol_namespace

NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)
ROOT_ID = 'A95F1F8A96159516'
CHILD_ID = 'E74B99BA41F4AFEE'
LEAF_ID = 'C74B99BA41F4AFEE'
SIBLING_ID = 'B74B99BA41F4AFEE'
OTHER_ROOT_ID = 'D95F1F8A96159516'
THIRD_ROOT_ID = 'B95F1F8A96159516'
MOSAIC_ID = '1234567890ABCDEF'
UNRELATED_MOSAIC_ID = '2234567890ABCDEF'
MOSAIC_OWNER = bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')


def _write_config(directory, database_config):
	db_path = Path(directory) / 'db.ini'
	db_path.write_text(
		'[symbol_db]\n'
		f'database = {database_config.database}\n'
		f'user = {database_config.user}\n'
		'password = \n'
		f'host = {database_config.host}\n'
		f'port = {database_config.port}\n',
		encoding='utf8')
	app_path = Path(directory) / 'app.config'
	app_path.write_text(
		'REST_CHAIN="symbol"\n'
		'NETWORK_NAME="testnet"\n'
		f'DATABASE_CONFIG_FILEPATH="{db_path}"\n'
		f'SYMBOL_NATIVE_MOSAIC_ID={NATIVE_MOSAIC_INFO.id!r}\n'
		'SYMBOL_ACCOUNT_REFRESH_MAX_AGE_SECONDS=7200\n'
		'SYMBOL_HARVESTING_ACTIVE_WINDOW_DAYS=7\n'
		'SYMBOL_NODE_URL="http://127.0.0.1:1"\n'
		'SYMBOL_NODE_ALLOWED_HOSTS="127.0.0.1:1"\n'
		'SYMBOL_NODE_ALLOW_LOOPBACK="true"\n'
		'SYMBOL_NODE_ALLOW_PRIVATE="false"\n',
		encoding='utf8')
	return app_path


def _create_symbol_client(  # pylint: disable=too-many-arguments,too-many-positional-arguments
	database_config, sync_state, blocks, rows, mosaics=(), alias_name_rows_by_namespace=None):
	with PullerSymbolDatabase(database_config) as database:
		database.create_tables()
		if sync_state is not None:
			database.upsert_sync_state(sync_state)
		database.upsert_blocks(blocks)
		for mosaic in mosaics:
			database.upsert_mosaic(mosaic)
		for row in rows:
			alias_name_rows = (alias_name_rows_by_namespace or {}).get(row['namespace_id'], ())
			database.upsert_namespace(row, alias_name_rows)

	with tempfile.TemporaryDirectory() as temp_directory:
		config_path = _write_config(temp_directory, database_config)
		with rest_settings_env(config_path):
			app = create_app()
	return app.test_client()


def _request_namespace_details(  # pylint: disable=too-many-arguments,too-many-positional-arguments
	sync_state, blocks, rows, namespace_ids, mosaics=(), alias_name_rows_by_namespace=None):
	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(
			database_config, sync_state, blocks, rows, mosaics, alias_name_rows_by_namespace)
		return [client.get(f'/api/symbol/namespace/{namespace_id}') for namespace_id in namespace_ids]


def test_http_items_and_empty_filters():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	blocks = [create_symbol_block(1), create_symbol_block(10)]
	rows = create_namespace_root_child_rows(ROOT_ID, CHILD_ID, NATIVE_MOSAIC_INFO.id)

	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(database_config, sync_state, blocks, rows)
		# Act:
		response = client.get('/api/symbol/namespaces?sort=ASC')
		empty_response = client.get('/api/symbol/namespaces?aliasType=2&registrationType=1')

	# Assert:
	assert 200 == response.status_code
	assert 200 == empty_response.status_code
	assert [] == empty_response.json
	assert [
		{
			'id': ROOT_ID,
			'name': ROOT_ID,
			'namespaceName': 'foo',
			'namespaceLevels': [{'name': 'foo', 'namespaceId': ROOT_ID, 'parentId': None}],
			'aliasType': 'none',
			'aliasMosaicId': None,
			'aliasAddress': None,
			'creator': str(Address(OWNER)),
			'registrationHeight': 1,
			'startTimestamp': '2026-01-01 00:00:00',
			'registrationType': 'root',
			'expirationHeight': None,
			'isUnlimitedDuration': True,
			'subNamespaceCount': 1
		},
		expected_symbol_namespace_child_dto(
			ROOT_ID, CHILD_ID, str(Address(OWNER)), NATIVE_MOSAIC_INFO.id)
	] == response.json


def test_http_filter_precedes_offset():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = [
		_namespace(ROOT_ID),
		_namespace(
			CHILD_ID, parent_id=ROOT_ID, root_id=ROOT_ID, name='bar', full_name='foo.bar', depth=2,
			registration_type='child'
		),
		_namespace(
			LEAF_ID, parent_id=ROOT_ID, root_id=ROOT_ID, name='leaf', full_name='foo.leaf', depth=2,
			registration_type='child'
		)
	]
	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(
			database_config, sync_state, [create_symbol_block(1), create_symbol_block(10)], rows)
		# Act:
		response = client.get('/api/symbol/namespaces?registrationType=1&limit=1&offset=1')

	# Assert:
	assert 200 == response.status_code
	assert [CHILD_ID] == [item['id'] for item in response.json]


def test_http_dirty_sync_returns_503():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10, dirty_state_from_height=11)
	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(
			database_config, sync_state, [create_symbol_block(10)], [])
		# Act:
		response = client.get('/api/symbol/namespaces?aliasType=2')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_http_cycle_returns_503():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = create_ancestor_cycle_namespaces(ROOT_ID, CHILD_ID, LEAF_ID, NATIVE_MOSAIC_INFO.id)
	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(
			database_config, sync_state, [create_symbol_block(1), create_symbol_block(10)], rows)
		# Act:
		response = call_with_timeout(
			lambda: client.get('/api/symbol/namespaces?aliasType=1'),
			'Namespace HTTP request did not finish within the timeout')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_http_missing_parent_returns_503():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = [
		_namespace(ROOT_ID),
		_namespace(LEAF_ID, parent_id=CHILD_ID, root_id=ROOT_ID, depth=3, registration_type='child')
	]
	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(
			database_config, sync_state, [create_symbol_block(1), create_symbol_block(10)], rows)
		# Act:
		response = client.get('/api/symbol/namespaces?registrationType=0')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_http_ignores_unrelated_orphan():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = [
		_namespace(ROOT_ID),
		_namespace(
			'D95F1F8A96159516', parent_id=LEAF_ID, root_id='D95F1F8A96159516', depth=3,
			registration_type='child')
	]
	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(
			database_config, sync_state, [create_symbol_block(1), create_symbol_block(10)], rows)
		# Act:
		response = client.get('/api/symbol/namespaces?registrationType=0')

	# Assert:
	assert 200 == response.status_code
	assert [ROOT_ID] == [item['id'] for item in response.json]


@pytest.mark.parametrize('height_field', ['updated_at_height', 'start_height'])
def test_http_height_filter_paginates(height_field):
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = [
		_namespace(ROOT_ID, start_height=10, updated_at_height=10, alias_type='none'),
		_namespace(OTHER_ROOT_ID, start_height=5, updated_at_height=10, alias_type='none'),
		_namespace(THIRD_ROOT_ID, start_height=9, updated_at_height=10, alias_type='none'),
	]
	rows[2][height_field] = 11
	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(
			database_config, sync_state, [create_symbol_block(5), create_symbol_block(10)], rows)
		# Act:
		response = client.get(
			'/api/symbol/namespaces?aliasType=0&registrationType=0&sort=DESC&limit=1&offset=1')

	# Assert:
	assert 200 == response.status_code
	assert [OTHER_ROOT_ID] == [item['id'] for item in response.json]


def test_http_height_equal_included():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = [_namespace(ROOT_ID, start_height=10, updated_at_height=10)]
	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(database_config, sync_state, [create_symbol_block(10)], rows)
		# Act:
		response = client.get('/api/symbol/namespaces?registrationType=0')

	# Assert:
	assert 200 == response.status_code
	assert [ROOT_ID] == [item['id'] for item in response.json]


@pytest.mark.parametrize(('query', 'row'), [
	('limit=1', _namespace(ROOT_ID, start_height=2, updated_at_height=11)),
	('limit=1&offset=1', _namespace(ROOT_ID, start_height=2, updated_at_height=10)),
])
def test_http_empty_height_page(query, row):
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(
			database_config, sync_state, [create_symbol_block(2), create_symbol_block(10)], [row])
		# Act:
		response = client.get(f'/api/symbol/namespaces?{query}')

	# Assert:
	assert 200 == response.status_code
	assert [] == response.json


def test_http_ignores_high_sibling():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = create_namespace_sibling_rows(ROOT_ID, CHILD_ID, LEAF_ID, NATIVE_MOSAIC_INFO.id)
	rows[2]['updated_at_height'] = 11
	rows.append(_namespace('D95F1F8A96159516', updated_at_height=11))
	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(
			database_config, sync_state, [create_symbol_block(1), create_symbol_block(10)], rows)
		# Act:
		response = client.get('/api/symbol/namespaces?aliasType=1')

	# Assert:
	assert 200 == response.status_code
	assert [expected_symbol_namespace_child_dto(
		ROOT_ID, CHILD_ID, str(Address(OWNER)), NATIVE_MOSAIC_INFO.id)] == response.json


def test_http_ignores_sibling_descendant():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = create_namespace_sibling_rows(
		ROOT_ID, CHILD_ID, LEAF_ID, NATIVE_MOSAIC_INFO.id, descendant_id='D95F1F8A96159516')
	rows[3]['updated_at_height'] = 11
	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(
			database_config, sync_state, [create_symbol_block(1), create_symbol_block(10)], rows)
		# Act:
		response = client.get('/api/symbol/namespaces?aliasType=1')

	# Assert:
	assert 200 == response.status_code
	assert [expected_symbol_namespace_child_dto(
		ROOT_ID, CHILD_ID, str(Address(OWNER)), '72C0212E67A08BCE')] == response.json


@pytest.mark.parametrize('height_field', ['updated_at_height', 'start_height'])
def test_http_child_descendant_503(height_field):
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = create_namespace_descendant_rows(ROOT_ID, CHILD_ID, LEAF_ID, NATIVE_MOSAIC_INFO.id)
	rows[2][height_field] = 11
	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(
			database_config, sync_state, [create_symbol_block(1), create_symbol_block(10)], rows)
		# Act:
		response = client.get('/api/symbol/namespaces?aliasType=1')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


@pytest.mark.parametrize('height_field', ['updated_at_height', 'start_height'])
def test_http_child_ancestor_503(height_field):
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = create_namespace_root_child_rows(ROOT_ID, CHILD_ID, NATIVE_MOSAIC_INFO.id)
	rows[0][height_field] = 11
	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(
			database_config, sync_state, [create_symbol_block(1), create_symbol_block(10)], rows)
		# Act:
		response = client.get('/api/symbol/namespaces?aliasType=1')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_http_high_candidate_filtered():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = create_namespace_root_child_rows(ROOT_ID, CHILD_ID, NATIVE_MOSAIC_INFO.id)
	rows[1]['updated_at_height'] = 11
	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(
			database_config, sync_state, [create_symbol_block(1), create_symbol_block(10)], rows)
		# Act:
		response = client.get('/api/symbol/namespaces?aliasType=1')

	# Assert:
	assert 200 == response.status_code
	assert [] == response.json


@pytest.mark.parametrize('height_field', ['updated_at_height', 'start_height'])
def test_http_root_high_child_503(height_field):
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = create_namespace_sibling_rows(ROOT_ID, CHILD_ID, LEAF_ID, NATIVE_MOSAIC_INFO.id)
	rows[2][height_field] = 11
	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(
			database_config, sync_state, [create_symbol_block(1), create_symbol_block(10)], rows)
		# Act:
		response = client.get('/api/symbol/namespaces?registrationType=0')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_http_root_bad_depth_503():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = [
		_namespace(ROOT_ID),
		_namespace(
			CHILD_ID, parent_id=ROOT_ID, root_id=ROOT_ID, depth=3, registration_type='child'),
	]
	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(
			database_config, sync_state, [create_symbol_block(1), create_symbol_block(10)], rows)
		# Act:
		response = client.get('/api/symbol/namespaces?registrationType=0')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def _assert_unavailable(response):
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def _detail_rows():
	return [
		_namespace(ROOT_ID, name='root', full_name='root', start_height=1, end_height=2),
		_namespace(
			CHILD_ID, parent_id=ROOT_ID, root_id=ROOT_ID, name='aaa', full_name='root.aaa', depth=2,
			registration_type='child', start_height=2, end_height=2, alias_type='mosaic', alias_mosaic_id=MOSAIC_ID),
		_namespace(
			LEAF_ID, parent_id=CHILD_ID, root_id=ROOT_ID, name='leaf', full_name='root.aaa.leaf', depth=3,
			registration_type='child', start_height=3, alias_type='mosaic', alias_mosaic_id=MOSAIC_ID),
		_namespace(
			SIBLING_ID, parent_id=ROOT_ID, root_id=ROOT_ID, name='zzz', full_name='root.zzz', depth=2,
			registration_type='child', alias_type='address', alias_address=MOSAIC_OWNER),
		_namespace(
			OTHER_ROOT_ID, name='other', full_name='other', alias_type='mosaic', alias_mosaic_id=UNRELATED_MOSAIC_ID)
	]


def _detail_mosaics():
	return [
		{
			**create_symbol_mosaic(MOSAIC_ID, 3),
			'owner_address': MOSAIC_OWNER, 'start_height': 4, 'duration': 5, 'expiration_height': 9,
			'supply': 123456789, 'supply_mutable': True, 'transferable': True, 'restrictable': True, 'revokable': True,
		},
		{
			**create_symbol_mosaic(UNRELATED_MOSAIC_ID, 0),
			'owner_address': MOSAIC_OWNER, 'start_height': 4, 'expiration_height': 7, 'supply': 99,
		}
	]


def _detail_alias_names():
	return {
		CHILD_ID: [
			{'artifact_type': 'namespace', 'artifact_id': CHILD_ID, 'name': 'root.aaa', 'updated_at_height': 2},
			{'artifact_type': 'mosaic', 'artifact_id': MOSAIC_ID, 'name': 'saved.alias', 'updated_at_height': 2},
			{'artifact_type': 'mosaic', 'artifact_id': MOSAIC_ID, 'name': 'unrelated.name', 'updated_at_height': 2},
		],
		LEAF_ID: [
			{'artifact_type': 'namespace', 'artifact_id': LEAF_ID, 'name': 'root.aaa.leaf', 'updated_at_height': 3},
			{'artifact_type': 'mosaic', 'artifact_id': MOSAIC_ID, 'name': 'leaf.alias', 'updated_at_height': 3},
		],
		SIBLING_ID: [{'artifact_type': 'namespace', 'artifact_id': SIBLING_ID, 'name': 'root.zzz', 'updated_at_height': 1}],
		OTHER_ROOT_ID: [
			{'artifact_type': 'namespace', 'artifact_id': OTHER_ROOT_ID, 'name': 'other', 'updated_at_height': 1},
			{'artifact_type': 'mosaic', 'artifact_id': UNRELATED_MOSAIC_ID, 'name': 'other.mosaic', 'updated_at_height': 1}
		]
	}


def _expected_detail_mosaic():
	return {
		'id': MOSAIC_ID, 'creator': str(Address(MOSAIC_OWNER)), 'aliasNames': ['leaf.alias', 'saved.alias', 'unrelated.name'],
		'supply': 123456789, 'divisibility': 3, 'registrationHeight': 4, 'expirationHeight': 9, 'value': 123456.789,
		'isUnlimitedDuration': False, 'isSupplyMutable': True, 'isTransferable': True, 'isRestrictable': True, 'isRevokable': True,
		'startTimestamp': '2026-01-04 00:00:00'
	}


# Namespace detail test names intentionally spell out the contract condition and result.
# pylint: disable=invalid-name
def test_namespace_detail_returns_root_and_child_fields():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	blocks = [create_symbol_block(height) for height in (1, 2, 3, 4, 10)]
	rows = _detail_rows()
	expected_mosaic = _expected_detail_mosaic()

	# Act:
	root_response, child_response = _request_namespace_details(
		sync_state, blocks, rows, [ROOT_ID, CHILD_ID], _detail_mosaics(), _detail_alias_names())

	# Assert:
	assert 200 == root_response.status_code
	assert {
		'id': ROOT_ID, 'name': ROOT_ID, 'namespaceName': 'root',
		'namespaceLevels': [{'name': 'root', 'namespaceId': ROOT_ID, 'parentId': None}],
		'aliasType': 'none', 'aliasMosaicId': None, 'aliasAddress': None,
		'creator': str(Address(OWNER)),
		'registrationHeight': 1, 'startTimestamp': '2026-01-01 00:00:00', 'registrationType': 'root',
		'expirationHeight': 2, 'isUnlimitedDuration': False, 'subNamespaceCount': 3,
		'subNamespaces': [
			{'namespaceId': CHILD_ID, 'namespaceName': 'root.aaa', 'parentId': ROOT_ID},
			{'namespaceId': LEAF_ID, 'namespaceName': 'root.aaa.leaf', 'parentId': CHILD_ID},
			{'namespaceId': SIBLING_ID, 'namespaceName': 'root.zzz', 'parentId': ROOT_ID}
		],
		'namespaceMosaics': [
			{'namespaceId': CHILD_ID, 'namespaceName': 'root.aaa', 'data': [expected_mosaic]},
			{'namespaceId': LEAF_ID, 'namespaceName': 'root.aaa.leaf', 'data': [expected_mosaic]}
		]
	} == root_response.json
	assert 200 == child_response.status_code
	assert {
		'id': CHILD_ID, 'name': CHILD_ID, 'namespaceName': 'root.aaa',
		'namespaceLevels': [
			{'name': 'root', 'namespaceId': ROOT_ID, 'parentId': None},
			{'name': 'aaa', 'namespaceId': CHILD_ID, 'parentId': ROOT_ID}
		],
		'aliasType': 'mosaic', 'aliasMosaicId': MOSAIC_ID, 'aliasAddress': None,
		'creator': str(Address(OWNER)),
		'registrationHeight': 2, 'startTimestamp': '2026-01-02 00:00:00', 'registrationType': 'child',
		'expirationHeight': 2, 'isUnlimitedDuration': False, 'subNamespaceCount': 1,
		'subNamespaces': [{'namespaceId': LEAF_ID, 'namespaceName': 'root.aaa.leaf', 'parentId': CHILD_ID}],
		'namespaceMosaics': [
			{'namespaceId': CHILD_ID, 'namespaceName': 'root.aaa', 'data': [expected_mosaic]},
			{'namespaceId': LEAF_ID, 'namespaceName': 'root.aaa.leaf', 'data': [expected_mosaic]}
		]
	} == child_response.json


def test_namespace_detail_name_and_lowercase_id_return_same_json():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	row = _namespace(ROOT_ID, name='symbol', full_name='symbol')
	expected = {
		'id': ROOT_ID, 'name': ROOT_ID, 'namespaceName': 'symbol',
		'namespaceLevels': [{'name': 'symbol', 'namespaceId': ROOT_ID, 'parentId': None}],
		'aliasType': 'none', 'aliasMosaicId': None, 'aliasAddress': None,
		'creator': str(Address(OWNER)),
		'registrationHeight': 1, 'startTimestamp': '2026-01-01 00:00:00', 'registrationType': 'root',
		'expirationHeight': None, 'isUnlimitedDuration': True, 'subNamespaceCount': 0,
		'subNamespaces': [], 'namespaceMosaics': []
	}

	# Act:
	name_response, id_response = _request_namespace_details(
		sync_state, [create_symbol_block(1), create_symbol_block(10)], [row], ['symbol', ROOT_ID.lower()])

	# Assert:
	assert 200 == name_response.status_code
	assert expected == name_response.json
	assert 200 == id_response.status_code
	assert expected == id_response.json


def test_namespace_detail_uses_id_when_leaf_name_is_missing():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = _detail_rows()
	rows[2]['name'] = None
	rows[2]['full_name'] = None

	# Act:
	response, = _request_namespace_details(
		sync_state, [create_symbol_block(height) for height in (1, 2, 3, 4, 10)], rows, [LEAF_ID],
		_detail_mosaics(), _detail_alias_names())

	# Assert:
	assert 200 == response.status_code
	assert {
		'id': LEAF_ID, 'name': LEAF_ID, 'namespaceName': LEAF_ID,
		'namespaceLevels': [
			{'name': 'root', 'namespaceId': ROOT_ID, 'parentId': None},
			{'name': 'aaa', 'namespaceId': CHILD_ID, 'parentId': ROOT_ID},
			{'name': LEAF_ID, 'namespaceId': LEAF_ID, 'parentId': CHILD_ID}
		],
		'aliasType': 'mosaic', 'aliasMosaicId': MOSAIC_ID, 'aliasAddress': None,
		'creator': str(Address(OWNER)),
		'registrationHeight': 3, 'startTimestamp': '2026-01-03 00:00:00', 'registrationType': 'child',
		'expirationHeight': None, 'isUnlimitedDuration': True, 'subNamespaceCount': 0, 'subNamespaces': [],
		'namespaceMosaics': [
			{'namespaceId': LEAF_ID, 'namespaceName': LEAF_ID, 'data': [_expected_detail_mosaic()]}
		]
	} == response.json


def test_namespace_detail_returns_address_alias_for_sibling():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)

	# Act:
	response, = _request_namespace_details(
		sync_state, [create_symbol_block(height) for height in (1, 2, 3, 4, 10)], _detail_rows(), [SIBLING_ID],
		_detail_mosaics(), _detail_alias_names())

	# Assert:
	assert 200 == response.status_code
	assert 'address' == response.json['aliasType']
	assert str(Address(MOSAIC_OWNER)) == response.json['aliasAddress']
	assert [] == response.json['namespaceMosaics']
	assert [] == response.json['subNamespaces']


def test_namespace_detail_returns_404_when_target_is_missing():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)

	# Act:
	response, = _request_namespace_details(
		sync_state, [create_symbol_block(1), create_symbol_block(10)], [_namespace(ROOT_ID)], ['F95F1F8A96159516'])

	# Assert:
	assert 404 == response.status_code
	assert {'status': 404, 'message': 'Resource not found'} == response.json


def test_namespace_detail_returns_null_for_missing_start_blocks():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = [
		_namespace(ROOT_ID, name='root', full_name='root', start_height=2),
		_namespace(
			CHILD_ID, parent_id=ROOT_ID, root_id=ROOT_ID, name='child', full_name='root.child', depth=2,
			registration_type='child', start_height=3, alias_type='mosaic', alias_mosaic_id=MOSAIC_ID),
		_namespace(
			LEAF_ID, parent_id=CHILD_ID, root_id=ROOT_ID, name='leaf', full_name='root.child.leaf', depth=3,
			registration_type='child', start_height=5, alias_type='mosaic', alias_mosaic_id=UNRELATED_MOSAIC_ID)
	]
	mosaics = [
		{**create_symbol_mosaic(MOSAIC_ID, 2), 'start_height': 4, 'supply': 1000},
		{**create_symbol_mosaic(UNRELATED_MOSAIC_ID, 0), 'start_height': 6, 'supply': 99}
	]

	# Act:
	root_response, child_response = _request_namespace_details(
		sync_state, [create_symbol_block(height) for height in (2, 4, 10)], rows, [ROOT_ID, CHILD_ID], mosaics)

	# Assert:
	assert 200 == root_response.status_code
	assert '2026-01-02 00:00:00' == root_response.json['startTimestamp']
	assert ['2026-01-04 00:00:00', None] == [
		group['data'][0]['startTimestamp'] for group in root_response.json['namespaceMosaics']]
	assert 200 == child_response.status_code
	assert None is child_response.json['startTimestamp']
	assert '2026-01-04 00:00:00' == child_response.json['namespaceMosaics'][0]['data'][0]['startTimestamp']
	assert None is child_response.json['namespaceMosaics'][1]['data'][0]['startTimestamp']


def test_namespace_detail_preserves_zero_mosaic_supply():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = create_namespace_root_child_rows(ROOT_ID, CHILD_ID, MOSAIC_ID)
	mosaic = {**create_symbol_mosaic(MOSAIC_ID, 6), 'start_height': 4, 'supply': 0}
	alias_names = {
		CHILD_ID: [{'artifact_type': 'mosaic', 'artifact_id': MOSAIC_ID, 'name': 'foo.bar', 'updated_at_height': 1}]}

	# Act:
	response, = _request_namespace_details(
		sync_state, [create_symbol_block(height) for height in (1, 4, 10)], rows, [ROOT_ID], [mosaic], alias_names)

	# Assert:
	assert 200 == response.status_code
	assert [{
		'id': MOSAIC_ID,
		'creator': str(Address(MOSAIC_OWNER)),
		'aliasNames': ['foo.bar'],
		'supply': 0,
		'divisibility': 6,
		'registrationHeight': 4,
		'expirationHeight': None,
		'value': 0.0,
		'isUnlimitedDuration': True,
		'isSupplyMutable': False,
		'isTransferable': False,
		'isRestrictable': False,
		'isRevokable': False,
		'startTimestamp': '2026-01-04 00:00:00'
	}] == response.json['namespaceMosaics'][0]['data']


def test_namespace_detail_follows_saved_parent_relationships():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = [
		_namespace(ROOT_ID, name='root', full_name='root'),
		_namespace(
			CHILD_ID, parent_id=ROOT_ID, root_id=ROOT_ID, name='child', full_name='elsewhere', depth=2,
			registration_type='child'),
		_namespace(OTHER_ROOT_ID, name='fake', full_name='root.fake')
	]

	# Act:
	response, = _request_namespace_details(
		sync_state, [create_symbol_block(1), create_symbol_block(10)], rows, [ROOT_ID])

	# Assert:
	assert 200 == response.status_code
	assert 1 == response.json['subNamespaceCount']
	assert [{'namespaceId': CHILD_ID, 'namespaceName': 'elsewhere', 'parentId': ROOT_ID}] == response.json['subNamespaces']
	assert [] == response.json['namespaceMosaics']


def test_namespace_detail_returns_404_when_target_is_deleted():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = [_namespace(ROOT_ID)]
	with symbol_test_database() as (database_config, puller_database):
		puller_database.upsert_sync_state(sync_state)
		puller_database.upsert_blocks([create_symbol_block(1), create_symbol_block(10)])
		puller_database.upsert_namespace(rows[0], [])
		with tempfile.TemporaryDirectory() as temp_directory:
			config_path = _write_config(temp_directory, database_config)
			with rest_settings_env(config_path):
				app = create_app()
			client = app.test_client()
			puller_database.delete_namespace(ROOT_ID)

			# Act:
			response = client.get(f'/api/symbol/namespace/{ROOT_ID}')

	# Assert:
	assert 404 == response.status_code
	assert {'status': 404, 'message': 'Resource not found'} == response.json


def test_namespace_detail_returns_503_when_target_is_missing_during_repair():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10, status='repairing')

	# Act:
	response, = _request_namespace_details(
		sync_state, [create_symbol_block(10)], [], [ROOT_ID])

	# Assert:
	_assert_unavailable(response)


def test_namespace_detail_excludes_deleted_descendant():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = create_namespace_descendant_rows(ROOT_ID, CHILD_ID, LEAF_ID, MOSAIC_ID)
	rows[1]['alias_type'] = 'none'
	rows[1]['alias_mosaic_id'] = None
	with symbol_test_database() as (database_config, puller_database):
		puller_database.upsert_sync_state(sync_state)
		puller_database.upsert_blocks([create_symbol_block(height) for height in (1, 2, 3, 10)])
		for row in rows:
			puller_database.upsert_namespace(row, [])
		with tempfile.TemporaryDirectory() as temp_directory:
			config_path = _write_config(temp_directory, database_config)
			with rest_settings_env(config_path):
				client = create_app().test_client()
			puller_database.delete_namespace(LEAF_ID)

			# Act:
			response = client.get(f'/api/symbol/namespace/{ROOT_ID}')

	# Assert:
	assert 200 == response.status_code
	assert 1 == response.json['subNamespaceCount']
	assert [{'namespaceId': CHILD_ID, 'namespaceName': 'foo.bar', 'parentId': ROOT_ID}] == response.json['subNamespaces']


@pytest.mark.parametrize('overrides', [
	{'status': 'repairing'},
	{'status': 'unhealthy'},
	{'dirty_state_from_height': 0},
	{'dirty_state_from_height': 1},
	{'dirty_state_from_height': 10},
	{'dirty_state_from_height': 11},
	{'chain_height': 9},
	{'last_synced_block_hash': None},
])
def test_namespace_detail_returns_503_when_sync_state_is_unavailable(overrides):
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10, **overrides)

	# Act:
	response, = _request_namespace_details(
		sync_state, [create_symbol_block(1), create_symbol_block(10)], [_namespace(ROOT_ID)], [ROOT_ID])

	# Assert:
	_assert_unavailable(response)


def test_namespace_detail_returns_503_when_sync_state_is_missing():
	# Arrange:
	blocks = [create_symbol_block(10)]

	# Act:
	response, = _request_namespace_details(None, blocks, [_namespace(ROOT_ID)], [ROOT_ID])

	# Assert:
	_assert_unavailable(response)


def test_namespace_detail_scopes_unsafe_sibling_to_selected_family():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = create_namespace_sibling_rows(ROOT_ID, CHILD_ID, SIBLING_ID, MOSAIC_ID)
	rows[2]['updated_at_height'] = 11

	# Act:
	child_response, root_response = _request_namespace_details(
		sync_state, [create_symbol_block(1), create_symbol_block(10)], rows, [CHILD_ID, ROOT_ID],
		[create_symbol_mosaic(MOSAIC_ID, 0)])

	# Assert:
	assert 200 == child_response.status_code
	_assert_unavailable(root_response)


def test_namespace_detail_returns_503_when_linked_mosaic_exceeds_watermark():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = create_namespace_root_child_rows(ROOT_ID, CHILD_ID, MOSAIC_ID)
	mosaic = {**create_symbol_mosaic(MOSAIC_ID, 0), 'updated_at_height': 11}

	# Act:
	response, = _request_namespace_details(
		sync_state, [create_symbol_block(1), create_symbol_block(10)], rows, [CHILD_ID], [mosaic])

	# Assert:
	_assert_unavailable(response)


def test_namespace_detail_returns_503_when_linked_mosaic_starts_above_watermark():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = create_namespace_root_child_rows(ROOT_ID, CHILD_ID, MOSAIC_ID)
	mosaic = {**create_symbol_mosaic(MOSAIC_ID, 0), 'start_height': 11}

	# Act:
	response, = _request_namespace_details(
		sync_state, [create_symbol_block(1), create_symbol_block(10)], rows, [CHILD_ID], [mosaic])

	# Assert:
	_assert_unavailable(response)


@pytest.mark.parametrize('row_index,field', [
	(0, 'updated_at_height'), (0, 'start_height'),
	(1, 'updated_at_height'), (1, 'start_height'),
	(2, 'updated_at_height'), (2, 'start_height')
])
def test_namespace_detail_returns_503_when_relevant_namespace_exceeds_watermark(row_index, field):
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = _detail_rows()
	rows[row_index][field] = 11

	# Act:
	response, = _request_namespace_details(
		sync_state, [create_symbol_block(1), create_symbol_block(10)], rows, [CHILD_ID],
		_detail_mosaics(), _detail_alias_names())

	# Assert:
	_assert_unavailable(response)


def test_namespace_detail_returns_503_when_ancestor_chain_contains_cycle():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = create_ancestor_cycle_namespaces(ROOT_ID, CHILD_ID, LEAF_ID, MOSAIC_ID)

	# Act:
	response, = _request_namespace_details(
		sync_state, [create_symbol_block(1), create_symbol_block(10)], rows, [LEAF_ID],
		[create_symbol_mosaic(MOSAIC_ID, 0)])

	# Assert:
	_assert_unavailable(response)


def test_namespace_detail_returns_503_when_target_is_in_ancestor_cycle():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = create_ancestor_cycle_namespaces(ROOT_ID, CHILD_ID, LEAF_ID, MOSAIC_ID)
	with symbol_test_database() as (database_config, _):
		client = _create_symbol_client(database_config, sync_state, [create_symbol_block(1), create_symbol_block(10)], rows)

		# Act:
		response = call_with_timeout(
			lambda: client.get(f'/api/symbol/namespace/{ROOT_ID}'),
			'Namespace detail request did not finish when the target is in a cycle')

	# Assert:
	_assert_unavailable(response)


def test_namespace_detail_returns_503_when_root_family_is_inconsistent():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = [
		_namespace(ROOT_ID, name='root', full_name='root'),
		_namespace(
			CHILD_ID, parent_id=OTHER_ROOT_ID, root_id=ROOT_ID, name='child', full_name='root.child', depth=2,
			registration_type='child')
	]

	# Act:
	response, = _request_namespace_details(
		sync_state, [create_symbol_block(1), create_symbol_block(10)], rows, [ROOT_ID])

	# Assert:
	_assert_unavailable(response)


def test_namespace_detail_returns_503_when_ancestor_is_missing():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = [
		_namespace(ROOT_ID),
		_namespace(LEAF_ID, parent_id=CHILD_ID, root_id=ROOT_ID, depth=3, registration_type='child')
	]

	# Act:
	response, = _request_namespace_details(
		sync_state, [create_symbol_block(1), create_symbol_block(10)], rows, [LEAF_ID])

	# Assert:
	_assert_unavailable(response)


def test_namespace_detail_returns_503_when_linked_mosaic_row_is_missing():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = create_namespace_root_child_rows(ROOT_ID, CHILD_ID, MOSAIC_ID)

	# Act:
	response, = _request_namespace_details(
		sync_state, [create_symbol_block(1), create_symbol_block(10)], rows, [ROOT_ID])

	# Assert:
	_assert_unavailable(response)


@pytest.mark.parametrize('malformed_id', [
	'+000000000000001',
	' 000000000000001',
	'１２３４５６７８９０１２３４５６'
])
def test_namespace_detail_returns_503_when_saved_mosaic_link_id_is_invalid(malformed_id):
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = create_namespace_root_child_rows(ROOT_ID, CHILD_ID, malformed_id)

	# Act:
	response, = _request_namespace_details(
		sync_state, [create_symbol_block(1), create_symbol_block(10)], rows, [ROOT_ID],
		[create_symbol_mosaic(malformed_id, 6)])

	# Assert:
	_assert_unavailable(response)


def test_namespace_detail_returns_503_when_saved_mosaic_link_id_is_null():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = create_namespace_root_child_rows(ROOT_ID, CHILD_ID, MOSAIC_ID)
	rows[1]['alias_mosaic_id'] = None

	# Act:
	response, = _request_namespace_details(
		sync_state, [create_symbol_block(1), create_symbol_block(10)], rows, [ROOT_ID])

	# Assert:
	_assert_unavailable(response)


def test_namespace_detail_returns_503_when_root_depth_is_inconsistent():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	rows = [_namespace(ROOT_ID, depth=2)]

	# Act:
	response, = _request_namespace_details(
		sync_state, [create_symbol_block(1), create_symbol_block(10)], rows, [ROOT_ID])

	# Assert:
	_assert_unavailable(response)


def test_namespace_detail_keeps_related_data_in_one_repeatable_read_snapshot():
	# pylint: disable=too-many-locals
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=10, finalized_height=10)
	old_root = _namespace(ROOT_ID, name='old', full_name='old', alias_type='mosaic', alias_mosaic_id=MOSAIC_ID)
	old_child = _namespace(
		CHILD_ID, parent_id=ROOT_ID, root_id=ROOT_ID, name='child', full_name='old.child', depth=2,
		registration_type='child')
	new_root = _namespace(ROOT_ID, name='new', full_name='new', alias_type='mosaic', alias_mosaic_id=UNRELATED_MOSAIC_ID)
	new_child = _namespace(
		SIBLING_ID, parent_id=ROOT_ID, root_id=ROOT_ID, name='fresh', full_name='new.fresh', depth=2,
		registration_type='child')
	old_mosaic = {**create_symbol_mosaic(MOSAIC_ID, 1), 'start_height': 2, 'supply': 111}
	updated_old_mosaic = {**old_mosaic, 'divisibility': 4, 'supply': 222}
	new_mosaic = {**create_symbol_mosaic(UNRELATED_MOSAIC_ID, 2), 'start_height': 3, 'supply': 9876}
	old_aliases = [{'artifact_type': 'mosaic', 'artifact_id': MOSAIC_ID, 'name': 'old', 'updated_at_height': 1}]
	new_aliases = [{'artifact_type': 'mosaic', 'artifact_id': UNRELATED_MOSAIC_ID, 'name': 'new', 'updated_at_height': 1}]
	blocks = [create_symbol_block(height) for height in (1, 2, 3, 10)]
	with symbol_test_database(sync_state, blocks, [old_mosaic]) as (database_config, puller_database):
		puller_database.upsert_namespace(old_root, old_aliases)
		puller_database.upsert_namespace(old_child, [])
		database = PausingAfterSyncStateReadSymbolDatabase(database_config)
		try:
			def setup_facade(app):
				app.extensions['symbol_database'] = database
				return SymbolRestFacade(database, object(), NATIVE_MOSAIC_INFO, Network.TESTNET)

			def update_related_data():
				# pylint: disable=protected-access
				with puller_database._database_transaction() as cursor:
					PullerSymbolDatabase._execute_delete_namespace(cursor, CHILD_ID)
					PullerSymbolDatabase._execute_upsert_namespace(cursor, new_root, new_aliases)
					PullerSymbolDatabase._execute_upsert_namespace(cursor, new_child, [])
					PullerSymbolDatabase._execute_upsert_mosaic(cursor, updated_old_mosaic)
					PullerSymbolDatabase._execute_upsert_mosaic(cursor, new_mosaic)
					cursor.execute(
						'UPDATE symbol_blocks SET timestamp = %s WHERE height = %s',
						(datetime(2027, 2, 3, tzinfo=timezone.utc), 1))
				# pylint: enable=protected-access

			with tempfile.TemporaryDirectory() as temp_directory:
				config_path = _write_config(temp_directory, database_config)
				with rest_settings_env(config_path):
					app = create_app({'symbol': (setup_facade, setup_symbol_routes)})
					client = app.test_client()

					# Act:
					old_response = read_during_database_snapshot(
						database,
						lambda: client.get(f'/api/symbol/namespace/{ROOT_ID}'),
						update_related_data)
					new_response = client.get(f'/api/symbol/namespace/{ROOT_ID}')
		finally:
			database.close()

	# Assert:
	assert 200 == old_response.status_code
	assert {
		'id': ROOT_ID, 'namespaceName': 'old', 'startTimestamp': '2026-01-01 00:00:00', 'aliasMosaicId': MOSAIC_ID,
		'subNamespaceCount': 1,
		'subNamespaces': [{'namespaceId': CHILD_ID, 'namespaceName': 'old.child', 'parentId': ROOT_ID}],
		'namespaceMosaics': [{'namespaceId': ROOT_ID, 'namespaceName': 'old', 'data': [{
			'id': MOSAIC_ID, 'creator': str(Address(MOSAIC_OWNER)), 'aliasNames': ['old'],
			'supply': 111, 'divisibility': 1, 'registrationHeight': 2, 'expirationHeight': None, 'value': 11.1,
			'isUnlimitedDuration': True, 'isSupplyMutable': False, 'isTransferable': False,
			'isRestrictable': False, 'isRevokable': False,
			'startTimestamp': '2026-01-02 00:00:00'}]}]
	} == {key: old_response.json[key] for key in (
		'id', 'namespaceName', 'startTimestamp', 'aliasMosaicId', 'subNamespaceCount', 'subNamespaces', 'namespaceMosaics')}
	assert 200 == new_response.status_code
	assert {
		'id': ROOT_ID, 'namespaceName': 'new', 'startTimestamp': '2027-02-03 00:00:00', 'aliasMosaicId': UNRELATED_MOSAIC_ID,
		'subNamespaceCount': 1,
		'subNamespaces': [{'namespaceId': SIBLING_ID, 'namespaceName': 'new.fresh', 'parentId': ROOT_ID}],
		'namespaceMosaics': [{'namespaceId': ROOT_ID, 'namespaceName': 'new', 'data': [{
			'id': UNRELATED_MOSAIC_ID, 'creator': str(Address(MOSAIC_OWNER)), 'aliasNames': ['new'],
			'supply': 9876, 'divisibility': 2, 'registrationHeight': 3, 'expirationHeight': None, 'value': 98.76,
			'isUnlimitedDuration': True, 'isSupplyMutable': False, 'isTransferable': False,
			'isRestrictable': False, 'isRevokable': False,
			'startTimestamp': '2026-01-03 00:00:00'}]}]
	} == {key: new_response.json[key] for key in (
		'id', 'namespaceName', 'startTimestamp', 'aliasMosaicId', 'subNamespaceCount', 'subNamespaces', 'namespaceMosaics')}
