from binascii import hexlify

import pytest
from symbolchain.CryptoTypes import Hash256

from bridge.ethereum.EthereumAdapters import EthereumAddress, EthereumPublicKey
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

def _create_config(server=None, config_extensions=None):  # pylint: disable=redefined-outer-name
	endpoint = server.make_url('') if server else 'http://foo.bar:1234'
	return NetworkConfiguration('ethereum', 'testnet', endpoint, '0x67b1d87101671b127f5f8714789C7192f7ad340e', {
		'chain_id': '8876',
		'mosaic_id': '0x0D8775F648430679A709E98d2b0Cb6250d2887EF',
		'signing_private_key': '0999a20d4fdda8d7273e8a24f70e1105f9dcfcae2fba55e9a08f6e752411ed7a',
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


async def test_can_initialize_facade(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = EthereumNetworkFacade(_create_config(server))

	# Act:
	await facade.init()

	# Assert:
	assert 3 == facade.token_precision
	assert {EthereumAddress('0xb5368c39Efb0DbA28C082733FE3F9463A215CC3D'): 11} == facade.address_to_nonce_map

# endregion


# region extract_mosaic_id

def test_can_extract_mosaic_id():
	# Arrange:
	facade = EthereumNetworkFacade(_create_config(config_extensions={
		'mosaic_id': '0x0ff070994dd3fdB1441433c219A42286ef85290f'
	}))

	# Act:
	mosaic_id = facade.extract_mosaic_id()

	# Assert:
	assert '0x0ff070994dd3fdB1441433c219A42286ef85290f' == mosaic_id.id
	assert '0x0ff070994dd3fdB1441433c219A42286ef85290f' == mosaic_id.formatted

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


# region make_address

def test_can_make_address():
	# Arrange:
	facade = EthereumNetworkFacade(_create_config())

	# Act:
	address_from_string = facade.make_address('0xa94f5374Fce5edBC8E2a8697C15331677e6EbF0B')

	# Assert:
	assert EthereumAddress('0xa94f5374Fce5edBC8E2a8697C15331677e6EbF0B') == address_from_string

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

	# Act + Assert:
	signer_address = '0xC3B280FA8E521B3263BD6DB705ACE0B309306A73'
	signer_public_key = ''.join([
		'0x',
		'B2B454118618A6D3E79FEDE753F60824C4D7E5EA15B4282D847801C8246A5A7C',
		'E29BD9A71871F0CAE8D14BF54A24652670111E6D13EBA155E6648554322AB301'
	])
	with pytest.raises(ValueError, match=f'unable to create transaction for sender {signer_address} with unknown nonce'):
		facade.create_transfer_transaction(
			None,
			_create_sample_balance_transfer(signer_public_key),
			'0x67b1d87101671b127f5f8714789C7192f7ad340e')


async def test_can_create_transfer_transaction(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = EthereumNetworkFacade(_create_config(server))
	await facade.init()

	# Act:
	transaction = facade.create_transfer_transaction(
		None,
		_create_sample_balance_transfer(),
		'0x67b1d87101671b127f5f8714789C7192f7ad340e')

	# Assert:
	assert {
		'from': '0xB5368C39EFB0DBA28C082733FE3F9463A215CC3D',
		'to': '0x67b1d87101671b127f5f8714789C7192f7ad340e',
		'data': ''.join([
			'0x',
			'a9059cbb000000000000000000000000',
			'F0109FC8DF283027B6285CC889F5AA624EAC1F55',
			hexlify(int(88888_000000).to_bytes(32, 'big')).decode('utf8')
		]),
		'nonce': 11,
		'chainId': 8876,

		'gas': 210000,
		'maxFeePerGas': 250_000000000,
		'maxPriorityFeePerGas': 2_000000000
	} == transaction


async def test_can_create_multiple_transfer_transactions_with_autoincrementing_nonce(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = EthereumNetworkFacade(_create_config(server))
	await facade.init()

	# Act:
	transactions = [
		facade.create_transfer_transaction(
			None,
			_create_sample_balance_transfer(),
			'0x67b1d87101671b127f5f8714789C7192f7ad340e')
		for _ in range(0, 4)
	]

	# Assert:
	assert [11, 12, 13, 14] == [transaction['nonce'] for transaction in transactions]

# endregion


# region calculate_transfer_transaction_fee

def test_can_calculate_transfer_transaction_fee():
	# Arrange:
	facade = EthereumNetworkFacade(_create_config())

	# Act:
	transaction_fee = facade.calculate_transfer_transaction_fee(_create_sample_balance_transfer(''))

	# Assert:
	assert 210000 == transaction_fee

# endregion
