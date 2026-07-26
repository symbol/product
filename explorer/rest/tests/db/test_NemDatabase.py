# pylint: disable=unexpected-keyword-arg
from datetime import timedelta

from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address
from symbollightapi.model.Transaction import (
	AccountKeyLinkTransaction,
	CosignSignatureTransaction,
	Message,
	Modification,
	Mosaic,
	MosaicDefinitionTransaction,
	MosaicLevy,
	MosaicProperties,
	MosaicSupplyChangeTransaction,
	MultisigAccountModificationTransaction,
	MultisigTransaction,
	NamespaceRegistrationTransaction,
	TransferTransaction
)

from rest import Pagination, Sorting
from rest.db.NemDatabase import NemDatabase
from rest.model.common import DEFAULT_HARVESTING_ACTIVE_WINDOW_DAYS
from rest.model.nem.Transaction import TransactionView

from ..test.DatabaseTestUtils import (
	ACCOUNT_STATISTIC_VIEW,
	ACCOUNT_STATISTIC_VIEW_WITHOUT_RECENT_HARVEST,
	ACCOUNT_VIEWS,
	ACCOUNTS,
	BLOCK_VIEWS,
	MOSAIC_RICH_LIST_VIEWS,
	MOSAIC_VIEWS,
	NAMESPACE_VIEWS,
	TRANSACTION_DAILY_STATISTIC_VIEW,
	TRANSACTION_MONTH_STATISTIC_VIEW,
	TRANSACTION_NAMES_FILTERED_BY_MULTISIG_INNER_SENDER,
	TRANSACTION_NAMES_SORTED_BY_HEIGHT_ASC,
	TRANSACTION_STATISTIC_VIEW,
	TRANSACTIONS,
	DatabaseTestBase,
	transaction_hash
)
from ..test.DatabaseTestUtils import transaction_view as expected_transaction_view
from ..test.DatabaseTestUtils import transaction_views

# region test data

HARVESTING_ACTIVE_WINDOW = timedelta(days=DEFAULT_HARVESTING_ACTIVE_WINDOW_DAYS)

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

