import unittest
from binascii import unhexlify
from collections import namedtuple

import testing.postgresql

from db.NemDatabase import NemDatabase

Block = namedtuple('Block', ['height', 'timestamp', 'total_fees', 'total_transactions', 'difficulty', 'block_hash', 'signer', 'signature'])
DatabaseConfig = namedtuple('DatabaseConfig', ['database', 'user', 'password', 'host', 'port'])


# region test data

BLOCKS = [
	Block(
		1,
		'2015-03-29 00:06:25',
		102000000,
		5,
		100000000000000,
		'438cf6375dab5a0d32f9b7bf151d4539e00a590f7c022d5572c7d41815a24be4',
		'8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9',
		'2abdd19ad3efab0413b42772a586faa19dedb16d35f665f90d598046a2132c4a'
		'd1e71001545ceaa44e63c04345591e7aadbfd330af82a0d8a1da5643e791ff0f'),
	Block(
		2,
		'2015-03-29 20:34:19',
		201000000,
		3,
		80000000000000,
		'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
		'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
		'1b81379847241e45da86b27911e5c9a9192ec04f644d98019657d32838b49c14'
		'3eaa4815a3028b80f9affdbf0b94cd620f7a925e02783dda67b8627b69ddf70e')
]

# endregion


class NemDatabaseTest(unittest.TestCase):

	@classmethod
	def setUpClass(cls):
		cls.postgresql = testing.postgresql.Postgresql()
		cls.db_config = DatabaseConfig(**cls.postgresql.dsn(), password='')
		cls._initialize_database(cls.db_config)

	@classmethod
	def tearDownClass(cls):
		cls.postgresql.stop()

	@staticmethod
	def _initialize_database(db_config):
		with NemDatabase(db_config).connection() as connection:
			cursor = connection.cursor()

			# Create tables
			cursor.execute('''
				CREATE TABLE IF NOT EXISTS blocks (
					height bigint NOT NULL PRIMARY KEY,
					timestamp timestamp NOT NULL,
					totalFees bigint DEFAULT 0,
					totalTransactions int DEFAULT 0,
					difficulty bigInt NOT NULL,
					hash bytea NOT NULL,
					signer bytea NOT NULL,
					signature bytea NOT NULL
			)
			''')

			# Insert data
			for block in BLOCKS:
				cursor.execute(
					'''
					INSERT INTO blocks
					VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
					''', (
						block.height,
						block.timestamp,
						block.total_fees,
						block.total_transactions,
						block.difficulty,
						unhexlify(block.block_hash),
						unhexlify(block.signer),
						unhexlify(block.signature)
					)
				)

			connection.commit()

	def _assert_block(self, expected_block, actual_block_view):
		self.assertEqual(expected_block.height, actual_block_view.height)
		self.assertEqual(expected_block.timestamp, actual_block_view.timestamp.strftime('%Y-%m-%d %H:%M:%S'))
		self.assertEqual(expected_block.total_fees, actual_block_view.total_fees)
		self.assertEqual(expected_block.total_transactions, actual_block_view.total_transactions)
		self.assertEqual(expected_block.difficulty, actual_block_view.difficulty)
		self.assertEqual(expected_block.block_hash, actual_block_view.block_hash)
		self.assertEqual(expected_block.signer, actual_block_view.signer)
		self.assertEqual(expected_block.signature, actual_block_view.signature)

	def _assert_can_query_block_by_height(self, height, expected_block):
		# Arrange:
		nem_db = NemDatabase(self.db_config)

		# Act:
		block_view = nem_db.get_block(height)

		# Assert:
		self._assert_block(expected_block, block_view)

	def _assert_can_query_blocks_filtered_offset(self, offset, expected_block):
		# Arrange:
		nem_db = NemDatabase(self.db_config)

		# Act:
		page = nem_db.get_blocks(1, offset, 1)

		# Assert:
		self.assertEqual(1, len(page))
		self._assert_block(expected_block, page[0])

	def _assert_can_query_blocks_filtered_min_height(self, min_height, expected_no_of_block):
		# Arrange:
		nem_db = NemDatabase(self.db_config)

		# Act:
		blocks_view = nem_db.get_blocks(10, 0, min_height)

		# Assert:
		self.assertEqual(expected_no_of_block, len(blocks_view))
		for block in blocks_view:
			self.assertGreaterEqual(block.height, min_height)

	def test_can_query_block_by_height_1(self):
		self._assert_can_query_block_by_height(1, BLOCKS[0])

	def test_can_query_block_by_height_2(self):
		self._assert_can_query_block_by_height(2, BLOCKS[1])

	def test_cannot_query_block_by_height_3(self):
		# Arrange:
		nem_db = NemDatabase(self.db_config)

		# Act:
		block_view = nem_db.get_block(3)

		# Assert:
		self.assertIsNone(block_view)

	def test_can_query_blocks_filtered_limit_1(self):
		# Arrange:
		nem_db = NemDatabase(self.db_config)

		# Act:
		blocks_view = nem_db.get_blocks(1, 0, 1)

		# Assert:
		self.assertEqual(1, len(blocks_view))
		self._assert_block(BLOCKS[0], blocks_view[0])

	def test_can_query_blocks_filtered_offset_0(self):
		self._assert_can_query_blocks_filtered_offset(0, BLOCKS[0])

	def test_can_query_blocks_filtered_offset_1(self):
		self._assert_can_query_blocks_filtered_offset(1, BLOCKS[1])

	def test_can_query_blocks_filtered_min_height_1(self):
		self._assert_can_query_blocks_filtered_min_height(1, 2)

	def test_cannot_query_blocks_filtered_min_height_3(self):
		self._assert_can_query_blocks_filtered_min_height(3, 0)
