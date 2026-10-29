from datetime import date, datetime, timedelta, timezone
from unittest import TestCase

from psycopg2 import Error as PsycopgError
from puller.db.SymbolDatabase import SymbolDatabase as PullerSymbolDatabase

from rest.db.SymbolDatabase import SymbolDatabase, SymbolDataUnavailable
from rest.facade.TtlCache import TtlCache

from ..test.SymbolBlockTestUtils import create_symbol_block, create_symbol_sync_state
from ..test.SymbolDatabaseTestUtils import PausingAfterSyncStateReadSymbolDatabase, read_during_database_snapshot, symbol_test_database


class SymbolDatabaseTransactionStatisticsTest(TestCase):
	def test_get_transaction_statistics_uses_the_two_count_columns_and_exact_cutoffs(self):
		"""Verifies get transaction statistics uses the two count columns and exact cutoffs."""

		# Arrange:
		head_timestamp = datetime(2026, 3, 31, 12, 0, tzinfo=timezone.utc)
		blocks = [
			_create_statistics_block(1, head_timestamp - timedelta(days=30, microseconds=1), 1, 10),
			_create_statistics_block(2, head_timestamp - timedelta(days=30), 2, 20),
			_create_statistics_block(3, head_timestamp - timedelta(days=30) + timedelta(microseconds=1), 3, 30),
			_create_statistics_block(4, head_timestamp - timedelta(hours=24, microseconds=1), 4, 40),
			_create_statistics_block(5, head_timestamp - timedelta(hours=24), 5, 50),
			_create_statistics_block(6, head_timestamp - timedelta(hours=24) + timedelta(microseconds=1), 6, 60),
			_create_statistics_block(7, head_timestamp, 7, 70),
			_create_statistics_block(8, head_timestamp + timedelta(microseconds=1), 999, 999),
		]

		# Act:
		result = _query_transaction_statistics(
			blocks, create_symbol_sync_state(last_synced_height=7, finalized_height=7))

		# Assert:
		self.assertEqual(280, result.total)
		self.assertEqual(250, result.last30_day)
		self.assertEqual(130, result.last24_hours)
		self.assertEqual(4.0, result.average_per_block)

	def test_get_transaction_statistics_averages_latest_240_blocks_including_zeroes(self):
		"""Verifies get transaction statistics averages latest 240 blocks including zeroes."""

		# Arrange:
		blocks = []
		for height in range(1, 242):
			transactions_count = 999 if height == 1 else 0 if height == 2 else 1
			blocks.append(_create_statistics_block(
				height,
				datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(minutes=height),
				transactions_count,
				transactions_count + height + 100))

		# Act:
		result = _query_transaction_statistics(
			blocks, create_symbol_sync_state(last_synced_height=241, finalized_height=241))

		# Assert:
		self.assertEqual(239 / 240, result.average_per_block)

	def test_transaction_range_rejects_invalid_period(self):
		"""Verifies transaction range rejects invalid period."""

		# Act + Assert:
		with self.assertRaisesRegex(ValueError, 'Invalid transaction statistics period'):
			SymbolDatabase.get_transaction_statistics_range(object(), date(2026, 1, 1), date(2026, 1, 1), 'WEEK')

	def test_transaction_range_returns_empty_for_no_matching_blocks(self):
		"""Verifies transaction range returns empty for no matching blocks."""

		# Arrange:
		block = _create_statistics_block(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 1, 10)

		# Act:
		result = _query_transaction_range([block], create_symbol_sync_state(1, 1), date(2025, 1, 1), date(2025, 12, 31), 'DAY')

		# Assert:
		self.assertEqual([], result)

	def test_get_transaction_statistics_rejects_unhealthy_state(self):
		"""Verifies get transaction statistics rejects unhealthy state."""

		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=1, finalized_height=1, status='unhealthy')

		# Act + Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_query_transaction_statistics([create_symbol_block(1)], sync_state)

	def test_get_transaction_statistics_rejects_repairing_state(self):
		"""Verifies get transaction statistics rejects repairing state."""

		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=1, finalized_height=1, status='repairing')

		# Act + Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_query_transaction_statistics([create_symbol_block(1)], sync_state)

	def test_get_transaction_statistics_rejects_dirty_state(self):
		"""Verifies get transaction statistics rejects dirty state."""

		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=2, finalized_height=1, dirty_state_from_height=2)

		# Act + Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_query_transaction_statistics([create_symbol_block(1)], sync_state)

	def test_get_transaction_statistics_rejects_missing_head_block(self):
		"""Verifies get transaction statistics rejects missing head block."""

		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=1, finalized_height=1)

		# Act + Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_query_transaction_statistics([], sync_state)

	def test_get_transaction_statistics_rejects_missing_sync_state(self):
		"""Verifies get transaction statistics rejects missing sync state."""

		# Act + Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_query_transaction_statistics([], None)

	def test_get_transaction_statistics_rejects_missing_synced_height(self):
		"""Verifies get transaction statistics rejects missing synced height."""

		# Arrange:
		sync_state = create_symbol_sync_state(1, 1)
		sync_state.update({'last_synced_height': None, 'chain_height': None, 'last_synced_block_hash': None})

		# Act + Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_query_transaction_statistics([create_symbol_block(1)], sync_state)

	def test_get_transaction_statistics_returns_zero_for_a_valid_zero_transaction_block(self):
		"""Verifies get transaction statistics returns zero for a valid zero transaction block."""

		# Arrange:
		block = _create_statistics_block(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 0, 0)
		sync_state = create_symbol_sync_state(last_synced_height=1, finalized_height=1)

		# Act:
		result = _query_transaction_statistics([block], sync_state)

		# Assert:
		self.assertEqual((0, 0, 0, 0.0), result)

	def test_get_transaction_statistics_does_not_change_persisted_data(self):
		"""Verifies get transaction statistics does not change persisted data."""

		# Arrange:
		block = _create_statistics_block(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 0, 0)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1), [block]) as (db_config, _):
			database = SymbolDatabase(db_config)
			try:
				# Act:
				statistics = database.get_transaction_statistics()
			finally:
				database.close()

			with PullerSymbolDatabase(db_config) as reader:
				with reader.connection.cursor() as cursor:
					cursor.execute('SELECT last_synced_height, status FROM symbol_sync_state')
					sync_state = cursor.fetchone()
					cursor.execute(
						'SELECT height, transactions_count, total_transactions_count FROM symbol_blocks ORDER BY height')
					persisted_blocks = cursor.fetchall()

		# Assert:
		self.assertEqual((0, 0, 0, 0.0), statistics)
		self.assertEqual((1, 'healthy'), sync_state)
		self.assertEqual([(1, 0, 0)], persisted_blocks)

	def test_get_transaction_statistics_keeps_old_snapshot_when_sync_advances_after_state_read(self):
		"""Verifies get transaction statistics keeps old snapshot when sync advances after state read."""

		# Arrange:
		block = _create_statistics_block(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 1, 10)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1), [block]) as (db_config, _):
			database = PausingAfterSyncStateReadSymbolDatabase(db_config)
			try:
				# Act:
				result = read_during_database_snapshot(
					database,
					database.get_transaction_statistics,
					lambda: _advance_transaction_state(db_config))
			finally:
				database.close()

		# Assert:
		self.assertEqual((10, 10, 10, 1.0), result)

	def test_get_transaction_statistics_keeps_old_snapshot_when_rollback_state_commits_after_state_read(self):
		"""Verifies get transaction statistics keeps old snapshot when rollback state commits after state read."""

		# Arrange:
		block = _create_statistics_block(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 1, 10)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1), [block]) as (db_config, _):
			database = PausingAfterSyncStateReadSymbolDatabase(db_config)
			try:
				# Act:
				result = read_during_database_snapshot(
					database,
					database.get_transaction_statistics,
					lambda: _mark_transaction_state_unhealthy(db_config))
			finally:
				database.close()

		# Assert:
		self.assertEqual((10, 10, 10, 1.0), result)

	def test_get_transaction_statistics_recovers_connection_after_sql_failure(self):
		"""Verifies get transaction statistics recovers connection after sql failure."""

		# Arrange:
		block = _create_statistics_block(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 1, 10)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1), [block]) as (db_config, _):
			database = SymbolDatabase(db_config)
			try:
				with PullerSymbolDatabase(db_config) as writer:
					with writer.connection.cursor() as cursor:
						cursor.execute('ALTER TABLE symbol_blocks RENAME COLUMN transactions_count TO transactions_count_for_test')
					writer.connection.commit()

				with self.assertRaises(PsycopgError):
					database.get_transaction_statistics()

				with PullerSymbolDatabase(db_config) as writer:
					with writer.connection.cursor() as cursor:
						cursor.execute('ALTER TABLE symbol_blocks RENAME COLUMN transactions_count_for_test TO transactions_count')
					writer.connection.commit()

				result = database.get_transaction_statistics()
			finally:
				database.close()

		# Assert:
		self.assertEqual((10, 10, 10, 1.0), result)


