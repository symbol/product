# pylint: disable=duplicate-code
from copy import deepcopy
from unittest.mock import Mock

import pytest
from common.symbol.NativeMosaic import NativeMosaicInfo
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Network

from rest.db.SymbolDatabase import SymbolDatabase, SymbolDataUnavailable
from rest.model.symbol.TransactionView import TransactionMosaicRecord

from ..test.SymbolUnconfirmedTransactionTestUtils import get_unconfirmed_aggregate_children, get_unconfirmed_transaction

NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)


@pytest.fixture(name='database')
def fixture_database():
	# Mapping node DTOs does not require an open database pool.
	database = SymbolDatabase.__new__(SymbolDatabase)
	database.native_mosaic_info = NATIVE_MOSAIC_INFO
	database.get_mosaic_divisibility = Mock(return_value={
		NATIVE_MOSAIC_INFO.id: (NATIVE_MOSAIC_INFO.id, NATIVE_MOSAIC_INFO.divisibility),
	})
	return database


def test_can_get_transfer_with_message(database):  # pylint: disable=invalid-name
	# Arrange:
	unconfirmed_transaction = get_unconfirmed_transaction(TransactionType.TRANSFER)
	unconfirmed_transaction['transaction']['message'] = '0048656C6C6F'

	# Act:
	result = database.get_unconfirmed_transactions([unconfirmed_transaction], Network.TESTNET)

	# Assert:
	transaction, = result
	assert '01' * 32 == transaction.transaction_hash
	assert TransactionType.TRANSFER == transaction.transaction_type
	assert [{'message': {'type': 0, 'payload': '48656C6C6F'}}] == transaction.payload
	assert (TransactionMosaicRecord(NATIVE_MOSAIC_INFO.id, 123000000, 6),) == transaction.mosaics
	assert () == transaction.embedded_transactions
	database.get_mosaic_divisibility.assert_called_once_with([NATIVE_MOSAIC_INFO.id], NATIVE_MOSAIC_INFO)


def test_can_get_transfer_without_message(database):  # pylint: disable=invalid-name
	# Arrange:
	mosaic_id = '1234567890ABCDEF'
	unconfirmed_transaction = get_unconfirmed_transaction(TransactionType.TRANSFER)
	unconfirmed_transaction['transaction']['mosaics'] = [{'id': mosaic_id.lower(), 'amount': '1234567'}]
	database.get_mosaic_divisibility.return_value = {mosaic_id: (mosaic_id, 3)}

	# Act:
	result = database.get_unconfirmed_transactions([unconfirmed_transaction], Network.TESTNET)

	# Assert:
	transaction, = result
	assert [] == transaction.payload
	assert (TransactionMosaicRecord(mosaic_id, 1234567, 3),) == transaction.mosaics
	database.get_mosaic_divisibility.assert_called_once_with([mosaic_id], NATIVE_MOSAIC_INFO)


def test_can_get_transfer_with_mosaic_alias(database):  # pylint: disable=invalid-name
	# Arrange:
	alias_id = '887E5DB6BB0B21F5'
	unconfirmed_transaction = get_unconfirmed_transaction(TransactionType.TRANSFER)
	unconfirmed_transaction['transaction']['mosaics'] = [{'id': alias_id, 'amount': '1234567'}]
	database.get_mosaic_divisibility.return_value = {alias_id: (NATIVE_MOSAIC_INFO.id, NATIVE_MOSAIC_INFO.divisibility)}

	# Act:
	result = database.get_unconfirmed_transactions([unconfirmed_transaction], Network.TESTNET)

	# Assert:
	transaction, = result
	assert (TransactionMosaicRecord(NATIVE_MOSAIC_INFO.id, 1234567, 6),) == transaction.mosaics
	database.get_mosaic_divisibility.assert_called_once_with([alias_id], NATIVE_MOSAIC_INFO)


def test_can_get_aggregate_complete(database):
	# Arrange:
	aggregate_transaction = get_unconfirmed_transaction(TransactionType.AGGREGATE_COMPLETE)
	embedded_transactions = get_unconfirmed_aggregate_children(aggregate_transaction['meta']['hash'])

	# Act:
	result = database.get_unconfirmed_transactions([aggregate_transaction, *embedded_transactions], Network.TESTNET)

	# Assert:
	transaction, = result
	assert '09' * 32 == transaction.transaction_hash
	assert TransactionType.AGGREGATE_COMPLETE == transaction.transaction_type
	embedded_transaction, = transaction.embedded_transactions
	assert transaction.transaction_hash == embedded_transaction.aggregate_hash
	assert TransactionType.MULTISIG_ACCOUNT_MODIFICATION == embedded_transaction.transaction_type
	assert () == embedded_transaction.mosaics
	database.get_mosaic_divisibility.assert_called_once_with([], NATIVE_MOSAIC_INFO)


