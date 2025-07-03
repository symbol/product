from binascii import hexlify

import pytest
from symbolchain import nc
from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nem.Network import Address, NetworkTimestamp
from symbollightapi.connector.NemConnector import NemConnector

from bridge.models.BridgeConfiguration import NetworkConfiguration
from bridge.models.WrapRequest import WrapError, WrapRequest
from bridge.nem.NemNetworkFacade import NemNetworkFacade
from bridge.NetworkUtils import BalanceTransfer

from ..test.BridgeTestUtils import assert_wrap_request_failure, assert_wrap_request_success
from ..test.PytestUtils import PytestAsserter, create_simple_nem_client


@pytest.fixture
async def server(aiohttp_client):
	return await create_simple_nem_client(aiohttp_client, {
		'TCQKTUUNUOPQGDQIDQT2CCJGQZ4QNAAGBZRV5YJJ': 9988776655
	})


# pylint: disable=invalid-name


# region constructor, create_connector, make_address, is_valid_address_string

def _create_config(server=None):  # pylint: disable=redefined-outer-name
	return NetworkConfiguration('nem', 'testnet', server.make_url('') if server else 'http://foo.bar:1234', None, {})


def test_can_create_facade():
	# Act:
	facade = NemNetworkFacade(_create_config())

	# Assert:
	assert 'testnet' == facade.network.name


def test_can_create_connector():
	# Arrange:
	facade = NemNetworkFacade(_create_config())

	# Act:
	connector = facade.create_connector()

	# Assert:
	assert isinstance(connector, NemConnector)


def test_can_make_address():
	# Arrange:
	facade = NemNetworkFacade(_create_config())

	# Act:
	address_from_string = facade.make_address('TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG')
	address_from_bytes = facade.make_address(b'\x98\x0f6\x80\x90h\xd2\xe0\x8c\xe7\x8b\x9b\xf9*\x9f{\xbc`Z\xe0Nx \xea\x06')

	# Assert:
	assert Address('TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG') == address_from_string
	assert Address('TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG') == address_from_bytes


def test_is_valid_address_string_only_returns_true_for_valid_addresses_on_network():
	# Arrange:
	facade = NemNetworkFacade(_create_config())

	# Act + Assert:
	assert facade.is_valid_address_string('TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG')        # nem testnet
	assert not facade.is_valid_address_string('NCHESTYVD2P6P646AMY7WSNG73PCPZDUQNSD6JAK')    # nem mainnet
	assert not facade.is_valid_address_string('0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97')  # ethereum
	assert not facade.is_valid_address_string('TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ')     # symbol testnet

# endregion


# region extract_wrap_request_from_transaction

async def _assert_can_extract_wrap_request_from_transaction(is_valid_address, expected_request_or_error, assert_wrap_request):
	# Arrange:
	facade = NemNetworkFacade(_create_config())

	# Act:
	results = facade.extract_wrap_request_from_transaction(lambda _address: is_valid_address, {
		'meta': {
			'height': 1234,
			'hash': {
				'data': 'FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA'
			},
		},
		'transaction': {
			'type': nc.TransferTransactionV1.TRANSACTION_TYPE.value,
			'version': (nc.NetworkType.TESTNET.value << 24) | nc.TransferTransactionV1.TRANSACTION_VERSION,
			'amount': 8888,
			'signer': '3917578FF27A88B20E137D9D2E54E775163F9C493A193A64F96748EBF8B21F3C',
			'message': {
				'type': nc.MessageType.PLAIN.value,
				'payload': hexlify('0x4838b106fce9647bdf1e7877bf73ce8b0bad5f98'.encode('utf8')).decode('utf8')
			}
		}
	})

	# Assert:
	assert 1 == len(results)
	assert_wrap_request(PytestAsserter(), results[0], expected_request_or_error)


async def test_can_extract_wrap_request_from_transaction_is_valid_address():
	expected_request = WrapRequest(
		1234,
		Hash256('FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA'),
		-1,
		Address('TCQKTUUNUOPQGDQIDQT2CCJGQZ4QNAAGBZRV5YJJ'),
		8888,
		'0x4838b106fce9647bdf1e7877bf73ce8b0bad5f98')

	await _assert_can_extract_wrap_request_from_transaction(True, expected_request, assert_wrap_request_success)


async def test_can_extract_wrap_request_from_transaction_not_is_valid_address():
	expected_error = WrapError(
		1234,
		Hash256('FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA'),
		-1,
		Address('TCQKTUUNUOPQGDQIDQT2CCJGQZ4QNAAGBZRV5YJJ'),
		'destination address 0x4838b106fce9647bdf1e7877bf73ce8b0bad5f98 is invalid')

	await _assert_can_extract_wrap_request_from_transaction(False, expected_error, assert_wrap_request_failure)