class SymbolDatabaseTransactionRangeTest(TestCase):
	def test_day_range_bounds_zero_buckets_and_published_head(self):
		"""Verifies day range bounds zero buckets and published head."""

		# Arrange: Heights 9 and 11 intentionally invert time to test T and L independently.
		blocks = [
			_create_statistics_block(1, datetime(2023, 12, 31, 23, 59, 59, 999999, tzinfo=timezone.utc), 101, 1101),
			_create_statistics_block(2, datetime(2024, 1, 1, tzinfo=timezone.utc), 2, 202),
			_create_statistics_block(3, datetime(2024, 1, 1, 0, 0, 0, 1, tzinfo=timezone.utc), 3, 303),
			_create_statistics_block(4, datetime(2024, 1, 1, 23, 59, 59, 999999, tzinfo=timezone.utc), 4, 404),
			_create_statistics_block(5, datetime(2024, 1, 2, tzinfo=timezone.utc), 0, 50),
			_create_statistics_block(6, datetime(2024, 2, 29, tzinfo=timezone.utc), 6, 606),
			_create_statistics_block(7, datetime(2024, 3, 1, 23, 59, 59, 999999, tzinfo=timezone.utc), 7, 707),
			_create_statistics_block(8, datetime(2024, 3, 2, tzinfo=timezone.utc), 8, 808),
			_create_statistics_block(9, datetime(2024, 3, 3, tzinfo=timezone.utc), 90, 900),
			_create_statistics_block(10, datetime(2024, 3, 2, 12, tzinfo=timezone.utc), 10, 100),
			_create_statistics_block(11, datetime(2024, 3, 1, 12, tzinfo=timezone.utc), 99, 999),
		]
		sync = create_symbol_sync_state(last_synced_height=10, finalized_height=5)

		# Act:
		result = _query_transaction_range(blocks, sync, date(2024, 1, 1), date(2024, 3, 1), 'DAY')
		through_head = _query_transaction_range(blocks, sync, date(2024, 3, 1), date(2024, 3, 3), 'DAY')
		long_range = _query_transaction_range(blocks, sync, date(2023, 1, 1), date(2024, 3, 3), 'DAY')

		# Assert:
		self.assertEqual([('2024-01-01', 9), ('2024-01-02', 0), ('2024-02-29', 6), ('2024-03-01', 7)], result)
		self.assertEqual([('2024-03-01', 7), ('2024-03-02', 18)], through_head)
		self.assertEqual([
			('2023-12-31', 101), ('2024-01-01', 9), ('2024-01-02', 0),
			('2024-02-29', 6), ('2024-03-01', 7), ('2024-03-02', 18)], long_range)

	def test_month_range_uses_partial_month_and_utc_boundaries(self):
		"""Verifies month range uses partial month and utc boundaries."""

		# Arrange:
		blocks = [
			_create_statistics_block(1, datetime(2023, 12, 31, 23, 59, 59, 999999, tzinfo=timezone.utc), 1, 11),
			_create_statistics_block(2, datetime(2024, 1, 1, tzinfo=timezone.utc), 2, 22),
			_create_statistics_block(3, datetime(2024, 1, 15, tzinfo=timezone.utc), 3, 33),
			_create_statistics_block(4, datetime(2024, 1, 31, 23, 59, 59, 999999, tzinfo=timezone.utc), 4, 44),
			_create_statistics_block(5, datetime(2024, 2, 1, tzinfo=timezone.utc), 5, 55),
			_create_statistics_block(6, datetime(2024, 2, 29, tzinfo=timezone.utc), 6, 66),
			_create_statistics_block(7, datetime(2024, 3, 1, tzinfo=timezone.utc), 7, 77),
		]

		# Act:
		result = _query_transaction_range(blocks, create_symbol_sync_state(7, 7), date(2024, 1, 15), date(2024, 2, 29), 'MONTH')
		year_boundary = _query_transaction_range(
			blocks, create_symbol_sync_state(7, 7), date(2019, 1, 1), date(2024, 1, 1), 'MONTH')

		# Assert:
		self.assertEqual([('2024-01', 7), ('2024-02', 11)], result)
		self.assertEqual([('2023-12', 1), ('2024-01', 2)], year_boundary)

	def test_range_snapshot_and_watermark_follow_commits(self):
		"""Verifies range snapshot and watermark follow commits."""

		# Arrange:
		block = _create_statistics_block(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 1, 10)
		with symbol_test_database(create_symbol_sync_state(1, 1), [block]) as (db_config, _):
			database = PausingAfterSyncStateReadSymbolDatabase(db_config)
			try:
				# Act:
				result = read_during_database_snapshot(
					database,
					lambda: database.get_transaction_statistics_range(date(2026, 1, 1), date(2026, 1, 1), 'DAY'),
					lambda: _advance_transaction_state(db_config))
				updated = database.get_transaction_statistics_range(date(2026, 1, 1), date(2026, 1, 1), 'DAY')
			finally:
				database.close()

		# Assert:
		self.assertEqual([('2026-01-01', 1)], result)
		self.assertEqual([('2026-01-01', 3)], updated)

	def test_range_recovers_connection_after_sql_failure(self):
		"""Verifies range recovers connection after sql failure."""

		# Arrange:
		block = _create_statistics_block(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 1, 10)
		with symbol_test_database(create_symbol_sync_state(1, 1), [block]) as (db_config, _):
			with SymbolDatabase(db_config) as database:
				with PullerSymbolDatabase(db_config) as writer:
					with writer.connection.cursor() as cursor:
						cursor.execute(
							'ALTER TABLE symbol_blocks RENAME COLUMN transactions_count TO count_for_test')
					writer.connection.commit()

				# Act + Assert:
				with self.assertRaises(PsycopgError):
					database.get_transaction_statistics_range(date(2026, 1, 1), date(2026, 1, 1), 'DAY')

				# Arrange: Restore the column.
				with PullerSymbolDatabase(db_config) as writer:
					with writer.connection.cursor() as cursor:
						cursor.execute(
							'ALTER TABLE symbol_blocks RENAME COLUMN count_for_test TO transactions_count')
					writer.connection.commit()

				# Act: Reuse the same database instance.
				result = database.get_transaction_statistics_range(date(2026, 1, 1), date(2026, 1, 1), 'DAY')

		# Assert:
		self.assertEqual([('2026-01-01', 1)], result)


