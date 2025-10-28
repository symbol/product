from binascii import unhexlify
from decimal import Decimal

import pytest
from symbolchain import sc
from symbolchain.CryptoTypes import Hash256, PrivateKey, PublicKey
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.symbol.Network import Address, Network, NetworkTimestamp
from symbollightapi.model.Exceptions import NodeException

from bridge.models.BridgeConfiguration import NetworkConfiguration
from bridge.NetworkUtils import (
	BalanceChange,
	BalanceTransfer,
	FeeInformation,
	TransactionSender,
	download_rosetta_block_balance_changes,
	estimate_balance_transfer_fees
)
from bridge.symbol.SymbolNetworkFacade import SymbolNetworkFacade

from .test.BridgeTestUtils import HASHES
from .test.MockSymbolServer import create_simple_symbol_client


@pytest.fixture
async def server(aiohttp_client):
	return await create_simple_symbol_client(aiohttp_client, '0x72C0\'212E\'67A0\'8BCE')


# pylint: disable=invalid-name


# region estimate_balance_transfer_fees

async def test_can_estimate_balance_transfer_fees_when_conversion_fee_is_zero(server):   # pylint: disable=redefined-outer-name
	# Arrange:
	network_facade = SymbolNetworkFacade(_create_config(server))
	balance_transfer = BalanceTransfer(
		PublicKey('237AA9D393924F2310C3F502B8FFB5DFBFFCE7CA982EEB5719D3BD96B234B41C'),
		Address('TC5EONJRZWHUWX4JOLHYGDGS2RQDDTLI5PES3WI'),
		12345000,
		None)

	# Act:
	fee_information = await estimate_balance_transfer_fees(network_facade, balance_transfer, Decimal('1.234'))

	# Assert: ceil(17600 * 1.234) = ceil(21718.4)
	assert FeeInformation(Decimal('21718.4'), Decimal('0'), 21719) == fee_information


async def test_can_estimate_balance_transfer_fees_when_conversion_fee_is_nonzero(server):   # pylint: disable=redefined-outer-name
	# Arrange:
	network_facade = SymbolNetworkFacade(_create_config(server, config_extensions={
		'percentage_conversion_fee': '0.077'
	}))
	balance_transfer = BalanceTransfer(
		PublicKey('237AA9D393924F2310C3F502B8FFB5DFBFFCE7CA982EEB5719D3BD96B234B41C'),
		Address('TC5EONJRZWHUWX4JOLHYGDGS2RQDDTLI5PES3WI'),
		12345000,
		None)

	# Act:
	fee_information = await estimate_balance_transfer_fees(network_facade, balance_transfer, Decimal('1.234'))

	# Assert: ceil(17600 * 1.234 + 12345000 * 0.077) = ceil(21718.4 + 950565) = ceil(972283.4)
	assert FeeInformation(Decimal('21718.4'), Decimal('950565'), 972284) == fee_information

# endregion


# region TransactionSender - constructor, init

def _create_config(server=None, mosaic_id='E74B99BA41F4AFEE', config_extensions=None):  # pylint: disable=redefined-outer-name
	endpoint = server.make_url('') if server else 'http://foo.bar:1234'
	return NetworkConfiguration('symbol', 'testnet', endpoint, 'TDDRDLK5QL2LJPZOF26QFXB24TJ5HGB4NDTF6SI', mosaic_id, {
		'signer_private_key': 'F490900201CD6365A89FDD41B7B2CC71E9537455E8AB626A47EBFA0681E5BE62',
		'transaction_fee_multiplier': '100',
		**(config_extensions or {})
	})


def test_can_create_transaction_sender():
	# Act:
	sender = TransactionSender(SymbolNetworkFacade(_create_config()), Decimal(1.2))

	# Assert:
	assert 'testnet' == sender.network_facade.network.name
	assert PrivateKey('F490900201CD6365A89FDD41B7B2CC71E9537455E8AB626A47EBFA0681E5BE62') == sender.sender_key_pair.private_key
	assert Decimal(1.2) == sender.fee_multiplier
	assert 0xE74B99BA41F4AFEE == sender.mosaic_id
	assert sender.timestamp is None


