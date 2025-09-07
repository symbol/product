import asyncio
from binascii import hexlify, unhexlify
from decimal import Decimal

import pytest
from symbolchain.CryptoTypes import Hash256, PrivateKey

from bridge.ethereum.EthereumAdapters import EthereumAddress, EthereumPublicKey, EthereumSdkFacade
from bridge.ethereum.EthereumConnector import EthereumConnector
from bridge.ethereum.EthereumNetworkFacade import EthereumNetworkFacade
from bridge.models.BridgeConfiguration import NetworkConfiguration
from bridge.models.WrapRequest import WrapError, WrapRequest
from bridge.NetworkUtils import BalanceTransfer

from ..test.BridgeTestUtils import assert_wrap_request_failure, assert_wrap_request_success
from ..test.MockEthereumServer import create_simple_ethereum_client
from ..test.PytestUtils import PytestAsserter


@pytest.fixture
async def server(aiohttp_client):
	return await create_simple_ethereum_client(aiohttp_client)


# pylint: disable=invalid-name


# region constructor, init

def _create_config(server=None, mosaic_id=None, config_extensions=None):  # pylint: disable=redefined-outer-name
	endpoint = server.make_url('') if server else 'http://foo.bar:1234'
	mosaic_id = '0x0D8775F648430679A709E98d2b0Cb6250d2887EF' if mosaic_id is None else mosaic_id
	signer_key_pair = EthereumSdkFacade.KeyPair(PrivateKey('0999A20D4FDDA8D7273E8A24F70E1105F9DCFCAE2FBA55E9A08F6E752411ED7A'))
	return NetworkConfiguration('ethereum', 'testnet', endpoint, '0x67b1d87101671b127f5f8714789C7192f7ad340e', mosaic_id, {
		'chain_id': '8876',
		'signer_public_key': f'0x{signer_key_pair.public_key}',
		**(config_extensions or {})
	})


def test_can_create_facade():
	# Act:
	facade = EthereumNetworkFacade(_create_config())

	# Assert:
	assert 'testnet' == facade.network.name
	assert facade.rosetta_network_id is None
	assert facade.network == facade.sdk_facade.network
	assert EthereumAddress('0x67b1d87101671b127f5f8714789C7192f7ad340e') == facade.bridge_address
	assert EthereumAddress('0x0D8775F648430679A709E98d2b0Cb6250d2887EF') == facade.transaction_search_address
	assert 8876 == facade.chain_id
	assert 18 == facade.NativeTokenPrecision


def test_can_create_facade_for_native_eth():
	# Act:
	facade = EthereumNetworkFacade(_create_config(mosaic_id=''))

	# Assert:
	assert 'testnet' == facade.network.name
	assert facade.rosetta_network_id is None
	assert facade.network == facade.sdk_facade.network
	assert EthereumAddress('0x67b1d87101671b127f5f8714789C7192f7ad340e') == facade.bridge_address
	assert EthereumAddress('0x67b1d87101671b127f5f8714789C7192f7ad340e') == facade.transaction_search_address
	assert 8876 == facade.chain_id
	assert 18 == facade.NativeTokenPrecision


