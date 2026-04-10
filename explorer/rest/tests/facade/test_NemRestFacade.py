import asyncio
from unittest.mock import patch

from symbollightapi.model.Exceptions import NodeException

from rest.facade.NemRestFacade import NemRestFacade
from rest.model.common import Pagination, RestConfig, Sorting

from ..test.DatabaseTestUtils import ACCOUNT_VIEWS, BLOCK_VIEWS, MOSAIC_VIEWS, NAMESPACE_VIEWS, DatabaseTestBase

# region test data

EXPECTED_BLOCK_1 = BLOCK_VIEWS[0].to_dict()

EXPECTED_BLOCK_2 = BLOCK_VIEWS[1].to_dict()

EXPECTED_ACCOUNT_1 = ACCOUNT_VIEWS[0].to_dict()

EXPECTED_ACCOUNT_2 = ACCOUNT_VIEWS[1].to_dict()

EXPECTED_NAMESPACE_1 = NAMESPACE_VIEWS[0].to_dict()

EXPECTED_NAMESPACE_2 = NAMESPACE_VIEWS[1].to_dict()

EXPECTED_MOSAIC_1 = MOSAIC_VIEWS[0].to_dict()

EXPECTED_MOSAIC_2 = MOSAIC_VIEWS[1].to_dict()

# endregion


