import os
import tempfile
from pathlib import Path

import pytest
import testing.postgresql

from rest import create_app
from rest.model.Block import BlockView

from .test.DatabaseTestUtils import BLOCKS, DatabaseConfig, initialize_database

DATABASE_CONFIG_INI = 'db_config.ini'

# region fixtures


@pytest.fixture(scope='module')
def database():
	postgresql = testing.postgresql.Postgresql(port=5433)
	db_config = DatabaseConfig(**postgresql.dsn(), password='')
	initialize_database(db_config)

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
			config_file.flush()

			temp_file_path = file_name.resolve()
			os.environ['EXPLORER_REST_SETTINGS'] = str(temp_file_path)
			return create_app()


@pytest.fixture
def client(app):  # pylint: disable=redefined-outer-name
	return app.test_client()

# endregion


# region /block/<height>

def _assert_get_api_nem_block_by_height(client, height, expected_status_code, expected_result):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get(f'/api/nem/block/{height}')

	# Assert:
	assert expected_status_code == response.status_code
	assert expected_result == response.json


def test_api_nem_block_by_height(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_block_by_height(client, 1, 200, BlockView(*BLOCKS[0]).to_dict())


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


def _assert_get_api_nem_blocks(client, expected_code, expected_result, **query_params):  # pylint: disable=redefined-outer-name
	# Act:
	response = _get_api_nem_blocks(client, **query_params)

	# Assert:
	assert expected_code == response.status_code
	assert expected_result == response.json


def _assert_get_api_nem_blocks_fail(client, **query_params):  # pylint: disable=redefined-outer-name
	# Act:
	response = _get_api_nem_blocks(client, **query_params)

	# Assert:
	assert 400 == response.status_code
	assert {
		'message': 'Bad request',
		'status': 400
	} == response.json


def test_api_nem_blocks_without_params(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/nem/blocks')

	# Assert:
	assert 200 == response.status_code
	assert [BlockView(*block).to_dict() for block in BLOCKS] == response.json


def test_api_nem_blocks_applies_limit(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_blocks(client, 200, [BlockView(*BLOCKS[0]).to_dict()], limit=1)


def test_api_nem_blocks_applies_offset(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_blocks(client, 200, [BlockView(*BLOCKS[1]).to_dict()], offset=1)


def test_api_nem_blocks_applies_min_height(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_blocks(client, 200, [], min_height=10)


def test_api_nem_blocks_with_all_params(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_blocks(client, 200, [BlockView(*BLOCKS[1]).to_dict()], limit=1, offset=1, min_height=1)


def test_api_nem_blocks_invalid_min_height(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_blocks_fail(client, min_height=0)
	_assert_get_api_nem_blocks_fail(client, min_height='invalid')


def test_api_nem_blocks_invalid_limit(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_blocks_fail(client, limit=-1)
	_assert_get_api_nem_blocks_fail(client, limit='invalid')


def test_api_nem_blocks_invalid_offset(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_blocks_fail(client, offset=-1)
	_assert_get_api_nem_blocks_fail(client, offset='invalid')

# endregion
