from binascii import hexlify, unhexlify

import pytest
from symbolchain import nc
from symbolchain.CryptoTypes import Hash256, PrivateKey
from symbolchain.facade.NemFacade import NemFacade
from symbolchain.nem.Network import Network, NetworkTimestamp

from bridge.models.BridgeConfiguration import NetworkConfiguration
from bridge.nem.NemNetworkFacade import NemNetworkFacade
from bridge.NetworkUtils import BalanceChange, TransactionSender, download_rosetta_block_balance_changes

from .test.BridgeTestUtils import HASHES
from .test.PytestUtils import create_simple_nem_client


@pytest.fixture
async def server(aiohttp_client):
	return await create_simple_nem_client(aiohttp_client)


# pylint: disable=invalid-name

# region TransactionSender - constructor, init

def _create_config(server=None):  # pylint: disable=redefined-outer-name
	endpoint = server.make_url('') if server else 'http://foo.bar:1234'
	return NetworkConfiguration('nem', 'testnet', endpoint, 'TCYIHED7HZQ3IPBY5WRDPDLV5CCMMOOVSOMSPD6B', {
		'signing_private_key': 'F490900201CD6365A89FDD41B7B2CC71E9537455E8AB626A47EBFA0681E5BE62'
	})


def test_can_create_transaction_sender():
	# Act:
	sender = TransactionSender(NemNetworkFacade(_create_config()), ('foo', 'bar'))

	# Assert:
	assert 'testnet' == sender.network_facade.network.name
	assert PrivateKey('F490900201CD6365A89FDD41B7B2CC71E9537455E8AB626A47EBFA0681E5BE62') == sender.sender_key_pair.private_key
	assert ('foo', 'bar') == sender.mosaic_id
	assert sender.timestamp is None


