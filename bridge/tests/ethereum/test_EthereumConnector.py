from collections import namedtuple

import pytest
from hexbytes import HexBytes
from symbolchain.CryptoTypes import Hash256
from symbollightapi.model.Constants import TimeoutSettings, TransactionStatus
from symbollightapi.model.Exceptions import InsufficientBalanceException, NodeException, NodeTransientException

from bridge.ethereum.EthereumAdapters import EthereumAddress
from bridge.ethereum.EthereumConnector import ConfirmedTransactionExecutionFailure, EthereumConnector
from bridge.ethereum.RpcUtils import make_rpc_request_json

from ..test.BridgeTestUtils import HASHES
from ..test.MockEthereumServer import create_simple_ethereum_client

SignedTransaction = namedtuple('SignedTransaction', ['raw_transaction'])


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
				'data': '0x70a08231000000000000000000000000d8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
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

async def _assert_can_query_nonce(server, block_identifier, expected_block_identifier, expected_nonce):
	# pylint: disable=redefined-outer-name
	# Arrange:
	connector = EthereumConnector(server.make_url(''))

	# Act:
	nonce = await connector.nonce(
		EthereumAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'),
		*([block_identifier] if block_identifier else []))

	# Assert:
	assert [f'{server.make_url("")}/'] == server.mock.urls
	assert [
		make_rpc_request_json('eth_getTransactionCount', ['0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', expected_block_identifier])
	] == server.mock.request_json_payloads
	assert expected_nonce == nonce


async def test_can_query_nonce(server):  # pylint: disable=redefined-outer-name
	await _assert_can_query_nonce(server, None, 'latest', 11)


async def test_can_query_nonce_with_custom_block_identifier(server):  # pylint: disable=redefined-outer-name
	await _assert_can_query_nonce(server, 0xAABBCC, '0xAABBCC', 9)

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


# region gas_price, estimate_gas, estimate_fees_from_history

