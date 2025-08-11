from binascii import hexlify, unhexlify

import pytest
from symbolchain import sc
from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.symbol.Network import Address, NetworkTimestamp
from symbollightapi.connector.SymbolConnector import SymbolConnector

from bridge.models.BridgeConfiguration import NetworkConfiguration
from bridge.models.WrapRequest import WrapError, WrapRequest
from bridge.NetworkUtils import BalanceTransfer
from bridge.symbol.SymbolNetworkFacade import SymbolNetworkFacade

from ..test.BridgeTestUtils import assert_wrap_request_failure, assert_wrap_request_success
from ..test.MockSymbolServer import create_simple_symbol_client
from ..test.PytestUtils import PytestAsserter


@pytest.fixture
async def server(aiohttp_client):
	return await create_simple_symbol_client(aiohttp_client, '0x72C0\'212E\'67A0\'8BCE', {
		'TA6MYQRFJI24C2Y2WPX7QKAPMUDIS5FWZOBIBEA': [
			('currency', 9988776655),
			('FAF0EBED913FA202', 1122334455)
		]
	})


# pylint: disable=invalid-name


# region constructor, init

def _create_config(server=None, mosaic_id=None, config_extensions=None):  # pylint: disable=redefined-outer-name
	endpoint = server.make_url('') if server else 'http://foo.bar:1234'
	return NetworkConfiguration('symbol', 'testnet', endpoint, 'TDDRDLK5QL2LJPZOF26QFXB24TJ5HGB4NDTF6SI', mosaic_id, {
		'transaction_fee_multiplier': '50',
		**(config_extensions or {})
	})


def test_can_create_facade():
	# Act:
	facade = SymbolNetworkFacade(_create_config())

	# Assert:
	assert 'testnet' == facade.network.name
	assert ('Symbol', 'testnet') == facade.rosetta_network_id
	assert facade.network == facade.sdk_facade.network
	assert Address('TDDRDLK5QL2LJPZOF26QFXB24TJ5HGB4NDTF6SI') == facade.bridge_address
	assert Address('TDDRDLK5QL2LJPZOF26QFXB24TJ5HGB4NDTF6SI') == facade.transaction_search_address


