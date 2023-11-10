import os
import tempfile
from pathlib import Path

import pytest
import testing.postgresql

from rest import create_app

from .test.DatabaseTestUtils import BLOCK_VIEWS, NAMESPACE_VIEWS, DatabaseConfig, initialize_database

DATABASE_CONFIG_INI = 'db_config.ini'

# region test data

EXPECTED_BLOCK_VIEW_1 = BLOCK_VIEWS[0]

EXPECTED_BLOCK_VIEW_2 = BLOCK_VIEWS[1]

EXPECTED_NAMESPACE_VIEW_1 = NAMESPACE_VIEWS[0]

EXPECTED_NAMESPACE_VIEW_2 = NAMESPACE_VIEWS[1]


# endregion

# region fixtures


@pytest.fixture(scope='module')
def database():
	postgresql = testing.postgresql.Postgresql(port=5433)
	db_config = DatabaseConfig(**postgresql.dsn(), password='')
	network_name = 'mainnet'
	initialize_database(db_config, network_name)

	yield db_config

	postgresql.stop()


@pytest.fixture
def app(database):  # pylint: disable=redefined-outer-name, unused-argument
	with tempfile.TemporaryDirectory() as temp_directory:
		file_name = Path(temp_directory) / 'app.config'

		# Create db_config.ini
		db_config_path = Path(temp_directory) / DATABASE_CONFIG_INI
		with open(db_config_path, 'wt', encoding='utf8') as db_config_file:
			print(f'Creating database config ini file {db_config_path}...')
			db_config_file.write('[nem_db]\n')
			db_config_file.write('database = test\n')
			db_config_file.write('user = postgres\n')
			db_config_file.write('password = \n')
			db_config_file.write('host = 127.0.0.1\n')
			db_config_file.write('port = 5433\n')

		with open(file_name, 'wt', encoding='utf8') as config_file:
			print(f'creating config file {file_name}...')
			config_file.write(f'DATABASE_CONFIG_FILEPATH="{db_config_path}"\n')
			config_file.write('NETWORK_NAME="mainnet"\n')
			config_file.flush()

			temp_file_path = file_name.resolve()
			os.environ['EXPLORER_REST_SETTINGS'] = str(temp_file_path)
			return create_app()


@pytest.fixture
def client(app):  # pylint: disable=redefined-outer-name
	return app.test_client()

# endregion


def _assert_status_code_and_headers(response, expected_status_code):
	assert expected_status_code == response.status_code
	assert response.headers['Access-Control-Allow-Origin'] == '*'


# region /block/<height>

def _assert_get_api_nem_block_by_height(client, height, expected_status_code, expected_result):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get(f'/api/nem/block/{height}')

	# Assert:
	_assert_status_code_and_headers(response, expected_status_code)
	assert expected_result == response.json


