import unittest
from collections import namedtuple

import testing.postgresql

from rest.db.NemDatabase import NemDatabase
from rest.model.Block import BlockView

from ..test.DatabaseTestUtils import initialize_database

DatabaseConfig = namedtuple('DatabaseConfig', ['database', 'user', 'password', 'host', 'port'])

# region test data

Expected_Block_View_1 = BlockView(  # block with height 1
	1,
	'2015-03-29 00:06:25',
	102000000,
	5,
	100000000000000,
	'438cf6375dab5a0d32f9b7bf151d4539e00a590f7c022d5572c7d41815a24be4',
	'8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9',
	(
		'2abdd19ad3efab0413b42772a586faa19dedb16d35f665f90d598046a2132c4a'
		'd1e71001545ceaa44e63c04345591e7aadbfd330af82a0d8a1da5643e791ff0f'
	)
)

Expected_Block_View_2 = BlockView(  # block with height 2
	2,
	'2015-03-29 20:34:19',
	201000000,
	3,
	80000000000000,
	'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
	'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
	(
		'1b81379847241e45da86b27911e5c9a9192ec04f644d98019657d32838b49c14'
		'3eaa4815a3028b80f9affdbf0b94cd620f7a925e02783dda67b8627b69ddf70e'
	)
)

# endregion


class NemDatabaseTest(unittest.TestCase):

	@classmethod
	def setUpClass(cls):
		cls.postgresql = testing.postgresql.Postgresql()
		cls.db_config = DatabaseConfig(**cls.postgresql.dsn(), password='')
		initialize_database(cls.db_config)

	@classmethod
	def tearDownClass(cls):
		cls.postgresql.stop()

	def _assert_can_query_block_by_height(self, height, expected_block):
		# Arrange:
		nem_db = NemDatabase(self.db_config)

		# Act:
		block_view = nem_db.get_block(height)

		# Assert:
		self.assertEqual(block_view, expected_block)

	def _assert_can_query_blocks_with_filter(self, limit, offset, min_height, expected_blocks):
		# Arrange:
		nem_db = NemDatabase(self.db_config)

		# Act:
		blocks_view = nem_db.get_blocks(limit, offset, min_height)

		# Assert:
		self.assertEqual(blocks_view, expected_blocks)

	def test_can_query_block_by_height_1(self):
		self._assert_can_query_block_by_height(1, Expected_Block_View_1)

	def test_can_query_nonexistent_block(self):
		self._assert_can_query_block_by_height(3, None)

	def test_can_query_blocks_filtered_limit(self):
		self._assert_can_query_blocks_with_filter(1, 0, 1, [Expected_Block_View_1])

	def test_can_query_blocks_filtered_offset_0(self):
		self._assert_can_query_blocks_with_filter(1, 0, 0, [Expected_Block_View_1])

	def test_can_query_blocks_filtered_offset_1(self):
		self._assert_can_query_blocks_with_filter(1, 1, 0, [Expected_Block_View_2])

	def test_can_query_blocks_filtered_min_height_1(self):
		#
		self._assert_can_query_blocks_with_filter(10, 0, 1, [Expected_Block_View_1, Expected_Block_View_2])

	def test_can_query_blocks_filtered_min_height_2(self):
		self._assert_can_query_blocks_with_filter(10, 0, 2, [Expected_Block_View_2])

	def test_can_query_blocks_filtered_min_height_3(self):
		self._assert_can_query_blocks_with_filter(10, 0, 3, [])