async def test_can_initialize_facade(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = EthereumNetworkFacade(_create_config(server))

	# Act:
	await facade.init()

	# Assert:
	assert {EthereumAddress('0xb5368c39Efb0DbA28C082733FE3F9463A215CC3D'): 14} == facade.address_to_nonce_map

# endregion


# region extract_mosaic_id

def test_can_extract_mosaic_id():
	# Arrange:
	facade = EthereumNetworkFacade(_create_config(mosaic_id='0x0ff070994dd3fdB1441433c219A42286ef85290f'))

	# Act:
	mosaic_id = facade.extract_mosaic_id()

	# Assert:
	assert '0x0ff070994dd3fdB1441433c219A42286ef85290f' == mosaic_id.id
	assert '0x0ff070994dd3fdB1441433c219A42286ef85290f' == mosaic_id.formatted


def test_can_extract_mosaic_id_for_native_eth():
	# Arrange:
	facade = EthereumNetworkFacade(_create_config(mosaic_id=''))

	# Act:
	mosaic_id = facade.extract_mosaic_id()

	# Assert:
	assert '' == mosaic_id.id
	assert 'ETH' == mosaic_id.formatted

# endregion


# region create_connector

def test_can_create_connector():
	# Arrange:
	config = _create_config()
	facade = EthereumNetworkFacade(config)

	# Act:
	connector = facade.create_connector()

	# Assert:
	assert isinstance(connector, EthereumConnector)
	assert 'http://foo.bar:1234' == connector.endpoint
	assert connector.is_finalization_supported


def test_can_create_connector_with_finalization_disabled():
	# Arrange:
	config = _create_config(config_extensions={'is_finalization_supported': 'False'})
	facade = EthereumNetworkFacade(config)

	# Act:
	connector = facade.create_connector()

	# Assert:
	assert isinstance(connector, EthereumConnector)
	assert 'http://foo.bar:1234' == connector.endpoint
	assert not connector.is_finalization_supported

# endregion


# region make_address, make_public_key

def test_can_make_address():
	# Arrange:
	facade = EthereumNetworkFacade(_create_config())

	# Act:
	address_from_string = facade.make_address('0xa94f5374Fce5edBC8E2a8697C15331677e6EbF0B')
	address_from_bytes = facade.make_address(unhexlify('A94F5374FCE5EDBC8E2A8697C15331677E6EBF0B'))

	# Assert:
	assert EthereumAddress('0xa94f5374Fce5edBC8E2a8697C15331677e6EbF0B') == address_from_string
	assert EthereumAddress('0xa94f5374Fce5edBC8E2a8697C15331677e6EbF0B') == address_from_bytes


def test_can_make_public_key():
	# Arrange:
	ETHEREUM_PUBLIC_KEY_HEX = ''.join([
		'B2B454118618A6D3E79FEDE753F60824C4D7E5EA15B4282D847801C8246A5A7C',
		'AB017D4EFA17D1EB61DA79E3632D33B5123E158135C94CA741BB05566FFFA757'
	])

	facade = EthereumNetworkFacade(_create_config())

	# Act:
	public_key_from_string = facade.make_public_key(f'0x{ETHEREUM_PUBLIC_KEY_HEX}')
	public_key_from_bytes = facade.make_public_key(unhexlify(ETHEREUM_PUBLIC_KEY_HEX))

	# Assert:
	assert EthereumPublicKey(f'0x{ETHEREUM_PUBLIC_KEY_HEX}') == public_key_from_string
	assert EthereumPublicKey(f'0x{ETHEREUM_PUBLIC_KEY_HEX}') == public_key_from_bytes

# endregion


# region is_valid_address

def test_is_valid_address_only_returns_true_for_valid_addresses_on_network():
	# Arrange:
	facade = EthereumNetworkFacade(_create_config())

	# Act + Assert:
	assert (True, '0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97') == facade.is_valid_address('0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97')

	assert (False, None) == facade.is_valid_address('NCHESTYVD2P6P646AMY7WSNG73PCPZDUQNSD6JAK')  # nem mainnet
	assert (False, None) == facade.is_valid_address('TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG')  # nem testnet
	assert (False, None) == facade.is_valid_address('NCHEST3QRQS4JZGOO64TH7NFJ2A63YA7TPM5PXI')   # symbol mainnet
	assert (False, None) == facade.is_valid_address('TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ')   # symbol testnet

# endregion


# region extract_wrap_request_from_transaction

def _extract_wrap_request_from_transaction(is_valid_address, receipient_address):
	# Arrange:
	facade = EthereumNetworkFacade(_create_config())

	input_data = ''.join([
		'0x',
		'a9059cbb000000000000000000000000',
		receipient_address,
		hexlify(int(9999_000000).to_bytes(32, 'big')).decode('utf8'),
		'983678467BDE6B234D8DDE673914A407AAB7287F244835DF'
	])

	# Act:
	results = facade.extract_wrap_request_from_transaction(lambda address: (is_valid_address, hexlify(address).decode('utf8').upper()), {
		'meta': {
			'height': 1234
		},
		'transaction': {
			'from': '0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97',
			'hash': '0x45202E96C89D8CADB83E1CD8684E5072580C8B7F5787412946EFEA0D38CB3210',
			'input': input_data
		}
	})
	return results


def _assert_can_extract_wrap_request_from_transaction(is_valid_address, expected_request_or_error, assert_wrap_request):
	# Act: use bridge address as recipient
	results = _extract_wrap_request_from_transaction(is_valid_address, '67b1d87101671b127f5f8714789C7192f7ad340e')

	# Assert:
	assert 1 == len(results)
	assert_wrap_request(PytestAsserter(), results[0], expected_request_or_error)


def test_can_extract_wrap_request_from_transaction_is_valid_address():
	expected_request = WrapRequest(
		1234,
		Hash256('45202E96C89D8CADB83E1CD8684E5072580C8B7F5787412946EFEA0D38CB3210'),
		-1,
		EthereumAddress('0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97'),
		9999_000000,
		'983678467BDE6B234D8DDE673914A407AAB7287F244835DF')

	_assert_can_extract_wrap_request_from_transaction(True, expected_request, assert_wrap_request_success)


def test_cannot_extract_wrap_request_from_transaction_not_is_valid_address():
	expected_error = WrapError(
		1234,
		Hash256('45202E96C89D8CADB83E1CD8684E5072580C8B7F5787412946EFEA0D38CB3210'),
		-1,
		EthereumAddress('0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97'),
		'destination address 983678467BDE6B234D8DDE673914A407AAB7287F244835DF is invalid')

	_assert_can_extract_wrap_request_from_transaction(False, expected_error, assert_wrap_request_failure)


def test_cannot_extract_wrap_request_from_transaction_mismatched_recipient():
	# Act: use other address as recipient
	results = _extract_wrap_request_from_transaction(True, '67b1d87101671b127f5f8714789C7192f7ad340f')

	# Assert:
	assert 0 == len(results)

# endregion


# region create_transfer_transaction

def _create_sample_balance_transfer(signer_public_key=None):
	default_signer_public_key = ''.join([
		'0x',
		'B2B454118618A6D3E79FEDE753F60824C4D7E5EA15B4282D847801C8246A5A7C',
		'AB017D4EFA17D1EB61DA79E3632D33B5123E158135C94CA741BB05566FFFA757'
	])

	return BalanceTransfer(
		EthereumPublicKey(signer_public_key or default_signer_public_key),
		EthereumAddress('0xF0109fC8DF283027b6285cc889F5aA624EaC1F55'),
		88888_000000,
		None)


async def test_cannot_create_transfer_transaction_from_account_with_unknown_nonce(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = EthereumNetworkFacade(_create_config(server))
	await facade.init()

	signer_address = '0xC3B280FA8E521B3263bD6db705ACe0B309306A73'
	signer_public_key = ''.join([
		'0x',
		'B2B454118618A6D3E79FEDE753F60824C4D7E5EA15B4282D847801C8246A5A7C',
		'E29BD9A71871F0CAE8D14BF54A24652670111E6D13EBA155E6648554322AB301'
	])

	# Act + Assert:
	with pytest.raises(ValueError, match=f'unable to create transaction for sender {signer_address} with unknown nonce'):
		await facade.create_transfer_transaction(
			None,
			_create_sample_balance_transfer(signer_public_key),
			'0x67b1d87101671b127f5f8714789C7192f7ad340e')


async def _assert_can_create_transfer_transaction(server, config_extensions, expected_values):
	# pylint: disable=redefined-outer-name
	facade = EthereumNetworkFacade(_create_config(server, config_extensions=config_extensions))
	await facade.init()

	# Act:
	transaction = await facade.create_transfer_transaction(
		None,
		_create_sample_balance_transfer(),
		'0x67b1d87101671b127f5f8714789C7192f7ad340e')

	# Assert:
	assert {
		'from': '0xb5368c39Efb0DbA28C082733FE3F9463A215CC3D',
		'to': '0x67b1d87101671b127f5f8714789C7192f7ad340e',
		'data': ''.join([
			'0x',
			'a9059cbb000000000000000000000000',
			'F0109fC8DF283027b6285cc889F5aA624EaC1F55',
			hexlify(int(88888_000000).to_bytes(32, 'big')).decode('utf8')
		]),
		'nonce': 14,
		'chainId': 8876,

		'gas': expected_values['gas'],
		'maxFeePerGas': expected_values['max_fee_per_gas'],
		'maxPriorityFeePerGas': expected_values['max_priority_fee_per_gas']
	} == transaction


async def test_can_create_transfer_transaction(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.gas_price_override = 1000

	# Act + Assert:
	await _assert_can_create_transfer_transaction(server, None, {
		'gas': 24150,  # ceil(21000 * 1.15 == 24150)
		'max_fee_per_gas': 2983960434 + 654360002,  # ceil(2486633695 * 1.2 == 2983960434) + ceil(623200001 * 1.05 == 654360001.05)
		'max_priority_fee_per_gas': 654360002  # ceil(623200001 * 1.05 == 654360001.05)
	})


async def test_can_create_transfer_transaction_with_multiple_custom_properties(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.gas_price_override = 1000

	# Act + Assert:
	await _assert_can_create_transfer_transaction(server, {
		'gas_multiple': '1.1111',
		'gas_price_multiple': '1.1',
		'priority_fee_multiple': '1.11'
	}, {
		'gas': 23334,  # ceil(21000 * 1.1111 == 23333.1)
		'max_fee_per_gas': 2735297065 + 691752002,  # ceil(2486633695 * 1.1 == 2735297064.5) + ceil(623200001 * 1.11 == 691752001.11)
		'max_priority_fee_per_gas': 691752002  # ceil(623200001 * 1.11 == 691752001.11)
	})


async def test_can_create_transfer_transaction_with_gas_price_fallback(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.gas_price_override = 2983960434 + 654360002 + 1000000  # 3639320436

	# Act + Assert:
	await _assert_can_create_transfer_transaction(server, None, {
		'gas': 24150,  # ceil(21000 * 1.15 == 24150)
		'max_fee_per_gas': 4367184524,  # ceil(3639320436 * 1.2 == 4367184523.2)
		'max_priority_fee_per_gas': 4367184524 - 2983960434  # ceil(3639320436 * 1.2 == 4367184523.2) - ceil(2486633695 * 1.2 == 2983960434)
	})


async def test_can_create_multiple_transfer_transactions_with_autoincrementing_nonce(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = EthereumNetworkFacade(_create_config(server))
	await facade.init()

	# Act:
	transactions = await asyncio.gather(*[
		facade.create_transfer_transaction(
			None,
			_create_sample_balance_transfer(),
			'0x67b1d87101671b127f5f8714789C7192f7ad340e')
		for _ in range(0, 4)
	])

	# Assert:
	assert [14, 15, 16, 17] == [transaction['nonce'] for transaction in transactions]


async def _assert_can_create_transfer_transaction_native(server, config_extensions, expected_values):
	# pylint: disable=redefined-outer-name
	facade = EthereumNetworkFacade(_create_config(server, mosaic_id='', config_extensions=config_extensions))
	await facade.init()

	# Act:
	transaction = await facade.create_transfer_transaction(None, _create_sample_balance_transfer(), '')

	# Assert:
	assert {
		'from': '0xb5368c39Efb0DbA28C082733FE3F9463A215CC3D',
		'to': '0xF0109fC8DF283027b6285cc889F5aA624EaC1F55',
		'value': hex(88888_000000),
		'nonce': 14,
		'chainId': 8876,

		'gas': expected_values['gas'],
		'maxFeePerGas': expected_values['max_fee_per_gas'],
		'maxPriorityFeePerGas': expected_values['max_priority_fee_per_gas']
	} == transaction


async def test_can_create_transfer_transaction_native(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.gas_price_override = 1000

	# Act + Assert:
	await _assert_can_create_transfer_transaction_native(server, None, {
		'gas': 19432,  # ceil(16897 * 1.15 == 19431.55)
		'max_fee_per_gas': 2983960434 + 654360002,  # ceil(2486633695 * 1.2 == 2983960434) + ceil(623200001 * 1.05 == 654360001.05)
		'max_priority_fee_per_gas': 654360002  # ceil(623200001 * 1.05 == 654360001.05)
	})


async def test_can_create_transfer_transaction_native_with_multiple_custom_properties(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.gas_price_override = 1000

	# Act + Assert:
	await _assert_can_create_transfer_transaction_native(server, {
		'gas_multiple': '1.1111',
		'gas_price_multiple': '1.1',
		'priority_fee_multiple': '1.11'
	}, {
		'gas': 18775,  # ceil(16897 * 1.1111 == 18774.2567)
		'max_fee_per_gas': 2735297065 + 691752002,  # ceil(2486633695 * 1.1 == 2735297064.5) + ceil(623200001 * 1.11 == 691752001.11)
		'max_priority_fee_per_gas': 691752002  # ceil(623200001 * 1.11 == 691752001.11)
	})


async def test_can_create_transfer_transaction_native_with_gas_price_fallback(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.gas_price_override = 2983960434 + 654360002 + 1000000  # 3639320436

	# Act + Assert:
	await _assert_can_create_transfer_transaction_native(server, None, {
		'gas': 19432,  # ceil(16897 * 1.15 == 19431.55)
		'max_fee_per_gas': 4367184524,  # ceil(3639320436 * 1.2 == 4367184523.2)
		'max_priority_fee_per_gas': 4367184524 - 2983960434  # ceil(3639320436 * 1.2 == 4367184523.2) - ceil(2486633695 * 1.2 == 2983960434)
	})


# endregion


# region calculate_transfer_transaction_fee

async def _assert_can_calculate_transfer_transaction_fee(server, config_extensions, expected_transaction_fee):
	# pylint: disable=redefined-outer-name
	# Arrange:
	facade = EthereumNetworkFacade(_create_config(server, config_extensions=config_extensions))
	await facade.init()

	# Act:
	transaction_fee = await facade.calculate_transfer_transaction_fee(
		_create_sample_balance_transfer(),
		'0x67b1d87101671b127f5f8714789C7192f7ad340e')

	# Assert:
	assert expected_transaction_fee == transaction_fee


async def test_can_calculate_transfer_transaction_fee(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.gas_price_override = 1000

	# Act + Assert:
	# - gas          => ceil(21000 * 1.15 == 24150)
	# - gas_price    => ceil(8049999872 * 1.2 == 9659999846.4)
	# - base_fee     => ceil(2486633695 * 1.2 == 2983960434)
	# - priority_fee => ceil(623200001 * 1.05 == 654360001.05)
	await _assert_can_calculate_transfer_transaction_fee(server, None, Decimal(24150 * (2983960434 + 654360002)))


async def test_can_calculate_transfer_transaction_fee_with_multiple_custom_properties(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.gas_price_override = 1000

	# Act + Assert:
	# - gas          => ceil(21000 * 1.1111 == 23333.1)
	# - gas_price    => ceil(8049999872 * 1.1 == 8854999859.2)
	# - base_fee     => ceil(2486633695 * 1.1 == 2735297064.5
	# - priority_fee => ceil(623200001 * 1.11 == 691752001.11)
	await _assert_can_calculate_transfer_transaction_fee(server, {
		'gas_multiple': '1.1111',
		'gas_price_multiple': '1.1',
		'priority_fee_multiple': '1.11'
	}, Decimal(23334 * (2735297065 + 691752002)))


async def test_can_calculate_transfer_transaction_fee_gas_price_fallback(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.gas_price_override = 2983960434 + 654360002 + 1000000  # 3639320436

	# Act + Assert:
	# - gas          => ceil(21000 * 1.15 == 24150)
	# - gas_price    => ceil(3639320436 * 1.2 == 4367184523.2)
	# - base_fee     => ceil(2486633695 * 1.2 == 2983960434)
	# - priority_fee => ceil(623200001 * 1.05 == 654360001.05)
	await _assert_can_calculate_transfer_transaction_fee(server, None, Decimal(24150 * 4367184524))


async def test_can_calculate_transfer_transaction_fee_for_account_with_unknown_nonce(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.gas_price_override = 1000

	facade = EthereumNetworkFacade(_create_config(server))
	await facade.init()

	signer_public_key = ''.join([
		'0x',
		'B2B454118618A6D3E79FEDE753F60824C4D7E5EA15B4282D847801C8246A5A7C',
		'E29BD9A71871F0CAE8D14BF54A24652670111E6D13EBA155E6648554322AB301'
	])

	# Act:
	transaction_fee = await facade.calculate_transfer_transaction_fee(
		_create_sample_balance_transfer(signer_public_key),
		'0x67b1d87101671b127f5f8714789C7192f7ad340e')

	# Act + Assert:
	# - gas          => ceil(21000 * 1.15 == 24150)
	# - gas_price    => ceil(8049999872 * 1.2 == 9659999846.4)
	# - base_fee     => ceil(2486633695 * 1.2 == 2983960434)
	# - priority_fee => ceil(623200001 * 1.05 == 654360001.05)
	assert Decimal(24150 * (2983960434 + 654360002)) == transaction_fee

# endregion
