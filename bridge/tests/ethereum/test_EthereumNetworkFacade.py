from binascii import hexlify

import pytest
from symbolchain.CryptoTypes import Hash256

from bridge.ethereum.EthereumAdapters import EthereumAddress
from bridge.ethereum.EthereumConnector import EthereumConnector
from bridge.ethereum.EthereumNetworkFacade import EthereumNetworkFacade
from bridge.models.BridgeConfiguration import NetworkConfiguration
from bridge.models.WrapRequest import WrapError, WrapRequest

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
		'mosaic_id': '0x0D8775F648430679A709E98d2b0Cb6250d2887EF',
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


async def test_can_initialize_facade(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = EthereumNetworkFacade(_create_config(server))

	# Act:
	await facade.init()

	# Assert:
	assert 3 == facade.token_precision

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
