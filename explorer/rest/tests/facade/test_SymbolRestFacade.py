from datetime import date, datetime, timedelta, timezone
from unittest import TestCase
from unittest.mock import create_autospec

from common.symbol.NativeMosaic import NativeMosaicInfo
from psycopg2 import Error as PsycopgError
from psycopg2 import OperationalError
from symbolchain.symbol.Network import Network

from rest.db.SymbolDatabase import (
	BlockStatisticsRecord,
	NamespaceQuery,
	ReceiptQuery,
	ReceiptRecord,
	SortOrder,
	SymbolDatabase,
	SymbolDataUnavailable,
	TransactionQuery,
	TransactionRangeRecord,
	TransactionStatisticsRecord
)
from rest.facade.SymbolRestFacade import SymbolRestFacade

from ..test.SymbolHealthTestUtils import create_symbol_health

NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)


class FailingSymbolDatabase:
	@staticmethod
	def check_connection():
		raise OperationalError('database unavailable')


class BlockReadErrorSymbolDatabase:
	@staticmethod
	def get_block(height):
		raise PsycopgError()


class BlocksReadErrorSymbolDatabase:
	@staticmethod
	def get_blocks(_from_height, _limit, _sort):
		raise PsycopgError()


class UnreadableBlocksSymbolDatabase:
	@staticmethod
	def get_blocks(_from_height, _limit, _sort):
		raise SymbolDataUnavailable('Symbol block data is unavailable')


class MosaicsReadErrorSymbolDatabase:
	@staticmethod
	def get_mosaics(_limit, _offset, _sort):
		raise PsycopgError('database unavailable')


class UnreadableMosaicsSymbolDatabase:
	@staticmethod
	def get_mosaics(_limit, _offset, _sort):
		raise SymbolDataUnavailable('Symbol mosaic data is unavailable')


class HealthySymbolDatabase:
	@staticmethod
	def check_connection():
		return True

	@staticmethod
	def try_get_sync_state():
		return {
			'status': 'healthy',
			'chain_height': 10,
			'finalized_height': 8,
			'last_synced_height': 10,
			'updated_at': None
		}


class TimestampedHealthySymbolDatabase(HealthySymbolDatabase):
	@staticmethod
	def try_get_sync_state():
		return {
			'status': 'healthy',
			'chain_height': 10,
			'finalized_height': 8,
			'last_synced_height': 10,
			'updated_at': datetime(2026, 1, 2, 8, 4, 5, 987654, tzinfo=timezone(timedelta(hours=5)))
		}


class LaggingSymbolDatabase:
	@staticmethod
	def check_connection():
		return True

	@staticmethod
	def try_get_sync_state():
		return {
			'status': 'healthy',
			'chain_height': 10,
			'finalized_height': 8,
			'last_synced_height': 9,
			'updated_at': None
		}


class UnhealthySymbolDatabase:
	@staticmethod
	def check_connection():
		return True

	@staticmethod
	def try_get_sync_state():
		return {
			'status': 'unhealthy',
			'chain_height': 10,
			'finalized_height': 8,
			'last_synced_height': 10,
			'updated_at': None
		}


class RepairingSymbolDatabase:
	@staticmethod
	def check_connection():
		return True

	@staticmethod
	def try_get_sync_state():
		return {
			'status': 'repairing',
			'chain_height': 10,
			'finalized_height': 8,
			'last_synced_height': 9,
			'updated_at': None
		}


class SyncStateFailingSymbolDatabase:
	@staticmethod
	def check_connection():
		return True

	@staticmethod
	def try_get_sync_state():
		raise OperationalError('database unavailable')


class BlockView:
	@staticmethod
	def to_dict(_native_mosaic_info):
		return {'height': 1}

	@staticmethod
	def to_detail_dict(_native_mosaic_info):
		return {'height': 1, 'detail': True}


DEFAULT_BLOCKS = object()


class BlockSymbolDatabase:
	def __init__(self, blocks=DEFAULT_BLOCKS):
		self.blocks = [BlockView()] if DEFAULT_BLOCKS is blocks else blocks
		self.limit = None
		self.from_height = None
		self.sort = None
		self.height = None

	def get_blocks(self, from_height, limit, sort):
		self.from_height = from_height
		self.limit = limit
		self.sort = sort
		return self.blocks

	def get_block(self, height):
		self.height = height
		return BlockView() if 1 == height else None


