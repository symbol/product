# pylint: disable=invalid-name

import pytest
from symbolchain.sc import ReceiptType

from puller.model.symbol.ReceiptCommitment import calculate_receipts_hash
from tests.test.SymbolPublicChainCommitmentTestUtils import load_public_chain_commitments

ADDRESS_1 = '98112233445566778899AABBCCDDEEFF0011223344556677'
ADDRESS_2 = '982233445566778899AABBCCDDEEFF001122334455667788'
ADDRESS_ALIAS_1 = '990100000000000080' + '00' * 15
ADDRESS_ALIAS_2 = '990001000000000080' + '00' * 15
MOSAIC_ID = '0102030405060708'


def _source(primary, secondary):
	return {'primaryId': primary, 'secondaryId': secondary}


def _transaction_statement(primary, secondary, *receipts):
	return {'height': '12', 'source': _source(primary, secondary), 'receipts': list(receipts)}


def _resolution_statement(unresolved, *entries):
	return {
		'height': '12',
		'unresolved': unresolved,
		'resolutionEntries': [{'source': _source(primary, secondary), 'resolved': resolved} for primary, secondary, resolved in entries]
	}


def _ordinary_receipts():
	# The two harvest receipts share a type and retain Core's insertion order.
	return [
		{
			'version': 1, 'type': ReceiptType.MOSAIC_RENTAL_FEE.value, 'mosaicId': MOSAIC_ID, 'amount': '12345',
			'senderAddress': ADDRESS_2, 'recipientAddress': ADDRESS_1
		},
		{
			'version': 1, 'type': ReceiptType.HARVEST_FEE.value, 'mosaicId': MOSAIC_ID, 'amount': '18446744073709551615',
			'targetAddress': ADDRESS_1
		},
		{
			'version': 1, 'type': ReceiptType.HARVEST_FEE.value, 'mosaicId': MOSAIC_ID, 'amount': '8',
			'targetAddress': ADDRESS_2
		},
		{'version': 1, 'type': ReceiptType.NAMESPACE_EXPIRED.value, 'artifactId': 'C102030405060708'},
		{'version': 1, 'type': ReceiptType.INFLATION.value, 'mosaicId': MOSAIC_ID, 'amount': '65536'}
	]


def test_calculate_receipts_hash_returns_zero_for_a_block_without_statements():
	# Act:
	result = calculate_receipts_hash([], [], [])

	# Assert:
	assert bytes(32) == result


@pytest.mark.parametrize(('receipt_order', 'expected'), [
	((0, 1, 2, 3, 4), '47ef57c41c291a556a3772eda6f62a4a8b140524daebae5901ee25b42a7ee377'),
	((0, 2, 1, 3, 4), '7b57dbf6af6bf2e0eb2b5b3267a0809f189e61dd58825a7f72cfbba7543306a1')
])
def test_calculate_receipts_hash_commits_to_receipt_layouts_and_equal_type_order(receipt_order, expected):
	# Arrange: vectors calculated with SDK receipt serialization and the Core TransactionStatement::hash preimage.
	receipts = _ordinary_receipts()
	statement = _transaction_statement(2, 5, *(receipts[index] for index in receipt_order))

	# Act:
	result = calculate_receipts_hash([statement], [], [])

	# Assert:
	assert bytes.fromhex(expected) == result


def test_calculate_receipts_hash_commits_to_address_resolution_entry_order():
	# Arrange: this alias resolves to two distinct values at the same receipt source.
	statement = _resolution_statement(ADDRESS_ALIAS_1, (2, 5, ADDRESS_2), (2, 5, ADDRESS_1))

	# Act:
	result = calculate_receipts_hash([], [statement], [])

	# Assert: Core address statement domain and the SDK resolution entry encodings.
	assert bytes.fromhex('150c34e5ef7d6282fc2241f4a6a0cedb5a4b8c4f84292f703fe893084831bbad') == result


def test_calculate_receipts_hash_commits_to_mosaic_resolution_entries():
	# Arrange:
	statement = _resolution_statement('8000000000000001', (2, 3, MOSAIC_ID), (256, 0, '0011223344556677'))

	# Act:
	result = calculate_receipts_hash([], [], [statement])

	# Assert: Core mosaic statement domain and the SDK resolution entry encodings.
	assert bytes.fromhex('339a14c876d2fcb35f5a7de8ce88e45c127147282a3845897d40e6c2201f8f3f') == result


