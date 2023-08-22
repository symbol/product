import os
import tempfile
from collections import namedtuple
from pathlib import Path

import pytest
import testing.postgresql

from rest import create_app
from rest.model.Block import BlockView

from .test.DatabaseTestUtils import BLOCKS, initialize_database

DatabaseConfig = namedtuple('DatabaseConfig', ['database', 'user', 'password', 'host', 'port'])
DATABASE_CONFIG_INI = 'db_config.ini'

postgresql = testing.postgresql.Postgresql(port=5433)
db_config = DatabaseConfig(**postgresql.dsn(), password='')
initialize_database(db_config)

# region fixtures


@pytest.fixture
def app():
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
			config_file.write(f'DATABASE_PATH="{db_config_path}"\n')
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

# endregion


# region /blocks

def _assert_get_api_nem_blocks(client, limit, offset, min_height, *args):  # pylint: disable=redefined-outer-name
	# Arrange:
	expected_code = args[0]
	expected_result = args[1]

	# Act:
	response = client.get(f'/api/nem/blocks?limit={limit}&offset={offset}&min_height={min_height}')

	# Assert:
	assert expected_code == response.status_code
	assert expected_result == response.json


def _assert_get_api_nem_blocks_fail(client, limit, offset, min_height):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get(f'/api/nem/blocks?limit={limit}&offset={offset}&min_height={min_height}')

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


def test_api_nem_blocks_limit_to_1(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_blocks(client, 1, 0, 1, 200, [BlockView(*BLOCKS[0]).to_dict()])


def test_api_nem_blocks_offset_to_1(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_blocks(client, 10, 1, 1, 200, [BlockView(*BLOCKS[1]).to_dict()])


def test_api_nem_blocks_empty(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_blocks(client, 10, 0, 3, 200, [])


def test_api_nem_blocks_invalid_min_height(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_blocks_fail(client, 10, 0, 0)
	_assert_get_api_nem_blocks_fail(client, 10, 0, 'invalid')


def test_api_nem_blocks_invalid_limit(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_blocks_fail(client, -1, 0, 1)
	_assert_get_api_nem_blocks_fail(client, 'invalid', 0, 1)


def test_api_nem_blocks_invalid_offset(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_blocks_fail(client, 10, -1, 1)
	_assert_get_api_nem_blocks_fail(client, 10, 'invalid', 1)

# endregion