class BlockStatisticsSymbolDatabase:
	def __init__(self):
		self.called = False

	def get_block_statistics(self):
		self.called = True
		return [
			BlockStatisticsRecord(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 1000000, 10 ** 12),
			BlockStatisticsRecord(2, datetime(2026, 1, 1, 0, 0, 30, tzinfo=timezone.utc), 3000000, 12 * 10 ** 12)
		]


class MosaicView:
	def __init__(self, mosaic_id):
		self.mosaic_id = mosaic_id

	def to_dict(self):
		return {'id': self.mosaic_id}


class MosaicSymbolDatabase:
	def __init__(self, mosaics):
		self.mosaics = mosaics
		self.limit = None
		self.offset = None
		self.sort = None

	def get_mosaics(self, limit, offset, sort):
		self.limit = limit
		self.offset = offset
		self.sort = sort
		return self.mosaics


class ReceiptSymbolDatabase:
	def __init__(self, receipts):
		self.receipts = receipts
		self.query = None

	def get_receipts(self, query):
		self.query = query
		return self.receipts


class TransactionSymbolDatabase:
	def __init__(self, transactions):
		self.transactions = transactions
		self.query = None

	def get_transactions(self, query):
		self.query = query
		return self.transactions


class TransactionStatisticsSymbolDatabase:
	def __init__(self):
		"""Creates independent summary and range records for facade serialization tests."""

		self.statistics = TransactionStatisticsRecord(12, 8, 3, 1.5)
		self.range_query = None
		self.range_rows = [TransactionRangeRecord('2026-01-01', 2)]

	def get_transaction_statistics(self, _cache):
		"""Returns the summary record supplied to the facade."""

		return self.statistics

	def get_transaction_statistics_range(self, start_date, end_date, period_type):
		"""Records the canonical date query and returns the configured period records."""

		self.range_query = (start_date, end_date, period_type)
		return self.range_rows


class NamespaceSymbolDatabase:
	def __init__(self, namespaces):
		self.namespaces = namespaces
		self.query = None

	def get_namespaces(self, query):
		self.query = query
		return self.namespaces


class NamespaceView:
	def __init__(self, value):
		self.value = value

	def to_dict(self):
		return self.value


class ReceiptReadErrorSymbolDatabase:
	@staticmethod
	def get_receipts(_query):
		raise PsycopgError('database unavailable')


def _create_configured_facade():
	return SymbolRestFacade(HealthySymbolDatabase(), NATIVE_MOSAIC_INFO, Network.TESTNET)


def _create_facade_with_database(symbol_db):
	return SymbolRestFacade(symbol_db, NATIVE_MOSAIC_INFO, Network.TESTNET)