def test_can_get_aggregate_bonded(database):
	# Arrange:
	aggregate_transaction = get_unconfirmed_transaction(TransactionType.AGGREGATE_BONDED)
	embedded_transactions = get_unconfirmed_aggregate_children(aggregate_transaction['meta']['hash'])

	# Act:
	result = database.get_unconfirmed_transactions([aggregate_transaction, *embedded_transactions], Network.TESTNET)

	# Assert:
	transaction, = result
	assert '02' * 32 == transaction.transaction_hash
	assert TransactionType.AGGREGATE_BONDED == transaction.transaction_type
	embedded_transaction, = transaction.embedded_transactions
	assert transaction.transaction_hash == embedded_transaction.aggregate_hash
	assert TransactionType.TRANSFER == embedded_transaction.transaction_type
	assert (TransactionMosaicRecord(NATIVE_MOSAIC_INFO.id, 5000000, 6),) == embedded_transaction.mosaics
	database.get_mosaic_divisibility.assert_called_once_with([NATIVE_MOSAIC_INFO.id], NATIVE_MOSAIC_INFO)


def test_returns_empty_list(database):
	# Act:
	result = database.get_unconfirmed_transactions([], Network.TESTNET)

	# Assert:
	assert [] == result
	database.get_mosaic_divisibility.assert_called_once_with([], NATIVE_MOSAIC_INFO)


def test_can_batch_distinct_mosaic_ids(database):
	# Arrange:
	unconfirmed_transaction = get_unconfirmed_transaction(TransactionType.TRANSFER)
	aggregate_transaction = get_unconfirmed_transaction(TransactionType.AGGREGATE_BONDED)
	embedded_transaction = get_unconfirmed_aggregate_children(aggregate_transaction['meta']['hash'])[0]
	unconfirmed_transaction['transaction']['mosaics'] = [{'id': '1234567890abcdef', 'amount': '1234567'}]
	embedded_transaction['transaction']['mosaics'] = [
		{'id': '1234567890ABCDEF', 'amount': '7654321'},
		{'id': '234567890ABCDEF0', 'amount': '100'},
	]
	database.get_mosaic_divisibility.return_value = {'1234567890ABCDEF': ('1234567890ABCDEF', 3)}

	# Act:
	result = database.get_unconfirmed_transactions(
		[unconfirmed_transaction, aggregate_transaction, embedded_transaction], Network.TESTNET)

	# Assert:
	assert (TransactionMosaicRecord('1234567890ABCDEF', 1234567, 3),) == result[0].mosaics
	assert (
		TransactionMosaicRecord('1234567890ABCDEF', 7654321, 3),
		TransactionMosaicRecord('234567890ABCDEF0', 100),
	) == result[1].embedded_transactions[0].mosaics
	database.get_mosaic_divisibility.assert_called_once_with(['1234567890ABCDEF', '234567890ABCDEF0'], NATIVE_MOSAIC_INFO)


@pytest.mark.parametrize('transaction_type', [TransactionType.AGGREGATE_COMPLETE, TransactionType.AGGREGATE_BONDED])
def test_returns_children_in_index_order(database, transaction_type):
	# Arrange:
	aggregate_transaction = get_unconfirmed_transaction(transaction_type)

	first_child = get_unconfirmed_aggregate_children(aggregate_transaction['meta']['hash'])[0]
	first_child['meta']['index'] = 0

	second_child = deepcopy(first_child)
	second_child['meta']['index'] = 1
	second_child['transaction']['version'] = 2

	# Act:
	result = database.get_unconfirmed_transactions([second_child, aggregate_transaction, first_child], Network.TESTNET)

	# Assert:
	assert 1 == len(result)
	assert transaction_type == result[0].transaction_type
	assert [1, 2] == [embedded_transaction.version for embedded_transaction in result[0].embedded_transactions]


def test_raises_on_metadata_failure(database):
	# Arrange:
	unconfirmed_transaction = get_unconfirmed_transaction(TransactionType.TRANSFER)
	unconfirmed_transaction['transaction']['mosaics'] = [{'id': '1234567890ABCDEF', 'amount': '1'}]
	database.get_mosaic_divisibility.side_effect = SymbolDataUnavailable('unhealthy')

	# Act + Assert:
	with pytest.raises(SymbolDataUnavailable):
		database.get_unconfirmed_transactions([unconfirmed_transaction], Network.TESTNET)
