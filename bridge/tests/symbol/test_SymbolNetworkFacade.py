from binascii import hexlify

import pytest
from symbolchain.CryptoTypes import Hash256
from symbolchain.sc import TransferTransactionV1
from symbolchain.symbol.Network import Address
from symbollightapi.connector.SymbolConnector import SymbolConnector

from bridge.models.WrapRequest import WrapRequest
from bridge.symbol.SymbolNetworkFacade import SymbolNetworkFacade

from ..test.BridgeTestUtils import assert_wrap_request_success
from ..test.PytestUtils import PytestAsserter, create_simple_symbol_client


@pytest.fixture
async def server(aiohttp_client):
	return await create_simple_symbol_client(aiohttp_client, '0x72C0\'212E\'67A0\'8BCE', {
		'TA6MYQRFJI24C2Y2WPX7QKAPMUDIS5FWZOBIBEA': 9988776655
	})


# pylint: disable=invalid-name


def test_can_create_facade():
	# Act:
	facade = SymbolNetworkFacade('testnet')

	# Assert:
	assert 'testnet' == facade.network.name


def test_can_create_connector():
	# Arrange:
	facade = SymbolNetworkFacade('testnet')

	# Act:
	connector = facade.create_connector('http://foo.bar:1234')

	# Assert:
	assert isinstance(connector, SymbolConnector)


def test_can_make_address():
	# Arrange:
	facade = SymbolNetworkFacade('testnet')

	# Act:
	address_from_string = facade.make_address('TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ')
	address_from_bytes = facade.make_address(b'\x98(\xf7\xf013`\xfe\xa8\xda\x86;\xb2\xb7\x19\xae\x7f!\xde\x15\x97Bm"')

	# Assert:
	assert Address('TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ') == address_from_string
	assert Address('TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ') == address_from_bytes


async def test_can_load_currency_mosaic_ids(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = SymbolNetworkFacade('testnet')

	# Act:
	await facade.load_currency_mosaic_ids(server.make_url(''))

	# Assert:
	assert facade.is_currency_mosaic_id(0x72C0212E67A08BCE)  # from /network/properties
	assert facade.is_currency_mosaic_id(0xE74B99BA41F4AFEE)  # alias symbol.xym
	assert not facade.is_currency_mosaic_id(0x6BED913FA20223F8)  # mainnet


async def test_can_extract_wrap_request_from_transaction(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = SymbolNetworkFacade('testnet')
	await facade.load_currency_mosaic_ids(server.make_url(''))

	# Act:
	results = facade.extract_wrap_request_from_transaction({
		'meta': {
			'height': '23456',
			'hash': 'FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA'
		},
		'transaction': {
			'type': TransferTransactionV1.TRANSACTION_TYPE.value,
			'signerPublicKey': '4B7E7A084005D2149B44F6A782D9E597C0FABE56F4FEEC1738FE5152C69D55C3',
			'mosaics': [
				{'id': '0x72C0212E67A08BCE', 'amount': '8888'}
			],
			'message': hexlify('0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97'.encode('utf8')).decode('utf8')
		}
	})

	# Assert:
	assert 1 == len(results)

	expected_request = WrapRequest(
		23456,
		Hash256('FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA'),
		-1,
		Address('TA6MYQRFJI24C2Y2WPX7QKAPMUDIS5FWZOBIBEA'),
		8888,
		'0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97')
	assert_wrap_request_success(PytestAsserter(), results[0], expected_request)


async def test_can_lookup_account_balance(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = SymbolNetworkFacade('testnet')
	await facade.load_currency_mosaic_ids(server.make_url(''))

	connector = facade.create_connector(server.make_url(''))

	# Act:
	balance = await facade.lookup_account_balance(connector, Address('TA6MYQRFJI24C2Y2WPX7QKAPMUDIS5FWZOBIBEA'))

	# Assert:
	assert 9988776655 == balance
