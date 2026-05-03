import os
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
import testing.postgresql
from symbollightapi.model.Exceptions import NodeException

from rest import create_app

from .test.DatabaseTestUtils import (
	ACCOUNT_STATISTIC_VIEW,
	ACCOUNT_VIEWS,
	BLOCK_VIEWS,
	MOSAIC_RICH_LIST_VIEWS,
	MOSAIC_VIEWS,
	NAMESPACE_VIEWS,
	TRANSACTION_STATISTIC_VIEW,
	TRANSACTIONS_VIEWS,
	DatabaseConfig,
	initialize_database
)

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


def _assert_status_code_400(response, expected_message):
	_assert_status_code_and_headers(response, 400)
	assert {
		'message': expected_message,
		'status': 400
	} == response.json


def _get_api(client, endpoint, **query_params):  # pylint: disable=redefined-outer-name
	query_string = '&'.join(f'{key}={val}' for key, val in query_params.items())
	return client.get(f'/api/nem/{endpoint}?{query_string}')


def test_invalid_pagination_params(client):  # pylint: disable=redefined-outer-name

	for module in ['blocks', 'accounts', 'namespaces', 'mosaics', 'mosaic/rich/list']:
		# Act:
		response = client.get(f'/api/nem/{module}', query_string={'limit': -1})

		_assert_status_code_400(response, 'Limit and offset must be greater than or equal to 0')

		# Act:
		response = client.get(f'/api/nem/{module}', query_string={'offset': -1})

		_assert_status_code_400(response, 'Limit and offset must be greater than or equal to 0')


def test_invalid_sort_params(client):  # pylint: disable=redefined-outer-name

	for module in ['blocks', 'namespaces', 'mosaics']:
		# Act:
		response = client.get(f'/api/nem/{module}', query_string={'sort': 'INVALID'})

		# Assert:
		_assert_status_code_400(response, 'Sort must be either ASC or DESC')


def test_data_not_found(client):  # pylint: disable=redefined-outer-name

	for module, params in [
		('block', '/3'),
		('account', '?address=NANEMOABLAGR72AZ2RV3V4ZHDCXW25XQ73O7OBT5'),
		('namespace', '/nonexistent'),
		('mosaic', '/nonexistent'),
		('transaction', '0' * 64)]:
		# Act:
		response = client.get(f'/api/nem/{module}{params}')

		# Assert:
		_assert_status_code_and_headers(response, 404)
		assert {
			'message': 'Resource not found',
			'status': 404
		} == response.json


# region /block/<height>

def _assert_get_api_nem_block_by_height(client, height, expected_status_code, expected_result):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get(f'/api/nem/block/{height}')

	# Assert:
	_assert_status_code_and_headers(response, expected_status_code)
	assert expected_result == response.json


