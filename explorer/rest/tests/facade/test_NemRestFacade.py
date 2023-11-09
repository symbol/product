from rest.facade.NemRestFacade import NemRestFacade

from ..db.test_NemDatabase import BlockQueryParams
from ..test.DatabaseTestUtils import BLOCK_VIEWS, DatabaseTestBase

# region test data

EXPECTED_BLOCK_1 = BLOCK_VIEWS[0].to_dict()

EXPECTED_BLOCK_2 = BLOCK_VIEWS[1].to_dict()

# endregion


class TestNemRestFacade(DatabaseTestBase):

	def _assert_can_retrieve_block(self, height, expected_block):
		# Arrange:
		nem_rest_facade = NemRestFacade(self.db_config, self.network_name)

		# Act:
		block = nem_rest_facade.get_block(height)

		# Assert:
		self.assertEqual(expected_block, block)

	def _assert_can_retrieve_blocks(self, query_params, expected_blocks):
		# Arrange:
		nem_rest_facade = NemRestFacade(self.db_config, self.network_name)

		# Act:
		blocks = nem_rest_facade.get_blocks(query_params.limit, query_params.offset, query_params.min_height, query_params.sort)

		# Assert:
		self.assertEqual(expected_blocks, blocks)

	def test_retrieve_block_by_height(self):
		self._assert_can_retrieve_block(1, EXPECTED_BLOCK_1)

	def test_returns_none_for_nonexistent_block(self):
		self._assert_can_retrieve_block(3, None)

	def test_blocks_filtered_by_limit(self):
		self._assert_can_retrieve_blocks(BlockQueryParams(1, 0, 0, 'desc'), [EXPECTED_BLOCK_2])

	def test_blocks_filtered_by_offset(self):
		self._assert_can_retrieve_blocks(BlockQueryParams(1, 1, 0, 'desc'), [EXPECTED_BLOCK_1])

	def test_blocks_filtered_by_min_height(self):
		self._assert_can_retrieve_blocks(BlockQueryParams(10, 0, 2, 'desc'), [EXPECTED_BLOCK_2])

	def test_returns_empty_list_on_no_matches(self):
		self._assert_can_retrieve_blocks(BlockQueryParams(10, 0, 3, 'desc'), [])

	def test_blocks_sorted_by_height_asc(self):
		self._assert_can_retrieve_blocks(BlockQueryParams(10, 0, 0, 'asc'), [EXPECTED_BLOCK_1, EXPECTED_BLOCK_2])

	def test_blocks_sorted_by_height_desc(self):
		self._assert_can_retrieve_blocks(BlockQueryParams(10, 0, 0, 'desc'), [EXPECTED_BLOCK_2, EXPECTED_BLOCK_1])