class SymbolDatabaseTransactionFinalityTest(TestCase):
	def test_transaction_statistics_and_range_include_unfinalized_blocks(self):
		"""Verifies transaction statistics and range include unfinalized blocks."""

		# Arrange:
		head_timestamp = datetime(2026, 3, 31, 12, 0, tzinfo=timezone.utc)
		blocks = [
			_create_statistics_block(1, head_timestamp - timedelta(days=35), 2, 20),
			_create_statistics_block(2, head_timestamp - timedelta(hours=25), 3, 30),
			_create_statistics_block(3, head_timestamp - timedelta(hours=23), 5, 50),
			_create_statistics_block(4, head_timestamp, 7, 70),
			_create_statistics_block(5, head_timestamp, 101, 1010),
		]
		sync_state = create_symbol_sync_state(last_synced_height=4, finalized_height=2)

		with symbol_test_database(sync_state, blocks) as (db_config, _puller_database):
			with SymbolDatabase(db_config) as database:
				# Act:
				statistics = database.get_transaction_statistics()
				day_chart = database.get_transaction_statistics_range(date(2026, 2, 1), date(2026, 3, 31), 'DAY')
				month_chart = database.get_transaction_statistics_range(date(2026, 2, 1), date(2026, 3, 31), 'MONTH')

		# Assert:
		self.assertEqual((170, 150, 120, 4.25), statistics)
		self.assertEqual(
			{'2026-02-24': 2, '2026-03-30': 8, '2026-03-31': 7},
			dict(day_chart))
		self.assertEqual(
			{'2026-02': 2, '2026-03': 15},
			dict(month_chart))


