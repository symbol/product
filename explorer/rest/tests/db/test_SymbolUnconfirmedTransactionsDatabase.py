# pylint: disable=duplicate-code
from copy import deepcopy
from unittest.mock import Mock

import pytest
from common.symbol.NativeMosaic import NativeMosaicInfo
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Network

from rest.db.SymbolDatabase import SymbolDatabase, SymbolDataUnavailable

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


def _get_transactions(database, unconfirmed_transactions):
	return [view.to_dict() for view in database.get_unconfirmed_transactions(unconfirmed_transactions, Network.TESTNET)]


def test_can_get_transfer_with_message(database):  # pylint: disable=invalid-name
	# Arrange:
	unconfirmed_transaction = get_unconfirmed_transaction(TransactionType.TRANSFER)
	unconfirmed_transaction['transaction']['message'] = '0048656C6C6F'

	# Act:
	result = _get_transactions(database, [unconfirmed_transaction])

	# Assert:
	assert [{
		'transactionHash': '01' * 32,
		'transactionType': 'TRANSFER',
		'fromAddress': 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
		'toAddress': 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
		'value': [
			{'message': {'type': 0, 'payload': '48656C6C6F'}},
			{'id': '72C0212E67A08BCE', 'name': '72C0212E67A08BCE', 'amount': 123},
		],
		'embeddedTransactions': None,
		'fee': None,
		'height': 0,
		'timestamp': None,
		'deadline': '2022-11-02 07:25:23',
		'signature': 'AB' * 64,
		'size': 176,
		'version': 1,
	}] == result
	database.get_mosaic_divisibility.assert_called_once_with([NATIVE_MOSAIC_INFO.id], NATIVE_MOSAIC_INFO)


def test_can_get_transfer_without_message(database):  # pylint: disable=invalid-name
	# Arrange:
	mosaic_id = '1234567890ABCDEF'
	unconfirmed_transaction = get_unconfirmed_transaction(TransactionType.TRANSFER)
	unconfirmed_transaction['transaction']['mosaics'] = [{'id': mosaic_id.lower(), 'amount': '1234567'}]
	database.get_mosaic_divisibility.return_value = {mosaic_id: (mosaic_id, 3)}

	# Act:
	result = _get_transactions(database, [unconfirmed_transaction])

	# Assert:
	assert [{
		'transactionHash': '01' * 32,
		'transactionType': 'TRANSFER',
		'fromAddress': 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
		'toAddress': 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
		'value': [
			{'id': mosaic_id, 'name': mosaic_id, 'amount': 1234.567},
		],
		'embeddedTransactions': None,
		'fee': None,
		'height': 0,
		'timestamp': None,
		'deadline': '2022-11-02 07:25:23',
		'signature': 'AB' * 64,
		'size': 176,
		'version': 1,
	}] == result
	database.get_mosaic_divisibility.assert_called_once_with([mosaic_id], NATIVE_MOSAIC_INFO)


def test_can_get_transfer_by_alias(database):
	# Arrange:
	alias_id = '887E5DB6BB0B21F5'
	unconfirmed_transaction = get_unconfirmed_transaction(TransactionType.TRANSFER)
	unconfirmed_transaction['transaction']['mosaics'] = [{'id': alias_id, 'amount': '1234567'}]
	database.get_mosaic_divisibility.return_value = {alias_id: (NATIVE_MOSAIC_INFO.id, NATIVE_MOSAIC_INFO.divisibility)}

	# Act:
	result = _get_transactions(database, [unconfirmed_transaction])

	# Assert:
	assert [{
		'id': NATIVE_MOSAIC_INFO.id,
		'name': NATIVE_MOSAIC_INFO.id,
		'amount': 1.234567,
	}] == result[0]['value']
	database.get_mosaic_divisibility.assert_called_once_with([alias_id], NATIVE_MOSAIC_INFO)


