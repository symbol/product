# pylint: disable=too-many-lines
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

from ..test.BridgeTestUtils import HASHES, NEM_ADDRESSES, SYMBOL_ADDRESSES, assert_timestamp_within_last_second
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
from ..test.MockEthereumServer import create_simple_ethereum_client
from ..test.MockNemServer import create_simple_nem_client
from ..test.MockNetworkFacade import MockNemNetworkFacade, MockSymbolNetworkFacade
from ..test.MockSymbolServer import create_simple_symbol_client

# region external server fixtures


@pytest.fixture
async def ethereum_server(aiohttp_client):
	return await create_simple_ethereum_client(aiohttp_client)


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

# endregion


# region apps

def _configure_app_directory(directory, native_server, wrapped_server, coingecko_server, update_network_configs):
	# pylint: disable=redefined-outer-name
	database_directory = Path(directory) / 'db'
	database_directory.mkdir()

	# create db tables
	with Databases(database_directory, MockNemNetworkFacade(), MockSymbolNetworkFacade()) as databases:
		databases.create_tables()

	# create bridge properties from sample
	sample_config_filename = 'tests/resources/sample.config.properties'
	parser = configparser.ConfigParser()
	parser.optionxform = str
	parser.read(sample_config_filename)
	parser['machine']['databaseDirectory'] = str(database_directory)
	parser['price_oracle']['url'] = str(coingecko_server.make_url(''))
	parser['native_network']['endpoint'] = str(native_server.make_url(''))
	parser['native_network']['signerPublicKey'] = '47D5025EC5E5892668FFB1BE2891D09C4D6DC507EDA474B439B33EF0C94F0AA9'
	parser['native_network']['percentageConversionFee'] = '0.002'
	parser['native_network']['explorerEndpoint'] = '<native explorer endpoint>'
	parser['wrapped_network']['endpoint'] = str(wrapped_server.make_url(''))
	parser['wrapped_network']['signerPublicKey'] = 'FDA024AD1FA204242F5FE579419491A76E467EAF6C36E29EA8FC4BF0734B3E81'
	parser['wrapped_network']['percentageConversionFee'] = '0.003'
	parser['wrapped_network']['explorerEndpoint'] = '<wrapped explorer endpoint>'
	update_network_configs(parser['native_network'], parser['wrapped_network'])

	bridge_propererties_filename = Path(directory) / 'bridge.test.properties'
	with open(bridge_propererties_filename, 'wt', encoding='utf8') as properties_file:
		parser.write(properties_file)

	# create Flask server config file
	config_filename = Path(directory) / 'config'
	with open(config_filename, 'wt', encoding='utf8') as config_file:
		print(f'creating config file {config_filename}...')

		config_file.write(f'CONFIG_PATH="{bridge_propererties_filename}"\n')
		config_file.flush()

		temp_file_path = config_filename.resolve()
		os.environ['BRIDGE_API_SETTINGS'] = str(temp_file_path)

	return database_directory


def make_app(database_directory):
	app = create_app()  # pylint: disable=redefined-outer-name
	app.database_directory = database_directory
	return app


@pytest.fixture
def app(nem_server, symbol_server, coingecko_server):  # pylint: disable=redefined-outer-name
	def update_network_configs(_native_network_config, wrapped_network_config):
		wrapped_network_config['transactionFeeMultiplier'] = '50'

	with tempfile.TemporaryDirectory() as temp_directory:
		database_directory = _configure_app_directory(temp_directory, nem_server, symbol_server, coingecko_server, update_network_configs)
		yield make_app(database_directory)


