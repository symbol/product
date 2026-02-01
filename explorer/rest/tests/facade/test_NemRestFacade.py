from rest import Pagination, Sorting
from rest.facade.NemRestFacade import NemRestFacade

from ..db.test_NemDatabase import BlockQueryParams
from ..test.DatabaseTestUtils import ACCOUNT_VIEWS, BLOCK_VIEWS, DatabaseTestBase

# region test data

EXPECTED_BLOCK_1 = BLOCK_VIEWS[0].to_dict()

EXPECTED_BLOCK_2 = BLOCK_VIEWS[1].to_dict()

EXPECTED_ACCOUNT_1 = ACCOUNT_VIEWS[0].to_dict()

EXPECTED_ACCOUNT_2 = ACCOUNT_VIEWS[1].to_dict()

# endregion


class TestNemRestFacade(DatabaseTestBase):

	def setUp(self):
		super().setUp()
		self.nem_rest_facade = NemRestFacade(self.db_config, 'mainnet')

	# region block

	def _assert_can_retrieve_block(self, height, expected_block):
		# Act:
		block = self.nem_rest_facade.get_block(height)

		# Assert:
		self.assertEqual(expected_block, block)

	def _assert_can_retrieve_blocks(self, query_params, expected_blocks):
		# Act:
		blocks = self.nem_rest_facade.get_blocks(query_params.limit, query_params.offset, query_params.min_height, query_params.sort)

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

	# region account

	def test_can_retrieve_account_by_address(self):
		# Act:
		account = self.nem_rest_facade.get_account_by_address(address='NAGHXD63C4V6REWGXCVKJ2SBS3GUAXGTRQZQXPRO')

		# Assert:
		self.assertEqual(EXPECTED_ACCOUNT_1, account)

	def test_can_retrieve_account_by_public_key(self):
		# Act:
		account = self.nem_rest_facade.get_account_by_public_key(public_key='b88221939ac920484753c738fafda87e82ff04b5e370c9456d85a0f12c6a5cca')

		# Assert:
		self.assertEqual(EXPECTED_ACCOUNT_1, account)

	def test_returns_none_for_nonexistent_account_address(self):
		# Act:
		account = self.nem_rest_facade.get_account_by_address(address='NAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')

		# Assert:
		self.assertIsNone(account)

	def test_returns_none_for_nonexistent_account_public_key(self):
		# Act:
		account = self.nem_rest_facade.get_account_by_public_key(public_key='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')

		# Assert:
		self.assertIsNone(account)

	def _assert_can_retrieve_accounts(self, pagination, sorting, expected_accounts, is_harvesting=False):
		# Act:
		accounts = self.nem_rest_facade.get_accounts(pagination, sorting, is_harvesting)

		# Assert:
		self.assertEqual(expected_accounts, accounts)

	def test_can_retrieve_accounts_filtered_by_limit(self):
		self._assert_can_retrieve_accounts(
			pagination=Pagination(limit=1, offset=0),
			sorting=Sorting(field='BALANCE', order='DESC'),
			expected_accounts=[EXPECTED_ACCOUNT_2]
		)

	def test_can_retrieve_accounts_filtered_by_offset(self):
		self._assert_can_retrieve_accounts(
			pagination=Pagination(limit=1, offset=1),
			sorting=Sorting(field='BALANCE', order='DESC'),
			expected_accounts=[EXPECTED_ACCOUNT_1]
		)

	def test_can_retrieve_accounts_sorted_by_balance_asc(self):
		self._assert_can_retrieve_accounts(
			pagination=Pagination(limit=10, offset=0),
			sorting=Sorting(field='BALANCE', order='ASC'),
			expected_accounts=[EXPECTED_ACCOUNT_1, EXPECTED_ACCOUNT_2]
		)

	def test_can_retrieve_accounts_sorted_by_balance_desc(self):
		self._assert_can_retrieve_accounts(
			pagination=Pagination(limit=10, offset=0),
			sorting=Sorting(field='BALANCE', order='DESC'),
			expected_accounts=[EXPECTED_ACCOUNT_2, EXPECTED_ACCOUNT_1]
		)

	def test_can_retrieve_harvesting_accounts(self):
		self._assert_can_retrieve_accounts(
			pagination=Pagination(limit=10, offset=0),
			sorting=Sorting(field='BALANCE', order='DESC'),
			expected_accounts=[EXPECTED_ACCOUNT_2],
			is_harvesting=True
		)
	# endregion
