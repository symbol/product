from datetime import datetime, timedelta, timezone

import pytest
from common.symbol.NativeMosaic import NativeMosaicInfo
from symbolchain.sc import NamespaceId, TransactionType
from symbolchain.symbol.Network import Address, Network

from rest.model.symbol.TransactionView import (
	SymbolTransactionView,
	TransactionViewRecord,
	create_transaction_payload,
	create_unconfirmed_record
)
from rest.model.symbol.validation import SymbolDataInvalid

from ...test.SymbolUnconfirmedTransactionTestUtils import get_unconfirmed_aggregate_children, get_unconfirmed_transaction

NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)


def _create_record(**overrides):
	record = TransactionViewRecord(
		transaction_hash='AB' * 32,
		aggregate_hash=None,
		embedded_index=None,
		transaction_type=TransactionType.TRANSFER,
		from_address='TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
		to_address='TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
		payload=[{'message': {'type': 0, 'payload': '4869'}}],
		mosaics=(('1234567890ABCDEF', 12345),),
		deadline=datetime(2026, 10, 28, 10, 0, tzinfo=timezone.utc),
		signature='CD' * 64,
		size=176,
		version=1,
	)
	return record._replace(**overrides)


@pytest.mark.parametrize('transaction_type,expected_payload_map', [
	(TransactionType.NAMESPACE_REGISTRATION, {
		'registrationType': 0,
		'duration': '86400',
		'id': '9B26A9460345E820',
		'name': 'test--'
	}),
	(TransactionType.ADDRESS_ALIAS, {
		'namespaceId': 'D748B092093AA7A1',
		'aliasAction': 1,
		'address': 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ'
	}),
	(TransactionType.MOSAIC_ALIAS, {
		'namespaceId': 'D47D7DC85A201C13',
		'aliasAction': 1,
		'mosaicId': '699E9532708D2FB8'
	}),
	(TransactionType.MOSAIC_DEFINITION, {
		'nonce': 1308337564,
		'id': '0E2B031D9C83906D',
		'flags': 15,
		'divisibility': 4,
		'duration': '100'
	}),
	(TransactionType.MOSAIC_SUPPLY_CHANGE, {
		'mosaicId': '0E2B031D9C83906D',
		'action': 1,
		'delta': '100000'
	}),
	(TransactionType.MOSAIC_SUPPLY_REVOCATION, {
		'sourceAddress': 'TAJHE6PY3UOW3EPZVL5UP52WPNOIQXH7BL6MXSQ',
		'mosaicId': '0E2B031D9C83906D',
		'amount': '1'
	}),
	(TransactionType.MULTISIG_ACCOUNT_MODIFICATION, {
		'minRemovalDelta': -1,
		'minApprovalDelta': -1,
		'addressAdditions': [],
		'addressDeletions': ['TD7TOGIBCITKDRXRVVVVTNZ7H5B72CZRJAPBBQY']
	}),
	(TransactionType.HASH_LOCK, {
		'duration': '5760',
		'mosaicId': '72C0212E67A08BCE',
		'amount': '10000000',
		'hash': 'ADA2C97667D2D0C856E1EC5C5FC3236081C4ECE01AF7051B6CC5EBF9FAEAE6CB'
	}),
	(TransactionType.SECRET_LOCK, {
		'duration': '100',
		'mosaicId': '72C0212E67A08BCE',
		'amount': '100000000',
		'hashAlgorithm': 0,
		'secret': '5F6844DA291E0C5D427FB7E2E042E5621DD8E9146FB10193066EB75BA674164F'
	}),
	(TransactionType.SECRET_PROOF, {
		'hashAlgorithm': 0,
		'secret': '5F6844DA291E0C5D427FB7E2E042E5621DD8E9146FB10193066EB75BA674164F',
		'proof': '100C5F424FB6FE5F4A789A21CDD299E10D09EA5A'
	}),
	(TransactionType.ACCOUNT_ADDRESS_RESTRICTION, {
		'restrictionFlags': 32769,
		'restrictionAdditions': [],
		'restrictionDeletions': ['TCSFD7TYOFAWXJ2IB7RTR4ELZVWX22Y5QPQLNKA']
	}),
	(TransactionType.ACCOUNT_MOSAIC_RESTRICTION, {
		'restrictionFlags': 32770,
		'restrictionAdditions': [],
		'restrictionDeletions': ['699E9532708D2FB8']
	}),
	(TransactionType.ACCOUNT_OPERATION_RESTRICTION, {
		'restrictionFlags': 49156,
		'restrictionAdditions': [],
		'restrictionDeletions': [16716]
	}),
	(TransactionType.ACCOUNT_KEY_LINK, {
		'linkedPublicKey': 'F7D905E706693CAD93D176158A52F48196075D0D2B78123623B0CA184855E9DA',
		'linkAction': 0
	}),
	(TransactionType.MOSAIC_ADDRESS_RESTRICTION, {
		'mosaicId': '1213766D49458631',
		'restrictionKey': '00000000000056CE',
		'targetAddress': 'TD7TOGIBCITKDRXRVVVVTNZ7H5B72CZRJAPBBQY',
		'previousRestrictionValue': '30',
		'newRestrictionValue': '40'
	}),
	(TransactionType.MOSAIC_GLOBAL_RESTRICTION, {
		'mosaicId': '1213766D49458631',
		'referenceMosaicId': '0000000000000000',
		'restrictionKey': '00000000000056CE',
		'previousRestrictionValue': '0',
		'previousRestrictionType': 0,
		'newRestrictionValue': '20',
		'newRestrictionType': 6
	}),
	(TransactionType.ACCOUNT_METADATA, {
		'targetAddress': 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ',
		'scopedMetadataKey': 'AB79F8932C207FF0',
		'valueSizeDelta': 8,
		'valueSize': 8,
		'value': '6D65746164617461'
	}),
	(TransactionType.MOSAIC_METADATA, {
		'targetAddress': 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ',
		'scopedMetadataKey': 'E58D01B9EFE794B0',
		'targetMosaicId': '699E9532708D2FB8',
		'valueSizeDelta': 15,
		'valueSize': 15,
		'value': '6D6F73616963206D65746164617461'
	}),
	(TransactionType.NAMESPACE_METADATA, {
		'targetAddress': 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ',
		'scopedMetadataKey': 'A7BA0DDE53F20693',
		'targetNamespaceId': 'D47D7DC85A201C13',
		'valueSizeDelta': 18,
		'valueSize': 18,
		'value': '6E616D657370616365206D65746164617461'
	}),
	(TransactionType.VRF_KEY_LINK, {
		'linkedPublicKey': 'D7EC9E0D284AEC0ED01AF09E286EA2F6D02B39F2CC95AB872687185C085C1BF6',
		'linkAction': 0
	}),
	(TransactionType.VOTING_KEY_LINK, {
		'linkedPublicKey': '1410185FF4E7CBC7A4F4D080CB6F5B3DC0553BB163A63EB6B90318A2077D10C5',
		'startEpoch': 100,
		'endEpoch': 150,
		'linkAction': 0
	}),
	(TransactionType.NODE_KEY_LINK, {
		'linkedPublicKey': '7D484DAD2B7D8B8F5E7DD52D29E338C5C5D7A7FBF065297A2A7902AD237616B9',
		'linkAction': 0
	})
])
def test_preserves_specific_payload(transaction_type, expected_payload_map):
	# Arrange:
	unconfirmed_transaction = get_unconfirmed_transaction(transaction_type)['transaction']

	# Act:
	payload, mosaics = create_transaction_payload(unconfirmed_transaction, transaction_type)

	# Assert:
	assert [expected_payload_map] == payload
	assert not mosaics


