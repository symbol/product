import unittest
from collections import namedtuple

import testing.postgresql

from rest.db.NemDatabase import NemDatabase
from rest.model.Block import BlockView

from ..test.DatabaseTestUtils import BLOCKS, DatabaseConfig, initialize_database

BlockQueryParams = namedtuple('BlockQueryParams', ['limit', 'offset', 'min_height'])

# region test data

EXPECTED_BLOCK_VIEW_1 = BlockView(*BLOCKS[0])

EXPECTED_BLOCK_VIEW_2 = BlockView(*BLOCKS[1])

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
		self.assertEqual(expected_block, block_view)

	def _assert_can_query_blocks_with_filter(self, query_params, expected_blocks):
		# Arrange:
		nem_db = NemDatabase(self.db_config)

		# Act:
		blocks_view = nem_db.get_blocks(query_params.limit, query_params.offset, query_params.min_height)

		# Assert:
		self.assertEqual(expected_blocks, blocks_view)

	def test_can_query_block_by_height_1(self):
		self._assert_can_query_block_by_height(1, EXPECTED_BLOCK_VIEW_1)

	def test_cannot_query_nonexistent_block(self):
		self._assert_can_query_block_by_height(3, None)

	def test_can_query_blocks_filtered_limit(self):
		self._assert_can_query_blocks_with_filter(BlockQueryParams(1, 0, 1), [EXPECTED_BLOCK_VIEW_1])

	def test_can_query_blocks_filtered_offset_0(self):
		self._assert_can_query_blocks_with_filter(BlockQueryParams(1, 0, 0), [EXPECTED_BLOCK_VIEW_1])

	def test_can_query_blocks_filtered_offset_1(self):
		self._assert_can_query_blocks_with_filter(BlockQueryParams(1, 1, 0), [EXPECTED_BLOCK_VIEW_2])

	def test_can_query_blocks_filtered_min_height_1(self):
		self._assert_can_query_blocks_with_filter(BlockQueryParams(10, 0, 1), [EXPECTED_BLOCK_VIEW_1, EXPECTED_BLOCK_VIEW_2])

	def test_can_query_blocks_filtered_min_height_2(self):
		self._assert_can_query_blocks_with_filter(BlockQueryParams(10, 0, 2), [EXPECTED_BLOCK_VIEW_2])

	def test_can_query_blocks_filtered_min_height_3(self):
		self._assert_can_query_blocks_with_filter(BlockQueryParams(10, 0, 3), [])