def test_calculate_receipts_hash_sorts_statement_keys_in_core_map_order():
	# Arrange: seven leaves across three maps, with the REST statement ordering reversed in each map.
	receipts = _ordinary_receipts()
	transactions = [
		_transaction_statement(256, 0, receipts[4]),
		_transaction_statement(2, 5, *receipts),
		_transaction_statement(2, 3, receipts[1])
	]
	addresses = [
		_resolution_statement(ADDRESS_ALIAS_1, (2, 5, ADDRESS_2), (2, 5, ADDRESS_1)),
		_resolution_statement(ADDRESS_ALIAS_2, (2, 5, ADDRESS_1))
	]
	mosaics = [
		_resolution_statement('8000000000000100', (2, 5, '0899AABBCCDDEEFF')),
		_resolution_statement('8000000000000001', (2, 3, MOSAIC_ID), (256, 0, '0011223344556677'))
	]

	# Act:
	result = calculate_receipts_hash(iter(transactions), iter(addresses), iter(mosaics))

	# Assert: independent Core-compatible leaf hashes with the seventh leaf duplicated for the first tree layer.
	assert bytes.fromhex('1dbe6f9455ccf9cd7763c0f60b70bcc89672745ae4ab5bfc58c70a4e7902b217') == result


@pytest.mark.parametrize(('field_name', 'value', 'message'), [
	('version', 2, 'Unsupported Symbol receipt version 2'),
	('version', True, 'Invalid Symbol receipt commitment version'),
	('type', ReceiptType.TRANSACTION_GROUP.value, 'Unsupported Symbol receipt type 57667'),
	('mosaicId', 'FFFFFFFFFFFFFFFG', 'Invalid Symbol receipt commitment mosaicId'),
	('mosaicId', '1', 'Invalid Symbol receipt commitment mosaicId'),
	('amount', 1, 'Invalid Symbol receipt commitment amount'),
	('amount', '1_000', 'Invalid Symbol receipt commitment amount'),
	('amount', '18446744073709551616', 'Invalid Symbol receipt commitment amount'),
	('targetAddress', None, 'Invalid Symbol receipt commitment targetAddress'),
	('targetAddress', '981122', 'Invalid Symbol receipt commitment targetAddress')
])
def test_calculate_receipts_hash_rejects_unsupported_or_malformed_receipts(field_name, value, message):
	# Arrange:
	receipt = {**_ordinary_receipts()[1], field_name: value}
	statement = _transaction_statement(2, 5, receipt)

	# Act:
	with pytest.raises(ValueError) as raised:
		calculate_receipts_hash([statement], [], [])

	# Assert:
	assert message == str(raised.value)


@pytest.mark.parametrize(('transaction_statements', 'address_statements', 'message'), [
	([{'source': _source(2, 5), 'receipts': {}}], [], 'Invalid Symbol receipt commitment receipts'),
	([{'source': _source(2, 1 << 32), 'receipts': []}], [], 'Invalid Symbol receipt commitment secondaryId'),
	([], [{'unresolved': ADDRESS_ALIAS_1}], 'Invalid Symbol receipt commitment resolutionEntries'),
	([], [_resolution_statement(ADDRESS_ALIAS_1, (False, 5, ADDRESS_1))], 'Invalid Symbol receipt commitment primaryId')
])
def test_calculate_receipts_hash_rejects_malformed_statements(transaction_statements, address_statements, message):
	# Act:
	with pytest.raises(ValueError) as raised:
		calculate_receipts_hash(transaction_statements, address_statements, [])

	# Assert:
	assert message == str(raised.value)


def test_calculate_receipts_hash_rejects_duplicate_statement_keys():
	# Arrange: hex letter case is immaterial to the Core map key.
	statements = [
		_resolution_statement(ADDRESS_ALIAS_1[:-2] + 'AB', (2, 5, ADDRESS_1)),
		_resolution_statement(ADDRESS_ALIAS_1[:-2] + 'ab', (2, 5, ADDRESS_2))
	]

	# Act:
	with pytest.raises(ValueError) as raised:
		calculate_receipts_hash([], statements, [])

	# Assert:
	assert 'Duplicate Symbol receipt commitment statement key' == str(raised.value)


@pytest.mark.parametrize('height', tuple(load_public_chain_commitments()['receipts']))
def test_reconstructs_receipts_hash(height):
	# Arrange:
	case = load_public_chain_commitments()['receipts'][height]
	expected_root = bytes.fromhex(case['block']['block']['receiptsHash'])
	transactions = [item['statement'] for item in case['transactions']['data']]
	addresses = [item['statement'] for item in case['addresses']['data']]
	mosaics = [item['statement'] for item in case['mosaics']['data']]

	# Act:
	result = calculate_receipts_hash(transactions, addresses, mosaics)

	# Assert:
	assert expected_root == result
