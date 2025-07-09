from binascii import hexlify, unhexlify

import pytest
from symbolchain import nc
from symbolchain.CryptoTypes import PrivateKey
from symbolchain.facade.NemFacade import NemFacade
from symbolchain.nem.Network import Network, NetworkTimestamp

from bridge.models.BridgeConfiguration import NetworkConfiguration
from bridge.nem.NemNetworkFacade import NemNetworkFacade
from bridge.NetworkUtils import BalanceChange, TransactionSender, download_rosetta_block_balance_changes

from .test.PytestUtils import create_simple_nem_client


@pytest.fixture
async def server(aiohttp_client):
	return await create_simple_nem_client(aiohttp_client)


# pylint: disable=invalid-name

# region TransactionSender - constructor, init

def _create_config(server=None):  # pylint: disable=redefined-outer-name
	return NetworkConfiguration('nem', 'testnet', server.make_url('') if server else 'http://foo.bar:1234', None, {
		'signing_private_key': 'F490900201CD6365A89FDD41B7B2CC71E9537455E8AB626A47EBFA0681E5BE62'
	})


def test_can_create_transaction_sender():
	# Act:
	sender = TransactionSender(NemNetworkFacade(_create_config()), [True, 123])

	# Assert:
	assert 'testnet' == sender.network_facade.network.name
	assert PrivateKey('F490900201CD6365A89FDD41B7B2CC71E9537455E8AB626A47EBFA0681E5BE62') == sender.sender_key_pair.private_key
	assert [True, 123] == sender.send_arguments
	assert sender.timestamp is None


async def test_can_initialize_transaction_sender(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	sender = TransactionSender(NemNetworkFacade(_create_config(server)))

	# Act:
	await sender.init()

	# Assert:
	assert NetworkTimestamp(322666792) == sender.timestamp

# endregion


# region TransactionSender - send_transfer, send_transaction

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


async def test_can_send_transfer(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	sender = TransactionSender(NemNetworkFacade(_create_config(server)))
	await sender.init()

	# Act:
	transaction_hash = await sender.send_transfer('NADP63FUUAOS2LDXY75SJ4TOLW4S7YXEAGT25IXG', 12345000, 'test nem transfer')

	# Assert:
	assert 1 == len(server.mock.request_json_payloads)

	(transaction, _) = _decode_and_check_announce_payload(server.mock.request_json_payloads[0], transaction_hash)

	assert nc.TransferTransactionV1.TRANSACTION_TYPE == transaction.type_
	assert nc.TransferTransactionV1.TRANSACTION_VERSION == transaction.version

	assert nc.Timestamp(322666792) == transaction.timestamp
	assert nc.PublicKey('8F3E37D0E2AAD0132FE1395DC53C9B867A0333299E278B76DF95E252C2335F06') == transaction.signer_public_key
	assert _make_nc_address('NADP63FUUAOS2LDXY75SJ4TOLW4S7YXEAGT25IXG') == transaction.recipient_address
	assert nc.Amount(12345000) == transaction.amount
	assert b'test nem transfer' == transaction.message.message


async def test_can_send_transfer_with_custom_send_arguments(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	sender = TransactionSender(NemNetworkFacade(_create_config(server)), [False])
	await sender.init()

	# Act:
	transaction_hash = await sender.send_transfer('NADP63FUUAOS2LDXY75SJ4TOLW4S7YXEAGT25IXG', 12345000, 'test nem transfer')

	# Assert:
	assert 1 == len(server.mock.request_json_payloads)

	(transaction, _) = _decode_and_check_announce_payload(server.mock.request_json_payloads[0], transaction_hash)

	assert nc.TransferTransactionV2.TRANSACTION_TYPE == transaction.type_
	assert nc.TransferTransactionV2.TRANSACTION_VERSION == transaction.version

	assert nc.Timestamp(322666792) == transaction.timestamp
	assert nc.PublicKey('8F3E37D0E2AAD0132FE1395DC53C9B867A0333299E278B76DF95E252C2335F06') == transaction.signer_public_key
	assert _make_nc_address('NADP63FUUAOS2LDXY75SJ4TOLW4S7YXEAGT25IXG') == transaction.recipient_address

	assert 1 == len(transaction.mosaics)

	mosaic = transaction.mosaics[0].mosaic
	assert b'nem' == mosaic.mosaic_id.namespace_id.name
	assert b'xem' == mosaic.mosaic_id.name
	assert nc.Amount(12345000) == mosaic.amount

	assert b'test nem transfer' == transaction.message.message


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
		BalanceChange('alpha', 'baz.token', 12345),
		BalanceChange('beta', 'foo.token', 22222),
		BalanceChange('beta', 'baz.token', 44444)
	] == balance_changes


async def test_can_download_rosetta_block_balance_changes_from_block_with_multiple_operations_in_multiple_transactions():
	# Arrange:
	connector = MockRosettaConnector()
	connector.post_response = {
		'block': {
			'transactions': [
				{
					'operations': [
						_make_operation_json('zeta', 'z.coupons', 1732),
						_make_operation_json('omega', 'z.coupons', 2233)
					]
				},
				{
					'operations': [
						_make_operation_json('alpha', 'baz.token', 12345),
						_make_operation_json('beta', 'foo.token', 22222),
						_make_operation_json('beta', 'baz.token', 44444)
					]
				},
				{
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
		BalanceChange('zeta', 'z.coupons', 1732),
		BalanceChange('omega', 'z.coupons', 2233),
		BalanceChange('alpha', 'baz.token', 12345),
		BalanceChange('beta', 'foo.token', 22222),
		BalanceChange('beta', 'baz.token', 44444),
		BalanceChange('gamma', 'bar.coin', 9988),
		BalanceChange('alpha', 'foo.token', 222)
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
		BalanceChange('alpha', 'baz.token', 12345),
		BalanceChange('beta', 'baz.token', 44444)
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
		BalanceChange('alpha', 'baz.token', 12345),
		BalanceChange('beta', '777', 22222),
		BalanceChange('beta', 'baz.token', 44444)
	] == balance_changes

# endregion