async def test_can_query_gas_price(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = EthereumConnector(server.make_url(''))

	# Act:
	gas_price = await connector.gas_price()

	# Assert:
	assert [f'{server.make_url("")}/'] == server.mock.urls
	assert [make_rpc_request_json('eth_gasPrice', [])] == server.mock.request_json_payloads
	assert 0x1DFD14000 == gas_price


async def test_can_estimate_gas(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = EthereumConnector(server.make_url(''))

	# Act:
	gas = await connector.estimate_gas({
		'from': '0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97',
		'to': '0xb5368c39Efb0DbA28C082733FE3F9463A215CC3D'
	})

	# Assert:
	assert [f'{server.make_url("")}/'] == server.mock.urls
	assert [make_rpc_request_json('eth_estimateGas', [
		{
			'from': '0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97',
			'to': '0xb5368c39Efb0DbA28C082733FE3F9463A215CC3D'
		}
	])] == server.mock.request_json_payloads
	assert 0x4201 == gas


async def test_can_estimate_fees_from_history(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = EthereumConnector(server.make_url(''))

	# Act:
	fee_information = await connector.estimate_fees_from_history(10)

	# Assert:
	assert [f'{server.make_url("")}/'] == server.mock.urls
	assert [make_rpc_request_json('eth_feeHistory', [10, 'latest', [50]])] == server.mock.request_json_payloads
	assert 0x943704DF == fee_information.base_fee
	assert 0x25254701 == fee_information.priority_fee

# endregion


# region filter_confirmed_transactions

async def _run_can_filter_confirmed_transactions_test(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = EthereumConnector(server.make_url(''))
	transaction_hashes = [Hash256(HASHES[i]) for i in (0, 3, 1, 2)]

	# Act:
	transaction_hash_height_pairs = await connector.filter_confirmed_transactions(transaction_hashes)

	# Assert:
	assert [f'{server.make_url("")}/'] * 6 == server.mock.urls

	assert [
		make_rpc_request_json('eth_getTransactionByHash', [f'0x{transaction_hash}'])
		for transaction_hash in transaction_hashes
	] + [
		# - eth_getTransactionReceipt is only called for confirmed transactions
		make_rpc_request_json('eth_getTransactionReceipt', [f'0x{HASHES[index]}'])
		for index in (0, 2)
	] == server.mock.request_json_payloads

	return transaction_hash_height_pairs


async def test_can_filter_confirmed_transactions(server):  # pylint: disable=redefined-outer-name
	# Act:
	transaction_hash_height_pairs = await _run_can_filter_confirmed_transactions_test(server)

	# Assert:
	assert 2 == len(transaction_hash_height_pairs)
	assert (Hash256(HASHES[0]), 0xAF) == transaction_hash_height_pairs[0]
	assert (Hash256(HASHES[2]), 0xA8) == transaction_hash_height_pairs[1]


async def test_can_filter_confirmed_transactions_excludes_transactions_with_execution_failure(server):
	# pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.failed_transaction_execution_hash = f'0x{HASHES[0]}'

	# Act:
	transaction_hash_height_pairs = await _run_can_filter_confirmed_transactions_test(server)

	# Assert:
	assert 1 == len(transaction_hash_height_pairs)
	assert (Hash256(HASHES[2]), 0xA8) == transaction_hash_height_pairs[0]

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
		make_rpc_request_json('ots_searchTransactionsBefore', ['0xB668a7Cdc62108fAC00F65E1690591B67A1eF7c9', expected_start_id, 25])
	] == server.mock.request_json_payloads

	hashes = [
		'0x12dfb8047ec57ba5a34a4ce8b8206e5020da409e06cdcf4ad02cc1034aa178ed',
		'0x7a184ca95fadc36f35bde72b4f042b281664c9db16e83a8d9ac10ee5b0491f77',
		'0x6f246476cff6570f9153cd4a463d4a25e6bf9ef1a1fc7b740523362fb391a45c'
	]
	assert [
		{'meta': {'height': 29, 'isSuccess': False}, 'transaction': {'blockNumber': '0x1d', 'nonce': '0x2', 'hash': hashes[0]}},
		{'meta': {'height': 26, 'isSuccess': True}, 'transaction': {'blockNumber': '0x1a', 'nonce': '0x3', 'hash': hashes[1]}},
		{'meta': {'height': 7, 'isSuccess': False}, 'transaction': {'blockNumber': '0x7', 'nonce': '0x1', 'hash': hashes[2]}}
	] == transactions


async def test_can_query_incoming_transactions_from_beginning(server):  # pylint: disable=redefined-outer-name
	await _assert_can_query_incoming_transactions(server, None, 0)


async def test_can_query_incoming_transactions_with_custom_start_id(server):  # pylint: disable=redefined-outer-name
	await _assert_can_query_incoming_transactions(server, 98765, 98765)

# endregion


# region announce_transaction

EXAMPLE_TRANSACTION_SIGNING_PAYLOAD_HEX = ''.join([
	'F86C8086D55698372431831E848094F0109FC8DF283027B6285CC889F5AA624E',
	'AC1F55843B9ACA0080820A95A06FF308663C63A472CC873D34D27BF78626122C',
	'7715B87E5AC2E1042D4DDDA494A064508194FA59205819F37C7F05A0A24667BD',
	'22BE77EE7A2EC14F33001CA3DDB4'
])


async def test_can_announce_transaction_success(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = EthereumConnector(server.make_url(''))
	transaction = {'signature': SignedTransaction(HexBytes(EXAMPLE_TRANSACTION_SIGNING_PAYLOAD_HEX))}

	# Act:
	await connector.announce_transaction(transaction)

	# Assert:
	assert [f'{server.make_url("")}/'] * 2 == server.mock.urls
	assert [
		make_rpc_request_json('eth_syncing', []),
		make_rpc_request_json('eth_sendRawTransaction', [f'0x{EXAMPLE_TRANSACTION_SIGNING_PAYLOAD_HEX.lower()}'])
	] == server.mock.request_json_payloads


async def test_cannot_announce_transaction_with_error(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.simulate_announce_error = True

	connector = EthereumConnector(server.make_url(''))
	transaction = {'signature': SignedTransaction(HexBytes(EXAMPLE_TRANSACTION_SIGNING_PAYLOAD_HEX))}

	# Act + Assert:
	with pytest.raises(NodeException, match='eth_sendRawTransaction RPC call failed: INTERNAL_ERROR: IntrinsicGas'):
		await connector.announce_transaction(transaction)


async def test_cannot_announce_transaction_with_error_insufficient_balance(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.simulate_announce_error = 'execution reverted: ERC20: transfer amount exceeds balance'

	connector = EthereumConnector(server.make_url(''))
	transaction = {'signature': SignedTransaction(HexBytes(EXAMPLE_TRANSACTION_SIGNING_PAYLOAD_HEX))}

	# Act + Assert:
	with pytest.raises(InsufficientBalanceException, match=f'eth_sendRawTransaction RPC call failed: {server.mock.simulate_announce_error}'):
		await connector.announce_transaction(transaction)


async def test_cannot_announce_transaction_to_syncing_node(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.simulate_sync = True

	connector = EthereumConnector(server.make_url(''))
	transaction = {'signature': SignedTransaction(HexBytes(EXAMPLE_TRANSACTION_SIGNING_PAYLOAD_HEX))}

	# Act + Assert:
	with pytest.raises(NodeTransientException, match='node is syncing and cannot accept transactions'):
		await connector.announce_transaction(transaction)


# endregion


# region try_wait_for_announced_transaction

async def _assert_can_try_wait_for_announced_transaction_success(server, transaction_hash, status):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = EthereumConnector(server.make_url(''))

	# Act:
	result = await connector.try_wait_for_announced_transaction(transaction_hash, status, TimeoutSettings(5, 0.001))

	# Assert:
	is_confirmed = transaction_hash == Hash256(HASHES[0])

	assert [f'{server.make_url("")}/'] * (3 if is_confirmed else 2) == server.mock.urls
	assert [
		make_rpc_request_json('eth_syncing', []),
		make_rpc_request_json('eth_getTransactionByHash', [f'0x{transaction_hash}']),
		*([make_rpc_request_json('eth_getTransactionReceipt', [f'0x{transaction_hash}'])] if is_confirmed else [])
	] == server.mock.request_json_payloads
	assert result


async def _assert_can_try_wait_for_announced_transaction_timeout(server, transaction_hash, status):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = EthereumConnector(server.make_url(''))

	# Act:
	result = await connector.try_wait_for_announced_transaction(transaction_hash, status, TimeoutSettings(5, 0.001))

	# Assert:
	assert [f'{server.make_url("")}/'] * 6 == server.mock.urls
	assert [
		make_rpc_request_json('eth_syncing', [])
	] + [
		make_rpc_request_json('eth_getTransactionByHash', [f'0x{transaction_hash}'])
	] * 5 == server.mock.request_json_payloads
	assert not result


async def test_can_try_wait_for_announced_transaction_unconfirmed_success_confirmed(server):  # pylint: disable=redefined-outer-name
	await _assert_can_try_wait_for_announced_transaction_success(server, Hash256(HASHES[0]), TransactionStatus.UNCONFIRMED)


async def test_can_try_wait_for_announced_transaction_unconfirmed_success_unconfirmed(server):  # pylint: disable=redefined-outer-name
	await _assert_can_try_wait_for_announced_transaction_success(server, Hash256(HASHES[1]), TransactionStatus.UNCONFIRMED)


async def test_can_try_wait_for_announced_transaction_unconfirmed_timeout(server):  # pylint: disable=redefined-outer-name
	await _assert_can_try_wait_for_announced_transaction_timeout(server, Hash256(HASHES[3]), TransactionStatus.UNCONFIRMED)


async def test_can_try_wait_for_announced_transaction_confirmed_success(server):  # pylint: disable=redefined-outer-name
	await _assert_can_try_wait_for_announced_transaction_success(server, Hash256(HASHES[0]), TransactionStatus.CONFIRMED)


async def test_can_try_wait_for_announced_transaction_confirmed_timeout_unconfirmed(server):  # pylint: disable=redefined-outer-name
	await _assert_can_try_wait_for_announced_transaction_timeout(server, Hash256(HASHES[1]), TransactionStatus.CONFIRMED)


async def test_can_try_wait_for_announced_transaction_confirmed_timeout_unknown(server):  # pylint: disable=redefined-outer-name
	await _assert_can_try_wait_for_announced_transaction_timeout(server, Hash256(HASHES[3]), TransactionStatus.CONFIRMED)


async def test_cannot_try_wait_for_announced_transaction_to_syncing_node(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.simulate_sync = True

	connector = EthereumConnector(server.make_url(''))

	# Act + Assert:
	with pytest.raises(NodeTransientException, match='node is syncing and cannot check transaction status'):
		await connector.try_wait_for_announced_transaction(Hash256(HASHES[0]), TransactionStatus.UNCONFIRMED, TimeoutSettings(5, 0.001))


async def test_cannot_try_wait_for_announced_transaction_with_execution_failure(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.failed_transaction_execution_hash = f'0x{HASHES[0]}'

	connector = EthereumConnector(server.make_url(''))

	# Act + Assert:
	with pytest.raises(ConfirmedTransactionExecutionFailure, match='transaction confirmed on chain but failed execution'):
		await connector.try_wait_for_announced_transaction(Hash256(HASHES[0]), TransactionStatus.UNCONFIRMED, TimeoutSettings(5, 0.001))

# endregion
