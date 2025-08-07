import tempfile
import unittest

from bridge.db.Databases import Databases

from ..test.MockNetworkFacade import MockNemNetworkFacade, MockSymbolNetworkFacade


class DatabasesTest(unittest.TestCase):
	@staticmethod
	def _create_databases(database_directory):
		return Databases(database_directory, MockNemNetworkFacade(), MockSymbolNetworkFacade())

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
