from binascii import hexlify

import pytest
from symbolchain import nc
from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nem.Network import Address, NetworkTimestamp
from symbollightapi.connector.NemConnector import MosaicFeeInformation, NemConnector

from bridge.models.BridgeConfiguration import NetworkConfiguration
from bridge.models.WrapRequest import WrapError, WrapRequest
from bridge.nem.NemNetworkFacade import NemNetworkFacade
from bridge.NetworkUtils import BalanceTransfer

from ..test.BridgeTestUtils import assert_wrap_request_failure, assert_wrap_request_success
from ..test.MockNemServer import create_simple_nem_client
from ..test.PytestUtils import PytestAsserter


@pytest.fixture
async def server(aiohttp_client):
	return await create_simple_nem_client(aiohttp_client, {
		'TCQKTUUNUOPQGDQIDQT2CCJGQZ4QNAAGBZRV5YJJ': 9988776655
	})


# pylint: disable=invalid-name


# region constructor, init

def _create_config(server=None, config_extensions=None):  # pylint: disable=redefined-outer-name
	endpoint = server.make_url('') if server else 'http://foo.bar:1234'
	return NetworkConfiguration('nem', 'testnet', endpoint, 'TCYIHED7HZQ3IPBY5WRDPDLV5CCMMOOVSOMSPD6B', config_extensions or {})


def test_can_create_facade():
	# Act:
	facade = NemNetworkFacade(_create_config())

	# Assert:
	assert 'testnet' == facade.network.name
	assert ('NEM', 'testnet') == facade.rosetta_network_id
	assert facade.network == facade.sdk_facade.network
	assert Address('TCYIHED7HZQ3IPBY5WRDPDLV5CCMMOOVSOMSPD6B') == facade.bridge_address
	assert Address('TCYIHED7HZQ3IPBY5WRDPDLV5CCMMOOVSOMSPD6B') == facade.transaction_search_address