@pytest.fixture
def app_n2n(nem_server, ethereum_server, coingecko_server):  # pylint: disable=redefined-outer-name
	def update_network_configs(_native_network_config, wrapped_network_config):
		wrapped_network_config['blockchain'] = 'ethereum'
		wrapped_network_config['bridgeAddress'] = '0x0ff070994dd3fdB1441433c219A42286ef85290f'
		wrapped_network_config['signerPublicKey'] = f'0x{2 * wrapped_network_config["signerPublicKey"]}'
		wrapped_network_config['mosaicId'] = ''
		wrapped_network_config['chainId'] = '1337'

	with tempfile.TemporaryDirectory() as temp_directory:
		database_directory = _configure_app_directory(temp_directory, nem_server, ethereum_server, coingecko_server, update_network_configs)
		yield make_app(database_directory)


@pytest.fixture
def app_limited(nem_server, symbol_server, coingecko_server):  # pylint: disable=redefined-outer-name
	def update_network_configs(native_network_config, wrapped_network_config):
		native_network_config['maxTransferAmount'] = '50'
		wrapped_network_config['maxTransferAmount'] = '21'

	with tempfile.TemporaryDirectory() as temp_directory:
		database_directory = _configure_app_directory(temp_directory, nem_server, symbol_server, coingecko_server, update_network_configs)
		yield make_app(database_directory)


def make_test_client_from_app(app):  # pylint: disable=redefined-outer-name
	test_client = app.test_client()
	test_client.database_directory = app.database_directory
	return test_client


@pytest.fixture
def client(app):  # pylint: disable=redefined-outer-name
	return make_test_client_from_app(app)


@pytest.fixture
def client_n2n(app_n2n):  # pylint: disable=redefined-outer-name
	return make_test_client_from_app(app_n2n)


@pytest.fixture
def client_limited(app_limited):  # pylint: disable=redefined-outer-name
	return make_test_client_from_app(app_limited)

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


def _assert_json_response_not_found(response):
	assert 404 == response.status_code
	assert 'text/html; charset=utf-8' == response.headers['Content-Type']


def _assert_json_response_internal_server_error(response):
	assert 500 == response.status_code
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
			'explorerUrl': '<native explorer endpoint>'
		},
		'wrappedNetwork': {
			'blockchain': 'symbol',
			'network': 'testnet',
			'bridgeAddress': 'TCRZANFBD6O6EGYCBAH6ICTLAMH6OGBV6CEH7UY',
			'tokenId': '5D6CFC64A20E86E6',
			'defaultNodeUrl': str(symbol_server.make_url('')),
			'explorerUrl': '<wrapped explorer endpoint>'
		},
		'enabled': True
	} == response_json