def test_api_nem_block_by_height(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_block_by_height(client, 1, 200, EXPECTED_BLOCK_VIEW_1.to_dict())


def test_api_nem_block_by_invalid_height(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_block_by_height(client, 0, 400, {
		'message': 'Height must be greater than or equal to 1',
		'status': 400
	})

# endregion


# region /blocks

def _assert_get_api_nem_blocks(client, expected_status_code, expected_result, **query_params):  # pylint: disable=redefined-outer-name
	# Act:
	response = _get_api(client, 'blocks', **query_params)

	# Assert:
	_assert_status_code_and_headers(response, expected_status_code)
	assert expected_result == response.json


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
	# Act:
	response = _get_api(client, 'blocks', min_height=0)

	# Assert:
	_assert_status_code_and_headers(response, 400)
	assert {
		'message': 'Minimum height must be greater than or equal to 1',
		'status': 400
	} == response.json

# endregion


# region /account

def _assert_get_nem_account_success(client, expected_result, **query_params):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/nem/account', query_string=query_params)

	# Assert:
	_assert_status_code_and_headers(response, 200)
	assert expected_result == response.json


def _assert_get_nem_account_bad_request(client, expected_message, **query_params):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/nem/account', query_string=query_params)

	# Assert:
	_assert_status_code_and_headers(response, 400)
	assert {
		'message': expected_message,
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
	_assert_get_nem_account_bad_request(client, 'Exactly one of address or publicKey must be provided')


def test_api_nem_account_both_params(client):  # pylint: disable=redefined-outer-name
	_assert_get_nem_account_bad_request(
		client,
		'Exactly one of address or publicKey must be provided',
		address='NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT',
		publicKey='107051C28A2C009A83AE0861CDBFF7C1CBAB387C964CC433F7D191D9C3115ED7')


def test_api_nem_account_invalid_address(client):  # pylint: disable=redefined-outer-name
	_assert_get_nem_account_bad_request(client, 'Invalid address format', address='INVALIDADDRESS')


def test_api_nem_account_invalid_public_key(client):  # pylint: disable=redefined-outer-name,invalid-name
	_assert_get_nem_account_bad_request(client, 'Invalid public key format', publicKey='INVALIDPUBLICKEY')


# endregion

# region /accounts


def _assert_get_nem_accounts_bad_request(client, expected_message, **query_params):  # pylint: disable=redefined-outer-name
	# Act:
	response = _get_api(client, 'accounts', **query_params)

	# Assert:
	_assert_status_code_and_headers(response, 400)
	assert {
		'message': expected_message,
		'status': 400
	} == response.json


def _assert_get_api_nem_accounts(client, expected_status_code, expected_result, **query_params):  # pylint: disable=redefined-outer-name
	# Act:
	response = _get_api(client, 'accounts', **query_params)

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


def test_api_nem_accounts_invalid_sort_field(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_nem_accounts_bad_request(client, 'Sort field must be BALANCE', sort_field='INVALID')


def test_api_nem_accounts_invalid_sort_order(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_nem_accounts_bad_request(client, 'Sort order must be either ASC or DESC', sort_order='INVALID')

# endregion

# region /health


@patch('rest.facade.NemRestFacade.NemConnector.chain_height')
def test_api_nem_health(mock_chain_height, client):  # pylint: disable=redefined-outer-name
	# Arrange:
	mock_chain_height.return_value = 2

	# Act:
	response = client.get('/api/nem/health')

	# Assert:
	_assert_status_code_and_headers(response, 200)
	assert {
		'isHealthy': True,
		'nodeUp': True,
		'nodeHeight': 2,
		'backendSynced': True,
		'lastDBSyncedAt': EXPECTED_BLOCK_VIEW_2.timestamp,
		'lastDBHeight': EXPECTED_BLOCK_VIEW_2.height,
		'errors': []
	} == response.json


@patch('rest.facade.NemRestFacade.NemConnector.chain_height')
def test_api_nem_health_node_behind(mock_chain_height, client):  # pylint: disable=redefined-outer-name
	# Arrange:
	mock_chain_height.return_value = 10

	# Act:
	response = client.get('/api/nem/health')

	# Assert:
	_assert_status_code_and_headers(response, 200)
	assert {
		'isHealthy': False,
		'nodeUp': True,
		'nodeHeight': 10,
		'backendSynced': False,
		'lastDBSyncedAt': EXPECTED_BLOCK_VIEW_2.timestamp,
		'lastDBHeight': EXPECTED_BLOCK_VIEW_2.height,
		'errors': [{
			'type': 'synchronization',
			'message': 'Database is 8 blocks behind node height'
		}]
	} == response.json


@patch('rest.facade.NemRestFacade.NemConnector.chain_height')
def test_api_nem_health_node_fails(mock_chain_height, client):  # pylint: disable=redefined-outer-name
	# Arrange:
	mock_chain_height.side_effect = NodeException('Connection refused')

	# Act:
	response = client.get('/api/nem/health')

	# Assert:
	_assert_status_code_and_headers(response, 200)
	assert {
		'isHealthy': False,
		'nodeUp': False,
		'nodeHeight': None,
		'backendSynced': False,
		'lastDBSyncedAt': EXPECTED_BLOCK_VIEW_2.timestamp,
		'lastDBHeight': EXPECTED_BLOCK_VIEW_2.height,
		'errors': [{'type': 'synchronization', 'message': 'Connection refused'}]
	} == response.json

# endregion

# region /namespace/<name>


def _assert_get_nem_namespace_by_name(client, name, expected_status_code, expected_result):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get(f'/api/nem/namespace/{name}')

	# Assert:
	_assert_status_code_and_headers(response, expected_status_code)
	assert expected_result == response.json


def test_api_namespace_by_root_namespace(client):  # pylint: disable=redefined-outer-name
	_assert_get_nem_namespace_by_name(client, 'root', 200, NAMESPACE_VIEWS[1].to_dict())


def test_api_namespace_by_sub_namespace(client):  # pylint: disable=redefined-outer-name
	_assert_get_nem_namespace_by_name(client, 'root_sub.sub_1', 200, NAMESPACE_VIEWS[2].to_dict())


# endregion

# region /namespaces

def _assert_get_api_nem_namespaces(client, expected_status_code, expected_result, **query_params):  # pylint: disable=redefined-outer-name
	# Act:
	response = _get_api(client, 'namespaces', **query_params)

	# Assert:
	_assert_status_code_and_headers(response, expected_status_code)
	assert expected_result == response.json


def test_api_namespaces_without_params(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_namespaces(client, 200, [NAMESPACE_VIEWS[1].to_dict(), NAMESPACE_VIEWS[2].to_dict(), NAMESPACE_VIEWS[0].to_dict()])


def test_api_namespaces_applies_limit(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_namespaces(client, 200, [NAMESPACE_VIEWS[1].to_dict()], limit=1)


def test_api_namespaces_applies_offset(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_namespaces(client, 200, [NAMESPACE_VIEWS[2].to_dict(), NAMESPACE_VIEWS[0].to_dict()], offset=1)


def test_api_namespaces_applies_sorted_by_registered_height_asc(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_namespaces(client, 200, [
		NAMESPACE_VIEWS[0].to_dict(),
		NAMESPACE_VIEWS[1].to_dict(),
		NAMESPACE_VIEWS[2].to_dict()
	], sort='ASC')


def test_api_namespaces_applies_sorted_by_registered_height_desc(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_namespaces(client, 200, [
		NAMESPACE_VIEWS[1].to_dict(),
		NAMESPACE_VIEWS[2].to_dict(),
		NAMESPACE_VIEWS[0].to_dict()
	], sort='DESC')


def test_api_namespaces_with_all_params(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_namespaces(
		client,
		200,
		[NAMESPACE_VIEWS[2].to_dict()],
		limit=1,
		offset=1,
		sort='DESC'
	)


# endregion

# region /mosaic/<name>

def test_api_mosaic_by_name(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/nem/mosaic/root.mosaic')

	# Assert:
	_assert_status_code_and_headers(response, 200)
	assert MOSAIC_VIEWS[1].to_dict() == response.json


# endregion

# region /mosaics

def _assert_get_api_nem_mosaics(client, expected_status_code, expected_result, **query_params):  # pylint: disable=redefined-outer-name
	# Act:
	response = _get_api(client, 'mosaics', **query_params)

	# Assert:
	_assert_status_code_and_headers(response, expected_status_code)
	assert expected_result == response.json


def test_api_mosaics_without_params(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_mosaics(client, 200, [MOSAIC_VIEWS[1].to_dict(), MOSAIC_VIEWS[2].to_dict(), MOSAIC_VIEWS[0].to_dict()])


def test_api_mosaics_applies_limit(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_mosaics(client, 200, [MOSAIC_VIEWS[1].to_dict()], limit=1)


def test_api_mosaics_applies_offset(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_mosaics(client, 200, [MOSAIC_VIEWS[2].to_dict(), MOSAIC_VIEWS[0].to_dict()], offset=1)


def test_api_mosaics_applies_sorted_by_registered_height_asc(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_mosaics(client, 200, [MOSAIC_VIEWS[0].to_dict(), MOSAIC_VIEWS[1].to_dict(), MOSAIC_VIEWS[2].to_dict()], sort='ASC')


def test_api_mosaics_applies_sorted_by_registered_height_desc(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_mosaics(client, 200, [MOSAIC_VIEWS[1].to_dict(), MOSAIC_VIEWS[2].to_dict(), MOSAIC_VIEWS[0].to_dict()], sort='DESC')


def test_api_mosaics_with_all_params(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nem_mosaics(
		client,
		200,
		[MOSAIC_VIEWS[2].to_dict()],
		limit=1,
		offset=1,
		sort='DESC'
	)


# endregion

# region /mosaic/rich/list

def _assert_get_api_nem_mosaic_rich_list(client, expected_status_code, expected_result, **query_params):
	# pylint: disable=redefined-outer-name
	# Act:
	response = _get_api(client, 'mosaic/rich/list', **query_params)

	# Assert:
	_assert_status_code_and_headers(response, expected_status_code)
	assert expected_result == response.json


def test_api_mosaic_rich_list_without_params(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_mosaic_rich_list(
		client,
		200,
		[
			MOSAIC_RICH_LIST_VIEWS[1].to_dict(),
			MOSAIC_RICH_LIST_VIEWS[0].to_dict()
		]
	)


def test_api_mosaic_rich_list_applies_namespace_name(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_mosaic_rich_list(
		client,
		200,
		[
			MOSAIC_RICH_LIST_VIEWS[1].to_dict(),
			MOSAIC_RICH_LIST_VIEWS[0].to_dict()
		],
		namespace_name='nem.xem'
	)


def test_api_mosaic_rich_list_applies_limit(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_mosaic_rich_list(
		client,
		200,
		[
			MOSAIC_RICH_LIST_VIEWS[1].to_dict()
		],
		limit=1
	)


def test_api_mosaic_rich_list_applies_offset(client):  # pylint: disable=redefined-outer-name, invalid-name
	_assert_get_api_nem_mosaic_rich_list(client, 200, [MOSAIC_RICH_LIST_VIEWS[0].to_dict()], offset=1)


# endregion

# region /transaction/<transaction_hash>

def test_api_nem_transaction_by_hash(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/nem/transaction/' + TRANSACTIONS_VIEWS[0].transaction_hash)

	# Assert:
	_assert_status_code_and_headers(response, 200)
	assert TRANSACTIONS_VIEWS[0].to_dict() == response.json


# endregion

# region /account/statistics

def test_api_nem_account_statistics(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/nem/account/statistics')

	# Assert:
	_assert_status_code_and_headers(response, 200)
	assert ACCOUNT_STATISTIC_VIEW.to_dict() == response.json


# endregion

# region /transaction/statistics

def test_api_nem_transaction_statistics(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/nem/transaction/statistics')

	# Assert:
	_assert_status_code_and_headers(response, 200)
	assert TRANSACTION_STATISTIC_VIEW.to_dict() == response.json


# endregion
