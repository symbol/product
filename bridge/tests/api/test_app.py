import asyncio
import configparser
import datetime
import json
import os
import tempfile
from pathlib import Path

import pytest

from bridge.api import create_app
from bridge.db.Databases import Databases

from ..test.BridgeTestUtils import HASHES, NEM_ADDRESSES, SYMBOL_ADDRESSES
from ..test.DatabaseTestUtils import (
	add_requests_unwrap,
	add_requests_wrap,
	add_transfers,
	get_default_filtering_test_parameters,
	seed_database_with_many_errors,
	seed_database_with_many_requests,
	seed_database_with_simple_errors,
	seed_database_with_simple_requests
)
from ..test.MockCoinGeckoServer import create_simple_coingecko_client
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
async def coingecko_server(aiohttp_client):
	return await create_simple_coingecko_client(aiohttp_client)


@pytest.fixture
def app(nem_server, symbol_server, coingecko_server):  # pylint: disable=redefined-outer-name
	with tempfile.TemporaryDirectory() as temp_directory:
		database_directory = Path(temp_directory) / 'db'  # pylint: disable=redefined-outer-name
		database_directory.mkdir()

		# create bridge properties from sample
		sample_config_filename = 'tests/resources/sample.config.properties'
		parser = configparser.ConfigParser()
		parser.optionxform = str
		parser.read(sample_config_filename)
		parser['machine']['databaseDirectory'] = str(database_directory)
		parser['price_oracle']['url'] = str(coingecko_server.make_url(''))
		parser['native_network']['endpoint'] = str(nem_server.make_url(''))
		parser['native_network']['signerPublicKey'] = '47D5025EC5E5892668FFB1BE2891D09C4D6DC507EDA474B439B33EF0C94F0AA9'
		parser['native_network']['percentageConversionFee'] = '0.002'
		parser['native_network']['unitMultiplier'] = '100'
		parser['native_network']['explorerEndpoint'] = '<nem explorer endpoint>'
		parser['wrapped_network']['endpoint'] = str(symbol_server.make_url(''))
		parser['wrapped_network']['signerPublicKey'] = 'FDA024AD1FA204242F5FE579419491A76E467EAF6C36E29EA8FC4BF0734B3E81'
		parser['wrapped_network']['transactionFeeMultiplier'] = '50'
		parser['wrapped_network']['percentageConversionFee'] = '0.003'
		parser['wrapped_network']['explorerEndpoint'] = '<symbol explorer endpoint>'

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
			app = create_app()  # pylint: disable=redefined-outer-name
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


def _seed_database_for_prepare_tests(database_directory):  # pylint: disable=redefined-outer-name
	with Databases(database_directory, MockNemNetworkFacade(), MockSymbolNetworkFacade()) as databases:
		databases.create_tables()

		add_transfers(databases.balance_change, [
			(1111, 200, None),
			(2220, 1000, None),
			(3330, 300, None),
			(4444, -1200, HASHES[0])
		], 'nem:xem')
		databases.balance_change.set_max_processed_height(4444)

		add_requests_wrap(databases.wrap_request, [
			(1111, 196, 4),
			(3330, 49, 1)
		])

		nem_epoch = datetime.datetime(2015, 3, 29, 0, 6, 25, tzinfo=datetime.timezone.utc)
		symbol_epoch = datetime.datetime(2022, 10, 31, 21, 7, 47, tzinfo=datetime.timezone.utc)
		difference_seconds = int((symbol_epoch - nem_epoch).total_seconds())

		databases.wrap_request.set_max_processed_height(4444)
		for (height, timestamp) in [(1111, 8000), (2220, 9000), (3330, 10000), (4444, 12000)]:
			databases.wrap_request.set_block_timestamp(height, difference_seconds + timestamp)

		add_requests_unwrap(databases.unwrap_request, [
			(900, 200, HASHES[0])
		])
		databases.unwrap_request.set_max_processed_height(1000)
		for (height, timestamp) in [(800, 10500), (900, 11500), (1000, 12000)]:
			databases.unwrap_request.set_block_timestamp(height, timestamp * 1000)  # to seconds

# endregion


# region test utils

def _assert_json_response_success(response):
	assert 200 == response.status_code
	assert 'application/json' == response.headers['Content-Type']


def _assert_json_response_bad_request(response):
	assert 400 == response.status_code
	assert 'application/json' == response.headers['Content-Type']

# endregion


# pylint: disable=invalid-name


# region root (/)

