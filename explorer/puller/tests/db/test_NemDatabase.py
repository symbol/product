import datetime
import unittest

import testing.postgresql

from db.NemDatabase import NemDatabase
from model.Block import Block

# region test data

BLOCKS = [
	Block(1, '2015-03-29 00:06:25', 0, 5, 100000000000000, '#', 'NANEMOABLAGR72AZ2RV3V4ZHDCXW25XQ73O7OBT5'),
	Block(
		2,
		'2015-03-29 20:34:19',
		0,
		5,
		80000000000000,
		'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
		'NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3')
]

# endregion


class NemDatabaseTest(unittest.TestCase):

	def setUp(self):
		self.postgresql = testing.postgresql.Postgresql()
		self.db_config = {
			'database': self.postgresql.url().split('/')[-1],
			'user': 'postgres',
			'password': '',
			'host': self.postgresql.url().split('/')[2].split('@')[1].split(':')[0],
			'port': self.postgresql.url().split('/')[-2].split(':')[-1]
		}

	def tearDown(self):
		# Destroy the temporary PostgreSQL database
		self.postgresql.stop()

	def test_create_tables(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			# Act:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()
			cursor.execute('''SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'blocks' ''')
			result = cursor.fetchone()

		# Assert:
		self.assertIsNotNone(result)
		self.assertEqual(result[0], 'blocks')

	def test_insert_block(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()
			# Act:
			nem_database.insert_block(BLOCKS[0].to_dict())

			cursor = nem_database.connection.cursor()
			cursor.execute('SELECT * FROM blocks')
			result = cursor.fetchone()

		# Assert:
		self.assertIsNotNone(result)
		self.assertEqual(result, (
			1,
			datetime.datetime(2015, 3, 29, 0, 6, 25),
			0,
			5,
			100000000000000,
			'#',
			'NANEMOABLAGR72AZ2RV3V4ZHDCXW25XQ73O7OBT5'))

	def test_get_current_height(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			for block in BLOCKS:
				nem_database.insert_block(block.to_dict())

			# Act:
			result = nem_database.get_current_height()

		# Assert:
		self.assertEqual(result, 2)
