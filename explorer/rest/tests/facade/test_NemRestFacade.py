from rest.facade.NemRestFacade import NemRestFacade

from ..db.test_NemDatabase import BlockQueryParams, PaginationQueryParams
from ..test.DatabaseTestUtils import BLOCK_VIEWS, NAMESPACE_VIEWS, DatabaseTestBase

# region test data

EXPECTED_BLOCK_1 = BLOCK_VIEWS[0].to_dict()

EXPECTED_BLOCK_2 = BLOCK_VIEWS[1].to_dict()

EXPECTED_NAMESPACE_1 = NAMESPACE_VIEWS[0].to_dict()

EXPECTED_NAMESPACE_2 = NAMESPACE_VIEWS[1].to_dict()

# endregion


class TestNemRestFacade(DatabaseTestBase):

	# region block tests

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

	# endregion

	# region namespace tests

	def _assert_can_retrieve_namespace(self, name, expected_namespace):
		# Arrange:
		nem_rest_facade = NemRestFacade(self.db_config, self.network)

		# Act:
		namespace = nem_rest_facade.get_namespace(name)

		# Assert:
		self.assertEqual(expected_namespace, namespace)

	def _assert_can_retrieve_namespaces(self, query_params, expected_namespaces):
		# Arrange:
		nem_rest_facade = NemRestFacade(self.db_config, self.network)

		# Act:
		namespaces = nem_rest_facade.get_namespaces(query_params.limit, query_params.offset, query_params.sort)

		# Assert:
		self.assertEqual(expected_namespaces, namespaces)

	def test_retrieve_namespace_by_name(self):
		self._assert_can_retrieve_namespace('oxford', EXPECTED_NAMESPACE_1)

	def test_returns_none_for_nonexistent_namespace(self):
		self._assert_can_retrieve_namespace('non_existing_namespace', None)

	def test_namespaces_filtered_by_limit(self):
		self._assert_can_retrieve_namespaces(PaginationQueryParams(1, 0, 'desc'), [EXPECTED_NAMESPACE_2])

	def test_namespaces_filtered_by_offset(self):
		self._assert_can_retrieve_namespaces(PaginationQueryParams(1, 1, 'desc'), [EXPECTED_NAMESPACE_1])

	def test_namespaces_sorted_by_id_asc(self):
		self._assert_can_retrieve_namespaces(PaginationQueryParams(10, 0, 'asc'), [EXPECTED_NAMESPACE_1, EXPECTED_NAMESPACE_2])

	def test_namespaces_sorted_by_id_desc(self):
		self._assert_can_retrieve_namespaces(PaginationQueryParams(10, 0, 'desc'), [EXPECTED_NAMESPACE_2, EXPECTED_NAMESPACE_1])

	# endregion