def test_root(client, nem_server, symbol_server):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/')
	response_json = json.loads(response.data)

	# Assert:
	_assert_json_response_success(response)
	assert {
		'nativeNetwork': {
			'blockchain': 'nem',
			'network': 'testnet',
			'bridgeAddress': 'TBINJOHFNWMNUOJ2KW3DWJTLRVNAOGQCE6FECSQJ',
			'tokenId': 'nem:xem',
			'defaultNodeUrl': str(nem_server.make_url('')),
			'explorerUrl': '<nem explorer endpoint>'
		},
		'wrappedNetwork': {
			'blockchain': 'symbol',
			'network': 'testnet',
			'bridgeAddress': 'TCRZANFBD6O6EGYCBAH6ICTLAMH6OGBV6CEH7UY',
			'tokenId': 'id:5D6CFC64A20E86E6',
			'defaultNodeUrl': str(symbol_server.make_url('')),
			'explorerUrl': '<symbol explorer endpoint>'
		},
		'enabled': True
	} == response_json

# endregion


# region shared validation tests

async def _assert_is_bad_request_get(client, path, expected_response_json):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Act:
		response = client.get(path)
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_bad_request(response)
		assert expected_response_json == response_json

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def _assert_is_bad_request_post(client, path, request_json, expected_response_json):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Act:
		response = client.post(path, json=request_json)
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_bad_request(response)
		assert expected_response_json == response_json

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def _assert_filtering_route_validates_parameters(client, database_directory, is_unwrap, base_path):
	# pylint: disable=redefined-outer-name
	# Arrange:
	_seed_multiple_requests(database_directory, is_unwrap)

	# Act + Assert:
	sample_address = (SYMBOL_ADDRESSES if is_unwrap else NEM_ADDRESSES)[2]
	await _assert_is_bad_request_get(client, f'{base_path}/{sample_address[:-1]}', {
		'error': 'address parameter is invalid'
	})
	await _assert_is_bad_request_get(client, f'{base_path}/{sample_address}/{HASHES[0][:-1]}', {
		'error': 'transaction_hash parameter is invalid'
	})
	await _assert_is_bad_request_get(client, f'{base_path}/{sample_address}?offset=s&limit=7', {
		'error': 'offset parameter is invalid'
	})
	await _assert_is_bad_request_get(client, f'{base_path}/{sample_address}?offset=5&limit=s', {
		'error': 'limit parameter is invalid'
	})


async def _assert_prepare_route_validates_parameters(client, database_directory, base_path):  # pylint: disable=redefined-outer-name
	# Arrange:
	_seed_database_for_prepare_tests(database_directory)

	# Act + Assert:
	await _assert_is_bad_request_post(client, base_path, {}, {
		'error': 'amount parameter is invalid'
	})
	await _assert_is_bad_request_post(client, base_path, {'amount': 's'}, {
		'error': 'amount parameter is invalid'
	})

# endregion


# region shared filtering tests

async def _assert_can_filter_by_address_empty(client, database_directory, base_path, is_unwrap):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		address_filter = (SYMBOL_ADDRESSES if is_unwrap else NEM_ADDRESSES)[4]
		_seed_multiple_requests(database_directory, is_unwrap)

		# Act:
		response = client.get(f'{base_path}{address_filter}')
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)
		assert [] == [view_json['requestTransactionHeight'] for view_json in response_json]

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def _assert_can_filter_by_address(client, database_directory, base_path, is_unwrap):  # pylint: disable=redefined-outer-name
	def test_impl():
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

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def _assert_can_filter_by_address_and_transaction_hash(client, database_directory, base_path, is_unwrap):
	# pylint: disable=redefined-outer-name
	def test_impl():
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

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def _assert_can_filter_by_address_with_custom_offset_and_limit(client, database_directory, base_path, is_unwrap):
	# pylint: disable=redefined-outer-name
	def test_impl():
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

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)

# endregion


# region /wrap/requests

