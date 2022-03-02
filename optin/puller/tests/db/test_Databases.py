import tempfile
import unittest

from puller.db.Databases import Databases


class DatabasesTest(unittest.TestCase):
	def test_can_create(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			# Act:
			databases = Databases(temp_directory)

			# Assert:
			self.assertIsNone(databases.completed)
			self.assertIsNone(databases.inprogress)
			self.assertIsNone(databases.multisig)
			self.assertIsNone(databases.balances)

	def test_can_connect(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			# Act:
			with Databases(temp_directory) as databases:
				# Assert:
				self.assertIsNotNone(databases.completed)
				self.assertIsNotNone(databases.inprogress)
				self.assertIsNotNone(databases.multisig)
				self.assertIsNotNone(databases.balances)
