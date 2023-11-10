from collections import namedtuple

from rest.db.NemDatabase import NemDatabase

from ..test.DatabaseTestUtils import BLOCK_VIEWS, NAMESPACE_VIEWS, DatabaseTestBase

BlockQueryParams = namedtuple('BlockQueryParams', ['limit', 'offset', 'min_height', 'sort'])
PaginationQueryParams = namedtuple('PaginationQueryParams', ['limit', 'offset', 'sort'])

# region test data

EXPECTED_BLOCK_VIEW_1 = BLOCK_VIEWS[0]

EXPECTED_BLOCK_VIEW_2 = BLOCK_VIEWS[1]

EXPECTED_NAMESPACE_VIEW_1 = NAMESPACE_VIEWS[0]

EXPECTED_NAMESPACE_VIEW_2 = NAMESPACE_VIEWS[1]

# endregion


class NemDatabaseTest(DatabaseTestBase):

	# region block tests

	def _assert_can_query_block_by_height(self, height, expected_block):
		# Arrange:
		nem_db = NemDatabase(self.db_config, self.network_name)

		# Act:
		block_view = nem_db.get_block(height)

		# Assert:
		self.assertEqual(expected_block, block_view)

	def _assert_can_query_blocks_with_filter(self, query_params, expected_blocks):
		# Arrange:
		nem_db = NemDatabase(self.db_config, self.network_name)

		# Act:
		blocks_view = nem_db.get_blocks(query_params.limit, query_params.offset, query_params.min_height, query_params.sort)

		# Assert:
		self.assertEqual(expected_blocks, blocks_view)

	def test_can_query_block_by_height_1(self):
		self._assert_can_query_block_by_height(1, EXPECTED_BLOCK_VIEW_1)

	def test_cannot_query_nonexistent_block(self):
		self._assert_can_query_block_by_height(3, None)

	def test_can_query_blocks_filtered_limit(self):
		self._assert_can_query_blocks_with_filter(BlockQueryParams(1, 0, 1, 'desc'), [EXPECTED_BLOCK_VIEW_2])

	def test_can_query_blocks_filtered_offset_0(self):
		self._assert_can_query_blocks_with_filter(BlockQueryParams(1, 0, 0, 'desc'), [EXPECTED_BLOCK_VIEW_2])

	def test_can_query_blocks_filtered_offset_1(self):
		self._assert_can_query_blocks_with_filter(BlockQueryParams(1, 1, 0, 'desc'), [EXPECTED_BLOCK_VIEW_1])

	def test_can_query_blocks_filtered_min_height_1(self):
		self._assert_can_query_blocks_with_filter(BlockQueryParams(10, 0, 1, 'desc'), [EXPECTED_BLOCK_VIEW_2, EXPECTED_BLOCK_VIEW_1])

	def test_can_query_blocks_filtered_min_height_2(self):
		self._assert_can_query_blocks_with_filter(BlockQueryParams(10, 0, 2, 'desc'), [EXPECTED_BLOCK_VIEW_2])

	def test_can_query_blocks_filtered_min_height_3(self):
		self._assert_can_query_blocks_with_filter(BlockQueryParams(10, 0, 3, 'desc'), [])

	def test_can_query_blocks_sorted_by_height_asc(self):
		self._assert_can_query_blocks_with_filter(BlockQueryParams(10, 0, 0, 'asc'), [EXPECTED_BLOCK_VIEW_1, EXPECTED_BLOCK_VIEW_2])

	def test_can_query_blocks_sorted_by_height_desc(self):
		self._assert_can_query_blocks_with_filter(BlockQueryParams(10, 0, 0, 'desc'), [EXPECTED_BLOCK_VIEW_2, EXPECTED_BLOCK_VIEW_1])

	# endregion

	# region namespace tests

	def _assert_can_query_namespace_by_name(self, name, expected_namespace):
		# Arrange:
		nem_db = NemDatabase(self.db_config, self.network_name)

		# Act:
		namespace_view = nem_db.get_namespace(name)

		# Assert:
		self.assertEqual(expected_namespace, namespace_view)

	def _assert_can_query_namespaces_with_filter(self, query_params, expected_namespaces):
		# Arrange:
		nem_db = NemDatabase(self.db_config, self.network_name)

		# Act:
		namespaces_view = nem_db.get_namespaces(query_params.limit, query_params.offset, query_params.sort)

		# Assert:
		self.assertEqual(expected_namespaces, namespaces_view)

	def test_can_query_namespace_by_name(self):
		self._assert_can_query_namespace_by_name('oxford', EXPECTED_NAMESPACE_VIEW_1)

	def test_cannot_query_nonexistent_namespace(self):
		self._assert_can_query_namespace_by_name('non_exist', None)

	def test_can_query_namespaces_filtered_limit(self):
		self._assert_can_query_namespaces_with_filter(PaginationQueryParams(1, 0, 'desc'), [EXPECTED_NAMESPACE_VIEW_2])

	def test_can_query_namespaces_filtered_offset_0(self):
		self._assert_can_query_namespaces_with_filter(PaginationQueryParams(1, 0, 'desc'), [EXPECTED_NAMESPACE_VIEW_2])

	def test_can_query_namespaces_filtered_offset_1(self):
		self._assert_can_query_namespaces_with_filter(PaginationQueryParams(1, 1, 'desc'), [EXPECTED_NAMESPACE_VIEW_1])

	def test_can_query_namespaces_sorted_by_id_asc(self):
		self._assert_can_query_namespaces_with_filter(PaginationQueryParams(10, 0, 'asc'), [EXPECTED_NAMESPACE_VIEW_1, EXPECTED_NAMESPACE_VIEW_2])

	def test_can_query_namespaces_sorted_by_id_desc(self):
		self._assert_can_query_namespaces_with_filter(
			PaginationQueryParams(10, 0, 'desc'),
			[EXPECTED_NAMESPACE_VIEW_2, EXPECTED_NAMESPACE_VIEW_1]
		)

	# endregion
