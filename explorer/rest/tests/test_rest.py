import os
import tempfile
from pathlib import Path

import pytest
import testing.postgresql

from rest import create_app

from .test.DatabaseTestUtils import ACCOUNT_VIEWS, BLOCK_VIEWS, DatabaseConfig, initialize_database

DATABASE_CONFIG_INI = 'db_config.ini'

# region test data

EXPECTED_BLOCK_VIEW_1 = BLOCK_VIEWS[0]

EXPECTED_BLOCK_VIEW_2 = BLOCK_VIEWS[1]

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


# region /account

def _assert_get_nem_account_success(client, expected_result, **query_params):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/nem/account', query_string=query_params)

	# Assert:
	_assert_status_code_and_headers(response, 200)
	assert expected_result == response.json


def _assert_get_nem_account_bad_request(client, **query_params):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/nem/account', query_string=query_params)

	# Assert:
	_assert_status_code_and_headers(response, 400)
	assert {
		'message': 'Bad request',
		'status': 400
	} == response.json


def test_api_nem_account_by_address(client):  # pylint: disable=redefined-outer-name
	_assert_get_nem_account_success(
		client,
		ACCOUNT_VIEWS[0].to_dict(),
		address='NAGHXD63C4V6REWGXCVKJ2SBS3GUAXGTRQZQXPRO')


def test_api_nem_account_by_public_key(client):  # pylint: disable=redefined-outer-name
	_assert_get_nem_account_success(
		client,
		ACCOUNT_VIEWS[0].to_dict(),
		publicKey='b88221939ac920484753c738fafda87e82ff04b5e370c9456d85a0f12c6a5cca')


def test_api_nem_account_missing_params(client):  # pylint: disable=redefined-outer-name
	_assert_get_nem_account_bad_request(client)


def test_api_nem_account_both_params(client):  # pylint: disable=redefined-outer-name
	_assert_get_nem_account_bad_request(
		client,
		address='NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT',
		publicKey='107051C28A2C009A83AE0861CDBFF7C1CBAB387C964CC433F7D191D9C3115ED7')


def test_api_nem_account_invalid_address(client):  # pylint: disable=redefined-outer-name
	_assert_get_nem_account_bad_request(client, address='INVALIDADDRESS')


def test_api_nem_account_invalid_public_key(client):  # pylint: disable=redefined-outer-name,invalid-name
	_assert_get_nem_account_bad_request(client, publicKey='INVALIDPUBLICKEY')


def test_api_nem_account_not_found(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/nem/account?address=NANEMOABLAGR72AZ2RV3V4ZHDCXW25XQ73O7OBT5')

	# Assert:
	_assert_status_code_and_headers(response, 404)
	assert {
		'message': 'Resource not found',
		'status': 404
	} == response.json


def _assert_get_api_nem_accounts(client, expected_status_code, expected_result, **query_params):  # pylint: disable=redefined-outer-name
	# Arrange:
	query_string = '&'.join(f'{key}={val}' for key, val in query_params.items())
	client.get(f'/api/nem/accounts?{query_string}')

	# Act:
	response = client.get(f'/api/nem/accounts?{query_string}')

	# Assert:
	_assert_status_code_and_headers(response, expected_status_code)
	assert expected_result == response.json


def test_api_nem_accounts_without_params(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_accounts(client, 200, [ACCOUNT_VIEWS[1].to_dict(), ACCOUNT_VIEWS[0].to_dict()])


def test_api_nem_accounts_applies_limit(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_accounts(client, 200, [ACCOUNT_VIEWS[1].to_dict()], limit=1)


def test_api_nem_accounts_applies_offset(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_accounts(client, 200, [ACCOUNT_VIEWS[0].to_dict()], offset=1)


def test_api_nem_accounts_applies_sorted_by_balance_desc(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_accounts(
		client,
		200,
		[ACCOUNT_VIEWS[1].to_dict(), ACCOUNT_VIEWS[0].to_dict()],
		sort_field='BALANCE',
		sort_order='DESC'
	)


def test_api_nem_accounts_applies_sorted_by_balance_asc(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_accounts(client, 200, [ACCOUNT_VIEWS[0].to_dict(), ACCOUNT_VIEWS[1].to_dict()], sort_field='BALANCE', sort_order='ASC')


def test_api_nem_accounts_invalid_limit(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_accounts(client, 400, {
		'message': 'Bad request',
		'status': 400
	}, limit=-1)


def test_api_nem_accounts_invalid_offset(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_accounts(client, 400, {
		'message': 'Bad request',
		'status': 400
	}, offset=-1)


def test_api_nem_accounts_invalid_sort_field(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_accounts(client, 400, {
		'message': 'Bad request',
		'status': 400
	}, sort_field='INVALID')


def test_api_nem_accounts_invalid_sort_order(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_accounts(client, 400, {
		'message': 'Bad request',
		'status': 400
	}, sort_order='INVALID')

# endregion
