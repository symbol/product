import sqlite3
import unittest

from symbolchain.nem.Network import Address as NemAddress

from puller.db.BalancesDatabase import BalancesDatabase

from ..test.DatabaseTestUtils import get_all_table_names
from ..test.OptinRequestTestUtils import NEM_ADDRESSES


class BalancesDatabaseTest(unittest.TestCase):
	# region create

	def test_can_create_tables(self):
		# Act:
		table_names = get_all_table_names(BalancesDatabase)

		# Assert:
		self.assertEqual(set(['snapshot_balances']), table_names)

	# endregion

	# region add_account_balance

	def _assert_db_contents(self, connection, expected_balances):
		cursor = connection.cursor()
		cursor.execute('''SELECT * FROM snapshot_balances''')
		balances = cursor.fetchall()

		# Assert:
		self.assertEqual(expected_balances, balances)

	@staticmethod
	def _create_database(connection, account_balances):
		database = BalancesDatabase(connection)
		database.create_tables()

		for account_balance in account_balances:
			database.add_account_balance(*account_balance)

		return database

	def test_can_insert_balances(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			# Act:
			self._create_database(connection, [
				(NemAddress(NEM_ADDRESSES[0]), 112233445566),
				(NemAddress(NEM_ADDRESSES[1]), 77889900)
			])

			# Assert: matches input
			self._assert_db_contents(connection, [
				(NemAddress(NEM_ADDRESSES[0]).bytes, 112233445566),
				(NemAddress(NEM_ADDRESSES[1]).bytes, 77889900)
			])

	def test_cannot_insert_same_account_multiple_times(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection, [(NemAddress(NEM_ADDRESSES[0]), 112233445566)])

			# Act + Assert:
			with self.assertRaises(sqlite3.IntegrityError):
				database.add_account_balance(NemAddress(NEM_ADDRESSES[0]), 77889900)

	def test_cannot_insert_same_account_multiple_times_simulate_file_access(self):
		# Arrange:
		with sqlite3.connect('file:mem1?mode=memory&cache=shared', uri=True) as connection:
			self._create_database(connection, [(NemAddress(NEM_ADDRESSES[0]), 112233445566)])

			# Act + Assert:
			with sqlite3.connect('file:mem1?mode=memory&cache=shared', uri=True) as connection2:
				with self.assertRaises(sqlite3.IntegrityError):
					database2 = BalancesDatabase(connection2)
					database2.add_account_balance(NemAddress(NEM_ADDRESSES[0]), 77889900)

	# endregion

	# region addresses

	def test_can_query_addresses(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection, [
				(NemAddress(NEM_ADDRESSES[0]), 112233445566),
				(NemAddress(NEM_ADDRESSES[1]), 77889900)
			])

			# Act:
			addresses = database.addresses()

			# Assert:
			self.assertEqual(2, len(addresses))
			self.assertTrue(NemAddress(NEM_ADDRESSES[0]) in addresses)
			self.assertTrue(NemAddress(NEM_ADDRESSES[1]) in addresses)

	# endregion

	# region lookup_balance

	def test_can_lookup_known_balance(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection, [
				(NemAddress(NEM_ADDRESSES[0]), 112233445566),
				(NemAddress(NEM_ADDRESSES[1]), 77889900)
			])

			# Act:
			balance1 = database.lookup_balance(NemAddress(NEM_ADDRESSES[0]))
			balance2 = database.lookup_balance(NemAddress(NEM_ADDRESSES[1]))

			# Assert:
			self.assertEqual(112233445566, balance1)
			self.assertEqual(77889900, balance2)

	def test_can_lookup_unknown_balance(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection, [
				(NemAddress(NEM_ADDRESSES[0]), 112233445566),
				(NemAddress(NEM_ADDRESSES[1]), 77889900)
			])

			# Act:
			balance = database.lookup_balance(NemAddress(NEM_ADDRESSES[2]))

			# Assert:
			self.assertEqual(0, balance)

	# endregion