def _create_statistics_block(height, timestamp, transactions_count, total_transactions_count):
	"""Creates a block fixture whose height can exceed the generic date fixture range."""

	block = create_symbol_block((height - 1) % 31 + 1)
	block.update({
		'height': height,
		'hash': bytes([height]) * 32,
		'previous_hash': bytes([height - 1]) * 32,
		'timestamp': timestamp,
		'transactions_count': transactions_count,
		'total_transactions_count': total_transactions_count
	})
	return block


def _query_transaction_statistics(blocks, sync_state):
	"""Reads summary statistics through a real PostgreSQL fixture."""

	return _query_symbol_database(blocks, sync_state, lambda database: database.get_transaction_statistics())


def _query_transaction_range(blocks, sync_state, start_date, end_date, period_type):
	"""Reads range statistics through a real PostgreSQL fixture."""

	return _query_symbol_database(
		blocks, sync_state, lambda database: database.get_transaction_statistics_range(start_date, end_date, period_type))


def _advance_transaction_state(db_config):
	"""Publishes a second block and its synchronization watermark."""

	with PullerSymbolDatabase(db_config) as database:
		database.upsert_blocks([_create_statistics_block(2, datetime(2026, 1, 1, 0, 1, tzinfo=timezone.utc), 2, 20)])
		database.upsert_sync_state(create_symbol_sync_state(last_synced_height=2, finalized_height=2))