async def test_can_initialize_transaction_sender(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	sender = TransactionSender(NemNetworkFacade(_create_config(server)))

	# Act:
	await sender.init()

	# Assert:
	assert NetworkTimestamp(322666792) == sender.timestamp

# endregion


# region TransactionSender - try_send_transfer, send_transaction

def _make_nc_address(address_str):
	return nc.Address(hexlify(address_str.encode('utf8')).decode('utf8'))


def _decode_and_check_announce_payload(payload, expected_transaction_hash):
	transaction = nc.NonVerifiableTransactionFactory.deserialize(unhexlify(payload['data']))
	signature = nc.Signature(unhexlify(payload['signature']))

	# check correct hash and signature
	facade = NemFacade(Network.TESTNET)
	assert expected_transaction_hash == facade.hash_transaction(transaction)
	assert facade.verify_transaction(transaction, signature)

	return (transaction, signature)


def _assert_sample_balance_transfer_common(transaction, expected_transaction_type):
	assert expected_transaction_type.TRANSACTION_TYPE == transaction.type_
	assert expected_transaction_type.TRANSACTION_VERSION == transaction.version

	assert nc.Timestamp(322666792) == transaction.timestamp
	assert nc.PublicKey('8F3E37D0E2AAD0132FE1395DC53C9B867A0333299E278B76DF95E252C2335F06') == transaction.signer_public_key
	assert _make_nc_address('NADP63FUUAOS2LDXY75SJ4TOLW4S7YXEAGT25IXG') == transaction.recipient_address


async def _create_transaction_sender(server, update_config):  # pylint: disable=redefined-outer-name
	config = _create_config(server)
	if update_config:
		update_config(config)

	sender = TransactionSender(NemNetworkFacade(config))
	await sender.init()
	return sender


async def _assert_try_send_transfer_success(server, amount, message, expected_fee, update_config=None):
	# pylint: disable=redefined-outer-name
	# Arrange:
	sender = await _create_transaction_sender(server, update_config)

	# Act:
	result = await sender.try_send_transfer('NADP63FUUAOS2LDXY75SJ4TOLW4S7YXEAGT25IXG', amount, message)

	# Assert:
	assert not result.is_error
	assert amount - expected_fee == result.net_amount
	assert expected_fee == result.total_fee
	assert result.error_message is None

	assert 1 == len(server.mock.request_json_payloads)
	(transaction, _) = _decode_and_check_announce_payload(server.mock.request_json_payloads[0], result.transaction_hash)

	_assert_sample_balance_transfer_common(transaction, nc.TransferTransactionV1)

	assert nc.Amount(amount - expected_fee) == transaction.amount
	if message:
		assert message.encode('utf8') == transaction.message.message
	else:
		assert transaction.message is None


async def _assert_try_send_transfer_failure(server, amount, expected_error_message, update_config=None):
	# pylint: disable=redefined-outer-name
	# Arrange:
	sender = await _create_transaction_sender(server, update_config)

	# Act:
	result = await sender.try_send_transfer('NADP63FUUAOS2LDXY75SJ4TOLW4S7YXEAGT25IXG', amount)

	# Assert:
	assert result.is_error
	assert result.transaction_hash is None
	assert result.net_amount is None
	assert result.total_fee is None
	assert expected_error_message == result.error_message


async def test_try_send_transfer_succeeds_without_message(server):  # pylint: disable=redefined-outer-name
	await _assert_try_send_transfer_success(server, 12345000, None, 50000)


async def test_try_send_transfer_succeeds_with_message(server):  # pylint: disable=redefined-outer-name
	await _assert_try_send_transfer_success(server, 12345000, 'test message 1', 100000)


async def test_try_send_transfer_succeeds_when_transfer_amount_is_exactly_fee(server):  # pylint: disable=redefined-outer-name
	await _assert_try_send_transfer_success(server, 50000, None, 50000)


async def test_try_send_transfer_fails_when_transfer_amount_is_less_than_transaction_fee(server):  # pylint: disable=redefined-outer-name
	await _assert_try_send_transfer_failure(
		server,
		50000 - 1,
		'total fee (transaction 50000 + conversion 0) exceeds transfer amount 49999')


async def test_try_send_transfer_succeeds_when_conversion_fee_is_enabled(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	def set_conversion_fee(config):
		config.extensions['percentage_conversion_fee'] = '0.007'

	# Act + Assert: conversion fee: ceil(12345011 * .007 == 86415.077)
	await _assert_try_send_transfer_success(server, 12345011, None, 86416 + 50000, update_config=set_conversion_fee)


async def test_try_send_transfer_fails_when_transfer_amount_is_less_than_total_fee(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	def set_conversion_fee(config):
		config.extensions['percentage_conversion_fee'] = '0.1'

	# Act + Assert: conversion fee: ceil(54000 * .1 == 5400)
	await _assert_try_send_transfer_failure(
		server,
		54000,
		'total fee (transaction 50000 + conversion 5400) exceeds transfer amount 54000',
		update_config=set_conversion_fee)


async def test_try_send_transfer_succeeds_with_custom_mosaic_id(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	sender = TransactionSender(NemNetworkFacade(_create_config(server)), ('foo', 'bar'))
	await sender.init()

	# Act:
	result = await sender.try_send_transfer('NADP63FUUAOS2LDXY75SJ4TOLW4S7YXEAGT25IXG', 12345000, 'test message 2')

	# Assert:
	assert not result.is_error
	assert 12345000 - 100000 == result.net_amount
	assert 100000 == result.total_fee
	assert result.error_message is None

	assert 1 == len(server.mock.request_json_payloads)
	(transaction, _) = _decode_and_check_announce_payload(server.mock.request_json_payloads[0], result.transaction_hash)

	_assert_sample_balance_transfer_common(transaction, nc.TransferTransactionV2)

	assert 1 == len(transaction.mosaics)

	mosaic = transaction.mosaics[0].mosaic
	assert b'foo' == mosaic.mosaic_id.namespace_id.name
	assert b'bar' == mosaic.mosaic_id.name
	assert nc.Amount(12345000 - 100000) == mosaic.amount

	assert b'test message 2' == transaction.message.message


async def test_can_send_transaction(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	sender = TransactionSender(NemNetworkFacade(_create_config(server)))

	# Act:
	transaction_hash = await sender.send_transaction(NemFacade(Network.TESTNET).transaction_factory.create({
		'type': 'namespace_registration_transaction_v1',
		'signer_public_key': '8F3E37D0E2AAD0132FE1395DC53C9B867A0333299E278B76DF95E252C2335F06',
		'rental_fee_sink': 'TAMESPACEWH4MKFMBCVFERDPOOP4FK7MTDJEYP35',
		'rental_fee': 50000_000000,
		'name': 'roger'
	}))

	# Assert:
	assert 1 == len(server.mock.request_json_payloads)

	(transaction, _) = _decode_and_check_announce_payload(server.mock.request_json_payloads[0], transaction_hash)

	assert nc.NamespaceRegistrationTransactionV1.TRANSACTION_TYPE == transaction.type_
	assert nc.NamespaceRegistrationTransactionV1.TRANSACTION_VERSION == transaction.version

	assert nc.PublicKey('8F3E37D0E2AAD0132FE1395DC53C9B867A0333299E278B76DF95E252C2335F06') == transaction.signer_public_key
	assert _make_nc_address('TAMESPACEWH4MKFMBCVFERDPOOP4FK7MTDJEYP35') == transaction.rental_fee_sink
	assert nc.Amount(50000_000000) == transaction.rental_fee
	assert b'roger' == transaction.name

# endregion


# region download_rosetta_block_balance_changes

class MockRosettaConnector:
	def __init__(self):
		self.post_requests = []
		self.post_response = {}

	async def post(self, url_path, request_payload):
		self.post_requests.append((url_path, request_payload))
		return self.post_response


def _make_operation_json(address, currency_name, amount, **kwargs):
	operation_json = {
		'type': kwargs.get('type', 'transfer'),
		'status': kwargs.get('status', 'success'),
		'account': {'address': address},
		'amount': {
			'value': str(amount),
			'currency': {
				'symbol': currency_name
			}
		}
	}

	currency_id = kwargs.get('currency_id', None)
	if currency_id:
		operation_json['amount']['currency']['metadata'] = {'id': currency_id}

	return operation_json


def _make_single_transaction_block_from_operations(operations):
	return {
		'block': {
			'transactions': [
				{
					'transaction_identifier': {'hash': HASHES[0]},
					'operations': operations
				}
			]
		}
	}


def _assert_single_post_request(connector):
	assert [
		('block', {
			'network_identifier': {'blockchain': 'foo', 'network': 'barnet'},
			'block_identifier': {'index': '1001'}
		})
	] == connector.post_requests


async def _assert_can_download_rosetta_block_balance_changes_from_block_with_no_balance_changes(post_response):
	# Arrange:
	connector = MockRosettaConnector()
	connector.post_response = post_response

	# Act:
	balance_changes = await download_rosetta_block_balance_changes(connector, 'foo', 'barnet', 1001)

	# Assert;
	_assert_single_post_request(connector)
	assert 0 == len(balance_changes)


async def test_can_download_rosetta_block_balance_changes_from_block_with_no_transactions():
	await _assert_can_download_rosetta_block_balance_changes_from_block_with_no_balance_changes({'block': {'transactions': []}})


async def test_can_download_rosetta_block_balance_changes_from_block_with_no_operations():
	await _assert_can_download_rosetta_block_balance_changes_from_block_with_no_balance_changes(
		_make_single_transaction_block_from_operations([]))


async def test_can_download_rosetta_block_balance_changes_from_block_with_multiple_operations_in_single_transaction():
	# Arrange:
	connector = MockRosettaConnector()
	connector.post_response = _make_single_transaction_block_from_operations([
		_make_operation_json('alpha', 'baz.token', 12345),
		_make_operation_json('beta', 'foo.token', 22222),
		_make_operation_json('beta', 'baz.token', 44444)
	])

	# Act:
	balance_changes = await download_rosetta_block_balance_changes(connector, 'foo', 'barnet', 1001)

	# Assert;
	_assert_single_post_request(connector)
	assert [
		BalanceChange('alpha', 'baz.token', 12345, Hash256(HASHES[0])),
		BalanceChange('beta', 'foo.token', 22222, Hash256(HASHES[0])),
		BalanceChange('beta', 'baz.token', 44444, Hash256(HASHES[0]))
	] == balance_changes


async def test_can_download_rosetta_block_balance_changes_from_block_with_multiple_operations_in_multiple_transactions():
	# Arrange:
	connector = MockRosettaConnector()
	connector.post_response = {
		'block': {
			'transactions': [
				{
					'transaction_identifier': {'hash': HASHES[0]},
					'operations': [
						_make_operation_json('zeta', 'z.coupons', 1732),
						_make_operation_json('omega', 'z.coupons', 2233)
					]
				},
				{
					'transaction_identifier': {'hash': HASHES[2]},
					'operations': [
						_make_operation_json('alpha', 'baz.token', 12345),
						_make_operation_json('beta', 'foo.token', 22222),
						_make_operation_json('beta', 'baz.token', 44444)
					]
				},
				{
					'transaction_identifier': {'hash': HASHES[1]},
					'operations': [
						_make_operation_json('gamma', 'bar.coin', 9988),
						_make_operation_json('alpha', 'foo.token', 222)
					]
				},
			]
		}
	}

	# Act:
	balance_changes = await download_rosetta_block_balance_changes(connector, 'foo', 'barnet', 1001)

	# Assert;
	_assert_single_post_request(connector)
	assert [
		BalanceChange('zeta', 'z.coupons', 1732, Hash256(HASHES[0])),
		BalanceChange('omega', 'z.coupons', 2233, Hash256(HASHES[0])),
		BalanceChange('alpha', 'baz.token', 12345, Hash256(HASHES[2])),
		BalanceChange('beta', 'foo.token', 22222, Hash256(HASHES[2])),
		BalanceChange('beta', 'baz.token', 44444, Hash256(HASHES[2])),
		BalanceChange('gamma', 'bar.coin', 9988, Hash256(HASHES[1])),
		BalanceChange('alpha', 'foo.token', 222, Hash256(HASHES[1]))
	] == balance_changes


async def _assert_single_skipped_operation(**kwargs):
	# Arrange:
	connector = MockRosettaConnector()
	connector.post_response = _make_single_transaction_block_from_operations([
		_make_operation_json('alpha', 'baz.token', 12345),
		_make_operation_json('beta', 'foo.token', 22222, **kwargs),
		_make_operation_json('beta', 'baz.token', 44444)
	])

	# Act:
	balance_changes = await download_rosetta_block_balance_changes(connector, 'foo', 'barnet', 1001)

	# Assert;
	_assert_single_post_request(connector)
	assert [
		BalanceChange('alpha', 'baz.token', 12345, Hash256(HASHES[0])),
		BalanceChange('beta', 'baz.token', 44444, Hash256(HASHES[0]))
	] == balance_changes


async def test_can_download_rosetta_block_balance_changes_from_block_skips_non_transfers():
	await _assert_single_skipped_operation(type='other')


async def test_can_download_rosetta_block_balance_changes_from_block_skips_non_successes():
	await _assert_single_skipped_operation(status='error')


async def test_can_download_rosetta_block_balance_changes_prefers_currency_id_when_present():
	# Arrange:
	connector = MockRosettaConnector()
	connector.post_response = _make_single_transaction_block_from_operations([
		_make_operation_json('alpha', 'baz.token', 12345),
		_make_operation_json('beta', 'foo.token', 22222, currency_id='777'),
		_make_operation_json('beta', 'baz.token', 44444)
	])

	# Act:
	balance_changes = await download_rosetta_block_balance_changes(connector, 'foo', 'barnet', 1001)

	# Assert;
	_assert_single_post_request(connector)
	assert [
		BalanceChange('alpha', 'baz.token', 12345, Hash256(HASHES[0])),
		BalanceChange('beta', '777', 22222, Hash256(HASHES[0])),
		BalanceChange('beta', 'baz.token', 44444, Hash256(HASHES[0])),
	] == balance_changes

# endregion