def test_api_nem_block_by_height(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_block_by_height(client, 1, 200, EXPECTED_BLOCK_VIEW_1.to_dict())


def test_api_nem_block_non_exist(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_block_by_height(client, 3, 404, {
		'message': 'Resource not found',
		'status': 404
	})


def test_api_nem_block_by_invalid_height(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_block_by_height(client, 'invalid', 400, {
		'message': 'Bad request',
		'status': 400
	})

# endregion


# region /blocks

def _get_api_nem_blocks(client, **query_params):  # pylint: disable=redefined-outer-name
	query_string = '&'.join(f'{key}={val}' for key, val in query_params.items())
	return client.get(f'/api/nem/blocks?{query_string}')


def _assert_get_api_nem_blocks(client, expected_status_code, expected_result, **query_params):  # pylint: disable=redefined-outer-name
	# Act:
	response = _get_api_nem_blocks(client, **query_params)

	# Assert:
	_assert_status_code_and_headers(response, expected_status_code)
	assert expected_result == response.json


def _assert_get_api_nem_blocks_fail(client, expected_status_code, **query_params):  # pylint: disable=redefined-outer-name
	# Act:
	response = _get_api_nem_blocks(client, **query_params)

	# Assert:
	_assert_status_code_and_headers(response, expected_status_code)
	assert {
		'message': 'Bad request',
		'status': expected_status_code
	} == response.json


def test_api_nem_blocks_without_params(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/nem/blocks')

	# Assert:
	_assert_status_code_and_headers(response, 200)
	assert [EXPECTED_BLOCK_VIEW_2.to_dict(), EXPECTED_BLOCK_VIEW_1.to_dict()] == response.json


def test_api_nem_blocks_applies_limit(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_blocks(client, 200, [EXPECTED_BLOCK_VIEW_2.to_dict()], limit=1)


def test_api_nem_blocks_applies_offset(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_blocks(client, 200, [EXPECTED_BLOCK_VIEW_1.to_dict()], offset=1)


def test_api_nem_blocks_applies_min_height(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_blocks(client, 200, [], min_height=10)


def test_api_nem_blocks_applies_sorted_by_height_desc(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_blocks(client, 200, [EXPECTED_BLOCK_VIEW_2.to_dict(), EXPECTED_BLOCK_VIEW_1.to_dict()], sort='desc')


def test_api_nem_blocks_applies_sorted_by_height_asc(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_blocks(client, 200, [EXPECTED_BLOCK_VIEW_1.to_dict(), EXPECTED_BLOCK_VIEW_2.to_dict()], sort='asc')


def test_api_nem_blocks_with_all_params(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_blocks(client, 200, [EXPECTED_BLOCK_VIEW_2.to_dict()], limit=1, offset=1, min_height=1, sort='asc')


def test_api_nem_blocks_invalid_min_height(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_blocks_fail(client, 400, min_height=0)
	_assert_get_api_nem_blocks_fail(client, 400, min_height='invalid')


def test_api_nem_blocks_invalid_limit(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_blocks_fail(client, 400, limit=-1)
	_assert_get_api_nem_blocks_fail(client, 400, limit='invalid')


def test_api_nem_blocks_invalid_offset(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_blocks_fail(client, 400, offset=-1)
	_assert_get_api_nem_blocks_fail(client, 400, offset='invalid')


def test_api_nem_blocks_invalid_sort(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_blocks_fail(client, 400, sort=-1)
	_assert_get_api_nem_blocks_fail(client, 400, sort='invalid')


# endregion


# region /namespace/<name>

def _assert_get_api_nem_namespace_by_name(client, name, expected_status_code, expected_result):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get(f'/api/nem/namespace/{name}')

	# Assert:
	assert expected_status_code == response.status_code
	assert expected_result == response.json


def test_api_nem_namespace_by_name(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_namespace_by_name(client, 'oxford', 200, EXPECTED_NAMESPACE_VIEW_1.to_dict())


def test_api_nem_namespace_non_exist(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_namespace_by_name(client, 'non_exist_namespace', 404, {
		'message': 'Resource not found',
		'status': 404
	})

# endregion


# region /namespaces

def _get_api_nem_namespaces(client, **query_params):  # pylint: disable=redefined-outer-name
	query_string = '&'.join(f'{key}={val}' for key, val in query_params.items())
	return client.get(f'/api/nem/namespaces?{query_string}')


def _assert_get_api_nem_namespaces(client, expected_code, expected_result, **query_params):  # pylint: disable=redefined-outer-name
	# Act:
	response = _get_api_nem_namespaces(client, **query_params)

	# Assert:
	assert expected_code == response.status_code
	assert expected_result == response.json


def test_api_nem_namespaces_without_params(client):  # pylint: disable=redefined-outer-name, invalid-name
	# Act:
	response = _get_api_nem_namespaces(client)

	# Assert:
	assert 200 == response.status_code
	assert [EXPECTED_NAMESPACE_VIEW_2.to_dict(), EXPECTED_NAMESPACE_VIEW_1.to_dict()] == response.json


def test_api_nem_namespaces_applies_limit(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_namespaces(client, 200, [EXPECTED_NAMESPACE_VIEW_2.to_dict()], limit=1)


def test_api_nem_namespaces_applies_offset(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_namespaces(client, 200, [EXPECTED_NAMESPACE_VIEW_1.to_dict()], offset=1)


def test_api_nem_namespaces_applies_sorted_by_id_desc(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_namespaces(client, 200, [EXPECTED_NAMESPACE_VIEW_2.to_dict(), EXPECTED_NAMESPACE_VIEW_1.to_dict()], sort='desc')


def test_api_nem_namespaces_applies_sorted_by_id_asc(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_namespaces(client, 200, [EXPECTED_NAMESPACE_VIEW_1.to_dict(), EXPECTED_NAMESPACE_VIEW_2.to_dict()], sort='asc')


def test_api_nem_namespaces_with_all_params(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_namespaces(client, 200, [EXPECTED_NAMESPACE_VIEW_2.to_dict()], limit=1, offset=1, sort='asc')


def _assert_get_api_nem_namespaces_fail(client, **query_params):  # pylint: disable=redefined-outer-name
	# Act:
	response = _get_api_nem_namespaces(client, **query_params)

	# Assert:
	assert 400 == response.status_code
	assert {
		'message': 'Bad request',
		'status': 400
	} == response.json


def test_api_nem_namespaces_invalid_limit(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_namespaces_fail(client, limit=-1)
	_assert_get_api_nem_namespaces_fail(client, limit='invalid')


def test_api_nem_namespaces_invalid_offset(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_namespaces_fail(client, offset=-1)
	_assert_get_api_nem_namespaces_fail(client, offset='invalid')


def test_api_nem_namespaces_invalid_sort(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_namespaces_fail(client, sort=-1)
	_assert_get_api_nem_namespaces_fail(client, sort='invalid')


# endregion
