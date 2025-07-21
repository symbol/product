import sqlite3
import unittest

from symbolchain.CryptoTypes import Hash256

from bridge.db.BalanceChangeDatabase import BalanceChangeDatabase
from bridge.NetworkUtils import BalanceChange

from ..test.BridgeTestUtils import HASHES
from ..test.DatabaseTestUtils import get_all_table_names

# region factories


def make_transfer_tuple(height, currency, amount, transaction_hash_index, use_typed_hash=False):
	transaction_hash = Hash256(HASHES[transaction_hash_index])
	return (height, currency, amount, transaction_hash if use_typed_hash else transaction_hash.bytes)

# endregion


class BalanceChangeDatabaseTest(unittest.TestCase):
	# region shared test utils

	@staticmethod
	def _query_all_transfers(cursor):
		cursor.execute('''SELECT * FROM transfer ORDER BY height DESC, amount ASC''')
		return cursor.fetchall()

	def _assert_can_insert_rows(self, seed, expected):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = BalanceChangeDatabase(connection)
			database.create_tables()

			# Act:
			for transfer_tuple in seed:
				database.add_transfer(*transfer_tuple)

			# Assert:
			cursor = connection.cursor()
			actual_transfers = self._query_all_transfers(cursor)

			self.assertEqual(expected, actual_transfers)

	# endregion

	# region create

	def test_can_create_tables(self):
		# Act:
		table_names = get_all_table_names(BalanceChangeDatabase)

		# Assert:
		self.assertEqual(set(['transfer', 'max_processed_height']), table_names)

	# endregion

	# region add_transfer

	def test_can_add_transfers(self):
		self._assert_can_insert_rows([
			make_transfer_tuple(1111, 'foo.bar', 123, 0, use_typed_hash=True),
			make_transfer_tuple(1111, 'alpha.beta', 222, 2, use_typed_hash=True),
			make_transfer_tuple(2345, 'foo.bar', 222, 1, use_typed_hash=True),
		], [
			make_transfer_tuple(2345, 'foo.bar', 222, 1),
			make_transfer_tuple(1111, 'foo.bar', 123, 0),
			make_transfer_tuple(1111, 'alpha.beta', 222, 2)
		])

	# endregion

	# region add_transfers_filtered_by_address

	def _assert_can_add_transfers_filtered_by_address(self, target_address, expected_transfers):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = BalanceChangeDatabase(connection)
			database.create_tables()

			# Act:
			add_count = database.add_transfers_filtered_by_address(1234, [
				BalanceChange('1111', 'foo.bar', 1111, Hash256(HASHES[0])),
				BalanceChange('1111', 'alpha.beta', 1234, Hash256(HASHES[2])),
				BalanceChange('2222', 'foo.bar', 2222, Hash256(HASHES[1])),
				BalanceChange('2222', 'alpha.beta', 9876, Hash256(HASHES[3])),
				BalanceChange('1111', 'foo.bar', 5533, Hash256(HASHES[4]))
			], target_address)

			# Assert:
			cursor = connection.cursor()

			actual_transfers = self._query_all_transfers(cursor)
			self.assertEqual(expected_transfers, actual_transfers)

			self.assertEqual(len(expected_transfers), add_count)

	def test_can_add_transfers_filtered_by_address_none_matching(self):
		# Assert: use integer as address to ensure it is converted to string before comparison
		self._assert_can_add_transfers_filtered_by_address(3333, [])

	def test_can_add_transfers_filtered_by_address_some_matching(self):
		# Assert: use integer as address to ensure it is converted to string before comparison
		self._assert_can_add_transfers_filtered_by_address(1111, [
			make_transfer_tuple(1234, 'foo.bar', 1111, 0),
			make_transfer_tuple(1234, 'alpha.beta', 1234, 2),
			make_transfer_tuple(1234, 'foo.bar', 5533, 4)
		])

	# endregion

	# region is_synced_at_height / balance_at

	@staticmethod
	def _create_database_for_balance_at_tests(connection):
		database = BalanceChangeDatabase(connection)
		database.create_tables()

		transfers = [
			make_transfer_tuple(1111, 'foo.bar', 111, 0, use_typed_hash=True),
			make_transfer_tuple(7777, 'alpha.beta', 222, 2, use_typed_hash=True),
			make_transfer_tuple(2345, 'foo.bar', 333, 1, use_typed_hash=True),
			make_transfer_tuple(5555, 'alpha.beta', 123, 4, use_typed_hash=True),
			make_transfer_tuple(3330, 'foo.bar', -100, 3, use_typed_hash=True)
		]

		database.set_max_processed_height(8888)

		for transfer in transfers:
			database.add_transfer(*transfer)

		return database

	def test_is_synced_at_height_is_only_true_when_height_is_not_greater_than_max_processed_height(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database_for_balance_at_tests(connection)

			# Act + Assert:
			self.assertTrue(database.is_synced_at_height(0))
			self.assertTrue(database.is_synced_at_height(5000))
			self.assertTrue(database.is_synced_at_height(8887))
			self.assertTrue(database.is_synced_at_height(8888))

			self.assertFalse(database.is_synced_at_height(8889))
			self.assertFalse(database.is_synced_at_height(10000))

	def _assert_balance_at(self, currency, height, expected_balance):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database_for_balance_at_tests(connection)

			# Act:
			balance = database.balance_at(height, currency)

			# Assert:
			self.assertEqual(expected_balance, balance)

	def test_balance_at_fails_when_empty(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = BalanceChangeDatabase(connection)
			database.create_tables()

			# Act + Assert:
			with self.assertRaisesRegex(ValueError, 'requested balance at 1000 beyond current database height 0'):
				database.balance_at(1000, 'foo.bar')

	def test_balance_at_returns_sum_of_amounts_less_than_equal_to_height(self):
		self._assert_balance_at('foo.bar', 0, 0)
		self._assert_balance_at('foo.bar', 1110, 0)
		self._assert_balance_at('foo.bar', 1111, 111)

		self._assert_balance_at('foo.bar', 2344, 111)
		self._assert_balance_at('foo.bar', 2345, 444)
		self._assert_balance_at('foo.bar', 2346, 444)

		self._assert_balance_at('foo.bar', 3329, 444)
		self._assert_balance_at('foo.bar', 3330, 344)
		self._assert_balance_at('foo.bar', 7777, 344)
		self._assert_balance_at('foo.bar', 8888, 344)

	def test_balance_at_fails_for_queries_past_max_processed_height(self):
		# Arrange:
		for height in [8889, 10000]:
			with sqlite3.connect(':memory:') as connection:
				database = self._create_database_for_balance_at_tests(connection)

				# Act + Assert:
				with self.assertRaisesRegex(ValueError, f'requested balance at {height} beyond current database height 8888'):
					database.balance_at(height, 'foo.bar')
	# endregion

	# region partial_balance_at

	def _assert_partial_balance_at(self, currency, height, expected_balance, hash_indexes, batch_size=2):
		# pylint: disable=too-many-arguments,too-many-positional-arguments
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database_for_balance_at_tests(connection)

			# Act:
			balance = database.partial_balance_at(height, currency, [Hash256(HASHES[i]) for i in hash_indexes], batch_size)

			# Assert:
			self.assertEqual(expected_balance, balance)

	def test_partial_balance_at_returns_zero_when_empty(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = BalanceChangeDatabase(connection)
			database.create_tables()

			# Act:
			balance = database.partial_balance_at(1000, 'foo.bar', [])

			# Assert:
			self.assertEqual(0, balance)

	def test_partial_balance_at_returns_sum_of_amounts_less_than_equal_to_height_no_filtering(self):
		# Assert: using all hash indexes should mimic balance_at
		self._assert_partial_balance_at('foo.bar', 0, 0, range(len(HASHES)))
		self._assert_partial_balance_at('foo.bar', 1110, 0, range(len(HASHES)))
		self._assert_partial_balance_at('foo.bar', 1111, 111, range(len(HASHES)))

		self._assert_partial_balance_at('foo.bar', 2344, 111, range(len(HASHES)))
		self._assert_partial_balance_at('foo.bar', 2345, 444, range(len(HASHES)))
		self._assert_partial_balance_at('foo.bar', 2346, 444, range(len(HASHES)))

		self._assert_partial_balance_at('foo.bar', 3329, 444, range(len(HASHES)))
		self._assert_partial_balance_at('foo.bar', 3330, 344, range(len(HASHES)))
		self._assert_partial_balance_at('foo.bar', 7777, 344, range(len(HASHES)))
		self._assert_partial_balance_at('foo.bar', 8888, 344, range(len(HASHES)))

	def test_partial_balance_at_returns_sum_of_amounts_less_than_equal_to_height_filtering(self):
		# Assert: exclude one foo.bar transfer at height 2345
		self._assert_partial_balance_at('foo.bar', 0, 0, [0, 2, 3, 4])
		self._assert_partial_balance_at('foo.bar', 1110, 0, [0, 2, 3, 4])
		self._assert_partial_balance_at('foo.bar', 1111, 111, [0, 2, 3, 4])

		self._assert_partial_balance_at('foo.bar', 2345, 111, [0, 2, 3, 4])

		self._assert_partial_balance_at('foo.bar', 3329, 111, [0, 2, 3, 4])
		self._assert_partial_balance_at('foo.bar', 3330, 11, [0, 2, 3, 4])
		self._assert_partial_balance_at('foo.bar', 7777, 11, [0, 2, 3, 4])
		self._assert_partial_balance_at('foo.bar', 8888, 11, [0, 2, 3, 4])

	def test_partial_balance_at_returns_sum_of_amounts_less_than_equal_to_height_custom_batch_size(self):
		# Assert: different batch sizes should not change result
		self._assert_partial_balance_at('foo.bar', 2345, 111, [0, 2, 3, 4])
		self._assert_partial_balance_at('foo.bar', 2345, 111, [0, 2, 3, 4], 1)
		self._assert_partial_balance_at('foo.bar', 2345, 111, [0, 2, 3, 4], 100)

	# endregion

	# region filter_transactions_if_present

	def _assert_filter_transactions_if_present(self, currency, height, expected_hash_indexes, hash_indexes, batch_size=2):
		# pylint: disable=too-many-arguments,too-many-positional-arguments
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database_for_balance_at_tests(connection)

			# Act:
			hash_indexes = list(database.filter_transactions_if_present(
				height,
				currency,
				[Hash256(HASHES[i]) for i in hash_indexes],
				batch_size))

			# Assert:
			self.assertEqual([Hash256(HASHES[i]) for i in expected_hash_indexes], hash_indexes)

	def test_filter_transactions_if_present_returns_empty_when_empty(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = BalanceChangeDatabase(connection)
			database.create_tables()

			# Act:
			hash_indexes = list(database.filter_transactions_if_present(1000, 'foo.bar', [Hash256(HASHES[i]) for i in range(len(HASHES))]))

			# Assert:
			self.assertEqual([], hash_indexes)

	def test_filter_transactions_if_present_returns_transactions_less_than_equal_to_height_no_filtering(self):
		# Assert: using all hash indexes should mimic balance_at
		self._assert_filter_transactions_if_present('foo.bar', 0, [], range(len(HASHES)))
		self._assert_filter_transactions_if_present('foo.bar', 1110, [], range(len(HASHES)))
		self._assert_filter_transactions_if_present('foo.bar', 1111, [0], range(len(HASHES)))

		self._assert_filter_transactions_if_present('foo.bar', 2344, [0], range(len(HASHES)))
		self._assert_filter_transactions_if_present('foo.bar', 2345, [0, 1], range(len(HASHES)))
		self._assert_filter_transactions_if_present('foo.bar', 2346, [0, 1], range(len(HASHES)))

		self._assert_filter_transactions_if_present('foo.bar', 3329, [0, 1], range(len(HASHES)))
		self._assert_filter_transactions_if_present('foo.bar', 3330, [0, 1, 3], range(len(HASHES)))
		self._assert_filter_transactions_if_present('foo.bar', 7777, [0, 1, 3], range(len(HASHES)))
		self._assert_filter_transactions_if_present('foo.bar', 8888, [0, 1, 3], range(len(HASHES)))

	def test_filter_transactions_if_present_returns_transactions_less_than_equal_to_height_filtering(self):
		# Assert: exclude one foo.bar transfer at height 2345
		self._assert_filter_transactions_if_present('foo.bar', 0, [], [0, 2, 3, 4])
		self._assert_filter_transactions_if_present('foo.bar', 1110, [], [0, 2, 3, 4])
		self._assert_filter_transactions_if_present('foo.bar', 1111, [0], [0, 2, 3, 4])

		self._assert_filter_transactions_if_present('foo.bar', 2345, [0], [0, 2, 3, 4])

		self._assert_filter_transactions_if_present('foo.bar', 3329, [0], [0, 2, 3, 4])
		self._assert_filter_transactions_if_present('foo.bar', 3330, [0, 3], [0, 2, 3, 4])
		self._assert_filter_transactions_if_present('foo.bar', 7777, [0, 3], [0, 2, 3, 4])
		self._assert_filter_transactions_if_present('foo.bar', 8888, [0, 3], [0, 2, 3, 4])

	def test_filter_transactions_if_present_returns_transactions_less_than_equal_to_height_custom_batch_size(self):
		# Assert: different batch sizes should not change result
		self._assert_filter_transactions_if_present('foo.bar', 2345, [0], [0, 2, 3, 4])
		self._assert_filter_transactions_if_present('foo.bar', 2345, [0], [0, 2, 3, 4], 1)
		self._assert_filter_transactions_if_present('foo.bar', 2345, [0], [0, 2, 3, 4], 100)

	# endregion

	# region reset

	def test_reset_deletes_rows(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = BalanceChangeDatabase(connection)
			database.create_tables()

			for delta in [2, 7, 4, 3, 9]:
				database.add_transfer(12345678900 + delta, 'foo.bar', delta, Hash256(HASHES[delta % len(HASHES)]))

			database.set_max_processed_height(12345678904)

			# Act:
			database.reset()

			# Assert:
			cursor = connection.cursor()
			actual_transfers = self._query_all_transfers(cursor)

			self.assertEqual(
				[(12345678900 + delta, 'foo.bar', delta, Hash256(HASHES[delta % len(HASHES)]).bytes) for delta in (4, 3, 2)],
				actual_transfers)

	# endregion
