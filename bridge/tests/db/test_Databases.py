import sqlite3
import tempfile
import unittest

from symbolchain.CryptoTypes import Hash256

from bridge.db.Databases import Databases

from ..test.MockNetworkFacade import MockNemNetworkFacade, MockSymbolNetworkFacade


class DatabasesTest(unittest.TestCase):
	@staticmethod
	def _create_databases(database_directory, is_read_only=False):
		return Databases(database_directory, MockNemNetworkFacade(), MockSymbolNetworkFacade(), is_read_only)

	def test_can_create(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			# Act:
			databases = self._create_databases(temp_directory)

			# Assert:
			self.assertIsNone(databases.balance_change)
			self.assertIsNone(databases.unwrap_request)
			self.assertIsNone(databases.wrap_request)

	def test_can_connect(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			# Act:
			with self._create_databases(temp_directory) as databases:
				# Assert:
				self.assertIsNotNone(databases.balance_change)
				self.assertIsNotNone(databases.unwrap_request)
				self.assertIsNotNone(databases.wrap_request)

	def test_can_create_tables(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with self._create_databases(temp_directory) as databases:
				# Act:
				databases.create_tables()

				# Assert:
				self.assertEqual(0, databases.balance_change.max_processed_height())
				self.assertEqual(0, databases.unwrap_request.max_processed_height())
				self.assertEqual(0, databases.wrap_request.max_processed_height())

	def test_can_connect_read_only(self):
		# Arrange: create the database
		with tempfile.TemporaryDirectory() as temp_directory:
			with self._create_databases(temp_directory) as databases:
				databases.create_tables()

				# Act: reopen the database as readonly
				with self._create_databases(temp_directory, True) as read_only_databases:
					# Assert: rw database can still make changes
					databases.balance_change.add_transfer(1234, 'foo.bar', 8888, Hash256.zero())
					databases.balance_change.set_max_processed_height(1234)

					# - rw database can read
					databases_balance = databases.balance_change.balance_at(1234, 'foo.bar')
					self.assertEqual(8888, databases_balance)

					# - ro database can read
					read_only_databases_balance = read_only_databases.balance_change.balance_at(1234, 'foo.bar')
					self.assertEqual(8888, read_only_databases_balance)

					# - ro database cannot make changes
					with self.assertRaises(sqlite3.OperationalError):
						read_only_databases.balance_change.add_transfer(2345, 'foo.bar', 9999, Hash256.zero())
