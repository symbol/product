import configparser
import json
import os
import tempfile
from pathlib import Path

import pytest

from bridge.api import create_app
from bridge.db.Databases import Databases

from ..test.BridgeTestUtils import HASHES, NEM_ADDRESSES, SYMBOL_ADDRESSES
from ..test.DatabaseTestUtils import (
	get_default_filtering_test_parameters,
	seed_database_with_many_errors,
	seed_database_with_many_requests,
	seed_database_with_simple_errors,
	seed_database_with_simple_requests
)
from ..test.MockNemServer import create_simple_nem_client
from ..test.MockNetworkFacade import MockNemNetworkFacade, MockSymbolNetworkFacade
from ..test.MockSymbolServer import create_simple_symbol_client

# region fixtures


@pytest.fixture
async def nem_server(aiohttp_client):
	return await create_simple_nem_client(aiohttp_client, {
		'TCQKTUUNUOPQGDQIDQT2CCJGQZ4QNAAGBZRV5YJJ': 9988776655
	})


@pytest.fixture
async def symbol_server(aiohttp_client):
	return await create_simple_symbol_client(aiohttp_client, '0x72C0\'212E\'67A0\'8BCE')


@pytest.fixture
async def app(nem_server, symbol_server):  # pylint: disable=redefined-outer-name
	with tempfile.TemporaryDirectory() as temp_directory:
		database_directory = Path(temp_directory) / 'db'  # pylint: disable=redefined-outer-name
		database_directory.mkdir()

		# create bridge properties from sample
		sample_config_filename = 'tests/resources/sample.config.properties'
		parser = configparser.ConfigParser()
		parser.optionxform = str
		parser.read(sample_config_filename)
		parser['machine']['databaseDirectory'] = str(database_directory)
		parser['native_network']['endpoint'] = str(nem_server.make_url(''))
		parser['wrapped_network']['endpoint'] = str(symbol_server.make_url(''))

		bridge_propererties_filename = Path(temp_directory) / 'bridge.test.properties'
		with open(bridge_propererties_filename, 'wt', encoding='utf8') as properties_file:
			parser.write(properties_file)

		# create Flask server config file
		config_filename = Path(temp_directory) / 'config'
		with open(config_filename, 'wt', encoding='utf8') as config_file:
			print(f'creating config file {config_filename}...')

			config_file.write(f'CONFIG_PATH="{bridge_propererties_filename}"\n')
			config_file.flush()

			temp_file_path = config_filename.resolve()
			os.environ['BRIDGE_API_SETTINGS'] = str(temp_file_path)
			app = await create_app()  # pylint: disable=redefined-outer-name
			app.database_directory = database_directory
			yield app


@pytest.fixture
def client(app):  # pylint: disable=redefined-outer-name
	return app.test_client()


@pytest.fixture
def database_directory(app):  # pylint: disable=redefined-outer-name
	return app.database_directory

# endregion


# region database utils

def _seed_completed_request(database_directory, is_unwrap):  # pylint: disable=redefined-outer-name
	with Databases(database_directory, MockNemNetworkFacade(), MockSymbolNetworkFacade()) as databases:
		databases.create_tables()
		seed_database_with_simple_requests(databases.unwrap_request if is_unwrap else databases.wrap_request, is_unwrap)


def _seed_multiple_requests(database_directory, is_unwrap):  # pylint: disable=redefined-outer-name
	with Databases(database_directory, MockNemNetworkFacade(), MockSymbolNetworkFacade()) as databases:
		databases.create_tables()
		seed_database_with_many_requests(databases.unwrap_request if is_unwrap else databases.wrap_request, is_unwrap)
		seed_database_with_many_errors(databases.unwrap_request if is_unwrap else databases.wrap_request, is_unwrap)


def _seed_simple_error(database_directory, is_unwrap):  # pylint: disable=redefined-outer-name
	with Databases(database_directory, MockNemNetworkFacade(), MockSymbolNetworkFacade()) as databases:
		databases.create_tables()
		seed_database_with_simple_errors(databases.unwrap_request if is_unwrap else databases.wrap_request, is_unwrap)

# endregion


# region test utils

def _assert_json_response_success(response):
	assert 200 == response.status_code
	assert 'application/json' == response.headers['Content-Type']

# endregion


# pylint: disable=invalid-name


# region root (/)