async def test_can_initialize_facade(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = NemNetworkFacade(_create_config(server, {
		'mosaic_id': 'foo:bar'
	}))

	# Act:
	await facade.init()

	# Assert:
	assert {'foo:bar': MosaicFeeInformation(123000000, 3)} == facade.mosaic_id_to_fee_information_map

# endregion


# region is_currency_mosaic_id

async def test_can_detect_currency_mosaic_id():
	# Arrange:
	facade = NemNetworkFacade(_create_config())

	# Act + Assert:
	assert facade.is_currency_mosaic_id(('nem', 'xem'))
	assert not facade.is_currency_mosaic_id(('foo', 'xem'))
	assert not facade.is_currency_mosaic_id(('nem', 'bar'))
	assert not facade.is_currency_mosaic_id(('foo', 'bar'))

# endregion


# region extract_mosaic_id

def test_can_extract_mosaic_id_currency():
	# Arrange:
	facade = NemNetworkFacade(_create_config(config_extensions={
		'mosaic_id': 'nem:xem'
	}))

	# Act:
	mosaic_id = facade.extract_mosaic_id()

	# Assert:
	assert mosaic_id.id is None
	assert 'nem:xem' == mosaic_id.formatted


def test_can_extract_mosaic_id_other():
	# Arrange:
	facade = NemNetworkFacade(_create_config(config_extensions={
		'mosaic_id': 'foo:bar'
	}))

	# Act:
	mosaic_id = facade.extract_mosaic_id()

	# Assert:
	assert ('foo', 'bar') == mosaic_id.id
	assert 'foo:bar' == mosaic_id.formatted

# endregion


# region create_connector

def test_can_create_connector():
	# Arrange:
	config = _create_config()
	config.extensions['rosetta_endpoint'] = 'http://rosetta.api:9988'
	facade = NemNetworkFacade(config)

	# Act:
	connector = facade.create_connector()

	# Assert:
	assert isinstance(connector, NemConnector)
	assert 'http://foo.bar:1234' == connector.endpoint


def test_can_create_connector_rosetta():
	# Arrange:
	config = _create_config()
	config.extensions['rosetta_endpoint'] = 'http://rosetta.api:9988'
	facade = NemNetworkFacade(config)

	# Act:
	connector = facade.create_connector(require_rosetta=True)

	# Assert:
	assert isinstance(connector, NemConnector)
	assert 'http://rosetta.api:9988' == connector.endpoint

# endregion


# region make_address

def test_can_make_address():
	# Arrange:
	facade = NemNetworkFacade(_create_config())

	# Act:
	address_from_string = facade.make_address('TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG')
	address_from_bytes = facade.make_address(b'\x98\x0f6\x80\x90h\xd2\xe0\x8c\xe7\x8b\x9b\xf9*\x9f{\xbc`Z\xe0Nx \xea\x06')

	# Assert:
	assert Address('TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG') == address_from_string
	assert Address('TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG') == address_from_bytes

# endregion


# region is_valid_address

def _assert_is_valid_address(address, expected_formatted_address):
	# Arrange:
	facade = NemNetworkFacade(_create_config())

	# Act + Assert:
	assert (True, expected_formatted_address) == facade.is_valid_address(address)


def _assert_is_invalid_address(address):
	# Arrange:
	facade = NemNetworkFacade(_create_config())

	# Act + Assert:
	assert (False, None) == facade.is_valid_address(address)


def test_is_valid_address_detects_matching_addresses():
	# nem testnet
	_assert_is_valid_address('TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG', 'TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG')
	_assert_is_valid_address(
		b'\x98\x0f6\x80\x90h\xd2\xe0\x8c\xe7\x8b\x9b\xf9*\x9f{\xbc`Z\xe0Nx \xea\x06',
		'TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG')

	# nem mainnet
	_assert_is_invalid_address('NCHESTYVD2P6P646AMY7WSNG73PCPZDUQNSD6JAK')
	_assert_is_invalid_address(b'\x68\x0f6\x80\x90h\xd2\xe0\x8c\xe7\x8b\x9b\xf9*\x9f{\xbc`Z\xe0Nx \xea\x06')

# endregion


# region extract_wrap_request_from_transaction

async def _assert_can_extract_wrap_request_from_transaction(
	is_valid_address,
	expected_request_or_error,
	assert_wrap_request,
	mosaic_id=None
):
	# Arrange:
	facade = NemNetworkFacade(_create_config())

	# Act:
	mosaic_id = mosaic_id or ('nem', 'xem')
	results = facade.extract_wrap_request_from_transaction(lambda address: (is_valid_address, address), {
		'meta': {
			'height': 1234,
			'hash': {
				'data': 'FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA'
			},
		},
		'transaction': {
			'type': nc.TransferTransactionV2.TRANSACTION_TYPE.value,
			'version': (nc.NetworkType.TESTNET.value << 24) | nc.TransferTransactionV2.TRANSACTION_VERSION,
			'amount': 1_000000,
			'signer': '3917578FF27A88B20E137D9D2E54E775163F9C493A193A64F96748EBF8B21F3C',
			'mosaics': [
				{
					'mosaicId': {'namespaceId': mosaic_id[0], 'name': mosaic_id[1]},
					'quantity': 8888
				}
			],
			'message': {
				'type': nc.MessageType.PLAIN.value,
				'payload': hexlify('0x4838b106fce9647bdf1e7877bf73ce8b0bad5f98'.encode('utf8')).decode('utf8')
			}
		}
	}, mosaic_id)

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


async def test_cannot_extract_wrap_request_from_transaction_not_is_valid_address():
	expected_error = WrapError(
		1234,
		Hash256('FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA'),
		-1,
		Address('TCQKTUUNUOPQGDQIDQT2CCJGQZ4QNAAGBZRV5YJJ'),
		'destination address 0x4838b106fce9647bdf1e7877bf73ce8b0bad5f98 is invalid')

	await _assert_can_extract_wrap_request_from_transaction(False, expected_error, assert_wrap_request_failure)


async def test_can_extract_wrap_request_from_transaction_matching_custom_mosaic():
	expected_request = WrapRequest(
		1234,
		Hash256('FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA'),
		-1,
		Address('TCQKTUUNUOPQGDQIDQT2CCJGQZ4QNAAGBZRV5YJJ'),
		8888,
		'0x4838b106fce9647bdf1e7877bf73ce8b0bad5f98')

	await _assert_can_extract_wrap_request_from_transaction(True, expected_request, assert_wrap_request_success, ('foo', 'bar'))

# endregion


# region create_transfer_transaction

def _create_sample_balance_transfer(message, amount=88888_000000):
	return BalanceTransfer(
		PublicKey('3917578FF27A88B20E137D9D2E54E775163F9C493A193A64F96748EBF8B21F3C'),
		Address('TCQKTUUNUOPQGDQIDQT2CCJGQZ4QNAAGBZRV5YJJ'),
		amount,
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


def _assert_transfer_transaction_version_one_without_message(transaction):
	_assert_sample_balance_transfer_common(transaction, nc.TransferTransactionV1)
	assert nc.Amount(400_000) == transaction.fee
	assert nc.Amount(88888_000000) == transaction.amount

	assert transaction.message is None


async def test_can_create_transfer_transaction_version_one_without_message(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = NemNetworkFacade(_create_config(server, {'mosaic_id': 'nem:xem'}))
	await facade.init()

	# Act:
	transaction = facade.create_transfer_transaction(NetworkTimestamp(12341234), _create_sample_balance_transfer(''))

	# Assert:
	_assert_transfer_transaction_version_one_without_message(transaction)


async def test_can_create_transfer_transaction_version_one_without_message_with_explicit_currency_mosaic_id(server):
	# pylint: disable=redefined-outer-name
	# Arrange:
	facade = NemNetworkFacade(_create_config(server, {'mosaic_id': 'nem:xem'}))
	await facade.init()

	# Act:
	transaction = facade.create_transfer_transaction(
		NetworkTimestamp(12341234),
		_create_sample_balance_transfer(''),
		mosaic_id=('nem', 'xem'))

	# Assert:
	_assert_transfer_transaction_version_one_without_message(transaction)


async def test_can_create_transfer_transaction_version_one_with_message(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = NemNetworkFacade(_create_config(server, {'mosaic_id': 'nem:xem'}))
	await facade.init()

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


async def test_can_create_transfer_transaction_version_two_without_message(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = NemNetworkFacade(_create_config(server, {'mosaic_id': 'nem:xem'}))
	await facade.init()

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


async def test_can_create_transfer_transaction_version_two_with_message(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = NemNetworkFacade(_create_config(server, {'mosaic_id': 'nem:xem'}))
	await facade.init()

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


def _assert_transfer_transaction_version_two_with_custom_mosaic(transaction):
	_assert_sample_balance_transfer_common(transaction, nc.TransferTransactionV2)
	assert nc.Amount(850_000) == transaction.fee
	assert nc.Amount(1_000000) == transaction.amount

	assert 1 == len(transaction.mosaics)

	mosaic = transaction.mosaics[0].mosaic
	assert b'foo' == mosaic.mosaic_id.namespace_id.name
	assert b'bar' == mosaic.mosaic_id.name
	assert nc.Amount(88887_000) == mosaic.amount

	assert transaction.message is None


async def test_cannot_create_transfer_transaction_version_one_with_custom_mosaic(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = NemNetworkFacade(_create_config(server, {'mosaic_id': 'foo:bar'}))
	await facade.init()

	# Act:
	transaction = facade.create_transfer_transaction(
		NetworkTimestamp(12341234),
		_create_sample_balance_transfer('', amount=88887_000),
		mosaic_id=('foo', 'bar'))

	# Assert: version two transaction is returned even though version one is preferred because version one doesn't support custom mosaics
	_assert_transfer_transaction_version_two_with_custom_mosaic(transaction)


async def test_can_create_transfer_transaction_version_two_with_custom_mosaic(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = NemNetworkFacade(_create_config(server, {'mosaic_id': 'foo:bar'}))
	await facade.init()

	# Act + Assert:
	transaction = facade.create_transfer_transaction(
		NetworkTimestamp(12341234),
		_create_sample_balance_transfer('', amount=88887_000),
		('foo', 'bar'),
		False)

	# Assert:
	_assert_transfer_transaction_version_two_with_custom_mosaic(transaction)


async def test_canot_create_transfer_transaction_version_two_with_custom_mosaic_without_mosaic_fee_information(server):
	# pylint: disable=redefined-outer-name
	# Arrange:
	facade = NemNetworkFacade(_create_config(server, {'mosaic_id': 'foo:bar'}))
	await facade.init()

	# Act:
	with pytest.raises(ValueError, match='unable to create transaction for mosaic foo:baz with unknown fee information'):
		facade.create_transfer_transaction(
			NetworkTimestamp(12341234),
			_create_sample_balance_transfer('', amount=88887_000),
			('foo', 'baz'),
			False)

# endregion


# region calculate_transfer_transaction_fee

async def test_can_calculate_transfer_transaction_fee_without_message(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = NemNetworkFacade(_create_config(server, {'mosaic_id': 'nem:xem'}))
	await facade.init()

	# Act:
	transaction_fee = facade.calculate_transfer_transaction_fee(_create_sample_balance_transfer(''))

	# Assert:
	assert 400_000 == transaction_fee


async def test_can_calculate_transfer_transaction_fee_with_message(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = NemNetworkFacade(_create_config(server, {'mosaic_id': 'nem:xem'}))
	await facade.init()

	# Act:
	transaction_fee = facade.calculate_transfer_transaction_fee(_create_sample_balance_transfer('this is a medium sized message!!!'))

	# Assert:
	assert 500_000 == transaction_fee


async def test_can_calculate_transfer_transaction_fee_without_message_custom_mosaic(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = NemNetworkFacade(_create_config(server, {'mosaic_id': 'foo:bar'}))
	await facade.init()

	# Act:
	transaction_fee = facade.calculate_transfer_transaction_fee(_create_sample_balance_transfer('', amount=88887_000), ('foo', 'bar'))

	# Assert:
	assert 850_000 == transaction_fee


async def test_cannot_calculate_transfer_transaction_fee_without_mosaic_fee_information(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	facade = NemNetworkFacade(_create_config(server, {'mosaic_id': 'foo:bar'}))
	await facade.init()

	# Act:
	with pytest.raises(ValueError, match='unable to create transaction for mosaic foo:baz with unknown fee information'):
		facade.calculate_transfer_transaction_fee(_create_sample_balance_transfer('', amount=88887_000), ('foo', 'baz'))

# endregion
