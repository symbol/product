import sqlite3
import unittest

from bridge.db.MaxProcessedHeightMixin import MaxProcessedHeightMixin

from ..test.DatabaseTestUtils import get_all_table_names


class MaxProcessedHeightMixinTest(unittest.TestCase):
	# region shared test utils

	@staticmethod
	def _query_all_max_processed_heights(cursor):
		cursor.execute('''SELECT * FROM max_processed_height''')
		return cursor.fetchall()

	# endregion

	# region create

	def test_can_create_tables(self):
		# Act:
		table_names = get_all_table_names(MaxProcessedHeightMixin)

		# Assert:
		self.assertEqual(set(['max_processed_height']), table_names)

	# endregion

	# region max_processed_height

	def test_max_processed_height_is_zero_when_empty(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = MaxProcessedHeightMixin(connection)
			database.create_tables()

			# Act:
			max_processed_height = database.max_processed_height()

			# Assert:
			self.assertEqual(0, max_processed_height)

			# Sanity:
			self.assertEqual(0, len(self._query_all_max_processed_heights(connection.cursor())))

	def test_max_processed_height_can_be_set_once(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = MaxProcessedHeightMixin(connection)
			database.create_tables()

			# Act:
			database.set_max_processed_height(123)
			max_processed_height = database.max_processed_height()

			# Assert:
			self.assertEqual(123, max_processed_height)

			# Sanity:
			self.assertEqual(1, len(self._query_all_max_processed_heights(connection.cursor())))

	def test_max_processed_height_can_be_set_multiple_times(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = MaxProcessedHeightMixin(connection)
			database.create_tables()

			# Act:
			database.set_max_processed_height(123)
			database.set_max_processed_height(654)
			database.set_max_processed_height(222)
			max_processed_height = database.max_processed_height()

			# Assert:
			self.assertEqual(222, max_processed_height)

			# Sanity:
			self.assertEqual(1, len(self._query_all_max_processed_heights(connection.cursor())))

	# endregion