async def test_wrap_requests_returns_bad_request_for_invalid_parameters(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_filtering_route_validates_parameters(client, database_directory, False, '/wrap/requests')


async def test_can_query_wrap_requests_with_single_match(client, database_directory):  # pylint: disable=redefined-outer-name
	def test_impl():
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

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def test_can_query_wrap_requests_with_no_matches(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_empty(client, database_directory, '/wrap/requests/', False)


async def test_can_query_wrap_requests_by_address(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address(client, database_directory, '/wrap/requests/', False)


async def test_can_query_wrap_requests_by_address_and_transaction_hash(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_and_transaction_hash(client, database_directory, '/wrap/requests/', False)


async def test_can_query_wrap_requests_with_custom_offset_and_limit(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_with_custom_offset_and_limit(client, database_directory, '/wrap/requests/', False)

# endregion


# region /unwrap/requests

async def test_unwrap_requests_returns_bad_request_for_invalid_parameters(client, database_directory):
	# pylint: disable=redefined-outer-name
	await _assert_filtering_route_validates_parameters(client, database_directory, True, '/unwrap/requests')


async def test_can_query_unwrap_requests_with_single_match(client, database_directory):  # pylint: disable=redefined-outer-name
	def test_impl():
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

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def test_can_query_unwrap_requests_with_no_matches(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_empty(client, database_directory, '/unwrap/requests/', True)


async def test_can_query_unwrap_requests_by_address(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address(client, database_directory, '/unwrap/requests/', True)


async def test_can_query_unwrap_requests_by_address_and_transaction_hash(client, database_directory):
	# pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_and_transaction_hash(client, database_directory, '/unwrap/requests/', True)


async def test_can_query_unwrap_requests_with_custom_offset_and_limit(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_with_custom_offset_and_limit(client, database_directory, '/unwrap/requests/', True)

# endregion


# region /wrap/errors

async def test_wrap_errors_returns_bad_request_for_invalid_parameters(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_filtering_route_validates_parameters(client, database_directory, False, '/wrap/errors')


async def test_can_query_wrap_errors_with_single_match(client, database_directory):  # pylint: disable=redefined-outer-name
	def test_impl():
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

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def test_can_query_wrap_errors_with_no_matches(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_empty(client, database_directory, '/wrap/errors/', False)


async def test_can_query_wrap_errors_by_address(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address(client, database_directory, '/wrap/errors/', False)


async def test_can_query_wrap_errors_by_address_and_transaction_hash(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_and_transaction_hash(client, database_directory, '/wrap/errors/', False)


async def test_can_query_wrap_errors_with_custom_offset_and_limit(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_with_custom_offset_and_limit(client, database_directory, '/wrap/errors/', False)

# endregion


# region /unwrap/errors

async def test_unwrap_errors_returns_bad_request_for_invalid_parameters(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_filtering_route_validates_parameters(client, database_directory, True, '/unwrap/errors')


async def test_can_query_unwrap_errors_with_single_match(client, database_directory):  # pylint: disable=redefined-outer-name
	def test_impl():
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

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def test_can_query_unwrap_errors_with_no_matches(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_empty(client, database_directory, '/unwrap/errors/', True)


async def test_can_query_unwrap_errors_by_address(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address(client, database_directory, '/unwrap/errors/', True)


async def test_can_query_unwrap_errors_by_address_and_transaction_hash(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_and_transaction_hash(client, database_directory, '/unwrap/errors/', True)


async def test_can_query_unwrap_errors_with_custom_offset_and_limit(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_with_custom_offset_and_limit(client, database_directory, '/unwrap/errors/', True)

# endregion


# region /wrap/prepare

async def test_prepare_wrap_returns_bad_request_for_invalid_parameters(client, database_directory):  # pylint: disable=redefined-outer-name
	await _assert_prepare_route_validates_parameters(client, database_directory, '/wrap/prepare')


async def test_can_prepare_wrap(client, database_directory):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		_seed_database_for_prepare_tests(database_directory)

		# Act:
		response = client.post('/wrap/prepare', json={'amount': 1234000000})
		response_json = json.loads(response.data)

		# Assert: fee_multiplier => 0.0877 / 0.0199 * 100
		_assert_json_response_success(response)
		assert {
			'grossAmount': 205666666,  # floor(1234000000 / 6),
			'conversionFee': '271914069.4704',  # grossAmount * config(percentageConversionFee) * feeMultiplier
			'transactionFee': '3878190.9548',  # 176 * config(transactionFeeMultiplier) * feeMultiplier
			'totalFee': 275792261,  # ceil(conversionFee + transactionFee)
			'netAmount': -70125595,  # grossAmount - totalFee

			'diagnostics': {
				'height': 4444,
				'nativeBalance': '1500',
				'wrappedBalance': '250',
				'unwrappedBalance': '0'
			}
		} == response_json

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)

# endregion


# region /unwrap/prepare

async def test_prepare_unwrap_returns_bad_request_for_invalid_parameters(client, database_directory):
	# pylint: disable=redefined-outer-name
	await _assert_prepare_route_validates_parameters(client, database_directory, '/unwrap/prepare')


async def test_can_prepare_unwrap(client, database_directory):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		_seed_database_for_prepare_tests(database_directory)

		# Act:
		response = client.post('/unwrap/prepare', json={'amount': 1234000000})
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)

		assert {
			'grossAmount': 7403999999,  # floor(1234000000 * 6),
			'conversionFee': '14807999.9980',  # grossAmount * config(percentageConversionFee)
			'transactionFee': '50000.0000',  # 50000
			'totalFee': 14858000,  # ceil(conversionFee + transactionFee)
			'netAmount': 7389141999,  # grossAmount - totalFee

			'diagnostics': {
				'height': 1000,
				'nativeBalance': '300',
				'wrappedBalance': '250',
				'unwrappedBalance': '200'
			}
		} == response_json

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)

# endregion
