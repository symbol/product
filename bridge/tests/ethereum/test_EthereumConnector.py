import pytest

from bridge.ethereum.EthereumAdapters import EthereumAddress
from bridge.ethereum.EthereumConnector import EthereumConnector
from bridge.ethereum.RpcUtils import make_rpc_request_json

from ..test.MockEthereumServer import create_simple_ethereum_client


@pytest.fixture
async def server(aiohttp_client):
	return await create_simple_ethereum_client(aiohttp_client)


# pylint: disable=invalid-name


# region extract_transaction_id, extract_block_timestamp

def test_can_extract_transaction_id():
	# Act:
	transaction_id = EthereumConnector.extract_transaction_id({
		'blockNumber': '0x123',
		'meta': {'height': 0x5577}
	})

	# Assert:
	assert 0x5577 == transaction_id


def test_can_extract_block_timestamp():
	# Act:
	timestamp = EthereumConnector.extract_block_timestamp({
		'timestamp': '0x123',
		'meta': {'timestamp': '0x5577'}
	})

	# Assert:
	assert 0x123 == timestamp

# endregion


# region chain_height, finalized_chain_height, network_time

async def test_can_query_chain_height(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = EthereumConnector(server.make_url(''))

	# Act:
	height = await connector.chain_height()

	# Assert:
	assert [f'{server.make_url("")}/'] == server.mock.urls
	assert [make_rpc_request_json('eth_blockNumber', [])] == server.mock.request_json_payloads
	assert 0xAB123 == height


async def test_can_query_finalized_chain_height(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = EthereumConnector(server.make_url(''))

	# Act:
	height = await connector.finalized_chain_height()

	# Assert:
	assert [f'{server.make_url("")}/'] == server.mock.urls
	assert [make_rpc_request_json('eth_getBlockByNumber', ['finalized', False])] == server.mock.request_json_payloads
	assert 0x112233 == height


async def test_can_query_finalized_chain_height_finalization_not_supported(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = EthereumConnector(server.make_url(''), False)

	# Act:
	height = await connector.finalized_chain_height()

	# Assert:
	assert [f'{server.make_url("")}/'] == server.mock.urls
	assert [make_rpc_request_json('eth_getBlockByNumber', ['latest', False])] == server.mock.request_json_payloads
	assert 0x112244 == height


async def test_can_query_network_time(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = EthereumConnector(server.make_url(''))

	# Act:
	timestamp = await connector.network_time()

	# Assert: fix me
	assert [f'{server.make_url("")}/'] == server.mock.urls
	assert [make_rpc_request_json('eth_getBlockByNumber', ['latest', False])] == server.mock.request_json_payloads
	assert 0x66AA3553 == timestamp.timestamp

# endregion


# region block_headers

async def test_can_query_block_headers(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = EthereumConnector(server.make_url(''))

	# Act:
	headers = await connector.block_headers(0x12345)

	# Assert:
	assert [f'{server.make_url("")}/'] == server.mock.urls
	assert [make_rpc_request_json('eth_getBlockByNumber', ['0x12345', False])] == server.mock.request_json_payloads
	assert {'number': '0x12345', 'timestamp': '0xBA4563'} == headers

# endregion


# region balance

async def _assert_can_query_balance(server, block_identifier, expected_block_identifier):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = EthereumConnector(server.make_url(''))

	# Act:
	balance = await connector.balance(
		EthereumAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'),
		'0x0D8775F648430679A709E98d2b0Cb6250d2887EF',
		*([block_identifier] if block_identifier else []))

	# Assert:
	assert [f'{server.make_url("")}/'] == server.mock.urls
	assert [
		make_rpc_request_json('eth_call', [
			{
				'data': '0x70a08231000000000000000000000000D8DA6BF26964AF9D7EED9E03E53415D37AA96045',
				'to': '0x0D8775F648430679A709E98d2b0Cb6250d2887EF'
			},
			expected_block_identifier
		])
	] == server.mock.request_json_payloads
	assert 0x123456 == balance


async def test_can_query_balance(server):  # pylint: disable=redefined-outer-name
	await _assert_can_query_balance(server, None, 'latest')


async def test_can_query_balance_with_custom_block_identifier(server):  # pylint: disable=redefined-outer-name
	await _assert_can_query_balance(server, 0xAABBCC, '0xAABBCC')

# endregion


# region nonce

async def _assert_can_query_nonce(server, block_identifier, expected_block_identifier):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = EthereumConnector(server.make_url(''))

	# Act:
	nonce = await connector.nonce(
		EthereumAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'),
		*([block_identifier] if block_identifier else []))

	# Assert:
	assert [f'{server.make_url("")}/'] == server.mock.urls
	assert [
		make_rpc_request_json('eth_getTransactionCount', ['0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045', expected_block_identifier])
	] == server.mock.request_json_payloads
	assert 11 == nonce


async def test_can_query_nonce(server):  # pylint: disable=redefined-outer-name
	await _assert_can_query_nonce(server, None, 'latest')


async def test_can_query_nonce_with_custom_block_identifier(server):  # pylint: disable=redefined-outer-name
	await _assert_can_query_nonce(server, 0xAABBCC, '0xAABBCC')

# endregion


# region token_precision

async def _assert_can_query_token_precision(server, block_identifier, expected_block_identifier):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = EthereumConnector(server.make_url(''))

	# Act:
	precision = await connector.token_precision(
		'0x0D8775F648430679A709E98d2b0Cb6250d2887EF',
		*([block_identifier] if block_identifier else []))

	# Assert:
	assert [f'{server.make_url("")}/'] == server.mock.urls
	assert [
		make_rpc_request_json('eth_call', [
			{
				'data': '0x313ce567',
				'to': '0x0D8775F648430679A709E98d2b0Cb6250d2887EF'
			},
			expected_block_identifier
		])
	] == server.mock.request_json_payloads
	assert 3 == precision


async def test_can_query_token_precision(server):  # pylint: disable=redefined-outer-name
	await _assert_can_query_token_precision(server, None, 'latest')


async def test_can_query_token_precision_with_custom_block_identifier(server):  # pylint: disable=redefined-outer-name
	await _assert_can_query_token_precision(server, 0xAABBCC, '0xAABBCC')

# endregion


# region incoming_transactions

async def _assert_can_query_incoming_transactions(server, start_id, expected_start_id):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = EthereumConnector(server.make_url(''))

	# Act:
	transactions = await connector.incoming_transactions(
		EthereumAddress('0xB668a7Cdc62108fAC00F65E1690591B67A1eF7c9'),
		*([start_id] if start_id else []))

	# Assert:
	assert [f'{server.make_url("")}/'] == server.mock.urls
	assert [
		make_rpc_request_json('ots_searchTransactionsBefore', ['0xB668A7CDC62108FAC00F65E1690591B67A1EF7C9', expected_start_id, 25])
	] == server.mock.request_json_payloads
	assert [
		{'meta': {'height': 29}, 'transaction': {'blockNumber': '0x1d', 'nonce': '0x2'}},
		{'meta': {'height': 26}, 'transaction': {'blockNumber': '0x1a', 'nonce': '0x3'}},
		{'meta': {'height': 7}, 'transaction': {'blockNumber': '0x7', 'nonce': '0x1'}}
	] == transactions


async def test_can_query_incoming_transactions_from_beginning(server):  # pylint: disable=redefined-outer-name
	await _assert_can_query_incoming_transactions(server, None, 0)


async def test_can_query_incoming_transactions_with_custom_start_id(server):  # pylint: disable=redefined-outer-name
	await _assert_can_query_incoming_transactions(server, 98765, 98765)

# endregion
