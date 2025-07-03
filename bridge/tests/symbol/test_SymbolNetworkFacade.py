from binascii import hexlify

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
from ..test.PytestUtils import PytestAsserter, create_simple_symbol_client


@pytest.fixture
async def server(aiohttp_client):
	return await create_simple_symbol_client(aiohttp_client, '0x72C0\'212E\'67A0\'8BCE', {
		'TA6MYQRFJI24C2Y2WPX7QKAPMUDIS5FWZOBIBEA': 9988776655
	})


# pylint: disable=invalid-name


# region constructor, create_connector, make_address, is_valid_address_string

def _create_config(server=None):  # pylint: disable=redefined-outer-name
	return NetworkConfiguration('symbol', 'testnet', server.make_url('') if server else 'http://foo.bar:1234', None, {
		'transaction_fee_multiplier': 50
	})


def test_can_create_facade():
	# Act:
	facade = SymbolNetworkFacade(_create_config())

	# Assert:
	assert 'testnet' == facade.network.name


def test_can_create_connector():
	# Arrange:
	facade = SymbolNetworkFacade(_create_config())

	# Act:
	connector = facade.create_connector()

	# Assert:
	assert isinstance(connector, SymbolConnector)


def test_can_make_address():
	# Arrange:
	facade = SymbolNetworkFacade(_create_config())

	# Act:
	address_from_string = facade.make_address('TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ')
	address_from_bytes = facade.make_address(b'\x98(\xf7\xf013`\xfe\xa8\xda\x86;\xb2\xb7\x19\xae\x7f!\xde\x15\x97Bm"')

	# Assert:
	assert Address('TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ') == address_from_string
	assert Address('TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ') == address_from_bytes


def test_is_valid_address_string_only_returns_true_for_valid_addresses_on_network():
	# Arrange:
	facade = SymbolNetworkFacade(_create_config())

	# Act + Assert:
	assert facade.is_valid_address_string('TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ')         # symbol testnet
	assert not facade.is_valid_address_string('NCHEST3QRQS4JZGOO64TH7NFJ2A63YA7TPM5PXI')     # symbol mainnet
	assert not facade.is_valid_address_string('0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97')  # ethereum
	assert not facade.is_valid_address_string('TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG')    # nem testnet

# endregion


# region load_currency_mosaic_ids

async def test_can_load_currency_mosaic_ids(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = SymbolNetworkFacade(_create_config(server))

	# Act:
	await facade.load_currency_mosaic_ids()

	# Assert:
	assert facade.is_currency_mosaic_id(0x72C0212E67A08BCE)  # from /network/properties
	assert facade.is_currency_mosaic_id(0xE74B99BA41F4AFEE)  # alias symbol.xym
	assert not facade.is_currency_mosaic_id(0x6BED913FA20223F8)  # mainnet

# endregion


# region extract_wrap_request_from_transaction

async def _assert_can_extract_wrap_request_from_transaction(server, is_valid_address, expected_request_or_error, assert_wrap_request):
	# pylint: disable=redefined-outer-name
	# Arrange:
	facade = SymbolNetworkFacade(_create_config(server))
	await facade.load_currency_mosaic_ids()

	# Act:
	results = facade.extract_wrap_request_from_transaction(lambda _address: is_valid_address, {
		'meta': {
			'height': '23456',
			'hash': 'FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA'
		},
		'transaction': {
			'type': sc.TransferTransactionV1.TRANSACTION_TYPE.value,
			'signerPublicKey': '4B7E7A084005D2149B44F6A782D9E597C0FABE56F4FEEC1738FE5152C69D55C3',
			'mosaics': [
				{'id': '0x72C0212E67A08BCE', 'amount': '8888'}
			],
			'message': hexlify('0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97'.encode('utf8')).decode('utf8')
		}
	})

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


async def test_can_extract_wrap_request_from_transaction_not_is_valid_address(server):  # pylint: disable=redefined-outer-name
	expected_error = WrapError(
		23456,
		Hash256('FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA'),
		-1,
		Address('TA6MYQRFJI24C2Y2WPX7QKAPMUDIS5FWZOBIBEA'),
		'destination address 0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97 is invalid')

	await _assert_can_extract_wrap_request_from_transaction(server, False, expected_error, assert_wrap_request_failure)


# endregion


# region lookup_account_balance

async def test_can_lookup_account_balance(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = SymbolNetworkFacade(_create_config(server))
	await facade.load_currency_mosaic_ids()

	# Act:
	balance = await facade.lookup_account_balance(Address('TA6MYQRFJI24C2Y2WPX7QKAPMUDIS5FWZOBIBEA'))

	# Assert:
	assert 9988776655 == balance

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

# endregion