async def test_can_initialize_transaction_sender(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	sender = TransactionSender(SymbolNetworkFacade(_create_config(server)))

	# Act:
	await sender.init()

	# Assert:
	assert NetworkTimestamp(68414660756) == sender.timestamp

# endregion


# region TransactionSender - try_send_transfer

def _make_sc_address(address_str):
	return sc.UnresolvedAddress(SymbolFacade.Address(address_str).bytes)


def _decode_and_check_announce_payload(payload, expected_transaction_hash):
	transaction = sc.TransactionFactory.deserialize(unhexlify(payload['payload']))

	# check correct hash and signature
	facade = SymbolFacade(Network.TESTNET)
	assert expected_transaction_hash == facade.hash_transaction(transaction)
	assert facade.verify_transaction(transaction, transaction.signature)

	return (transaction, transaction.signature)


def _assert_sample_balance_transfer_common(transaction, expected_transaction_type):
	assert expected_transaction_type.TRANSACTION_TYPE == transaction.type_
	assert expected_transaction_type.TRANSACTION_VERSION == transaction.version

	assert sc.Timestamp(68414660756 + 60 * 60 * 1000) == transaction.deadline
	assert sc.PublicKey('E94F195D3D88F6FE46CC12C88E6135D21E67826D385966CC67E67AC4960762C9') == transaction.signer_public_key
	assert _make_sc_address('TD3KYLTDR7PP4ZWGXCSCCTQ7NRCMPCCD3WPKK7Y') == transaction.recipient_address


async def _create_transaction_sender(server, fee_multiplier, update_config):  # pylint: disable=redefined-outer-name
	config = _create_config(server)
	if update_config:
		update_config(config)

	sender = TransactionSender(SymbolNetworkFacade(config), fee_multiplier)
	await sender.init()
	return sender


async def _assert_try_send_transfer_success(server, amount, message, expected_fee, fee_multiplier=Decimal(1), update_config=None):
	# pylint: disable=redefined-outer-name,too-many-arguments,too-many-positional-arguments
	# Arrange:
	sender = await _create_transaction_sender(server, fee_multiplier, update_config)

	# Act:
	result = await sender.try_send_transfer('TD3KYLTDR7PP4ZWGXCSCCTQ7NRCMPCCD3WPKK7Y', amount, message)

	# Assert:
	assert not result.is_error
	assert amount - expected_fee == result.net_amount
	assert expected_fee == result.total_fee
	assert result.error_message is None

	assert 1 == len(server.mock.request_json_payloads)
	(transaction, _) = _decode_and_check_announce_payload(server.mock.request_json_payloads[0], result.transaction_hash)

	_assert_sample_balance_transfer_common(transaction, sc.TransferTransactionV1)

	assert 1 == len(transaction.mosaics)
	assert sc.UnresolvedMosaicId(0xE74B99BA41F4AFEE) == transaction.mosaics[0].mosaic_id
	assert sc.Amount(amount - expected_fee) == transaction.mosaics[0].amount

	assert message.encode('utf8') if message else b'' == transaction.message


async def _assert_try_send_transfer_failure(server, amount, expected_error_message, update_config=None):
	# pylint: disable=redefined-outer-name
	# Arrange:
	sender = await _create_transaction_sender(server, Decimal(1), update_config)

	# Act:
	result = await sender.try_send_transfer('TD3KYLTDR7PP4ZWGXCSCCTQ7NRCMPCCD3WPKK7Y', amount)

	# Assert:
	assert result.is_error
	assert result.transaction_hash is None
	assert result.net_amount is None
	assert result.total_fee is None
	assert expected_error_message == result.error_message


async def test_try_send_transfer_succeeds_without_message(server):  # pylint: disable=redefined-outer-name
	await _assert_try_send_transfer_success(server, 12345000, None, 17600)


async def test_try_send_transfer_succeeds_with_message(server):  # pylint: disable=redefined-outer-name
	await _assert_try_send_transfer_success(server, 12345000, 'test message 1', 19000)


async def test_try_send_transfer_succeeds_when_transfer_amount_is_exactly_fee(server):  # pylint: disable=redefined-outer-name
	await _assert_try_send_transfer_success(server, 17600, None, 17600)


async def test_try_send_transfer_fails_when_transfer_amount_is_less_than_transaction_fee(server):  # pylint: disable=redefined-outer-name
	await _assert_try_send_transfer_failure(
		server,
		17600 - 1,
		'total fee (transaction 17600 + conversion 0) exceeds transfer amount 17599')


async def test_try_send_transfer_succeeds_when_conversion_fee_is_enabled(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	def set_conversion_fee(config):
		config.extensions['percentage_conversion_fee'] = '0.007'

	# Act + Assert: conversion fee => ceil(12345011 * .007 == 86415.077)
	await _assert_try_send_transfer_success(server, 12345011, None, 86416 + 17600, update_config=set_conversion_fee)


async def test_try_send_transfer_fails_when_transfer_amount_is_less_than_total_fee(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	def set_conversion_fee(config):
		config.extensions['percentage_conversion_fee'] = '0.1'

	# Act + Assert: conversion fee => ceil(19000 * .1 == 1900)
	await _assert_try_send_transfer_failure(
		server,
		19000,
		'total fee (transaction 17600 + conversion 1900) exceeds transfer amount 19000',
		update_config=set_conversion_fee)


async def test_try_send_transfer_applies_fee_multipler_to_transaction_fee(server):  # pylint: disable=redefined-outer-name
	# Assert: transaction fee => ceil(17600 * .777 == 13675.2) < 17600
	await _assert_try_send_transfer_success(server, 17600 - 1, None, 13676, fee_multiplier=Decimal(0.777))


async def test_try_send_transfer_applies_fee_multipler_to_conversion_fee(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	def set_conversion_fee(config):
		config.extensions['percentage_conversion_fee'] = '0.007'

	# Act + Assert: conversion fee => ceil(12345011 * .007 == 86415.077)
	#               transaction fee => ceil(17600 * .777 == 13675.2)
	await _assert_try_send_transfer_success(
		server,
		12345011,
		None,
		86415 + 13675 + 1,
		fee_multiplier=Decimal(0.777),
		update_config=set_conversion_fee)


async def test_try_send_transfer_succeeds_with_custom_mosaic_id(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	sender = TransactionSender(SymbolNetworkFacade(_create_config(server, 'ABCD12349876FEDC')))
	await sender.init()

	# Act:
	result = await sender.try_send_transfer('TD3KYLTDR7PP4ZWGXCSCCTQ7NRCMPCCD3WPKK7Y', 12345000, 'test message 2')

	# Assert:
	assert not result.is_error
	assert 12345000 - 19000 == result.net_amount
	assert 19000 == result.total_fee
	assert result.error_message is None

	assert 1 == len(server.mock.request_json_payloads)
	(transaction, _) = _decode_and_check_announce_payload(server.mock.request_json_payloads[0], result.transaction_hash)

	_assert_sample_balance_transfer_common(transaction, sc.TransferTransactionV1)

	assert 1 == len(transaction.mosaics)
	assert sc.UnresolvedMosaicId(0xABCD12349876FEDC) == transaction.mosaics[0].mosaic_id
	assert sc.Amount(12345000 - 19000) == transaction.mosaics[0].amount

	assert b'test message 2' == transaction.message

# endregion


# region TransactionSender - send_transaction

async def test_can_send_transaction(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	sender = TransactionSender(SymbolNetworkFacade(_create_config(server)))

	# Act:
	transaction_hash = await sender.send_transaction(SymbolFacade(Network.TESTNET).transaction_factory.create({
		'type': 'namespace_registration_transaction_v1',
		'signer_public_key': 'E94F195D3D88F6FE46CC12C88E6135D21E67826D385966CC67E67AC4960762C9',
		'registration_type': 'root',
		'duration': 123,
		'name': 'roger'
	}))

	# Assert:
	assert 1 == len(server.mock.request_json_payloads)

	(transaction, _) = _decode_and_check_announce_payload(server.mock.request_json_payloads[0], transaction_hash)

	assert sc.NamespaceRegistrationTransactionV1.TRANSACTION_TYPE == transaction.type_
	assert sc.NamespaceRegistrationTransactionV1.TRANSACTION_VERSION == transaction.version

	assert sc.PublicKey('E94F195D3D88F6FE46CC12C88E6135D21E67826D385966CC67E67AC4960762C9') == transaction.signer_public_key
	assert sc.NamespaceRegistrationType.ROOT == transaction.registration_type
	assert sc.BlockDuration(123) == transaction.duration
	assert b'roger' == transaction.name


async def test_cannot_send_transaction_that_does_not_transition_to_unconfirmed(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.simulate_transaction_status_not_found = True

	sender = TransactionSender(SymbolNetworkFacade(_create_config(server)))

	# Act + Assert:
	with pytest.raises(NodeException, match=r'aborting because transaction .+ did not transition to unconfirmed status'):
		await sender.send_transaction(SymbolFacade(Network.TESTNET).transaction_factory.create({
			'type': 'namespace_registration_transaction_v1',
			'signer_public_key': 'E94F195D3D88F6FE46CC12C88E6135D21E67826D385966CC67E67AC4960762C9',
			'registration_type': 'root',
			'duration': 123,
			'name': 'roger'
		}))

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
