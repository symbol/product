import sqlite3
import unittest

from bridge.db.BalanceChangeDatabase import BalanceChangeDatabase
from bridge.NetworkUtils import BalanceChange

from ..test.DatabaseTestUtils import get_all_table_names

# region factories


def make_transfer_tuple(height, currency, amount):
	return (height, currency, amount)

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
		self.assertEqual(set(['transfer']), table_names)

	# endregion

	# region add_transfer

	def test_can_add_transfers(self):
		self._assert_can_insert_rows([
			make_transfer_tuple(1111, 'foo.bar', 123),
			make_transfer_tuple(1111, 'alpha.beta', 222),
			make_transfer_tuple(2345, 'foo.bar', 222)
		], [
			make_transfer_tuple(2345, 'foo.bar', 222),
			make_transfer_tuple(1111, 'foo.bar', 123),
			make_transfer_tuple(1111, 'alpha.beta', 222)
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
				BalanceChange('1111', 'foo.bar', 1111),
				BalanceChange('1111', 'alpha.beta', 1234),
				BalanceChange('2222', 'foo.bar', 2222),
				BalanceChange('2222', 'alpha.beta', 9876),
				BalanceChange('1111', 'foo.bar', 5533),
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
			make_transfer_tuple(1234, 'foo.bar', 1111),
			make_transfer_tuple(1234, 'alpha.beta', 1234),
			make_transfer_tuple(1234, 'foo.bar', 5533),
		])

	# endregion

	# region max_processed_height

	def test_max_processed_height_is_zero_when_empty(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = BalanceChangeDatabase(connection)
			database.create_tables()

			# Act:
			max_processed_height = database.max_processed_height()

			# Assert:
			self.assertEqual(0, max_processed_height)

	def test_max_processed_height_is_max_transfer_height(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = BalanceChangeDatabase(connection)
			database.create_tables()

			transfers = [
				make_transfer_tuple(1111, 'foo.bar', 111),
				make_transfer_tuple(7777, 'alpha.beta', 222),
				make_transfer_tuple(2345, 'foo.bar', 333)
			]
			for transfer in transfers:
				database.add_transfer(*transfer)

			# Act:
			max_processed_height = database.max_processed_height()

			# Assert:
			self.assertEqual(7777, max_processed_height)

	# endregion

	# region balance_at

	@staticmethod
	def _create_database_for_balance_at_tests(connection):
		database = BalanceChangeDatabase(connection)
		database.create_tables()

		transfers = [
			make_transfer_tuple(1111, 'foo.bar', 111),
			make_transfer_tuple(7777, 'alpha.beta', 222),
			make_transfer_tuple(2345, 'foo.bar', 333),
			make_transfer_tuple(5555, 'alpha.beta', 123),
			make_transfer_tuple(3330, 'foo.bar', -100)
		]

		for transfer in transfers:
			database.add_transfer(*transfer)

		return database

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

	def test_balance_at_fails_for_queries_past_max_processed_height(self):
		# Arrange:
		for height in [7778, 10000]:
			with sqlite3.connect(':memory:') as connection:
				database = self._create_database_for_balance_at_tests(connection)

				# Act + Assert:
				with self.assertRaisesRegex(ValueError, f'requested balance at {height} beyond current database height 7777'):
					database.balance_at(height, 'foo.bar')
	# endregion