@pytest.mark.parametrize('transaction_type,field_name', [
	(TransactionType.MULTISIG_ACCOUNT_MODIFICATION, 'addressAdditions'),
	(TransactionType.MULTISIG_ACCOUNT_MODIFICATION, 'addressDeletions'),
	(TransactionType.ACCOUNT_ADDRESS_RESTRICTION, 'restrictionAdditions'),
	(TransactionType.ACCOUNT_ADDRESS_RESTRICTION, 'restrictionDeletions'),
])
def test_formats_address_lists(transaction_type, field_name):
	# Arrange:
	unconfirmed_transaction = get_unconfirmed_transaction(transaction_type)['transaction']
	unconfirmed_transaction[field_name] = [
		'982c69a051a72bfbe31aeda7250ac6c747b7570b3e9c00b6',
		'98127279F8DD1D6D91F9AAFB47F7567B5C885CFF0AFCCBCA',
	]

	# Act:
	payload, _ = create_transaction_payload(unconfirmed_transaction, transaction_type)

	# Assert:
	assert [
		'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ',
		'TAJHE6PY3UOW3EPZVL5UP52WPNOIQXH7BL6MXSQ',
	] == payload[0][field_name]


@pytest.mark.parametrize('transaction_type,field_name', [
	(TransactionType.MOSAIC_SUPPLY_REVOCATION, 'sourceAddress'),
	(TransactionType.MOSAIC_ADDRESS_RESTRICTION, 'targetAddress'),
])
def test_formats_unresolved_address(transaction_type, field_name):
	# Arrange:
	address = Address.from_namespace_id(NamespaceId(int('887E5DB6BB0B21F5', 16)), Network.TESTNET.identifier)
	unconfirmed_transaction = get_unconfirmed_transaction(transaction_type)['transaction']
	unconfirmed_transaction[field_name] = address.bytes.hex()

	# Act:
	payload, _ = create_transaction_payload(unconfirmed_transaction, transaction_type)

	# Assert:
	assert str(address) == payload[0][field_name]