class SymbolRestFacadeTest(TestCase):  # pylint: disable=too-many-public-methods
	def test_get_namespaces_formats_each_view(self):
		# Arrange:
		expected = [{'id': 'A95F1F8A96159516'}]
		database = NamespaceSymbolDatabase([NamespaceView(expected[0])])
		facade = _create_facade_with_database(database)

		# Act:
		result = facade.get_namespaces(NamespaceQuery())

		# Assert:
		self.assertEqual(expected, result)
		self.assertEqual(NamespaceQuery(), database.query)

	def test_get_transactions_passes_query(self):
		# Arrange:
		query = TransactionQuery()
		symbol_db = TransactionSymbolDatabase([])
		facade = _create_facade_with_database(symbol_db)

		# Act:
		result = facade.get_transactions(query)

		# Assert:
		self.assertIs(query, symbol_db.query)
		self.assertEqual([], result)

	def test_get_transaction_statistics_formats_contract_fields(self):
		"""Verifies that summary record fields map to the public statistics response."""

		# Arrange:
		symbol_db = TransactionStatisticsSymbolDatabase()
		facade = _create_facade_with_database(symbol_db)

		# Act:
		result = facade.get_transaction_statistics()

		# Assert:
		self.assertEqual({
			'total': 12,
			'last30Days': 8,
			'last24Hours': 3,
			'averagePerBlock': 1.5
		}, result)

	def test_get_transaction_range_formats_fields(self):
		"""Verifies range query forwarding and the public period response fields."""

		# Arrange:
		symbol_db = TransactionStatisticsSymbolDatabase()
		facade = _create_facade_with_database(symbol_db)

		# Act:
		result = facade.get_transaction_statistics_range(date(2026, 1, 1), date(2026, 1, 31), 'DAY')

		# Assert:
		self.assertEqual({'periodType': 'day', 'data': [{'period': '2026-01-01', 'totalTransactions': 2}]}, result)
		self.assertEqual((date(2026, 1, 1), date(2026, 1, 31), 'DAY'), symbol_db.range_query)

	def test_get_transaction_range_formats_empty_data(self):
		"""Keeps an empty range as an empty data array with its requested period type."""

		# Arrange:
		symbol_db = TransactionStatisticsSymbolDatabase()
		symbol_db.range_rows = []
		facade = _create_facade_with_database(symbol_db)

		# Act:
		result = facade.get_transaction_statistics_range(date(2026, 1, 1), date(2026, 1, 31), 'MONTH')

		# Assert:
		self.assertEqual({'periodType': 'month', 'data': []}, result)

	def test_rejects_missing_database(self):
		# Arrange:
		# Act + Assert:
		with self.assertRaisesRegex(
			ValueError,
			'Symbol database is required'
		):
			SymbolRestFacade(None, NATIVE_MOSAIC_INFO, Network.TESTNET)

	def test_rejects_missing_native_mosaic_info(self):
		# Arrange + Act + Assert:
		with self.assertRaisesRegex(ValueError, 'Native mosaic information is required'):
			SymbolRestFacade(object(), None, Network.TESTNET)

	def test_rejects_missing_network(self):
		# Arrange + Act + Assert:
		with self.assertRaises(ValueError) as exception_info:
			SymbolRestFacade(object(), NATIVE_MOSAIC_INFO, None)
		self.assertIs(ValueError, type(exception_info.exception))
		self.assertEqual('Symbol network is required', str(exception_info.exception))

	def test_reports_healthy_core_when_dependencies_are_available(self):
		# Arrange:
		facade = _create_configured_facade()

		# Act:
		result = facade.get_health()

		# Assert:
		self.assertEqual({
			'isHealthy': True,
			'dbUp': True,
			'finalizedHeight': 8,
			'backendSynced': True,
			'lastDBSyncedAt': None,
			'lastDBHeight': 10,
			'status': 'healthy',
			'errors': []
		}, result)

	def test_formats_health_sync_timestamp_as_utc_without_fractional_seconds(self):
		# Arrange:
		facade = _create_facade_with_database(TimestampedHealthySymbolDatabase())

		# Act:
		result = facade.get_health()

		# Assert:
		self.assertEqual('2026-01-02 03:04:05', result['lastDBSyncedAt'])

	def test_reports_unsynced_when_healthy_state_is_behind_chain_height(self):
		# Arrange:
		facade = _create_facade_with_database(LaggingSymbolDatabase())

		# Act:
		result = facade.get_health()

		# Assert:
		self.assertEqual(create_symbol_health(
			dbUp=True,
			finalizedHeight=8,
			lastDBHeight=9,
			status='healthy',
			errors=[{
				'type': 'synchronization',
				'message': 'Symbol database height 9 does not match chain height 10'
			}]
		), result)

	def test_reports_database_error(self):
		# Arrange:
		facade = _create_facade_with_database(FailingSymbolDatabase())

		# Act + Assert:
		self.assertEqual(create_symbol_health(
			errors=[{
				'type': 'database',
				'message': 'Symbol database is unavailable'
			}]
		), facade.get_health())

	def test_reports_database_error_when_sync_state_read_fails(self):
		# Arrange:
		facade = _create_facade_with_database(SyncStateFailingSymbolDatabase())

		# Act:
		result = facade.get_health()

		# Assert:
		self.assertEqual(create_symbol_health(
			dbUp=True,
			errors=[{
				'type': 'database',
				'message': 'Symbol database is unavailable'
			}]
		), result)

	def test_reports_unhealthy_rollback_state(self):
		# Arrange:
		facade = _create_facade_with_database(UnhealthySymbolDatabase())

		# Act:
		result = facade.get_health()

		# Assert:
		self.assertEqual(create_symbol_health(
			dbUp=True,
			finalizedHeight=8,
			lastDBHeight=10,
			status='unhealthy',
			errors=[{
				'type': 'rollback',
				'message': 'Symbol backend is in an unhealthy rollback state'
			}]
		), result)

	def test_reports_repairing_sync_state_as_unhealthy(self):
		# Arrange:
		facade = _create_facade_with_database(RepairingSymbolDatabase())

		# Act:
		result = facade.get_health()

		# Assert:
		self.assertEqual(create_symbol_health(
			dbUp=True,
			finalizedHeight=8,
			lastDBHeight=9,
			status='repairing',
			errors=[{
				'type': 'synchronization',
				'message': 'Symbol backend status is repairing'
			}]
		), result)

	def test_can_get_blocks(self):
		# Arrange:
		facade = _create_facade_with_database(BlockSymbolDatabase())

		# Act:
		result = facade.get_blocks(from_height=2, limit=1, sort=SortOrder.DESC)

		# Assert:
		self.assertEqual([{'height': 1}], result)

	def test_get_blocks_passes_cursor_query_to_database(self):
		# Arrange:
		symbol_db = BlockSymbolDatabase()
		facade = _create_facade_with_database(symbol_db)

		# Act:
		facade.get_blocks(from_height=2, limit=1, sort=SortOrder.DESC)

		# Assert:
		self.assertEqual(1, facade.symbol_db.limit)
		self.assertEqual(2, facade.symbol_db.from_height)
		self.assertEqual(SortOrder.DESC, facade.symbol_db.sort)

	def test_get_blocks_raises_when_database_read_fails(self):
		# Arrange:
		facade = _create_facade_with_database(BlocksReadErrorSymbolDatabase())

		# Act + Assert:
		with self.assertRaises(PsycopgError):
			facade.get_blocks(1, 10, SortOrder.DESC)

	def test_get_blocks_propagates_unreadable_data(self):
		# Arrange:
		facade = _create_facade_with_database(UnreadableBlocksSymbolDatabase())

		# Act + Assert:
		with self.assertRaises(SymbolDataUnavailable):
			facade.get_blocks(1, 10, SortOrder.DESC)

	def test_get_block_statistics_formats_database_rows(self):
		# Arrange:
		symbol_db = BlockStatisticsSymbolDatabase()
		facade = _create_facade_with_database(symbol_db)

		# Act:
		result = facade.get_block_statistics()

		# Assert:
		self.assertTrue(symbol_db.called)
		self.assertEqual({
			'blockTimeChart': [[2, 30.0]],
			'blockFeeChart': [[1, 1.0], [2, 3.0]],
			'blockDifficultyChart': [[1, '1.00'], [2, '12.00']],
			'blockTime': 30,
			'blockFee': 2.0,
			'blockDifficulty': '12.00'
		}, result)

	def test_can_get_mosaics(self):
		# Arrange:
		symbol_db = MosaicSymbolDatabase([
			MosaicView('1234567890ABCDEF'),
			MosaicView('0000000000000001'),
			MosaicView('234567890ABCDEF0')
		])
		facade = _create_facade_with_database(symbol_db)

		# Act:
		result = facade.get_mosaics(limit=3, offset=0, sort=SortOrder.DESC)

		# Assert:
		self.assertEqual([
			{'id': '1234567890ABCDEF'},
			{'id': '0000000000000001'},
			{'id': '234567890ABCDEF0'}
		], result)

	def _assert_get_mosaics_passes_page_query_to_database(self, sort):
		# Arrange:
		symbol_db = MosaicSymbolDatabase([])
		facade = _create_facade_with_database(symbol_db)

		# Act:
		facade.get_mosaics(limit=10, offset=20, sort=sort)

		# Assert:
		self.assertEqual(10, symbol_db.limit)
		self.assertEqual(20, symbol_db.offset)
		self.assertEqual(sort, symbol_db.sort)

	def test_get_mosaics_passes_ascending_page_query_to_database(self):
		self._assert_get_mosaics_passes_page_query_to_database(SortOrder.ASC)

	def test_get_mosaics_passes_descending_page_query_to_database(self):
		self._assert_get_mosaics_passes_page_query_to_database(SortOrder.DESC)

	def test_get_mosaics_returns_empty_page(self):
		# Arrange:
		facade = _create_facade_with_database(MosaicSymbolDatabase([]))

		# Act:
		result = facade.get_mosaics(limit=10, offset=0, sort=SortOrder.DESC)

		# Assert:
		self.assertEqual([], result)

	def test_get_mosaics_raises_when_database_read_fails(self):
		# Arrange:
		facade = _create_facade_with_database(MosaicsReadErrorSymbolDatabase())

		# Act + Assert:
		with self.assertRaises(PsycopgError):
			facade.get_mosaics(10, 0, SortOrder.DESC)

	def test_get_mosaics_propagates_unreadable_data(self):
		# Arrange:
		facade = _create_facade_with_database(UnreadableMosaicsSymbolDatabase())

		# Act + Assert:
		with self.assertRaisesRegex(SymbolDataUnavailable, 'Symbol mosaic data is unavailable'):
			facade.get_mosaics(10, 0, SortOrder.DESC)

	def test_can_get_mosaic(self):
		# Arrange:
		symbol_db = create_autospec(SymbolDatabase, instance=True, spec_set=True)
		symbol_db.get_mosaic.return_value = MosaicView('72C0212E67A08BCE')
		facade = _create_facade_with_database(symbol_db)

		# Act:
		result = facade.get_mosaic('72C0212E67A08BCE')

		# Assert:
		self.assertEqual({'id': '72C0212E67A08BCE'}, result)
		symbol_db.get_mosaic.assert_called_once_with('72C0212E67A08BCE')

	def test_get_mosaic_returns_none_when_missing(self):
		# Arrange:
		symbol_db = create_autospec(SymbolDatabase, instance=True, spec_set=True)
		symbol_db.get_mosaic.return_value = None
		facade = _create_facade_with_database(symbol_db)

		# Act + Assert:
		self.assertIsNone(facade.get_mosaic('72C0212E67A08BCE'))

	def test_can_get_block_detail(self):
		# Arrange:
		facade = _create_facade_with_database(BlockSymbolDatabase())

		# Act + Assert:
		self.assertEqual({'height': 1, 'detail': True}, facade.get_block(1))

	def test_get_block_returns_none_when_missing(self):
		# Arrange:
		facade = _create_facade_with_database(BlockSymbolDatabase())

		# Act + Assert:
		self.assertIsNone(facade.get_block(2))

	def test_get_block_raises_when_database_read_fails(self):
		# Act + Assert:
		with self.assertRaises(PsycopgError):
			_create_facade_with_database(BlockReadErrorSymbolDatabase()).get_block(1)

	def test_can_get_receipts(self):
		# Arrange:
		receipt = ReceiptRecord(
			1234,
			'harvestFee',
			'balanceChange',
			1,
			None,
			None,
			bytes.fromhex('98534F7E1D0A26CA4E316F901E23E55C8701DB20DF11A7B2'),
			'72C0212E67A08BCE',
			1234567,
			None,
			None)
		symbol_db = ReceiptSymbolDatabase([receipt])
		facade = _create_facade_with_database(symbol_db)

		# Act:
		result = facade.get_receipts(ReceiptQuery(10, 0, None, 'balanceChange'))

		# Assert:
		self.assertEqual([{
			'version': 1,
			'height': 1234,
			'type': 'harvestFee',
			'group': 'balanceChange',
			'targetAddress': 'TBJU67Q5BITMUTRRN6IB4I7FLSDQDWZA34I2PMQ',
			'sender': None,
			'to': None,
			'artifactId': None,
			'mosaics': [{
				'id': '72C0212E67A08BCE',
				'name': '72C0212E67A08BCE',
				'amount': 1.234567,
				'isNative': True
			}]
		}], result)
		self.assertEqual(ReceiptQuery(10, 0, None, 'balanceChange'), symbol_db.query)

	def test_get_receipts_returns_none_when_database_has_no_block(self):
		# Arrange:
		facade = _create_facade_with_database(ReceiptSymbolDatabase(None))

		# Act:
		result = facade.get_receipts(ReceiptQuery(height=1234))

		# Assert:
		self.assertIsNone(result)

	def test_receipts_db_error_propagates(self):
		# Arrange:
		facade = _create_facade_with_database(ReceiptReadErrorSymbolDatabase())

		# Act + Assert:
		with self.assertRaises(PsycopgError):
			facade.get_receipts(ReceiptQuery())
