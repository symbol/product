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

	# region add_account_balance - valid

	def _assert_db_contents(self, connection, expected_balances):
		cursor = connection.cursor()
		cursor.execute('''SELECT * FROM snapshot_balances''')
		balances = cursor.fetchall()

		# Assert:
		self.assertEqual(expected_balances, balances)

	def test_can_insert_balances(self):
		# Arrange:
		balances = [
			(NemAddress(NEM_ADDRESSES[0]).bytes, 112233445566),
			(NemAddress(NEM_ADDRESSES[1]).bytes, 77889900)
		]

		with sqlite3.connect(':memory:') as connection:
			database = BalancesDatabase(connection)
			database.create_tables()

			# Act:
			for account_balance in balances:
				database.add_account_balance(*account_balance)

			# Assert: (matches input)
			self._assert_db_contents(connection, balances)

	def test_cannot_insert_same_account_multiple_times(self):
		# Arrange:
		balances = [
			(NemAddress(NEM_ADDRESSES[0]).bytes, 112233445566),
			(NemAddress(NEM_ADDRESSES[0]).bytes, 77889900)
		]

		with sqlite3.connect(':memory:') as connection:
			database = BalancesDatabase(connection)
			database.create_tables()

			database.add_account_balance(*balances[0])

			# Act:
			with self.assertRaises(sqlite3.IntegrityError):
				database.add_account_balance(*balances[1])

	# endregion
