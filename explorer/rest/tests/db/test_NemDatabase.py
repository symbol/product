from rest import Pagination, Sorting
from rest.db.NemDatabase import NemDatabase
from rest.model.Transaction import TransactionQuery

from ..test.DatabaseTestUtils import (
	ACCOUNT_VIEWS,
	ACCOUNTS,
	BLOCK_VIEWS,
	MOSAIC_RICH_LIST_VIEWS,
	MOSAIC_VIEWS,
	NAMESPACE_VIEWS,
	TRANSACTIONS,
	TRANSACTIONS_VIEWS,
	DatabaseTestBase
)

# region test data

EXPECTED_BLOCK_VIEW_1 = BLOCK_VIEWS[0]

EXPECTED_BLOCK_VIEW_2 = BLOCK_VIEWS[1]

EXPECTED_ACCOUNT_VIEW_1 = ACCOUNT_VIEWS[0]

EXPECTED_ACCOUNT_VIEW_2 = ACCOUNT_VIEWS[1]

EXPECTED_NAMESPACE_VIEW_1 = NAMESPACE_VIEWS[0]

EXPECTED_NAMESPACE_VIEW_2 = NAMESPACE_VIEWS[1]

EXPECTED_NAMESPACE_VIEW_3 = NAMESPACE_VIEWS[2]

EXPECTED_MOSAIC_VIEW_1 = MOSAIC_VIEWS[0]

EXPECTED_MOSAIC_VIEW_2 = MOSAIC_VIEWS[1]