def test_root_n2n(client_n2n, nem_server, ethereum_server):  # pylint: disable=redefined-outer-name
	# Act:
	response = client_n2n.get('/')
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
			'explorerUrl': '<native explorer endpoint>'
		},
		'wrappedNetwork': {
			'blockchain': 'ethereum',
			'network': 'testnet',
			'bridgeAddress': '0x0ff070994dd3fdB1441433c219A42286ef85290f',
			'tokenId': '',
			'defaultNodeUrl': str(ethereum_server.make_url('')),
			'explorerUrl': '<wrapped explorer endpoint>'
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


async def _assert_filtering_route_validates_parameters(client, is_unwrap, base_path):
	# pylint: disable=redefined-outer-name
	# Arrange:
	_seed_multiple_requests(client.database_directory, is_unwrap)

	async def _assert_paging_parameter_validation(filter_base_path):
		await _assert_is_bad_request_get(client, f'{filter_base_path}?offset=s&limit=7', {
			'error': 'offset parameter is invalid'
		})
		await _assert_is_bad_request_get(client, f'{filter_base_path}?offset=5&limit=s', {
			'error': 'limit parameter is invalid'
		})
		await _assert_is_bad_request_get(client, f'{filter_base_path}?offset=5&limit=7&sort=z', {
			'error': 'sort parameter is invalid'
		})

	# Act + Assert:
	# - address filter
	sample_address = (SYMBOL_ADDRESSES if is_unwrap else NEM_ADDRESSES)[2]
	await _assert_is_bad_request_get(client, f'{base_path}/{sample_address[:-1]}', {
		'error': 'address parameter is invalid'
	})
	await _assert_paging_parameter_validation(f'{base_path}/{sample_address}')

	# - hash filter
	await _assert_is_bad_request_get(client, f'{base_path}/hash/{HASHES[0][:-1]}', {
		'error': 'transaction_hash parameter is invalid'
	})
	await _assert_paging_parameter_validation(f'{base_path}/hash/{HASHES[0]}')


async def _assert_prepare_route_validates_parameters(client, is_unwrap, base_path):  # pylint: disable=redefined-outer-name
	# Arrange:
	_seed_database_for_prepare_tests(client.database_directory)

	# Act + Assert:
	sample_address = (SYMBOL_ADDRESSES if not is_unwrap else NEM_ADDRESSES)[2]
	await _assert_is_bad_request_post(client, base_path, {}, {
		'error': 'recipientAddress parameter is invalid'
	})

	await _assert_is_bad_request_post(client, base_path, {'amount': '1234'}, {
		'error': 'recipientAddress parameter is invalid'
	})
	await _assert_is_bad_request_post(client, base_path, {'recipientAddress': sample_address}, {
		'error': 'amount parameter is invalid'
	})

	await _assert_is_bad_request_post(client, base_path, {'amount': '1234', 'recipientAddress': sample_address[:-1]}, {
		'error': 'recipientAddress parameter is invalid'
	})
	await _assert_is_bad_request_post(client, base_path, {'amount': 's', 'recipientAddress': sample_address}, {
		'error': 'amount parameter is invalid'
	})


async def _assert_is_route_accessible_get(client, path):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Act:
		response = client.get(path)

		# Assert:
		_assert_json_response_success(response)

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def _assert_not_is_route_accessible_get(client, path):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Act:
		response = client.get(path)

		# Assert:
		_assert_json_response_not_found(response)

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def _assert_not_is_route_accessible_post(client, path, request_json):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Act:
		response = client.post(path, json=request_json)

		# Assert:
		_assert_json_response_not_found(response)

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)

# endregion


# region shared filtering tests