NEM_CONNECTOR_UNCONFIRMED_TRANSACTIONS = [
	AccountKeyLinkTransaction(
		transaction_hash=None,
		height=0,
		sender=PublicKey('22df5f43ee3739a10c346b3ec2d3878668c5514696be425f9067d3a11c777f1d'),
		fee=150000,
		timestamp=73397,
		deadline=83397,
		signature='0' * 128,
		size=168,
		version=1,
		mode=1,
		remote_account=PublicKey('7195f4d7a40ad7e31958ae96c4afed002962229675a4cae8dc8a18e290618981')
	),
	TransferTransaction(
		transaction_hash=None,
		height=0,
		sender=PublicKey('22df5f43ee3739a10c346b3ec2d3878668c5514696be425f9067d3a11c777f1d'),
		fee=150000,
		timestamp=73397,
		deadline=83397,
		signature='0' * 128,
		size=202,
		version=2,
		amount=1999999,
		recipient=Address('NCOPERAWEWCD4A34NP5UQCCKEX44MW4SL3QYJYS5'),
		mosaics=[
			Mosaic(namespace_name='nem.xem', quantity=8000000),
			Mosaic(namespace_name='root.mosaic', quantity=20),
		],
		message=Message(
			payload='test message',
			type=1
		)
	),
	MultisigAccountModificationTransaction(
		transaction_hash=None,
		height=0,
		sender=PublicKey('22df5f43ee3739a10c346b3ec2d3878668c5514696be425f9067d3a11c777f1d'),
		fee=150000,
		timestamp=73397,
		deadline=83397,
		signature='0' * 128,
		size=220,
		version=1,
		min_cosignatories=2,
		modifications=[
			Modification(1, PublicKey('1fbdbdde28daf828245e4533765726f0b7790e0b7146e2ce205df3e86366980b')),
			Modification(1, PublicKey('f94e8702eb1943b23570b1b83be1b81536df35538978820e98bfce8f999e2d37'))
		]
	),
	NamespaceRegistrationTransaction(
		transaction_hash=None,
		height=0,
		sender=PublicKey('22df5f43ee3739a10c346b3ec2d3878668c5514696be425f9067d3a11c777f1d'),
		fee=150000,
		timestamp=73397,
		deadline=83397,
		signature='0' * 128,
		size=197,
		version=1,
		rental_fee_sink=Address('NAMESPACEWH4MKFMBCVFERDPOOP4FK7MTBXDPZZA'),
		rental_fee=100000000,
		parent=None,
		namespace='namespace'
	),
	MosaicDefinitionTransaction(
		transaction_hash=None,
		height=0,
		sender=PublicKey('22df5f43ee3739a10c346b3ec2d3878668c5514696be425f9067d3a11c777f1d'),
		fee=150000,
		timestamp=73397,
		deadline=83397,
		signature='0' * 128,
		size=464,
		version=1,
		creation_fee=10000000,
		creation_fee_sink=Address('NBMOSAICOD4F54EE5CDMR23CCBGOAM2XSIUX6TRS'),
		creator=PublicKey('22df5f43ee3739a10c346b3ec2d3878668c5514696be425f9067d3a11c777f1d'),
		description='NEM namespace test',
		properties=MosaicProperties(4, 3100000, False, True),
		levy=MosaicLevy(500, Address('NBRYCNWZINEVNITUESKUMFIENWKYCRUGNFZV25AV'), 1, 'nem.xem'),
		namespace_name='namespace.test'
	),
	MosaicSupplyChangeTransaction(
		transaction_hash=None,
		height=0,
		sender=PublicKey('22df5f43ee3739a10c346b3ec2d3878668c5514696be425f9067d3a11c777f1d'),
		fee=150000,
		timestamp=73397,
		deadline=83397,
		signature='0' * 128,
		size=165,
		version=1,
		supply_type=2,
		delta=500000,
		namespace_name='namespace.test'
	),
	MultisigTransaction(
		transaction_hash=None,
		height=0,
		sender=PublicKey('aa455d831430872feb0c6ae14265209182546c985a321c501be7fdc96ed04757'),
		fee=500000,
		timestamp=73397,
		deadline=83397,
		signature='0' * 128,
		size=468,
		version=1,
		signatures=[
			CosignSignatureTransaction(
				timestamp=261593985,
				other_hash='0' * 64,
				other_account=Address('NAGJG3QFWYZ37LMI7IQPSGQNYADGSJZGJRD2DIYA'),
				sender=PublicKey('ae6754c70b7e3ba0c51617c8f9efd462d0bf680d45e09c3444e817643d277826'),
				fee=500000,
				deadline=261680385,
				signature='0' * 128
			)
		],
		other_transaction=TransferTransaction(
			transaction_hash=None,
			height=None,
			sender=PublicKey('fbae41931de6a0cc25153781321f3de0806c7ba9a191474bb9a838118c8de4d3'),
			fee=750000,
			timestamp=73397,
			deadline=83397,
			signature=None,
			size=184,
			version=1,
			amount=150000000000,
			recipient=Address('NBUH72UCGBIB64VYTAAJ7QITJ62BLISFFQOHVP65'),
			mosaics=None,
			message=None
		),
		inner_hash='0' * 64
	)
]


def _create_unconfirmed_transaction_view(transaction_type, to_address, value, size, version=1):
	return TransactionView(
		transaction_hash=None,
		transaction_type=transaction_type,
		from_address='NBKQWJJGPOHL462DBVMTYOAERXGG2BOS5WFSIGHT',
		to_address=to_address,
		value=value,
		embedded_transactions=None,
		fee=0.15,
		height=0,
		timestamp='2015-03-29 20:29:42',
		deadline='2015-03-29 23:16:22',
		signature='0' * 128,
		size=size,
		version=version
	)