def _mark_transaction_state_unhealthy(db_config):
	"""Deletes the old head while marking its publication unhealthy."""

	with PullerSymbolDatabase(db_config) as database:
		with database.connection.cursor() as cursor:
			cursor.execute('DELETE FROM symbol_blocks WHERE height = 1')
			cursor.execute("UPDATE symbol_sync_state SET status = 'unhealthy', dirty_state_from_height = 1 WHERE id = 1")
		database.connection.commit()


def _query_symbol_database(blocks, sync_state, query_database):
	"""Owns the fixture and REST database resources for a query."""

	with symbol_test_database(sync_state, blocks) as (db_config, _puller_database):
		with SymbolDatabase(db_config) as database:
			return query_database(database)


class CountingStatisticsCache(TtlCache):
	"""Records actual aggregate loads while retaining the production bounded cache behavior."""

	def __init__(self, ttl_seconds=900, max_entries=4):
		"""Creates a cache with the production limits unless a boundary test overrides them."""

		super().__init__(ttl_seconds, max_entries)
		self.load_count = 0

	def get_or_load(self, key, load):
		"""Counts cache misses without replacing the database query or cache implementation."""

		def counted_load():
			"""Runs the real aggregation and records its invocation."""

			self.load_count += 1
			return load()

		return super().get_or_load(key, counted_load)