def test_root(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/')
	response_json = json.loads(response.data)

	# Assert:
	_assert_json_response_success(response)
	assert {
		'native_network': {
			'blockchain': 'nem',
			'network': 'testnet',
			'bridgeAddress': 'TBINJOHFNWMNUOJ2KW3DWJTLRVNAOGQCE6FECSQJ',
			'tokenId': 'nem:xem'
		},
		'wrapped_network': {
			'blockchain': 'symbol',
			'network': 'testnet',
			'bridgeAddress': 'TCRZANFBD6O6EGYCBAH6ICTLAMH6OGBV6CEH7UY',
			'tokenId': 'id:5D6CFC64A20E86E6'
		}
	} == response_json

# endregion


# region shared filtering tests

def _assert_can_filter_by_address_empty(client, database_directory, base_path, is_unwrap):  # pylint: disable=redefined-outer-name
	# Arrange:
	address_filter = (SYMBOL_ADDRESSES if is_unwrap else NEM_ADDRESSES)[4]
	_seed_multiple_requests(database_directory, is_unwrap)

	# Act:
	response = client.get(f'{base_path}{address_filter}')
	response_json = json.loads(response.data)

	# Assert:
	_assert_json_response_success(response)
	assert [] == [view_json['requestTransactionHeight'] for view_json in response_json]


def _assert_can_filter_by_address(client, database_directory, base_path, is_unwrap):  # pylint: disable=redefined-outer-name
	# Arrange:
	test_params = get_default_filtering_test_parameters()
	address_filter = (SYMBOL_ADDRESSES if is_unwrap else NEM_ADDRESSES)[test_params.address_index]
	_seed_multiple_requests(database_directory, is_unwrap)

	# Act:
	response = client.get(f'{base_path}{address_filter}')
	response_json = json.loads(response.data)

	# Assert:
	_assert_json_response_success(response)
	assert test_params.expected_all == [view_json['requestTransactionHeight'] for view_json in response_json]


def _assert_can_filter_by_address_and_transaction_hash(client, database_directory, base_path, is_unwrap):
	# pylint: disable=redefined-outer-name
	# Arrange:
	test_params = get_default_filtering_test_parameters()
	address_filter = (SYMBOL_ADDRESSES if is_unwrap else NEM_ADDRESSES)[test_params.address_index]
	_seed_multiple_requests(database_directory, is_unwrap)

	# Act:
	response = client.get(f'{base_path}{address_filter}/{HASHES[test_params.hash_index]}')
	response_json = json.loads(response.data)

	# Assert:
	_assert_json_response_success(response)
	assert test_params.expected_hash_filter == [view_json['requestTransactionHeight'] for view_json in response_json]


def _assert_can_filter_by_address_with_custom_offset_and_limit(client, database_directory, base_path, is_unwrap):
	# pylint: disable=redefined-outer-name
	# Arrange:
	test_params = get_default_filtering_test_parameters()
	address_filter = (SYMBOL_ADDRESSES if is_unwrap else NEM_ADDRESSES)[test_params.address_index]
	_seed_multiple_requests(database_directory, is_unwrap)

	# Act:
	response = client.get(f'{base_path}{address_filter}?offset={test_params.offset}&limit={test_params.limit}')
	response_json = json.loads(response.data)

	# Assert:
	_assert_json_response_success(response)
	assert test_params.expected_custom_offset_and_limit == [view_json['requestTransactionHeight'] for view_json in response_json]

# endregion


# region /wrap/requests

def test_can_query_wrap_requests_with_single_match(client, database_directory):  # pylint: disable=redefined-outer-name
	# Arrange:
	_seed_completed_request(database_directory, False)

	# Act:
	response = client.get(f'/wrap/requests/{NEM_ADDRESSES[2]}')
	response_json = json.loads(response.data)

	# Assert:
	_assert_json_response_success(response)
	assert [
		{
			'requestTransactionHeight': 333,
			'requestTransactionHash': HASHES[2],
			'requestTransactionSubindex': 0,
			'senderAddress': NEM_ADDRESSES[2],

			'requestAmount': 8889,
			'destinationAddress': SYMBOL_ADDRESSES[2],
			'payoutStatus': 2,
			'payoutTransactionHash': 'ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D',

			'requestTimestamp': 1427591635,

			'payoutTransactionHeight': 1122,
			'payoutNetAmount': 1100,
			'payoutTotalFee': 300,
			'payoutConversionRate': 121,

			'payoutTimestamp': 1667250470.333
		}
	] == response_json


def test_can_query_wrap_requests_with_no_matches(client, database_directory):  # pylint: disable=redefined-outer-name
	_assert_can_filter_by_address_empty(client, database_directory, '/wrap/requests/', False)


def test_can_query_wrap_requests_by_address(client, database_directory):  # pylint: disable=redefined-outer-name
	_assert_can_filter_by_address(client, database_directory, '/wrap/requests/', False)


def test_can_query_wrap_requests_by_address_and_transaction_hash(client, database_directory):  # pylint: disable=redefined-outer-name
	_assert_can_filter_by_address_and_transaction_hash(client, database_directory, '/wrap/requests/', False)


def test_can_query_wrap_requests_with_custom_offset_and_limit(client, database_directory):  # pylint: disable=redefined-outer-name
	_assert_can_filter_by_address_with_custom_offset_and_limit(client, database_directory, '/wrap/requests/', False)

# endregion


# region /unwrap/requests

def test_can_query_unwrap_requests_with_single_match(client, database_directory):  # pylint: disable=redefined-outer-name
	# Arrange:
	_seed_completed_request(database_directory, True)

	# Act:
	response = client.get(f'/unwrap/requests/{SYMBOL_ADDRESSES[2]}')
	response_json = json.loads(response.data)

	# Assert:
	_assert_json_response_success(response)
	assert [
		{
			'requestTransactionHeight': 333,
			'requestTransactionHash': HASHES[2],
			'requestTransactionSubindex': 0,
			'senderAddress': SYMBOL_ADDRESSES[2],

			'requestAmount': 8889,
			'destinationAddress': NEM_ADDRESSES[2],
			'payoutStatus': 2,
			'payoutTransactionHash': 'ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D',

			'requestTimestamp': 1667250471.05,

			'payoutTransactionHeight': 1122,
			'payoutNetAmount': 1100,
			'payoutTotalFee': 300,
			'payoutConversionRate': 121,

			'payoutTimestamp': 1427590918
		}
	] == response_json


def test_can_query_unwrap_requests_with_no_matches(client, database_directory):  # pylint: disable=redefined-outer-name
	_assert_can_filter_by_address_empty(client, database_directory, '/unwrap/requests/', True)


def test_can_query_unwrap_requests_by_address(client, database_directory):  # pylint: disable=redefined-outer-name
	_assert_can_filter_by_address(client, database_directory, '/unwrap/requests/', True)


def test_can_query_unwrap_requests_by_address_and_transaction_hash(client, database_directory):  # pylint: disable=redefined-outer-name
	_assert_can_filter_by_address_and_transaction_hash(client, database_directory, '/unwrap/requests/', True)


def test_can_query_unwrap_requests_with_custom_offset_and_limit(client, database_directory):  # pylint: disable=redefined-outer-name
	_assert_can_filter_by_address_with_custom_offset_and_limit(client, database_directory, '/unwrap/requests/', True)

# endregion


# region /wrap/errors

def test_can_query_wrap_errors_with_single_match(client, database_directory):  # pylint: disable=redefined-outer-name
	# Arrange:
	_seed_simple_error(database_directory, False)

	# Act:
	response = client.get(f'/wrap/errors/{NEM_ADDRESSES[2]}')
	response_json = json.loads(response.data)

	# Assert:
	_assert_json_response_success(response)
	assert [
		{
			'requestTransactionHeight': 333,
			'requestTransactionHash': HASHES[2],
			'requestTransactionSubindex': 0,
			'senderAddress': NEM_ADDRESSES[2],

			'errorMessage': 'error message',

			'requestTimestamp': 1427591635
		}
	] == response_json


def test_can_query_wrap_errors_with_no_matches(client, database_directory):  # pylint: disable=redefined-outer-name
	_assert_can_filter_by_address_empty(client, database_directory, '/wrap/errors/', False)


def test_can_query_wrap_errors_by_address(client, database_directory):  # pylint: disable=redefined-outer-name
	_assert_can_filter_by_address(client, database_directory, '/wrap/errors/', False)


def test_can_query_wrap_errors_by_address_and_transaction_hash(client, database_directory):  # pylint: disable=redefined-outer-name
	_assert_can_filter_by_address_and_transaction_hash(client, database_directory, '/wrap/errors/', False)


def test_can_query_wrap_errors_with_custom_offset_and_limit(client, database_directory):  # pylint: disable=redefined-outer-name
	_assert_can_filter_by_address_with_custom_offset_and_limit(client, database_directory, '/wrap/errors/', False)

# endregion


# region /unwrap/errors

def test_can_query_unwrap_errors_with_single_match(client, database_directory):  # pylint: disable=redefined-outer-name
	# Arrange:
	_seed_simple_error(database_directory, True)

	# Act:
	response = client.get(f'/unwrap/errors/{SYMBOL_ADDRESSES[2]}')
	response_json = json.loads(response.data)

	# Assert:
	_assert_json_response_success(response)
	assert [
		{
			'requestTransactionHeight': 333,
			'requestTransactionHash': HASHES[2],
			'requestTransactionSubindex': 0,
			'senderAddress': SYMBOL_ADDRESSES[2],

			'errorMessage': 'error message',

			'requestTimestamp': 1667250471.05
		}
	] == response_json


def test_can_query_unwrap_errors_with_no_matches(client, database_directory):  # pylint: disable=redefined-outer-name
	_assert_can_filter_by_address_empty(client, database_directory, '/unwrap/errors/', True)


def test_can_query_unwrap_errors_by_address(client, database_directory):  # pylint: disable=redefined-outer-name
	_assert_can_filter_by_address(client, database_directory, '/unwrap/errors/', True)


def test_can_query_unwrap_errors_by_address_and_transaction_hash(client, database_directory):  # pylint: disable=redefined-outer-name
	_assert_can_filter_by_address_and_transaction_hash(client, database_directory, '/unwrap/errors/', True)


def test_can_query_unwrap_errors_with_custom_offset_and_limit(client, database_directory):  # pylint: disable=redefined-outer-name
	_assert_can_filter_by_address_with_custom_offset_and_limit(client, database_directory, '/unwrap/errors/', True)

# endregion