class TestNemRestFacade(DatabaseTestBase):  # pylint: disable=too-many-public-methods
	def setUp(self):
		super().setUp()
		self.nem_rest_facade = NemRestFacade(self.db_config, RestConfig(
			network_name='mainnet',
			node_url='http://localhost:7890',
			max_lag_blocks=2
		))

	# region block

	def _assert_can_retrieve_block(self, height, expected_block):
		# Act:
		block = self.nem_rest_facade.get_block(height)

		# Assert:
		self.assertEqual(expected_block, block)

	def test_retrieve_block_by_height(self):
		self._assert_can_retrieve_block(1, EXPECTED_BLOCK_1)

	def test_returns_none_for_nonexistent_block(self):
		self._assert_can_retrieve_block(3, None)

	# endregion

	# region blocks

	def _assert_can_retrieve_blocks(self, pagination, min_height, sort, expected_blocks):
		# Act:
		blocks = self.nem_rest_facade.get_blocks(pagination=pagination, min_height=min_height, sort=sort)

		# Assert:
		self.assertEqual(expected_blocks, blocks)

	def test_blocks_filtered_by_limit(self):
		self._assert_can_retrieve_blocks(Pagination(1, 0), 0, 'desc', [EXPECTED_BLOCK_2])

	def test_blocks_filtered_by_offset(self):
		self._assert_can_retrieve_blocks(Pagination(1, 1), 0, 'desc', [EXPECTED_BLOCK_1])

	def test_blocks_filtered_by_min_height(self):
		self._assert_can_retrieve_blocks(Pagination(10, 0), 2, 'desc', [EXPECTED_BLOCK_2])

	def test_returns_empty_list_on_no_matches(self):
		self._assert_can_retrieve_blocks(Pagination(10, 0), 3, 'desc', [])

	def test_blocks_sorted_by_height_asc(self):
		self._assert_can_retrieve_blocks(Pagination(10, 0), 0, 'asc', [EXPECTED_BLOCK_1, EXPECTED_BLOCK_2])

	def test_blocks_sorted_by_height_desc(self):
		self._assert_can_retrieve_blocks(Pagination(10, 0), 0, 'desc', [EXPECTED_BLOCK_2, EXPECTED_BLOCK_1])

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

	# endregion

	# region accounts

	def _assert_can_retrieve_accounts(self, pagination, sorting, expected_accounts, is_harvesting=False):
		# Act:
		accounts = self.nem_rest_facade.get_accounts(pagination, sorting, is_harvesting)

		# Assert:
		self.assertEqual(expected_accounts, accounts)

	def test_can_retrieve_accounts_filtered_by_limit(self):
		self._assert_can_retrieve_accounts(
			pagination=Pagination(1, 0),
			sorting=Sorting(field='BALANCE', order='DESC'),
			expected_accounts=[EXPECTED_ACCOUNT_2]
		)

	def test_can_retrieve_accounts_filtered_by_offset(self):
		self._assert_can_retrieve_accounts(
			pagination=Pagination(1, 1),
			sorting=Sorting(field='BALANCE', order='DESC'),
			expected_accounts=[EXPECTED_ACCOUNT_1]
		)

	def test_can_retrieve_accounts_sorted_by_balance_asc(self):
		self._assert_can_retrieve_accounts(
			pagination=Pagination(10, 0),
			sorting=Sorting(field='BALANCE', order='ASC'),
			expected_accounts=[EXPECTED_ACCOUNT_1, EXPECTED_ACCOUNT_2]
		)

	def test_can_retrieve_accounts_sorted_by_balance_desc(self):
		self._assert_can_retrieve_accounts(
			pagination=Pagination(10, 0),
			sorting=Sorting(field='BALANCE', order='DESC'),
			expected_accounts=[EXPECTED_ACCOUNT_2, EXPECTED_ACCOUNT_1]
		)

	def test_can_retrieve_harvesting_accounts(self):
		self._assert_can_retrieve_accounts(
			pagination=Pagination(10, 0),
			sorting=Sorting(field='BALANCE', order='DESC'),
			expected_accounts=[EXPECTED_ACCOUNT_2],
			is_harvesting=True
		)

	# endregion

	# region health

	@patch('rest.facade.NemRestFacade.NemConnector.chain_height')
	def test_can_retrieve_health(self, mock_chain_height):
		# Arrange:
		mock_chain_height.return_value = 2

		# Act:
		result = asyncio.run(self.nem_rest_facade.get_health())

		# Assert:
		self.assertTrue(result['isHealthy'])
		self.assertTrue(result['nodeUp'])
		self.assertEqual(2, result['nodeHeight'])
		self.assertTrue(result['backendSynced'])
		self.assertEqual(EXPECTED_BLOCK_2['timestamp'], result['lastDBSyncedAt'])
		self.assertEqual(EXPECTED_BLOCK_2['height'], result['lastDBHeight'])
		self.assertEqual([], result['errors'])

	@patch('rest.facade.NemRestFacade.NemConnector.chain_height')
	def test_can_retrieve_health_with_node_sync_lag(self, mock_chain_height):
		# Arrange:
		mock_chain_height.return_value = 5

		# Act:
		result = asyncio.run(self.nem_rest_facade.get_health())

		# Assert:
		self.assertFalse(result['isHealthy'])
		self.assertTrue(result['nodeUp'])
		self.assertEqual(5, result['nodeHeight'])
		self.assertFalse(result['backendSynced'])
		self.assertEqual(EXPECTED_BLOCK_2['timestamp'], result['lastDBSyncedAt'])
		self.assertEqual(EXPECTED_BLOCK_2['height'], result['lastDBHeight'])
		self.assertEqual([{'type': 'synchronization', 'message': 'Database is 3 blocks behind node height'}], result['errors'])

	@patch('rest.facade.NemRestFacade.NemConnector.chain_height')
	def test_can_retrieve_health_with_node_exception(self, mock_chain_height):
		# Arrange:
		mock_chain_height.side_effect = NodeException('Connection refused')

		# Act:
		result = asyncio.run(self.nem_rest_facade.get_health())

		# Assert:
		self.assertFalse(result['isHealthy'])
		self.assertFalse(result['nodeUp'])
		self.assertIsNone(result['nodeHeight'])
		self.assertFalse(result['backendSynced'])
		self.assertEqual(EXPECTED_BLOCK_2['timestamp'], result['lastDBSyncedAt'])
		self.assertEqual(EXPECTED_BLOCK_2['height'], result['lastDBHeight'])
		self.assertEqual([{'type': 'synchronization', 'message': 'Connection refused'}], result['errors'])

	# endregion

	# region namespace

	def _assert_can_retrieve_namespace_by_name(self, name, expected_namespace):
		# Act:
		namespace = self.nem_rest_facade.get_namespace_by_name(name)

		# Assert:
		self.assertEqual(expected_namespace, namespace)

	def test_can_retrieve_namespace_by_root_namespace_name(self):
		self._assert_can_retrieve_namespace_by_name(name='root', expected_namespace=EXPECTED_NAMESPACE_1)

	def test_can_retrieve_namespace_by_sub_namespace_name(self):
		self._assert_can_retrieve_namespace_by_name(name='root_sub.sub_1', expected_namespace=EXPECTED_NAMESPACE_2)

	def test_returns_none_for_nonexistent_namespace_name(self):
		self._assert_can_retrieve_namespace_by_name(name='nonexistent', expected_namespace=None)

	# endregion

	# region namespaces

	def _assert_can_retrieve_namespaces(self, pagination, sort, expected_namespaces):
		# Act:
		namespaces = self.nem_rest_facade.get_namespaces(pagination, sort)

		# Assert:
		self.assertEqual(expected_namespaces, namespaces)

	def test_can_retrieve_namespaces_filtered_by_limit(self):
		self._assert_can_retrieve_namespaces(
			pagination=Pagination(1, 0),
			sort='DESC',
			expected_namespaces=[EXPECTED_NAMESPACE_2]
		)

	def test_can_retrieve_namespaces_filtered_by_offset(self):
		self._assert_can_retrieve_namespaces(
			pagination=Pagination(1, 1),
			sort='DESC',
			expected_namespaces=[EXPECTED_NAMESPACE_1]
		)

	def test_can_retrieve_namespaces_sorted_by_registered_height_asc(self):
		self._assert_can_retrieve_namespaces(
			pagination=Pagination(10, 0),
			sort='ASC',
			expected_namespaces=[EXPECTED_NAMESPACE_1, EXPECTED_NAMESPACE_2]
		)

	def test_can_retrieve_namespaces_sorted_by_registered_height_desc(self):
		self._assert_can_retrieve_namespaces(
			pagination=Pagination(10, 0),
			sort='DESC',
			expected_namespaces=[EXPECTED_NAMESPACE_2, EXPECTED_NAMESPACE_1]
		)

	# endregion

	# region mosaic

	def _assert_can_retrieve_mosaic_by_namespace_name(self, namespace_name, expected_mosaic):
		# Act:
		mosaic = self.nem_rest_facade.get_mosaic_by_name(namespace_name)

		# Assert:
		self.assertEqual(expected_mosaic, mosaic)

	def test_can_retrieve_mosaic_by_namespace_name(self):
		self._assert_can_retrieve_mosaic_by_namespace_name(namespace_name='root.mosaic', expected_mosaic=EXPECTED_MOSAIC_1)

	def test_returns_none_for_nonexistent_mosaic_namespace_name(self):
		self._assert_can_retrieve_mosaic_by_namespace_name(namespace_name='nonexistent', expected_mosaic=None)

	# endregion

	# region mosaics

	def _assert_can_retrieve_mosaics(self, pagination, sort, expected_mosaics):
		# Act:
		mosaics = self.nem_rest_facade.get_mosaics(pagination, sort)

		# Assert:
		self.assertEqual(expected_mosaics, mosaics)

	def test_can_retrieve_mosaics_filtered_by_limit(self):
		self._assert_can_retrieve_mosaics(
			pagination=Pagination(1, 0),
			sort='DESC',
			expected_mosaics=[EXPECTED_MOSAIC_2]
		)

	def test_can_retrieve_mosaics_filtered_by_offset(self):
		self._assert_can_retrieve_mosaics(
			pagination=Pagination(1, 1),
			sort='DESC',
			expected_mosaics=[EXPECTED_MOSAIC_1]
		)

	def test_can_retrieve_mosaics_sorted_by_registered_height_asc(self):
		self._assert_can_retrieve_mosaics(
			pagination=Pagination(10, 0),
			sort='ASC',
			expected_mosaics=[EXPECTED_MOSAIC_1, EXPECTED_MOSAIC_2]
		)

	def test_can_retrieve_mosaics_sorted_by_registered_height_desc(self):
		self._assert_can_retrieve_mosaics(
			pagination=Pagination(10, 0),
			sort='DESC',
			expected_mosaics=[EXPECTED_MOSAIC_2, EXPECTED_MOSAIC_1]
		)

	# endregion