class SymbolDatabaseTransactionStatisticsCacheTest(TestCase):
	"""Exercises publication-aware caching through the public database method and real PostgreSQL."""

	def test_reuses_statistics_for_unchanged_publication(self):
		"""Repeated reads return the complete result without loading the aggregate again."""

		# Arrange:
		cache = CountingStatisticsCache()
		block = _create_statistics_block(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 1, 10)
		with symbol_test_database(create_symbol_sync_state(1, 1), [block]) as (db_config, _):
			with SymbolDatabase(db_config) as database:
				# Act:
				first = database.get_transaction_statistics(cache)
				second = database.get_transaction_statistics(cache)

		# Assert:
		self.assertEqual([(10, 10, 10, 1.0)] * 2, [first, second])
		self.assertEqual(1, cache.load_count)

	def test_expired_statistics_are_reloaded(self):
		"""An expired cache entry cannot suppress a fresh aggregate read."""

		# Arrange:
		cache = CountingStatisticsCache(ttl_seconds=0)
		block = _create_statistics_block(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 1, 10)
		with symbol_test_database(create_symbol_sync_state(1, 1), [block]) as (db_config, _):
			with SymbolDatabase(db_config) as database:
				# Act:
				first = database.get_transaction_statistics(cache)
				second = database.get_transaction_statistics(cache)

		# Assert:
		self.assertEqual([(10, 10, 10, 1.0)] * 2, [first, second])
		self.assertEqual(2, cache.load_count)

	def test_same_height_block_replacement_invalidates_cache(self):
		"""A changed head hash invalidates totals even if height, timestamp and sync state are unchanged."""

		# Arrange:
		cache = CountingStatisticsCache()
		block = _create_statistics_block(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 1, 10)
		with symbol_test_database(create_symbol_sync_state(1, 1), [block]) as (db_config, writer):
			with SymbolDatabase(db_config) as database:
				before = database.get_transaction_statistics(cache)

				# Act:
				writer.upsert_blocks([{**block, 'hash': bytes([99]) * 32, 'transactions_count': 3, 'total_transactions_count': 30}])
				after = database.get_transaction_statistics(cache)

		# Assert:
		self.assertEqual((10, 10, 10, 1.0), before)
		self.assertEqual((30, 30, 30, 3.0), after)
		self.assertEqual(2, cache.load_count)

	def test_publication_revision_invalidates_cache(self):
		"""Republishing the same head reloads statistics even if its block hash is unchanged."""

		# Arrange:
		cache = CountingStatisticsCache()
		block = _create_statistics_block(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 1, 10)
		with symbol_test_database(create_symbol_sync_state(1, 1), [block]) as (db_config, writer):
			with SymbolDatabase(db_config) as database:
				before = database.get_transaction_statistics(cache)

				# Act:
				with writer.connection.cursor() as cursor:
					cursor.execute("UPDATE symbol_sync_state SET updated_at = updated_at + INTERVAL '1 second'")
				writer.connection.commit()
				after = database.get_transaction_statistics(cache)

		# Assert:
		self.assertEqual([(10, 10, 10, 1.0)] * 2, [before, after])
		self.assertEqual(2, cache.load_count)

	def test_cached_success_is_rejected_when_publication_becomes_unavailable(self):
		"""Every read checks unhealthy, repairing, dirty, missing-state and missing-head conditions."""

		for statement in (
			"UPDATE symbol_sync_state SET status = 'unhealthy'",
			"UPDATE symbol_sync_state SET status = 'repairing'",
			'UPDATE symbol_sync_state SET dirty_state_from_height = 2',
			'DELETE FROM symbol_sync_state',
			'DELETE FROM symbol_blocks'
		):
			with self.subTest(statement=statement):
				# Arrange:
				cache = CountingStatisticsCache()
				block = _create_statistics_block(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 1, 10)
				with symbol_test_database(create_symbol_sync_state(1, 1), [block]) as (db_config, writer):
					with SymbolDatabase(db_config) as database:
						self.assertEqual((10, 10, 10, 1.0), database.get_transaction_statistics(cache))
						with writer.connection.cursor() as cursor:
							cursor.execute(statement)
						writer.connection.commit()

						# Act + Assert:
						with self.assertRaisesRegex(SymbolDataUnavailable, '^Symbol transaction statistics are unavailable$'):
							database.get_transaction_statistics(cache)
						self.assertEqual(1, cache.load_count)

	def test_concurrent_publication_cannot_store_old_totals_under_new_head(self):
		"""A delayed old snapshot does not overwrite a concurrently cached new publication."""

		# Arrange:
		cache = CountingStatisticsCache()
		block = _create_statistics_block(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 1, 10)
		new_results = []
		with symbol_test_database(create_symbol_sync_state(1, 1), [block]) as (db_config, _):
			with PausingAfterSyncStateReadSymbolDatabase(db_config) as paused_database:
				with SymbolDatabase(db_config) as database:
					def publish_and_read():
						"""Publishes and caches a new head while the original snapshot is paused."""

						_advance_transaction_state(db_config)
						new_results.append(database.get_transaction_statistics(cache))

					# Act:
					old_result = read_during_database_snapshot(
						paused_database, lambda: paused_database.get_transaction_statistics(cache), publish_and_read)
					new_results.append(database.get_transaction_statistics(cache))

		# Assert:
		self.assertEqual((10, 10, 10, 1.0), old_result)
		self.assertEqual([(30, 30, 30, 1.5)] * 2, new_results)
		self.assertEqual(2, cache.load_count)

	def test_cache_hit_keeps_validated_snapshot_during_concurrent_unhealthy_update(self):
		"""A cache hit belongs to its validated snapshot; the next read rejects the unhealthy state."""

		# Arrange:
		cache = CountingStatisticsCache()
		block = _create_statistics_block(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 1, 10)
		with symbol_test_database(create_symbol_sync_state(1, 1), [block]) as (db_config, _):
			with SymbolDatabase(db_config) as database:
				self.assertEqual((10, 10, 10, 1.0), database.get_transaction_statistics(cache))
			with PausingAfterSyncStateReadSymbolDatabase(db_config) as database:
				# Act:
				result = read_during_database_snapshot(
					database, lambda: database.get_transaction_statistics(cache), lambda: _mark_transaction_state_unhealthy(db_config))

				# Assert:
				self.assertEqual((10, 10, 10, 1.0), result)
				with self.assertRaisesRegex(SymbolDataUnavailable, '^Symbol transaction statistics are unavailable$'):
					database.get_transaction_statistics(cache)
				self.assertEqual(1, cache.load_count)

	def test_cache_does_not_hide_sql_failure_and_connection_recovers(self):
		"""A failed publication check propagates despite cached success, and the connection remains reusable."""

		# Arrange:
		cache = CountingStatisticsCache()
		block = _create_statistics_block(1, datetime(2026, 1, 1, tzinfo=timezone.utc), 1, 10)
		with symbol_test_database(create_symbol_sync_state(1, 1), [block]) as (db_config, writer):
			with SymbolDatabase(db_config) as database:
				self.assertEqual((10, 10, 10, 1.0), database.get_transaction_statistics(cache))
				with writer.connection.cursor() as cursor:
					cursor.execute('ALTER TABLE symbol_blocks RENAME COLUMN hash TO hash_for_test')
				writer.connection.commit()

				# Act + Assert:
				try:
					with self.assertRaises(PsycopgError):
						database.get_transaction_statistics(cache)
				finally:
					with writer.connection.cursor() as cursor:
						cursor.execute('ALTER TABLE symbol_blocks RENAME COLUMN hash_for_test TO hash')
					writer.connection.commit()

				self.assertEqual((10, 10, 10, 1.0), database.get_transaction_statistics(cache))
				self.assertEqual(1, cache.load_count)