def test_can_get_aggregate_complete(database):
	# Arrange:
	aggregate_transaction = get_unconfirmed_transaction(TransactionType.AGGREGATE_COMPLETE)
	embedded_transactions = get_unconfirmed_aggregate_children(aggregate_transaction['meta']['hash'])

	# Act:
	result = _get_transactions(database, [aggregate_transaction, *embedded_transactions])

	# Assert:
	assert [{
		'transactionHash': '09' * 32,
		'transactionType': 'AGGREGATE_COMPLETE',
		'fromAddress': 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
		'toAddress': None,
		'value': [{
			'transactionsHash': 'B239D10DAECEEB7077E1F6942300916041E91CBEA7613B267BAF3D913CBE6A22',
			'cosignatures': [],
		}],
		'embeddedTransactions': [{
			'transactionHash': None,
			'transactionType': 'MULTISIG_ACCOUNT_MODIFICATION',
			'fromAddress': 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
			'toAddress': None,
			'value': [{
				'minRemovalDelta': -1,
				'minApprovalDelta': -1,
				'addressAdditions': [],
				'addressDeletions': ['TD7TOGIBCITKDRXRVVVVTNZ7H5B72CZRJAPBBQY'],
			}],
			'embeddedTransactions': None,
			'fee': None,
			'height': 0,
			'timestamp': None,
			'deadline': None,
			'signature': None,
			'size': None,
			'version': 1,
		}],
		'fee': None,
		'height': 0,
		'timestamp': None,
		'deadline': '2022-11-02 07:25:23',
		'signature': 'AB' * 64,
		'size': 248,
		'version': 3,
	}] == result
	database.get_mosaic_divisibility.assert_called_once_with([], NATIVE_MOSAIC_INFO)


def test_can_get_aggregate_bonded(database):
	# Arrange:
	aggregate_transaction = get_unconfirmed_transaction(TransactionType.AGGREGATE_BONDED)
	embedded_transactions = get_unconfirmed_aggregate_children(aggregate_transaction['meta']['hash'])

	# Act:
	result = _get_transactions(database, [aggregate_transaction, *embedded_transactions])

	# Assert:
	assert [{
		'transactionHash': '02' * 32,
		'transactionType': 'AGGREGATE_BONDED',
		'fromAddress': 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
		'toAddress': None,
		'value': [{
			'transactionsHash': '2C03591ED233B317D8617565D7F75085E0710804EB836933171DDEBC3BBC4294',
			'cosignatures': [],
		}],
		'embeddedTransactions': [{
			'transactionHash': None,
			'transactionType': 'TRANSFER',
			'fromAddress': 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
			'toAddress': 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
			'value': [
				{'id': '72C0212E67A08BCE', 'name': '72C0212E67A08BCE', 'amount': 5},
			],
			'embeddedTransactions': None,
			'fee': None,
			'height': 0,
			'timestamp': None,
			'deadline': None,
			'signature': None,
			'size': None,
			'version': 1,
		}],
		'fee': None,
		'height': 0,
		'timestamp': None,
		'deadline': '2022-11-02 07:25:23',
		'signature': 'AB' * 64,
		'size': 264,
		'version': 2,
	}] == result
	database.get_mosaic_divisibility.assert_called_once_with([NATIVE_MOSAIC_INFO.id], NATIVE_MOSAIC_INFO)


def test_returns_empty_list(database):
	# Arrange + Act:
	result = _get_transactions(database, [])

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
	result = _get_transactions(database, [unconfirmed_transaction, aggregate_transaction, embedded_transaction])

	# Assert:
	assert 1234.567 == result[0]['value'][0]['amount']
	assert [7654.321, 100] == [mosaic['amount'] for mosaic in result[1]['embeddedTransactions'][0]['value']]
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
	result = _get_transactions(database, [second_child, aggregate_transaction, first_child])

	# Assert:
	assert 1 == len(result)
	assert transaction_type.name == result[0]['transactionType']
	assert [1, 2] == [embedded_transaction['version'] for embedded_transaction in result[0]['embeddedTransactions']]


def test_raises_on_metadata_failure(database):
	# Arrange:
	unconfirmed_transaction = get_unconfirmed_transaction(TransactionType.TRANSFER)
	unconfirmed_transaction['transaction']['mosaics'] = [{'id': '1234567890ABCDEF', 'amount': '1'}]
	database.get_mosaic_divisibility.side_effect = SymbolDataUnavailable('unhealthy')

	# Act + Assert:
	with pytest.raises(SymbolDataUnavailable):
		_get_transactions(database, [unconfirmed_transaction])
