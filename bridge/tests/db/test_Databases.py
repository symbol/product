import tempfile
import unittest

from bridge.db.Databases import Databases

from ..test.MockNetworkFacade import MockNetworkFacade


class DatabasesTest(unittest.TestCase):
	def test_can_create(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			# Act:
			databases = Databases(temp_directory, MockNetworkFacade())

			# Assert:
			self.assertIsNone(databases.balance_change)
			self.assertIsNone(databases.wrap_request)

	def test_can_connect(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			# Act:
			with Databases(temp_directory, MockNetworkFacade()) as databases:
				# Assert:
				self.assertIsNotNone(databases.balance_change)
				self.assertIsNotNone(databases.wrap_request)