@pytest.mark.parametrize('transaction_type,restrictions', [
	(TransactionType.ACCOUNT_MOSAIC_RESTRICTION, ['699E9532708D2FB8', '1213766D49458631']),
	(TransactionType.ACCOUNT_OPERATION_RESTRICTION, [16716, 16724]),
])
def test_preserves_non_address_lists(transaction_type, restrictions):
	# Arrange:
	unconfirmed_transaction = get_unconfirmed_transaction(transaction_type)['transaction']
	unconfirmed_transaction.update(restrictionAdditions=restrictions[:], restrictionDeletions=restrictions[:])

	# Act:
	payload, _ = create_transaction_payload(unconfirmed_transaction, transaction_type)

	# Assert:
	assert restrictions == payload[0]['restrictionAdditions']
	assert restrictions == payload[0]['restrictionDeletions']


@pytest.mark.parametrize('transaction_type', [TransactionType.AGGREGATE_COMPLETE, TransactionType.AGGREGATE_BONDED])
def test_formats_aggregate_payload(transaction_type):
	# Arrange:
	unconfirmed_transaction = get_unconfirmed_transaction(transaction_type)['transaction']
	cosignature_map = {
		'version': '0',
		'signerPublicKey': 'CD' * 32,
		'signature': 'AB' * 64,
	}
	unconfirmed_transaction['cosignatures'] = [cosignature_map]

	# Act:
	payload, mosaics = create_transaction_payload(unconfirmed_transaction, transaction_type)

	# Assert:
	assert [{
		'transactionsHash': unconfirmed_transaction['transactionsHash'],
		'cosignatures': [cosignature_map],
	}] == payload
	assert not mosaics


@pytest.mark.parametrize('message,expected', [
	(None, None), ('', None), ('00', {'type': 0, 'payload': ''}),
	('00FF', {'type': 0, 'payload': 'FF'}),
	('0100ff', {'type': 1, 'payload': '00FF'}),
	('fe2a8061577301e200ff', {'type': 254, 'payload': '00FF'}),
	('AAFF', {'type': None, 'payload': 'AAFF'})
])
def test_formats_transfer_message(message, expected):
	# Arrange:
	unconfirmed_transaction = {'message': message, 'mosaics': []}

	# Act:
	payload, mosaics = create_transaction_payload(unconfirmed_transaction, TransactionType.TRANSFER)

	# Assert:
	assert ([] if expected is None else [{'message': expected}]) == payload
	assert not mosaics