async def _assert_can_filter_by_address_empty(client, base_path, is_unwrap):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		address_filter = (SYMBOL_ADDRESSES if is_unwrap else NEM_ADDRESSES)[4]
		_seed_multiple_requests(client.database_directory, is_unwrap)

		# Act:
		response = client.get(f'{base_path}{address_filter}')
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)
		assert [] == [view_json['requestTransactionHeight'] for view_json in response_json]

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def _assert_can_query_all(client, base_path, is_unwrap):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		test_params = get_default_filtering_test_parameters()
		_seed_multiple_requests(client.database_directory, is_unwrap)

		# Act:
		response = client.get(base_path)
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)
		assert test_params.expected_all == [int(view_json['requestTransactionHeight']) for view_json in response_json]

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def _assert_can_filter_by_address(client, base_path, is_unwrap):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		test_params = get_default_filtering_test_parameters()
		address_filter = (SYMBOL_ADDRESSES if is_unwrap else NEM_ADDRESSES)[test_params.address_index]
		_seed_multiple_requests(client.database_directory, is_unwrap)

		# Act:
		response = client.get(f'{base_path}{address_filter}')
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)
		assert test_params.expected_address_filter == [int(view_json['requestTransactionHeight']) for view_json in response_json]

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def _assert_can_filter_by_address_destination(client, base_path, is_unwrap):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		test_params = get_default_filtering_test_parameters()
		address_filter = (SYMBOL_ADDRESSES if not is_unwrap else NEM_ADDRESSES)[test_params.address_index]
		_seed_multiple_requests(client.database_directory, is_unwrap)

		# Act:
		response = client.get(f'{base_path}{address_filter}')
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)
		assert test_params.expected_destination_address_filter == [
			int(view_json['requestTransactionHeight']) for view_json in response_json
		]

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def _assert_can_filter_by_transaction_hash(client, base_path, is_unwrap):
	# pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		test_params = get_default_filtering_test_parameters()
		_seed_multiple_requests(client.database_directory, is_unwrap)

		# Act:
		response = client.get(f'{base_path}hash/{HASHES[test_params.hash_index]}')
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)
		assert test_params.expected_hash_filter == [int(view_json['requestTransactionHeight']) for view_json in response_json]

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def _assert_can_filter_by_transaction_hash_payout(client, base_path, is_unwrap):
	# pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		test_params = get_default_filtering_test_parameters()
		_seed_multiple_requests(client.database_directory, is_unwrap)

		# Act:
		response = client.get(f'{base_path}hash/{test_params.payout_transaction_hash}')
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)
		assert test_params.expected_payout_hash_filter == [int(view_json['requestTransactionHeight']) for view_json in response_json]

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def _assert_can_filter_by_payout_status(client, base_path, is_unwrap):
	# pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		test_params = get_default_filtering_test_parameters()
		_seed_multiple_requests(client.database_directory, is_unwrap)

		# Act:
		response = client.get(f'{base_path}?payout_status={test_params.payout_status}')
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)
		assert test_params.expected_payout_status_filter == [int(view_json['requestTransactionHeight']) for view_json in response_json]

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def _assert_can_filter_by_address_with_custom_offset_and_limit(client, base_path, is_unwrap):
	# pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		test_params = get_default_filtering_test_parameters()
		address_filter = (SYMBOL_ADDRESSES if is_unwrap else NEM_ADDRESSES)[test_params.address_index]
		_seed_multiple_requests(client.database_directory, is_unwrap)

		# Act:
		response = client.get(f'{base_path}{address_filter}?offset={test_params.offset}&limit={test_params.limit}')
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)
		assert test_params.expected_custom_offset_and_limit == [int(view_json['requestTransactionHeight']) for view_json in response_json]

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def _assert_can_filter_by_address_with_custom_offset_and_limit_and_custom_sort(client, base_path, is_unwrap):
	# pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		test_params = get_default_filtering_test_parameters()
		address_filter = (SYMBOL_ADDRESSES if is_unwrap else NEM_ADDRESSES)[test_params.address_index]
		_seed_multiple_requests(client.database_directory, is_unwrap)

		# Act:
		response = client.get(f'{base_path}{address_filter}?offset={test_params.offset}&limit={test_params.limit}&sort=0')
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)
		assert test_params.expected_custom_offset_and_limit_desc == [
			int(view_json['requestTransactionHeight']) for view_json in response_json
		]

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


# endregion


# region /wrap/requests

async def test_wrap_requests_returns_bad_request_for_invalid_parameters(client):  # pylint: disable=redefined-outer-name
	await _assert_filtering_route_validates_parameters(client, False, '/wrap/requests')