UNCONFIRMED_TRANSACTION_VIEWS = [
	_create_unconfirmed_transaction_view(
		transaction_type='ACCOUNT_KEY_LINK',
		to_address=None,
		value=[
			{
				'mode': 1,
				'remoteAccount': '7195F4D7A40AD7E31958AE96C4AFED002962229675A4CAE8DC8A18E290618981',
				'remoteAddress': 'NCC4NPREMOSTSKVODMW3T7OWDL4SRBT5BMHMRAPF'
			}
		],
		size=168
	),
	_create_unconfirmed_transaction_view(
		transaction_type='TRANSFER',
		to_address='NCOPERAWEWCD4A34NP5UQCCKEX44MW4SL3QYJYS5',
		value=[
			{
				'message': {
					'type': 1,
					'payload': 'test message'
				}
			},
			{
				'namespace': 'nem.xem',
				'amount': 15.999992
			},
			{
				'namespace': 'root.mosaic',
				'amount': 39.0
			}
		],
		size=202,
		version=2
	),
	_create_unconfirmed_transaction_view(
		transaction_type='MULTISIG_ACCOUNT_MODIFICATION',
		to_address=None,
		value=[{
			'minCosignatories': 2,
			'modifications': [
				{
					'cosignatoryAccount': 'NADMEHCFJD45GPTDL4HZP2LJLZVAZRLYWYPNEMLY',
					'modificationType': 1
				},
				{
					'cosignatoryAccount': 'NANIBAXPVLBP37YXSGREVD77NXIFZML5FDE7F3ZN',
					'modificationType': 1
				}
			]
		}],
		size=220
	),
	_create_unconfirmed_transaction_view(
		transaction_type='NAMESPACE_REGISTRATION',
		to_address='NAMESPACEWH4MKFMBCVFERDPOOP4FK7MTBXDPZZA',
		value=[{
			'sinkFee': 100.0,
			'parent': None,
			'namespaceName': 'namespace'
		}],
		size=197
	),
	_create_unconfirmed_transaction_view(
		transaction_type='MOSAIC_DEFINITION',
		to_address='NBMOSAICOD4F54EE5CDMR23CCBGOAM2XSIUX6TRS',
		value=[{
			'sinkFee': 10.0,
			'mosaicNamespaceName': 'namespace.test'
		}],
		size=464
	),
	_create_unconfirmed_transaction_view(
		transaction_type='MOSAIC_SUPPLY_CHANGE',
		to_address=None,
		value=[{
			'supplyType': 2,
			'delta': 500000,
			'namespaceName': 'namespace.test'
		}],
		size=165
	),
	TransactionView(
		transaction_hash=None,
		transaction_type='MULTISIG',
		from_address='NAGJG3QFWYZ37LMI7IQPSGQNYADGSJZGJRD2DIYA',
		to_address='NBUH72UCGBIB64VYTAAJ7QITJ62BLISFFQOHVP65',
		value=None,
		embedded_transactions=[{
			'initiator': 'NCTWKWGD564GIQQCZ5X5TC4YM46VXWLT3QWD5NLZ',
			'transactionHash': None,
			'transactionType': 'TRANSFER',
			'signatures': [{
				'fee': 0.5,
				'signature': '0' * 128,
				'signer': 'NBEM6SFOHU5PORIGAVG3NNJIMCG73R2TWEEIDAZ5'
			}],
			'fee': 0.75,
			'value': [{
				'namespace': 'nem.xem',
				'amount': 150000.0
			}]
		}],
		fee=0.5,
		height=0,
		timestamp='2015-03-29 20:29:42',
		deadline='2015-03-29 23:16:22',
		signature='0' * 128,
		size=468,
		version=1
	)
]

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

	def _advance_chain_tip(self, timestamp_offset):
		"""Appends a block to the chain tip, offset from the current tip timestamp."""

		with self.nem_db.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(
				'''
				INSERT INTO blocks (height, timestamp, total_fee, total_transactions, difficulty, hash, beneficiary, signer, signature, size)
				SELECT height + 1, timestamp + %s, total_fee, total_transactions, difficulty, hash, beneficiary, signer, signature, size
				FROM blocks WHERE height = (SELECT MAX(height) FROM blocks)
				''',
				(timestamp_offset,))
			connection.commit()

	def test_can_query_accounts_filtered_limit(self):
		self._assert_can_query_accounts(Pagination(1, 0), Sorting('BALANCE', 'desc'), [EXPECTED_ACCOUNT_VIEW_2])

	def test_can_query_accounts_filtered_offset(self):
		self._assert_can_query_accounts(Pagination(1, 1), Sorting('BALANCE', 'desc'), [EXPECTED_ACCOUNT_VIEW_1])

	def test_can_query_accounts_filtered_is_harvesting(self):
		self._assert_can_query_accounts(Pagination(10, 0), Sorting('BALANCE', 'desc'), [EXPECTED_ACCOUNT_VIEW_2], is_harvesting=True)

	def test_can_query_accounts_filtered_is_harvesting_includes_harvest_at_window_boundary(self):
		# Arrange: the block harvested by the account is exactly the oldest one still inside the window
		self._advance_chain_tip(HARVESTING_ACTIVE_WINDOW)

		# Act + Assert:
		self._assert_can_query_accounts(Pagination(10, 0), Sorting('BALANCE', 'desc'), [EXPECTED_ACCOUNT_VIEW_2], is_harvesting=True)

	def test_can_query_accounts_filtered_is_harvesting_excludes_harvest_older_than_window(self):
		# Arrange: one second more pushes that block out of the window
		self._advance_chain_tip(HARVESTING_ACTIVE_WINDOW + timedelta(seconds=1))

		# Act + Assert:
		self._assert_can_query_accounts(Pagination(10, 0), Sorting('BALANCE', 'desc'), [], is_harvesting=True)

	def test_can_query_accounts_reports_stale_harvester_as_not_harvesting_active(self):
		# Arrange:
		self._advance_chain_tip(HARVESTING_ACTIVE_WINDOW + timedelta(seconds=1))

		# Act:
		accounts_view = self.nem_db.get_accounts(Pagination(10, 0), Sorting('BALANCE', 'desc'), False)

		# Assert:
		self.assertEqual([False, False], [account.is_harvesting_active for account in accounts_view])

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
		transaction_view = self.nem_db.get_transaction_by_hash(transaction_hash('transfer'))

		# Assert:
		self.assertEqual(expected_transaction_view('transfer'), transaction_view)

	def test_can_query_transfer_v2_by_hash(self):
		# Act:
		transaction_view = self.nem_db.get_transaction_by_hash(transaction_hash('transfer_v2'))

		# Assert:
		self.assertEqual(expected_transaction_view('transfer_v2'), transaction_view)

	def test_can_query_account_link_by_hash(self):
		# Act:
		transaction_view = self.nem_db.get_transaction_by_hash(transaction_hash('account_key_link'))

		# Assert:
		self.assertEqual(expected_transaction_view('account_key_link'), transaction_view)

	def test_can_query_multisig_account_modification_by_hash(self):
		# Act:
		transaction_view = self.nem_db.get_transaction_by_hash(transaction_hash('multisig_account_modification'))

		# Assert:
		self.assertEqual(expected_transaction_view('multisig_account_modification'), transaction_view)

	def test_can_query_multisig_by_hash(self):
		# Act:
		transaction_view = self.nem_db.get_transaction_by_hash(transaction_hash('multisig'))

		# Assert:
		self.assertEqual(expected_transaction_view('multisig'), transaction_view)

	def test_can_query_namespace_registration_by_hash(self):
		# Act:
		transaction_view = self.nem_db.get_transaction_by_hash(transaction_hash('namespace_registration'))

		# Assert:
		self.assertEqual(expected_transaction_view('namespace_registration'), transaction_view)

	def test_can_query_mosaic_definition_by_hash(self):
		# Act:
		transaction_view = self.nem_db.get_transaction_by_hash(transaction_hash('mosaic_definition'))

		# Assert:
		self.assertEqual(expected_transaction_view('mosaic_definition'), transaction_view)

	def test_can_query_mosaic_supply_change_by_hash(self):
		# Act:
		transaction_view = self.nem_db.get_transaction_by_hash(transaction_hash('mosaic_supply_change'))

		# Assert:
		self.assertEqual(expected_transaction_view('mosaic_supply_change'), transaction_view)

	# endregion

	# region account statistics

	def test_can_query_account_statistics(self):
		# Act:
		account_statistics = self.nem_db.get_account_statistics()

		# Assert:
		self.assertEqual(ACCOUNT_STATISTIC_VIEW, account_statistics)

	def test_can_query_account_statistics_excluding_harvests_older_than_activity_window(self):
		# Arrange:
		self._advance_chain_tip(HARVESTING_ACTIVE_WINDOW + timedelta(seconds=1))

		# Act:
		account_statistics = self.nem_db.get_account_statistics()

		# Assert:
		self.assertEqual(ACCOUNT_STATISTIC_VIEW_WITHOUT_RECENT_HARVEST, account_statistics)

	# endregion

	# region transaction statistics

	def test_can_query_transaction_statistics(self):
		# Act:
		transaction_statistics = self.nem_db.get_transaction_statistics()

		# Assert:
		self.assertEqual(TRANSACTION_STATISTIC_VIEW, transaction_statistics)

	def test_can_query_transaction_statistics_grouped_daily(self):
		# Act:
		transaction_statistics = self.nem_db.get_transaction_statistics_by_date_range('2015-03-29', '2015-03-29', 'DAY')

		# Assert:
		self.assertEqual(TRANSACTION_DAILY_STATISTIC_VIEW, transaction_statistics)

	def test_can_query_transaction_statistics_grouped_month(self):
		# Act:
		transaction_statistics = self.nem_db.get_transaction_statistics_by_date_range('2015-03-01', '2015-03-31', 'MONTH')

		# Assert:
		self.assertEqual(TRANSACTION_MONTH_STATISTIC_VIEW, transaction_statistics)
	# region transactions

	def _assert_can_query_transactions_with_filter(self, pagination, sort, transaction_query, expected_transaction_names):
		# Act:
		transactions_view = self.nem_db.get_transactions(pagination, sort, transaction_query)

		# Assert:
		self.assertEqual(transaction_views(*expected_transaction_names), transactions_view)

	def test_can_query_transactions_filtered_limit_offset_0(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(1, 0), 'desc', self._make_transaction_query(), ('account_key_link', )
		)

	def test_can_query_transactions_filtered_limit_offset_1(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(2, 1), 'desc', self._make_transaction_query(), ('account_key_link', 'multisig')
		)

	def test_can_query_transactions_sorted_by_height_asc(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'asc', self._make_transaction_query(), TRANSACTION_NAMES_SORTED_BY_HEIGHT_ASC
		)

	def test_can_query_transactions_sorted_by_height_desc(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(3, 0), 'desc', self._make_transaction_query(),
			('multisig_account_modification', 'account_key_link', 'multisig')
		)

	def test_can_query_transactions_filtered_by_height(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(height=1),
			('transfer', 'transfer_v2')
		)

	def test_can_query_transactions_filtered_by_nonexistent_height(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(height=999), ()
		)

	def test_can_query_transactions_filtered_by_multiple_transaction_types(self):
		# TRANSFER (257) + ACCOUNT_KEY_LINK (2049)
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc',
			self._make_transaction_query(transaction_types=[257, 2049]),
			('account_key_link', 'transfer', 'transfer_v2')
		)

	def test_can_query_transactions_filtered_by_address_as_sender(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(2, 0), 'desc', self._make_transaction_query(address=TRANSACTIONS[2].sender_address),
			('account_key_link', )
		)

	def test_can_query_transactions_filtered_by_address_as_recipient(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(address=TRANSACTIONS[0].recipient_address),
			('multisig', 'namespace_registration', 'mosaic_definition', 'transfer', 'transfer_v2')
		)

	def test_can_query_transactions_filtered_by_sender_address(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(sender_address=TRANSACTIONS[2].sender_address),
			('account_key_link', )
		)

	def test_can_query_transactions_filtered_by_recipient_address(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(recipient_address=TRANSACTIONS[0].recipient_address),
			('multisig', 'namespace_registration', 'mosaic_definition', 'transfer', 'transfer_v2')
		)

	def test_can_exclude_multisig_transaction_for_initiator_account_from_address_filter(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(address=TRANSACTIONS[4].sender_address), ()
		)
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(sender_address=TRANSACTIONS[4].sender_address), ()
		)

	def test_can_query_multisig_transaction_filtered_by_inner_sender_address(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc',
			self._make_transaction_query(sender_address=TRANSACTIONS[5].sender_address),
			TRANSACTION_NAMES_FILTERED_BY_MULTISIG_INNER_SENDER
		)

	def test_can_query_multisig_transaction_filtered_by_inner_recipient_address(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(recipient_address=TRANSACTIONS[5].recipient_address),
			('multisig', 'namespace_registration', 'mosaic_definition', 'transfer', 'transfer_v2')
		)

	def test_can_query_transactions_filtered_by_mosaic_nem_xem(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(mosaic='nem.xem'),
			('transfer', 'transfer_v2')
		)

	def test_can_query_transactions_filtered_by_mosaic_other(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(mosaic='root.mosaic'),
			('transfer_v2', )
		)

	def test_can_query_transactions_filtered_by_nonexistent_mosaic(self):
		self._assert_can_query_transactions_with_filter(
			Pagination(10, 0), 'desc', self._make_transaction_query(mosaic='nonexistent.mosaic'), ()
		)

	# endregion

	# region unconfirmed transactions

	def test_can_format_unconfirmed_transaction(self):
		# Act:
		unconfirmed_transaction_views = self.nem_db.get_unconfirmed_transactions(NEM_CONNECTOR_UNCONFIRMED_TRANSACTIONS)

		# Assert:
		self.assertEqual(UNCONFIRMED_TRANSACTION_VIEWS, unconfirmed_transaction_views)

	# endregion