@pytest.mark.parametrize('amount,expected_amount', [
	('12345', 12345),
	('18446744073709551615', 18446744073709551615),
])
def test_can_format_transaction_fields(amount, expected_amount):
	# Arrange:
	unconfirmed_transaction = {
		'message': '004869',
		'mosaics': [{'id': '1234567890abcdef', 'amount': amount}],
	}

	# Act:
	payload, mosaics = create_transaction_payload(unconfirmed_transaction, TransactionType.TRANSFER)

	# Assert:
	assert [{'message': {'type': 0, 'payload': '4869'}}] == payload
	assert (('1234567890ABCDEF', expected_amount),) == mosaics


def test_can_create_unconfirmed_record():
	# Arrange:
	unconfirmed_transaction = get_unconfirmed_transaction(TransactionType.TRANSFER)

	# Act:
	record = create_unconfirmed_record(unconfirmed_transaction, Network.TESTNET)

	# Assert:
	assert TransactionViewRecord(
		transaction_hash='01' * 32,
		aggregate_hash=None,
		embedded_index=None,
		transaction_type=TransactionType.TRANSFER,
		from_address='TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
		to_address='TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
		payload=[],
		mosaics=(('72C0212E67A08BCE', 123000000),),
		deadline=datetime(2022, 11, 2, 7, 25, 23, 789000, tzinfo=timezone.utc),
		signature='AB' * 64,
		size=176,
		version=1,
		fee=None,
		height=0,
		timestamp=None,
	) == record


@pytest.mark.parametrize('index', [0, 2])
def test_can_create_embedded_record(index):
	# Arrange:
	unconfirmed_transaction, = get_unconfirmed_aggregate_children('02' * 32)
	unconfirmed_transaction['meta']['index'] = str(index)

	# Act:
	record = create_unconfirmed_record(unconfirmed_transaction, Network.TESTNET)

	# Assert:
	assert None is record.transaction_hash
	assert '02' * 32 == record.aggregate_hash
	assert index == record.embedded_index
	assert TransactionType.TRANSFER == record.transaction_type
	assert 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY' == record.from_address
	assert 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY' == record.to_address
	assert (('72C0212E67A08BCE', 5000000),) == record.mosaics
	assert [] == record.payload
	assert 1 == record.version
	assert 0 == record.height
	for field_name in ('deadline', 'signature', 'size', 'fee', 'timestamp'):
		assert None is getattr(record, field_name)


def test_returns_no_record_recipient():
	# Arrange:
	unconfirmed_transaction = get_unconfirmed_transaction(TransactionType.NAMESPACE_REGISTRATION)

	# Act:
	record = create_unconfirmed_record(unconfirmed_transaction, Network.TESTNET)

	# Assert:
	assert None is record.to_address


def test_preserves_recipient_alias():
	# Arrange:
	address = Address.from_namespace_id(NamespaceId(int('887E5DB6BB0B21F5', 16)), Network.TESTNET.identifier)
	unconfirmed_transaction = get_unconfirmed_transaction(TransactionType.TRANSFER)
	unconfirmed_transaction['transaction']['recipientAddress'] = address.bytes.hex()

	# Act:
	record = create_unconfirmed_record(unconfirmed_transaction, Network.TESTNET)

	# Assert:
	assert str(address) == record.to_address


@pytest.mark.parametrize('transaction_type', [TransactionType.SECRET_LOCK, TransactionType.SECRET_PROOF])
def test_formats_secret_recipient(transaction_type):
	# Arrange:
	unconfirmed_transaction = get_unconfirmed_transaction(transaction_type)

	# Act:
	record = create_unconfirmed_record(unconfirmed_transaction, Network.TESTNET)

	# Assert:
	assert 'TAJHE6PY3UOW3EPZVL5UP52WPNOIQXH7BL6MXSQ' == record.to_address


@pytest.mark.parametrize('amount', ['1.5', 'invalid'])
def test_rejects_invalid_transfer_amount(amount):
	# Arrange:
	unconfirmed_transaction = get_unconfirmed_transaction(TransactionType.TRANSFER)
	unconfirmed_transaction['transaction']['mosaics'][0]['amount'] = amount

	# Act + Assert:
	with pytest.raises(SymbolDataInvalid, match='invalid node response'):
		create_unconfirmed_record(unconfirmed_transaction, Network.TESTNET)