EXPECTED_MOSAIC_VIEW_3 = MOSAIC_VIEWS[2]

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
		self._assert_can_query_namespace_by_name('root', EXPECTED_NAMESPACE_VIEW_2)

	def test_can_query_namespace_by_sub_namespace(self):
		self._assert_can_query_namespace_by_name('root_sub.sub_1', EXPECTED_NAMESPACE_VIEW_3)

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
		self._assert_can_query_namespaces_with_filter(Pagination(1, 1), 'desc', [EXPECTED_NAMESPACE_VIEW_3])

	def test_can_query_namespaces_sorted_by_registered_height_asc(self):
		self._assert_can_query_namespaces_with_filter(
			Pagination(10, 0),
			'asc',
			[EXPECTED_NAMESPACE_VIEW_1, EXPECTED_NAMESPACE_VIEW_2, EXPECTED_NAMESPACE_VIEW_3]
		)

	def test_can_query_namespaces_sorted_by_registered_height_desc(self):
		self._assert_can_query_namespaces_with_filter(
			Pagination(10, 0),
			'desc',
			[EXPECTED_NAMESPACE_VIEW_2, EXPECTED_NAMESPACE_VIEW_3, EXPECTED_NAMESPACE_VIEW_1]
		)

	# endregion

	# region mosaic

	def _assert_can_query_mosaic_by_name(self, namespace_name, expected_mosaic):
		# Act:
		mosaic_view = self.nem_db.get_mosaic_by_name(namespace_name)

		# Assert:
		self.assertEqual(expected_mosaic, mosaic_view)

	def test_can_query_mosaic_by_namespace_name(self):
		self._assert_can_query_mosaic_by_name('root.mosaic', EXPECTED_MOSAIC_VIEW_2)

	def test_cannot_query_nonexistent_mosaic(self):
		self._assert_can_query_mosaic_by_name('nonexistent', None)

	# endregion

	# region mosaics

	def _assert_can_query_mosaics_with_filter(self, pagination, sort, expected_mosaics):
		# Act:
		mosaics_view = self.nem_db.get_mosaics(pagination, sort)

		# Assert:
		self.assertEqual(expected_mosaics, mosaics_view)

	def test_can_query_mosaics_filtered_limit_offset_0(self):
		self._assert_can_query_mosaics_with_filter(Pagination(1, 0), 'desc', [EXPECTED_MOSAIC_VIEW_2])

	def test_can_query_mosaics_filtered_offset_1(self):
		self._assert_can_query_mosaics_with_filter(Pagination(1, 1), 'desc', [EXPECTED_MOSAIC_VIEW_3])

	def test_can_query_mosaics_sorted_by_registered_height_asc(self):
		self._assert_can_query_mosaics_with_filter(
			Pagination(10, 0),
			'asc',
			[EXPECTED_MOSAIC_VIEW_1, EXPECTED_MOSAIC_VIEW_2, EXPECTED_MOSAIC_VIEW_3]
		)

	def test_can_query_mosaics_sorted_by_registered_height_desc(self):
		self._assert_can_query_mosaics_with_filter(
			Pagination(10, 0),
			'desc',
			[EXPECTED_MOSAIC_VIEW_2, EXPECTED_MOSAIC_VIEW_3, EXPECTED_MOSAIC_VIEW_1]
		)

	# endregion

	# region mosaic rich list

	def _assert_can_query_mosaic_rich_list_with_filter(self, pagination, namespace_name, expected_mosaic_rich_list):
		# Act:
		mosaic_rich_list_view = self.nem_db.get_mosaic_rich_list(pagination, namespace_name)

		# Assert:
		self.assertEqual(expected_mosaic_rich_list, mosaic_rich_list_view)

	def test_can_query_mosaic_rich_list_by_name(self):
		self._assert_can_query_mosaic_rich_list_with_filter(Pagination(10, 0), 'nem.xem', [MOSAIC_RICH_LIST_VIEWS[1], MOSAIC_RICH_LIST_VIEWS[0]])

	def test_can_query_mosaic_rich_list_with_limit_offset(self):
		self._assert_can_query_mosaic_rich_list_with_filter(Pagination(1, 0), 'nem.xem', [MOSAIC_RICH_LIST_VIEWS[1]])

	def test_can_query_mosaic_rich_list_filtered_offset_1(self):
		self._assert_can_query_mosaic_rich_list_with_filter(Pagination(1, 1), 'nem.xem', [MOSAIC_RICH_LIST_VIEWS[0]])

	# endregion

	# region transaction

	def test_can_query_transfer_by_hash(self):
		# Act:
		transaction_view = self.nem_db.get_transaction_by_hash('0' * 63 + '1')

		# Assert:
		self.assertEqual(TRANSACTIONS_VIEWS[0], transaction_view)

	def test_can_query_transfer_v2_by_hash(self):
		# Act:
		transaction_view = self.nem_db.get_transaction_by_hash('0' * 63 + '2')

		# Assert:
		self.assertEqual(TRANSACTIONS_VIEWS[1], transaction_view)

	def test_can_query_account_link_by_hash(self):
		# Act:
		transaction_view = self.nem_db.get_transaction_by_hash('0' * 63 + '3')

		# Assert:
		self.assertEqual(TRANSACTIONS_VIEWS[2], transaction_view)

	def test_can_query_multisig_account_modification_by_hash(self):
		# Act:
		transaction_view = self.nem_db.get_transaction_by_hash('0' * 63 + '4')

		# Assert:
		self.assertEqual(TRANSACTIONS_VIEWS[3], transaction_view)

	def test_can_query_multisig_by_hash(self):
		# Act:
		transaction_view = self.nem_db.get_transaction_by_hash('0' * 63 + '5')

		# Assert:
		self.assertEqual(TRANSACTIONS_VIEWS[4], transaction_view)

	def test_can_query_namespace_registration_by_hash(self):
		# Act:
		transaction_view = self.nem_db.get_transaction_by_hash('0' * 63 + '7')

		# Assert:
		self.assertEqual(TRANSACTIONS_VIEWS[5], transaction_view)

	def test_can_query_mosaic_definition_by_hash(self):
		# Act:
		transaction_view = self.nem_db.get_transaction_by_hash('0' * 63 + '8')

		# Assert:
		self.assertEqual(TRANSACTIONS_VIEWS[6], transaction_view)

	def test_can_query_mosaic_supply_change_by_hash(self):
		# Act:
		transaction_view = self.nem_db.get_transaction_by_hash('0' * 63 + '9')

		# Assert:
		self.assertEqual(TRANSACTIONS_VIEWS[7], transaction_view)

	# endregion

	# region transactions

	@staticmethod
	def _make_transaction_query(**kwargs):
		defaults = TransactionQuery(
			height=None,
			transaction_types=None,
			sender=None,
			address=None,
			sender_address=None,
			recipient_address=None,
			mosaic=None
		)
		return defaults._replace(**kwargs)

	def _assert_can_query_transactions_with_filter(self, pagination, sort, transaction_query, expected_transactions):
		# Act:
		transactions_view = self.nem_db.get_transactions(pagination, sort, transaction_query)

		# Assert:
		self.assertEqual(expected_transactions, transactions_view)

	def test_can_query_transactions_filtered_limit_offset_0(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(1, 0), 'desc', self._make_transaction_query(), [TRANSACTIONS_VIEWS[2]]
		)

	def test_can_query_transactions_filtered_limit_offset_1(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(2, 1), 'desc', self._make_transaction_query(), [TRANSACTIONS_VIEWS[2], TRANSACTIONS_VIEWS[4]]
		)

	def test_can_query_transactions_sorted_by_height_asc(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'asc', self._make_transaction_query(), list(TRANSACTIONS_VIEWS)
		)

	def test_can_query_transactions_sorted_by_height_desc(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(3, 0), 'desc', self._make_transaction_query(),
			[TRANSACTIONS_VIEWS[3], TRANSACTIONS_VIEWS[2], TRANSACTIONS_VIEWS[4]]
		)

	def test_can_query_transactions_filtered_by_height(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(height=1),
			[TRANSACTIONS_VIEWS[0], TRANSACTIONS_VIEWS[1]]
		)

	def test_can_query_transactions_filtered_by_nonexistent_height(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(height=999), []
		)

	def test_can_query_transactions_filtered_by_multiple_transaction_types(self):
		# TRANSFER (257) + ACCOUNT_KEY_LINK (2049)
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc',
			self._make_transaction_query(transaction_types=[257, 2049]),
			[TRANSACTIONS_VIEWS[2], TRANSACTIONS_VIEWS[0], TRANSACTIONS_VIEWS[1]]
		)

	def test_can_query_transactions_filtered_by_address_as_sender(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(2, 0), 'desc', self._make_transaction_query(address=TRANSACTIONS[2].sender_address),
			[TRANSACTIONS_VIEWS[2]]
		)

	def test_can_query_transactions_filtered_by_address_as_recipient(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(address=TRANSACTIONS[0].recipient_address),
			[TRANSACTIONS_VIEWS[5], TRANSACTIONS_VIEWS[6], TRANSACTIONS_VIEWS[0], TRANSACTIONS_VIEWS[1]]
		)

	def test_can_query_transactions_filtered_by_sender_address(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(sender_address=TRANSACTIONS[2].sender_address),
			[TRANSACTIONS_VIEWS[2]]
		)

	def test_can_query_transactions_filtered_by_recipient_address(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(recipient_address=TRANSACTIONS[0].recipient_address),
			[TRANSACTIONS_VIEWS[5], TRANSACTIONS_VIEWS[6], TRANSACTIONS_VIEWS[0], TRANSACTIONS_VIEWS[1]]
		)

	def test_can_query_transactions_filtered_by_sender_public_key(self):
		sender = self.network.public_key_to_address(TRANSACTIONS[2].sender_public_key)
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(sender=sender),
			[TRANSACTIONS_VIEWS[2]]
		)

	def test_can_query_transactions_filtered_by_mosaic_nem_xem(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(mosaic='nem.xem'),
			[TRANSACTIONS_VIEWS[0], TRANSACTIONS_VIEWS[1]]
		)

	def test_can_query_transactions_filtered_by_mosaic_other(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(mosaic='root.mosaic'),
			[TRANSACTIONS_VIEWS[1]]
		)

	def test_can_query_transactions_filtered_by_nonexistent_mosaic(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(mosaic='nonexistent.mosaic'), []
		)

	# endregion