async def test_can_query_wrap_requests_with_single_match(client):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		_seed_completed_request(client.database_directory, False)

		# Act:
		response = client.get(f'/wrap/requests/{NEM_ADDRESSES[2]}')
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)

		payout_sent_timestamp = response_json[0]['payoutSentTimestamp']  # only validate timestamp is within range
		assert_timestamp_within_last_second(payout_sent_timestamp)
		assert [
			{
				'requestTransactionHeight': '333',
				'requestTransactionHash': HASHES[2],
				'requestTransactionSubindex': 0,
				'senderAddress': NEM_ADDRESSES[2],

				'requestAmount': '8889',
				'destinationAddress': SYMBOL_ADDRESSES[2],
				'payoutStatus': 2,
				'payoutTransactionHash': 'ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D',
				'payoutSentTimestamp': payout_sent_timestamp,

				'requestTimestamp': 1427591635,

				'payoutTransactionHeight': '1122',
				'payoutNetAmount': '1100',
				'payoutTotalFee': '300',
				'payoutConversionRate': '121',

				'payoutTimestamp': 1667250470.333,

				'errorMessage': None
			}
		] == response_json

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def test_can_query_wrap_requests_with_single_match_unprocessed(client):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		_seed_completed_request(client.database_directory, False)

		# Act:
		response = client.get(f'/wrap/requests/{NEM_ADDRESSES[0]}')
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)
		assert [
			{
				'requestTransactionHeight': '111',
				'requestTransactionHash': HASHES[0],
				'requestTransactionSubindex': 0,
				'senderAddress': NEM_ADDRESSES[0],

				'requestAmount': '5554',
				'destinationAddress': SYMBOL_ADDRESSES[0],
				'payoutStatus': 0,
				'payoutTransactionHash': None,
				'payoutSentTimestamp': None,

				'requestTimestamp': 1427588605,

				'payoutTransactionHeight': None,
				'payoutNetAmount': None,
				'payoutTotalFee': None,
				'payoutConversionRate': None,

				'payoutTimestamp': None,

				'errorMessage': None
			}
		] == response_json

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def test_can_query_wrap_requests_with_single_match_failed(client):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		_seed_completed_request(client.database_directory, False)

		# Act:
		response = client.get(f'/wrap/requests/{NEM_ADDRESSES[3]}')
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)
		assert [
			{
				'requestTransactionHeight': '444',
				'requestTransactionHash': HASHES[3],
				'requestTransactionSubindex': 2,
				'senderAddress': NEM_ADDRESSES[3],

				'requestAmount': '1234',
				'destinationAddress': SYMBOL_ADDRESSES[3],
				'payoutStatus': 3,
				'payoutTransactionHash': None,
				'payoutSentTimestamp': None,

				'requestTimestamp': 1427592645,

				'payoutTransactionHeight': None,
				'payoutNetAmount': None,
				'payoutTotalFee': None,
				'payoutConversionRate': None,

				'payoutTimestamp': None,

				'errorMessage': 'failed to send payout 2'
			}
		] == response_json

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def test_can_query_wrap_requests_with_no_matches(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_empty(client, '/wrap/requests/', False)


async def test_can_query_all_wrap_requests(client):  # pylint: disable=redefined-outer-name
	await _assert_can_query_all(client, '/wrap/requests', False)


async def test_can_query_wrap_requests_by_address(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address(client, '/wrap/requests/', False)


async def test_can_query_wrap_requests_by_address_destination(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_destination(client, '/wrap/requests/', False)


async def test_can_query_wrap_requests_by_transaction_hash(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_transaction_hash(client, '/wrap/requests/', False)


async def test_can_query_wrap_requests_by_transaction_hash_payout(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_transaction_hash_payout(client, '/wrap/requests/', False)


async def test_can_query_wrap_requests_by_payout_status(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_payout_status(client, '/wrap/requests', False)


async def test_can_query_wrap_requests_with_custom_offset_and_limit(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_with_custom_offset_and_limit(client, '/wrap/requests/', False)


async def test_can_query_wrap_requests_with_custom_offset_and_limit_and_custom_sort(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_with_custom_offset_and_limit_and_custom_sort(client, '/wrap/requests/', False)


async def test_can_query_wrap_requests_n2n(client_n2n):  # pylint: disable=redefined-outer-name
	await _assert_is_route_accessible_get(client_n2n, f'/wrap/requests/{NEM_ADDRESSES[2]}')

# endregion


# region /unwrap/requests

async def test_unwrap_requests_returns_bad_request_for_invalid_parameters(client):
	# pylint: disable=redefined-outer-name
	await _assert_filtering_route_validates_parameters(client, True, '/unwrap/requests')


async def test_can_query_unwrap_requests_with_single_match(client):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		_seed_completed_request(client.database_directory, True)

		# Act:
		response = client.get(f'/unwrap/requests/{SYMBOL_ADDRESSES[2]}')
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)

		payout_sent_timestamp = response_json[0]['payoutSentTimestamp']  # only validate timestamp is within range
		assert_timestamp_within_last_second(payout_sent_timestamp)
		assert [
			{
				'requestTransactionHeight': '333',
				'requestTransactionHash': HASHES[2],
				'requestTransactionSubindex': 0,
				'senderAddress': SYMBOL_ADDRESSES[2],

				'requestAmount': '8889',
				'destinationAddress': NEM_ADDRESSES[2],
				'payoutStatus': 2,
				'payoutTransactionHash': 'ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D',
				'payoutSentTimestamp': payout_sent_timestamp,

				'requestTimestamp': 1667250471.05,

				'payoutTransactionHeight': '1122',
				'payoutNetAmount': '1100',
				'payoutTotalFee': '300',
				'payoutConversionRate': '121',

				'payoutTimestamp': 1427590918,

				'errorMessage': None
			}
		] == response_json

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def test_can_query_unwrap_requests_with_no_matches(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_empty(client, '/unwrap/requests/', True)


async def test_can_query_all_unwrap_requests(client):  # pylint: disable=redefined-outer-name
	await _assert_can_query_all(client, '/unwrap/requests', True)


async def test_can_query_unwrap_requests_by_address(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address(client, '/unwrap/requests/', True)


async def test_can_query_unwrap_requests_by_address_destination(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_destination(client, '/unwrap/requests/', True)


async def test_can_query_unwrap_requests_by_transaction_hash(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_transaction_hash(client, '/unwrap/requests/', True)


async def test_can_query_unwrap_requests_by_transaction_hash_payout(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_transaction_hash_payout(client, '/unwrap/requests/', True)


async def test_can_query_unwrap_requests_by_payout_status(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_payout_status(client, '/unwrap/requests', True)


async def test_can_query_unwrap_requests_with_custom_offset_and_limit(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_with_custom_offset_and_limit(client, '/unwrap/requests/', True)


async def test_can_query_unwrap_requests_with_custom_offset_and_limit_and_custom_sort(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_with_custom_offset_and_limit_and_custom_sort(client, '/unwrap/requests/', True)


async def test_cannot_query_unwrap_requests_n2n(client_n2n):  # pylint: disable=redefined-outer-name
	await _assert_not_is_route_accessible_get(client_n2n, '/unwrap/requests/0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97')

# endregion


# region /wrap/errors

async def test_wrap_errors_returns_bad_request_for_invalid_parameters(client):  # pylint: disable=redefined-outer-name
	await _assert_filtering_route_validates_parameters(client, False, '/wrap/errors')


async def test_can_query_wrap_errors_with_single_match(client):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		_seed_simple_error(client.database_directory, False)

		# Act:
		response = client.get(f'/wrap/errors/{NEM_ADDRESSES[2]}')
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)
		assert [
			{
				'requestTransactionHeight': '333',
				'requestTransactionHash': HASHES[2],
				'requestTransactionSubindex': 0,
				'senderAddress': NEM_ADDRESSES[2],

				'errorMessage': 'error message',

				'requestTimestamp': 1427591635
			}
		] == response_json

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def test_can_query_wrap_errors_with_no_matches(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_empty(client, '/wrap/errors/', False)


async def test_can_query_all_wrap_errors(client):  # pylint: disable=redefined-outer-name
	await _assert_can_query_all(client, '/wrap/errors', False)


async def test_can_query_wrap_errors_by_address(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address(client, '/wrap/errors/', False)


async def test_can_query_wrap_errors_by_transaction_hash(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_transaction_hash(client, '/wrap/errors/', False)


async def test_can_query_wrap_errors_with_custom_offset_and_limit(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_with_custom_offset_and_limit(client, '/wrap/errors/', False)


async def test_can_query_wrap_errors_with_custom_offset_and_limit_and_custom_sort(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_with_custom_offset_and_limit_and_custom_sort(client, '/wrap/errors/', False)


async def test_can_query_wrap_errors_n2n(client_n2n):  # pylint: disable=redefined-outer-name
	await _assert_is_route_accessible_get(client_n2n, f'/wrap/errors/{NEM_ADDRESSES[2]}')

# endregion


# region /unwrap/errors

async def test_unwrap_errors_returns_bad_request_for_invalid_parameters(client):  # pylint: disable=redefined-outer-name
	await _assert_filtering_route_validates_parameters(client, True, '/unwrap/errors')


async def test_can_query_unwrap_errors_with_single_match(client):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		_seed_simple_error(client.database_directory, True)

		# Act:
		response = client.get(f'/unwrap/errors/{SYMBOL_ADDRESSES[2]}')
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)
		assert [
			{
				'requestTransactionHeight': '333',
				'requestTransactionHash': HASHES[2],
				'requestTransactionSubindex': 0,
				'senderAddress': SYMBOL_ADDRESSES[2],

				'errorMessage': 'error message',

				'requestTimestamp': 1667250471.05
			}
		] == response_json

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def test_can_query_unwrap_errors_with_no_matches(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_empty(client, '/unwrap/errors/', True)


async def test_can_query_all_unwrap_errors(client):  # pylint: disable=redefined-outer-name
	await _assert_can_query_all(client, '/unwrap/errors', True)


async def test_can_query_unwrap_errors_by_address(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address(client, '/unwrap/errors/', True)


async def test_can_query_unwrap_errors_by_transaction_hash(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_transaction_hash(client, '/unwrap/errors/', True)


async def test_can_query_unwrap_errors_with_custom_offset_and_limit(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_with_custom_offset_and_limit(client, '/unwrap/errors/', True)


async def test_can_query_unwrap_errors_with_custom_offset_and_limit_and_custom_sort(client):  # pylint: disable=redefined-outer-name
	await _assert_can_filter_by_address_with_custom_offset_and_limit_and_custom_sort(client, '/unwrap/errors/', True)


async def test_cannot_query_unwrap_errors_n2n(client_n2n):  # pylint: disable=redefined-outer-name
	await _assert_not_is_route_accessible_get(client_n2n, '/unwrap/errors/0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97')

# endregion


# region /wrap/prepare

async def test_prepare_wrap_returns_bad_request_for_invalid_parameters(client):  # pylint: disable=redefined-outer-name
	await _assert_prepare_route_validates_parameters(client, False, '/wrap/prepare')


async def test_prepare_wrap_returns_internal_server_errors_gracefully(client_n2n, ethereum_server):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange: this test is using client_n2n because only ethereum makes network calls during prepare
		ethereum_server.mock.simulate_estimate_gas_error = True

		_seed_database_for_prepare_tests(client_n2n.database_directory)

		response = client_n2n.post('/wrap/prepare', json={
			'amount': '1234000000',
			'recipientAddress': '0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97'
		})
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_internal_server_error(response)
		assert {
			'errorCode': 'UNEXPECTED_ERROR',
			'error': 'eth_estimateGas RPC call failed: execution reverted: ERC20: transfer amount exceeds balance'
		} == response_json

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def test_prepare_wrap_returns_request_limit_exceeded_errors_gracefully(client_limited):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		_seed_database_for_prepare_tests(client_limited.database_directory)

		# Act:
		response = client_limited.post('/wrap/prepare', json={'amount': '1234000000', 'recipientAddress': SYMBOL_ADDRESSES[2]})
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_bad_request(response)
		assert {
			'errorCode': 'REQUEST_LIMIT_EXCEEDED',
			'error': 'gross transfer amount 205666666 exceeds max transfer amount 21'
		} == response_json

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def test_can_prepare_wrap(client):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		_seed_database_for_prepare_tests(client.database_directory)

		# Act:
		response = client.post('/wrap/prepare', json={'amount': '1234000000', 'recipientAddress': SYMBOL_ADDRESSES[2]})
		response_json = json.loads(response.data)

		# Assert: fee_multiplier => 0.0877 / 0.0199 / 6
		_assert_json_response_success(response)
		assert {
			'grossAmount': '205666666',  # floor(1234000000 / 6),
			'conversionFee': '616999.9980',  # grossAmount * config(percentageConversionFee)[0.003]
			'transactionFee': '6463.6516',  # 176 * config(transactionFeeMultiplier)[50] * feeMultiplier
			'totalFee': '623464',  # ceil(conversionFee + transactionFee)
			'netAmount': '205043202',  # grossAmount - totalFee

			'diagnostics': {
				'height': '4444',
				'nativeBalance': '1500',
				'wrappedBalance': '250',
				'unwrappedBalance': '0'
			}
		} == response_json

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def test_can_prepare_wrap_n2n(client_n2n):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		_seed_database_for_prepare_tests(client_n2n.database_directory)

		# Act:
		response = client_n2n.post('/wrap/prepare', json={
			'amount': '1234000000',
			'recipientAddress': '0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97'
		})
		response_json = json.loads(response.data)

		# Assert: fee_multiplier => 0.0199 / 4500 * 10^6 / 10^18
		_assert_json_response_success(response)
		assert {
			'grossAmount': '5457022222222222',  # floor(1234000000 * feeMultiplier)
			'conversionFee': '16371066666666.6660',  # grossAmount * config(percentageConversionFee)[0.003]
			'transactionFee': '70699842712352.0000',  # \=>
			# gas[19432] * (ceil(baseFee[2486633695] * 1.2) + ceil(priorityFee[623200001] * 1.05))
			# 19432 * (ceil(2983960434) + ceil(654360001.05))
			# 19432 * (2983960434 + 654360002)
			'totalFee': '87070909379019',  # ceil(conversionFee + transactionFee)
			'netAmount': '5369951312843203',  # grossAmount - totalFee

			'diagnostics': {
				'height': '4444'
			}
		} == response_json

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)

# endregion


# region /unwrap/prepare

async def test_prepare_unwrap_returns_bad_request_for_invalid_parameters(client):
	# pylint: disable=redefined-outer-name
	await _assert_prepare_route_validates_parameters(client, True, '/unwrap/prepare')


async def test_prepare_unwrap_returns_request_limit_exceeded_errors_gracefully(client_limited):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		_seed_database_for_prepare_tests(client_limited.database_directory)

		# Act:
		response = client_limited.post('/unwrap/prepare', json={'amount': '1234000000', 'recipientAddress': NEM_ADDRESSES[2]})
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_bad_request(response)
		assert {
			'errorCode': 'REQUEST_LIMIT_EXCEEDED',
			'error': 'gross transfer amount 7403999999 exceeds max transfer amount 50'
		} == response_json

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def test_can_prepare_unwrap(client):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Arrange:
		_seed_database_for_prepare_tests(client.database_directory)

		# Act:
		response = client.post('/unwrap/prepare', json={'amount': '1234000000', 'recipientAddress': NEM_ADDRESSES[2]})
		response_json = json.loads(response.data)

		# Assert:
		_assert_json_response_success(response)
		assert {
			'grossAmount': '7403999999',  # floor(1234000000 * 6),
			'conversionFee': '14807999.9980',  # grossAmount * config(percentageConversionFee)[0.002]
			'transactionFee': '50000.0000',  # 50000
			'totalFee': '14858000',  # ceil(conversionFee + transactionFee)
			'netAmount': '7389141999',  # grossAmount - totalFee

			'diagnostics': {
				'height': '1000',
				'nativeBalance': '300',
				'wrappedBalance': '250',
				'unwrappedBalance': '200'
			}
		} == response_json

	loop = asyncio.get_running_loop()
	await loop.run_in_executor(None, test_impl)


async def test_cannot_prepare_unwrap_n2n(client_n2n):  # pylint: disable=redefined-outer-name
	await _assert_not_is_route_accessible_post(client_n2n, '/unwrap/prepare', {'amount': '1234000000'})

# endregion