@pytest.mark.parametrize('overrides_map', [
	{'type': 0}, {'signerPublicKey': 'AB'}, {'recipientAddress': 'AB'},
	{'deadline': 'invalid'}, {'mosaics': [{'id': 'invalid', 'amount': '1'}]}
])
def test_rejects_invalid_common_fields(overrides_map):
	# Arrange:
	unconfirmed_transaction = get_unconfirmed_transaction(TransactionType.TRANSFER)
	unconfirmed_transaction['transaction'].update(overrides_map)

	# Act + Assert:
	with pytest.raises(SymbolDataInvalid, match='invalid node response'):
		create_unconfirmed_record(unconfirmed_transaction, Network.TESTNET)


@pytest.mark.parametrize('confirmation_map,expected_timestamp', [
	({}, None),
	({
		'fee': 0.125,
		'height': 123456,
		'timestamp': datetime(2026, 10, 28, 16, 0, tzinfo=timezone(timedelta(hours=8))),
	}, '2026-10-28 08:00:00'),
])
def test_returns_shared_output(confirmation_map, expected_timestamp):
	# Arrange:
	record = _create_record(**confirmation_map)
	view = SymbolTransactionView(record, {'1234567890ABCDEF': ('1234567890ABCDEF', 2)})

	# Act:
	result = view.to_dict()

	# Assert:
	assert {
		'transactionHash': 'AB' * 32,
		'transactionType': 'TRANSFER',
		'fromAddress': record.from_address,
		'toAddress': record.to_address,
		'value': [
			{'message': {'type': 0, 'payload': '4869'}},
			{'id': '1234567890ABCDEF', 'name': '1234567890ABCDEF', 'amount': 123.45},
		],
		'embeddedTransactions': None,
		'fee': confirmation_map.get('fee'),
		'height': confirmation_map.get('height', 0),
		'timestamp': expected_timestamp,
		'deadline': '2026-10-28 10:00:00',
		'signature': 'CD' * 64,
		'size': 176,
		'version': 1,
	} == result


@pytest.mark.parametrize('divisibility,expected_amount', [
	(0, 1234567),
	(2, 12345.67),
	(6, 1.234567),
])
def test_formats_transfer_mosaic(divisibility, expected_amount):
	# Arrange:
	mosaic_id = '1234567890ABCDEF'
	record = _create_record(payload=[], mosaics=((mosaic_id, 1234567),))
	view = SymbolTransactionView(record, {mosaic_id: (mosaic_id, divisibility)})

	# Act:
	result = view.to_dict()

	# Assert:
	assert [{'id': mosaic_id, 'name': mosaic_id, 'amount': expected_amount}] == result['value']


def test_preserves_mosaic_amount():
	# Arrange:
	record = _create_record(payload=[], mosaics=(('1234567890ABCDEF', 18446744073709551615),))
	view = SymbolTransactionView(record, {})

	# Act:
	result = view.to_dict()

	# Assert:
	assert [{
		'id': '1234567890ABCDEF',
		'name': '1234567890ABCDEF',
		'amount': 18446744073709551615,
	}] == result['value']


def test_preserves_unresolved_aliases():
	# Arrange:
	alias_id = '887E5DB6BB0B21F5'
	record = _create_record(payload=[], mosaics=((alias_id, 1234567),))
	view = SymbolTransactionView(record, {})

	# Act:
	result = view.to_dict()

	# Assert:
	assert [{'id': alias_id, 'name': alias_id, 'amount': 1234567}] == result['value']


@pytest.mark.parametrize('resolved_id,divisibility,expected_amount', [
	('1234567890ABCDEF', 3, 1234.567),
	('72C0212E67A08BCE', 3, 1234.567)
])
def test_formats_resolved_alias(resolved_id, divisibility, expected_amount):
	# Arrange:
	alias_id = '887E5DB6BB0B21F5'
	record = _create_record(payload=[], mosaics=((alias_id, 1234567),))
	view = SymbolTransactionView(record, {alias_id: (resolved_id, divisibility)})

	# Act:
	result = view.to_dict()

	# Assert:
	assert [{'id': resolved_id, 'name': resolved_id, 'amount': expected_amount}] == result['value']