async def test_can_initialize_facade(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = SymbolNetworkFacade(_create_config(server))

	# Act:
	await facade.init()

	# Assert:
	assert [0x72C0212E67A08BCE, 0xE74B99BA41F4AFEE] == facade.currency_mosaic_ids

# endregion


# region is_currency_mosaic_id

async def test_can_detect_currency_mosaic_id(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = SymbolNetworkFacade(_create_config(server))

	# Act:
	await facade.init()

	# Assert:
	assert facade.is_currency_mosaic_id(0x72C0212E67A08BCE)  # from /network/properties
	assert facade.is_currency_mosaic_id(0xE74B99BA41F4AFEE)  # alias symbol.xym
	assert not facade.is_currency_mosaic_id(0x6BED913FA20223F8)  # mainnet

# endregion


# region extract_mosaic_id

async def test_can_extract_mosaic_id_currency(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = SymbolNetworkFacade(_create_config(server, mosaic_id='id:E74B99BA41F4AFEE'))
	await facade.init()

	# Act:
	mosaic_id = facade.extract_mosaic_id()

	# Assert:
	assert mosaic_id.id is None
	assert 'E74B99BA41F4AFEE' == mosaic_id.formatted


async def test_can_extract_mosaic_id_other(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = SymbolNetworkFacade(_create_config(server, mosaic_id='id:5D6CFC64A20E86E6'))
	await facade.init()

	# Act:
	mosaic_id = facade.extract_mosaic_id()

	# Assert:
	assert 0x5D6CFC64A20E86E6 == mosaic_id.id
	assert '5D6CFC64A20E86E6' == mosaic_id.formatted

# endregion


# region create_connector

def test_can_create_connector():
	# Arrange:
	config = _create_config()
	config.extensions['rosetta_endpoint'] = 'http://rosetta.api:9988'
	facade = SymbolNetworkFacade(config)

	# Act:
	connector = facade.create_connector()

	# Assert:
	assert isinstance(connector, SymbolConnector)
	assert 'http://foo.bar:1234' == connector.endpoint


def test_can_create_connector_rosetta():
	# Arrange:
	config = _create_config()
	config.extensions['rosetta_endpoint'] = 'http://rosetta.api:9988'
	facade = SymbolNetworkFacade(config)

	# Act:
	connector = facade.create_connector(require_rosetta=True)

	# Assert:
	assert isinstance(connector, SymbolConnector)
	assert 'http://foo.bar:1234' == connector.endpoint

# endregion


# region make_address, make_public_key

def test_can_make_address():
	# Arrange:
	facade = SymbolNetworkFacade(_create_config())

	# Act:
	address_from_string = facade.make_address('TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ')
	address_from_bytes = facade.make_address(b'\x98(\xf7\xf013`\xfe\xa8\xda\x86;\xb2\xb7\x19\xae\x7f!\xde\x15\x97Bm"')

	# Assert:
	assert Address('TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ') == address_from_string
	assert Address('TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ') == address_from_bytes


def test_can_make_public_key():
	# Arrange:
	facade = SymbolNetworkFacade(_create_config())

	# Act:
	public_key_from_string = facade.make_public_key('3BB0E477B1675D780DFB78C62CCEE0D43191B04115A4BEA8A1E6959367509983')
	public_key_from_bytes = facade.make_public_key(unhexlify('3BB0E477B1675D780DFB78C62CCEE0D43191B04115A4BEA8A1E6959367509983'))

	# Assert:
	assert PublicKey('3BB0E477B1675D780DFB78C62CCEE0D43191B04115A4BEA8A1E6959367509983') == public_key_from_string
	assert PublicKey('3BB0E477B1675D780DFB78C62CCEE0D43191B04115A4BEA8A1E6959367509983') == public_key_from_bytes

# endregion


# region is_valid_address

def _assert_is_valid_address(address, expected_formatted_address):
	# Arrange:
	facade = SymbolNetworkFacade(_create_config())

	# Act + Assert:
	assert (True, expected_formatted_address) == facade.is_valid_address(address)


def _assert_is_invalid_address(address):
	# Arrange:
	facade = SymbolNetworkFacade(_create_config())

	# Act + Assert:
	assert (False, None) == facade.is_valid_address(address)


def test_is_valid_address_detects_matching_addresses():
	# symbol testnet
	_assert_is_valid_address('TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ', 'TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ')
	_assert_is_valid_address(
		b'\x98(\xf7\xf013`\xfe\xa8\xda\x86;\xb2\xb7\x19\xae\x7f!\xde\x15\x97Bm"',
		'TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ')

	# symbol mainnet
	_assert_is_invalid_address('NCHEST3QRQS4JZGOO64TH7NFJ2A63YA7TPM5PXI')
	_assert_is_invalid_address(b'\x68(\xf7\xf013`\xfe\xa8\xda\x86;\xb2\xb7\x19\xae\x7f!\xde\x15\x97Bm"')

# endregion


# region extract_wrap_request_from_transaction

async def _assert_can_extract_wrap_request_from_transaction(
	server,
	is_valid_address,
	expected_request_or_error,
	assert_wrap_request,
	mosaic_id=None
):
	# pylint: disable=redefined-outer-name
	# Arrange:
	facade = SymbolNetworkFacade(_create_config(server))
	await facade.init()

	# Act:
	results = facade.extract_wrap_request_from_transaction(lambda address: (is_valid_address, address), {
		'meta': {
			'height': '23456',
			'hash': 'FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA'
		},
		'transaction': {
			'type': sc.TransferTransactionV1.TRANSACTION_TYPE.value,
			'signerPublicKey': '4B7E7A084005D2149B44F6A782D9E597C0FABE56F4FEEC1738FE5152C69D55C3',
			'mosaics': [
				{'id': mosaic_id or '72C0212E67A08BCE', 'amount': '8888'}
			],
			'message': hexlify('0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97'.encode('utf8')).decode('utf8')
		}
	}, int(mosaic_id, 16) if mosaic_id else None)

	# Assert:
	assert 1 == len(results)
	assert_wrap_request(PytestAsserter(), results[0], expected_request_or_error)


async def test_can_extract_wrap_request_from_transaction_is_valid_address(server):  # pylint: disable=redefined-outer-name
	expected_request = WrapRequest(
		23456,
		Hash256('FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA'),
		-1,
		Address('TA6MYQRFJI24C2Y2WPX7QKAPMUDIS5FWZOBIBEA'),
		8888,
		'0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97')

	await _assert_can_extract_wrap_request_from_transaction(server, True, expected_request, assert_wrap_request_success)


async def test_cannot_extract_wrap_request_from_transaction_not_is_valid_address(server):  # pylint: disable=redefined-outer-name
	expected_error = WrapError(
		23456,
		Hash256('FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA'),
		-1,
		Address('TA6MYQRFJI24C2Y2WPX7QKAPMUDIS5FWZOBIBEA'),
		'destination address 0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97 is invalid')

	await _assert_can_extract_wrap_request_from_transaction(server, False, expected_error, assert_wrap_request_failure)


async def test_can_extract_wrap_request_from_transaction_matching_custom_mosaic(server):  # pylint: disable=redefined-outer-name
	expected_request = WrapRequest(
		23456,
		Hash256('FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA'),
		-1,
		Address('TA6MYQRFJI24C2Y2WPX7QKAPMUDIS5FWZOBIBEA'),
		8888,
		'0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97')

	await _assert_can_extract_wrap_request_from_transaction(server, True, expected_request, assert_wrap_request_success, 'AABBCCDD112233')

# endregion


# region create_transfer_transaction

def _create_sample_balance_transfer(message):
	return BalanceTransfer(
		PublicKey('4B7E7A084005D2149B44F6A782D9E597C0FABE56F4FEEC1738FE5152C69D55C3'),
		Address('TA6MYQRFJI24C2Y2WPX7QKAPMUDIS5FWZOBIBEA'),
		88888_000000,
		message)


def _assert_sample_balance_transfer_common(transaction):
	def _make_sc_address(address_str):
		return sc.UnresolvedAddress(Address(address_str).bytes)

	assert sc.TransferTransactionV1.TRANSACTION_TYPE == transaction.type_
	assert sc.TransferTransactionV1.TRANSACTION_VERSION == transaction.version
	assert sc.PublicKey('4B7E7A084005D2149B44F6A782D9E597C0FABE56F4FEEC1738FE5152C69D55C3') == transaction.signer_public_key
	assert _make_sc_address('TA6MYQRFJI24C2Y2WPX7QKAPMUDIS5FWZOBIBEA') == transaction.recipient_address
	assert sc.Timestamp(12341234 + 60 * 60 * 1000) == transaction.deadline


def test_can_create_transfer_transaction_without_message():
	# Arrange:
	facade = SymbolNetworkFacade(_create_config())

	# Act:
	transaction = facade.create_transfer_transaction(NetworkTimestamp(12341234), _create_sample_balance_transfer(''))

	# Assert:
	_assert_sample_balance_transfer_common(transaction)
	assert sc.Amount(176 * 50) == transaction.fee

	assert 1 == len(transaction.mosaics)

	mosaic = transaction.mosaics[0]
	assert sc.UnresolvedMosaicId(0xE74B99BA41F4AFEE) == mosaic.mosaic_id
	assert sc.Amount(88888_000000) == mosaic.amount

	assert b'' == transaction.message


def test_can_create_transfer_transaction_with_message():
	# Arrange:
	facade = SymbolNetworkFacade(_create_config())

	# Act:
	transaction = facade.create_transfer_transaction(
		NetworkTimestamp(12341234),
		_create_sample_balance_transfer('this is a medium sized message!!!'))

	# Assert:
	_assert_sample_balance_transfer_common(transaction)
	assert sc.Amount(209 * 50) == transaction.fee

	assert 1 == len(transaction.mosaics)

	mosaic = transaction.mosaics[0]
	assert sc.UnresolvedMosaicId(0xE74B99BA41F4AFEE) == mosaic.mosaic_id
	assert sc.Amount(88888_000000) == mosaic.amount

	assert b'this is a medium sized message!!!' == transaction.message


def test_can_create_transfer_transaction_with_custom_mosaic():
	# Arrange:
	facade = SymbolNetworkFacade(_create_config())

	# Act:
	transaction = facade.create_transfer_transaction(
		NetworkTimestamp(12341234),
		_create_sample_balance_transfer(''),
		mosaic_id=0xABCD12349876FEDC)

	# Assert:
	_assert_sample_balance_transfer_common(transaction)
	assert sc.Amount(176 * 50) == transaction.fee

	assert 1 == len(transaction.mosaics)

	mosaic = transaction.mosaics[0]
	assert sc.UnresolvedMosaicId(0xABCD12349876FEDC) == mosaic.mosaic_id
	assert sc.Amount(88888_000000) == mosaic.amount

	assert b'' == transaction.message

# endregion


# region calculate_transfer_transaction_fee

def test_can_calculate_transfer_transaction_fee_without_message():
	# Arrange:
	facade = SymbolNetworkFacade(_create_config())

	# Act:
	transaction_fee = facade.calculate_transfer_transaction_fee(_create_sample_balance_transfer(''))

	# Assert:
	assert 176 * 50 == transaction_fee


def test_can_calculate_transfer_transaction_fee_with_message():
	# Arrange:
	facade = SymbolNetworkFacade(_create_config())

	# Act:
	transaction_fee = facade.calculate_transfer_transaction_fee(_create_sample_balance_transfer('this is a medium sized message!!!'))

	# Assert:
	assert 209 * 50 == transaction_fee

# endregion
