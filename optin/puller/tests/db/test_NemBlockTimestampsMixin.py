import sqlite3
import unittest

from puller.db.NemBlockTimestampsMixin import NemBlockTimestampsMixin

from ..test.DatabaseTestUtils import get_all_table_names


class NemBlockTimestampsMixinTest(unittest.TestCase):
	def test_can_create_tables(self):
		# Act:
		table_names = get_all_table_names(NemBlockTimestampsMixin)

		# Assert:
		self.assertEqual(set(['nem_block_timestamps']), table_names)

	def _assert_timestamps(self, connection, expected_timestamps):
		cursor = connection.cursor()
		cursor.execute('''SELECT * FROM nem_block_timestamps ORDER BY height DESC''')
		block_timestamps = cursor.fetchall()

		# Assert:
		self.assertEqual(expected_timestamps, block_timestamps)

	def test_can_insert_nem_block_timestamps(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = NemBlockTimestampsMixin(connection)
			database.create_tables()

			# Act:
			database.insert_nem_block_timestamps({5: 8, 6: 13, 7: 21})

			# Assert:
			self._assert_timestamps(connection, [(7, 21), (6, 13), (5, 8)])

	def test_can_query_nem_block_timestamps(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = NemBlockTimestampsMixin(connection)
			database.create_tables()
			database.insert_nem_block_timestamps({5: 8, 6: 13, 7: 21})

			# Act:
			block_timestamps = database.nem_block_timestamps()

			# Assert:
			self.assertEqual([(7, 21), (6, 13), (5, 8)], block_timestamps)