def test_returns_confirmed_child():
	# Arrange:
	timestamp = datetime(2026, 10, 28, 8, 0)
	parent = _create_record(
		transaction_type=TransactionType.AGGREGATE_COMPLETE,
		payload=[],
		mosaics=(),
		fee=0.5,
		height=123456,
		timestamp=timestamp,
	)
	child = _create_record(
		transaction_hash=None,
		aggregate_hash=parent.transaction_hash,
		embedded_index=0,
		deadline=None,
		signature=None,
		size=None,
		height=parent.height,
		timestamp=timestamp,
	)
	view = SymbolTransactionView(parent, {'1234567890ABCDEF': ('1234567890ABCDEF', 2)}, (child,))

	# Act:
	result = view.to_dict()

	# Assert:
	child_map, = result['embeddedTransactions']
	assert 123456 == child_map['height']
	assert '2026-10-28 08:00:00' == child_map['timestamp']
	assert 123.45 == child_map['value'][1]['amount']
	assert None is child_map['embeddedTransactions']
	for field_name in ('transactionHash', 'fee', 'deadline', 'signature', 'size'):
		assert None is child_map[field_name]


@pytest.mark.parametrize('parent_type,child_type,payload,mosaics,expected_value', [
	(TransactionType.AGGREGATE_COMPLETE, TransactionType.MULTISIG_ACCOUNT_MODIFICATION, [{
		'minRemovalDelta': -1,
		'minApprovalDelta': -1,
		'addressAdditions': [],
		'addressDeletions': ['TD7TOGIBCITKDRXRVVVVTNZ7H5B72CZRJAPBBQY'],
	}], (), [{
		'minRemovalDelta': -1,
		'minApprovalDelta': -1,
		'addressAdditions': [],
		'addressDeletions': ['TD7TOGIBCITKDRXRVVVVTNZ7H5B72CZRJAPBBQY'],
	}]),
	(TransactionType.AGGREGATE_BONDED, TransactionType.TRANSFER, [], (('72C0212E67A08BCE', 5000000),), [{
		'id': '72C0212E67A08BCE',
		'name': '72C0212E67A08BCE',
		'amount': 5,
	}]),
])
def test_returns_embedded_transactions(parent_type, child_type, payload, mosaics, expected_value):
	# Arrange:
	parent = _create_record(transaction_type=parent_type, payload=[], mosaics=())
	child = _create_record(
		transaction_hash=None,
		aggregate_hash=parent.transaction_hash,
		embedded_index=0,
		transaction_type=child_type,
		payload=payload,
		mosaics=mosaics,
		deadline=None,
		signature=None,
		size=None,
	)
	view = SymbolTransactionView(parent, {NATIVE_MOSAIC_INFO.id: (NATIVE_MOSAIC_INFO.id, 6)}, (child,))

	# Act:
	result = view.to_dict()

	# Assert:
	child_map, = result['embeddedTransactions']
	assert child_type.name == child_map['transactionType']
	assert expected_value == child_map['value']
	for field_name in ('transactionHash', 'signature', 'deadline', 'size', 'fee'):
		assert None is child_map[field_name]


def test_can_format_unconfirmed_transfer():
	# Arrange:
	unconfirmed_transaction = get_unconfirmed_transaction(TransactionType.TRANSFER)
	unconfirmed_transaction['transaction']['message'] = '0048656C6C6F'
	mosaic_divisibility_map = {NATIVE_MOSAIC_INFO.id: (NATIVE_MOSAIC_INFO.id, NATIVE_MOSAIC_INFO.divisibility)}

	# Act:
	record = create_unconfirmed_record(unconfirmed_transaction, Network.TESTNET)
	result = SymbolTransactionView(record, mosaic_divisibility_map).to_dict()

	# Assert:
	assert {
		'transactionHash': '01' * 32,
		'transactionType': 'TRANSFER',
		'fromAddress': 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
		'toAddress': 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
		'value': [
			{'message': {'type': 0, 'payload': '48656C6C6F'}},
			{'id': '72C0212E67A08BCE', 'name': '72C0212E67A08BCE', 'amount': 123}
		],
		'embeddedTransactions': None,
		'fee': None,
		'height': 0,
		'timestamp': None,
		'deadline': '2022-11-02 07:25:23',
		'signature': 'AB' * 64,
		'size': 176,
		'version': 1
	} == result
