from rest import Pagination, Sorting
from rest.db.NemDatabase import NemDatabase

from ..test.DatabaseTestUtils import ACCOUNT_VIEWS, ACCOUNTS, BLOCK_VIEWS, NAMESPACE_VIEWS, DatabaseTestBase

# region test data

EXPECTED_BLOCK_VIEW_1 = BLOCK_VIEWS[0]

EXPECTED_BLOCK_VIEW_2 = BLOCK_VIEWS[1]

EXPECTED_ACCOUNT_VIEW_1 = ACCOUNT_VIEWS[0]

EXPECTED_ACCOUNT_VIEW_2 = ACCOUNT_VIEWS[1]

EXPECTED_NAMESPACE_VIEW_1 = NAMESPACE_VIEWS[0]

EXPECTED_NAMESPACE_VIEW_2 = NAMESPACE_VIEWS[1]

# endregion


class NemDatabaseTest(DatabaseTestBase):  # pylint: disable=too-many-public-methods

	def setUp(self):
		super().setUp()
		self.nem_db = NemDatabase(self.db_config, self.network)

	# region block

	def _assert_can_query_block_by_height(self, height, expected_block):
		# Act:
		block_view = self.nem_db.get_block(height)

		# Assert:
		self.assertEqual(expected_block, block_view)

	def _assert_can_query_blocks_with_filter(self, pagination, min_height, sort, expected_blocks):
		# Act:
		blocks_view = self.nem_db.get_blocks(pagination, min_height, sort)

		# Assert:
		self.assertEqual(expected_blocks, blocks_view)

	def test_can_query_block_by_height_1(self):
		self._assert_can_query_block_by_height(1, EXPECTED_BLOCK_VIEW_1)

	def test_cannot_query_nonexistent_block(self):
		self._assert_can_query_block_by_height(3, None)

	def test_can_query_blocks_filtered_limit(self):
		self._assert_can_query_blocks_with_filter(Pagination(1, 0), 1, 'desc', [EXPECTED_BLOCK_VIEW_2])

	def test_can_query_blocks_filtered_offset_0(self):
		self._assert_can_query_blocks_with_filter(Pagination(1, 0), 0, 'desc', [EXPECTED_BLOCK_VIEW_2])

	def test_can_query_blocks_filtered_offset_1(self):
		self._assert_can_query_blocks_with_filter(Pagination(1, 1), 0, 'desc', [EXPECTED_BLOCK_VIEW_1])

	def test_can_query_blocks_filtered_min_height_1(self):
		self._assert_can_query_blocks_with_filter(Pagination(10, 0), 1, 'desc', [EXPECTED_BLOCK_VIEW_2, EXPECTED_BLOCK_VIEW_1])

	def test_can_query_blocks_filtered_min_height_2(self):
		self._assert_can_query_blocks_with_filter(Pagination(10, 0), 2, 'desc', [EXPECTED_BLOCK_VIEW_2])

	def test_can_query_blocks_filtered_min_height_3(self):
		self._assert_can_query_blocks_with_filter(Pagination(10, 0), 3, 'desc', [])

	def test_can_query_blocks_sorted_by_height_asc(self):
		self._assert_can_query_blocks_with_filter(Pagination(10, 0), 0, 'asc', [EXPECTED_BLOCK_VIEW_1, EXPECTED_BLOCK_VIEW_2])

	def test_can_query_blocks_sorted_by_height_desc(self):
		self._assert_can_query_blocks_with_filter(Pagination(10, 0), 0, 'desc', [EXPECTED_BLOCK_VIEW_2, EXPECTED_BLOCK_VIEW_1])

	# endregion

	# region account

	def test_can_query_account_by_address(self):
		# Act:
		account_view = self.nem_db.get_account_by_address(address=ACCOUNTS[0].address)
		# Assert:
		self.assertEqual(EXPECTED_ACCOUNT_VIEW_1, account_view)

	def test_can_query_account_by_public_key(self):
		# Act:
		account_view = self.nem_db.get_account_by_public_key(public_key=ACCOUNTS[0].public_key)
		# Assert:
		self.assertEqual(EXPECTED_ACCOUNT_VIEW_1, account_view)

	# endregion

	# region accounts
	def _assert_can_query_accounts(self, pagination, sorting, expected_accounts, is_harvesting=False):
		# Act:
		accounts_view = self.nem_db.get_accounts(pagination, sorting, is_harvesting)
		# Assert:
		self.assertEqual(expected_accounts, accounts_view)

	def test_can_query_accounts_filtered_limit(self):
		self._assert_can_query_accounts(Pagination(1, 0), Sorting('BALANCE', 'desc'), [EXPECTED_ACCOUNT_VIEW_2])

	def test_can_query_accounts_filtered_offset(self):
		self._assert_can_query_accounts(Pagination(1, 1), Sorting('BALANCE', 'desc'), [EXPECTED_ACCOUNT_VIEW_1])

	def test_can_query_accounts_filtered_is_harvesting(self):
		self._assert_can_query_accounts(Pagination(10, 0), Sorting('BALANCE', 'desc'), [EXPECTED_ACCOUNT_VIEW_2], is_harvesting=True)

	def test_can_query_accounts_sorted_by_balance_asc(self):
		self._assert_can_query_accounts(Pagination(10, 0), Sorting('BALANCE', 'asc'), [EXPECTED_ACCOUNT_VIEW_1, EXPECTED_ACCOUNT_VIEW_2])

	def test_can_query_accounts_sorted_by_balance_desc(self):
		self._assert_can_query_accounts(Pagination(10, 0), Sorting('BALANCE', 'desc'), [EXPECTED_ACCOUNT_VIEW_2, EXPECTED_ACCOUNT_VIEW_1])

	# endregion

	# region namespace

	def _assert_can_query_namespace_by_name(self, namespace, expected_namespace):
		# Act:
		namespace_view = self.nem_db.get_namespace_by_name(namespace)

		# Assert:
		self.assertEqual(expected_namespace, namespace_view)

	def test_can_query_namespace_by_root_namespace(self):
		self._assert_can_query_namespace_by_name('root', EXPECTED_NAMESPACE_VIEW_1)

	def test_can_query_namespace_by_sub_namespace(self):
		self._assert_can_query_namespace_by_name('root_sub.sub_1', EXPECTED_NAMESPACE_VIEW_2)

	def test_cannot_query_nonexistent_namespace(self):
		self._assert_can_query_namespace_by_name('nonexistent', None)

	# endregion

	# region namespaces

	def _assert_can_query_namespaces_with_filter(self, pagination, sort, expected_namespaces):
		# Act:
		namespaces_view = self.nem_db.get_namespaces(pagination, sort)

		# Assert:
		self.assertEqual(expected_namespaces, namespaces_view)

	def test_can_query_namespaces_filtered_limit_offset_0(self):
		self._assert_can_query_namespaces_with_filter(Pagination(1, 0), 'desc', [EXPECTED_NAMESPACE_VIEW_2])

	def test_can_query_namespaces_filtered_offset_1(self):
		self._assert_can_query_namespaces_with_filter(Pagination(1, 1), 'desc', [EXPECTED_NAMESPACE_VIEW_1])

	def test_can_query_namespaces_sorted_by_registered_height_asc(self):
		self._assert_can_query_namespaces_with_filter(Pagination(10, 0), 'asc', [EXPECTED_NAMESPACE_VIEW_1, EXPECTED_NAMESPACE_VIEW_2])

	def test_can_query_namespaces_sorted_by_registered_height_desc(self):
		self._assert_can_query_namespaces_with_filter(Pagination(10, 0), 'desc', [EXPECTED_NAMESPACE_VIEW_2, EXPECTED_NAMESPACE_VIEW_1])

	# endregion
