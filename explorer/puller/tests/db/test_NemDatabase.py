import datetime
import unittest

import psycopg2
import testing.postgresql

from db.NemDatabase import NemDatabase
from model.Block import Block

# region test data

BLOCKS = [
	Block(
		1,
		'2015-03-29 00:06:25',
		0,
		5,
		100000000000000,
		'438cf6375dab5a0d32f9b7bf151d4539e00a590f7c022d5572c7d41815a24be4',
		'8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9',
		'2abdd19ad3efab0413b42772a586faa19dedb16d35f665f90d598046a2132c4ad1e71001545ceaa44e63c04345591e7aadbfd330af82a0d8a1da5643e791ff0f'),
	Block(
		2,
		'2015-03-29 20:34:19',
		0,
		5,
		80000000000000,
		'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
		'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
		'1b81379847241e45da86b27911e5c9a9192ec04f644d98019657d32838b49c143eaa4815a3028b80f9affdbf0b94cd620f7a925e02783dda67b8627b69ddf70e')
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

	def test_can_create_tables(self):
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

	def test_can_insert_block(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()

			# Act:
			nem_database.insert_block(cursor, BLOCKS[0])

			nem_database.connection.commit()
			cursor.execute('SELECT * FROM blocks WHERE height = %s', (BLOCKS[0].height, ))
			result = cursor.fetchone()

			# Convert memoryview objects to bytes
			result = tuple(bytes(item) if isinstance(item, memoryview) else item for item in result)

		# Assert:
		self.assertIsNotNone(result)
		expected_result = (
			1,
			datetime.datetime(2015, 3, 29, 0, 6, 25),
			0,
			5,
			100000000000000,
			bytes.fromhex(BLOCKS[0].block_hash),
			bytes.fromhex(BLOCKS[0].signer),
			bytes.fromhex(BLOCKS[0].signature)
		)
		self.assertEqual(result, expected_result)

	def test_cannot_insert_same_block_multiple_times(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()

			nem_database.insert_block(cursor, BLOCKS[0])

			# Act + Assert:
			with self.assertRaises(psycopg2.IntegrityError):
				nem_database.insert_block(cursor, BLOCKS[0])

	def test_can_get_current_height(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()

			for block in BLOCKS:
				nem_database.insert_block(cursor, block)

			nem_database.connection.commit()

			# Act:
			result = nem_database.get_current_height()

		# Assert:
		self.assertEqual(result, 2)

	def test_can_get_current_height_is_zero_database_empty(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			# Act:
			result = nem_database.get_current_height()

		# Assert:
		self.assertEqual(result, 0)