# endregion


# region lookup_account_balance

async def test_can_lookup_account_balance(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = NemNetworkFacade(_create_config(server))

	# Act:
	balance = await facade.lookup_account_balance(Address('TCQKTUUNUOPQGDQIDQT2CCJGQZ4QNAAGBZRV5YJJ'))

	# Assert:
	assert 9988776655 == balance

# endregion


# region create_transfer_transaction

def _create_sample_balance_transfer(message):
	return BalanceTransfer(
		PublicKey('3917578FF27A88B20E137D9D2E54E775163F9C493A193A64F96748EBF8B21F3C'),
		Address('TCQKTUUNUOPQGDQIDQT2CCJGQZ4QNAAGBZRV5YJJ'),
		88888_000000,
		message)


def _assert_sample_balance_transfer_common(transaction, expected_transaction_type):
	def _make_nc_address(address_str):
		return nc.Address(hexlify(address_str.encode('utf8')).decode('utf8'))

	assert expected_transaction_type.TRANSACTION_TYPE == transaction.type_
	assert expected_transaction_type.TRANSACTION_VERSION == transaction.version
	assert nc.PublicKey('3917578FF27A88B20E137D9D2E54E775163F9C493A193A64F96748EBF8B21F3C') == transaction.signer_public_key
	assert _make_nc_address('TCQKTUUNUOPQGDQIDQT2CCJGQZ4QNAAGBZRV5YJJ') == transaction.recipient_address
	assert nc.Timestamp(12341234) == transaction.timestamp
	assert nc.Timestamp(12341234 + 60 * 60) == transaction.deadline


def test_can_create_transfer_transaction_version_one_without_message():
	# Arrange:
	facade = NemNetworkFacade(_create_config())

	# Act:
	transaction = facade.create_transfer_transaction(NetworkTimestamp(12341234), _create_sample_balance_transfer(''))

	# Assert:
	_assert_sample_balance_transfer_common(transaction, nc.TransferTransactionV1)
	assert nc.Amount(400_000) == transaction.fee
	assert nc.Amount(88888_000000) == transaction.amount

	assert transaction.message is None


def test_can_create_transfer_transaction_version_one_with_message():
	# Arrange:
	facade = NemNetworkFacade(_create_config())

	# Act:
	transaction = facade.create_transfer_transaction(
		NetworkTimestamp(12341234),
		_create_sample_balance_transfer('this is a medium sized message!!!'))

	# Assert:
	_assert_sample_balance_transfer_common(transaction, nc.TransferTransactionV1)
	assert nc.Amount(500_000) == transaction.fee
	assert nc.Amount(88888_000000) == transaction.amount

	assert nc.MessageType.PLAIN == transaction.message.message_type
	assert b'this is a medium sized message!!!' == transaction.message.message


def test_can_create_transfer_transaction_version_two_without_message():
	# Arrange:
	facade = NemNetworkFacade(_create_config())

	# Act:
	transaction = facade.create_transfer_transaction(NetworkTimestamp(12341234), _create_sample_balance_transfer(''), False)

	# Assert:
	_assert_sample_balance_transfer_common(transaction, nc.TransferTransactionV2)
	assert nc.Amount(400_000) == transaction.fee
	assert nc.Amount(1_000000) == transaction.amount

	assert 1 == len(transaction.mosaics)

	mosaic = transaction.mosaics[0].mosaic
	assert b'nem' == mosaic.mosaic_id.namespace_id.name
	assert b'xem' == mosaic.mosaic_id.name
	assert nc.Amount(88888_000000) == mosaic.amount

	assert transaction.message is None


def test_can_create_transfer_transaction_version_two_with_message():
	# Arrange:
	facade = NemNetworkFacade(_create_config())

	# Act:
	transaction = facade.create_transfer_transaction(
		NetworkTimestamp(12341234),
		_create_sample_balance_transfer('this is a medium sized message!!!'),
		False)

	# Assert:
	_assert_sample_balance_transfer_common(transaction, nc.TransferTransactionV2)
	assert nc.Amount(500_000) == transaction.fee
	assert nc.Amount(1_000000) == transaction.amount

	assert 1 == len(transaction.mosaics)

	mosaic = transaction.mosaics[0].mosaic
	assert b'nem' == mosaic.mosaic_id.namespace_id.name
	assert b'xem' == mosaic.mosaic_id.name
	assert nc.Amount(88888_000000) == mosaic.amount

	assert nc.MessageType.PLAIN == transaction.message.message_type
	assert b'this is a medium sized message!!!' == transaction.message.message

# endregion
