import tempfile
from pathlib import Path

import pytest
from common.symbol.NativeMosaic import NativeMosaicInfo
from puller.db.SymbolDatabase import SymbolDatabase as PullerSymbolDatabase
from symbolchain.symbol.Network import Address

from rest import create_app

from .test.EnvTestUtils import rest_settings_env
from .test.SymbolBlockTestUtils import create_symbol_block, create_symbol_sync_state
from .test.SymbolDatabaseTestUtils import symbol_test_database
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
OTHER_ROOT_ID = 'D95F1F8A96159516'
THIRD_ROOT_ID = 'B95F1F8A96159516'


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
		'SYMBOL_NODE_URL="http://127.0.0.1:1"\n'
		'SYMBOL_NODE_ALLOWED_HOSTS="127.0.0.1:1"\n'
		'SYMBOL_NODE_ALLOW_LOOPBACK="true"\n'
		'SYMBOL_NODE_ALLOW_PRIVATE="false"\n',
		encoding='utf8')
	return app_path


def _create_symbol_client(database_config, sync_state, blocks, rows):
	with PullerSymbolDatabase(database_config) as database:
		database.create_tables()
		database.upsert_sync_state(sync_state)
		database.upsert_blocks(blocks)
		for row in rows:
			database.upsert_namespace(row, [])

	with tempfile.TemporaryDirectory() as temp_directory:
		config_path = _write_config(temp_directory, database_config)
		with rest_settings_env(config_path):
			app = create_app()
	return app.test_client()


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
