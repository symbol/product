import datetime
import unittest

import psycopg2
import testing.postgresql
from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address
from symbollightapi.model.Transaction import Mosaic
from test_DatabaseConnection import DatabaseConfig

from puller.db.NemDatabase import NemDatabase
from puller.facade.NemPuller import AccountRecord, BlockRecord, MosaicRecord, NamespaceRecord, TransactionRecord

# region test data

BLOCKS = [
	BlockRecord(
		1,
		'2015-03-29 00:06:25+00:00',  # UTC timestamp from convert_timestamp_to_datetime
		102000000,
		5,
		100000000000000,
		'438cf6375dab5a0d32f9b7bf151d4539e00a590f7c022d5572c7d41815a24be4',
		Address('TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I'),
		PublicKey('8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9'),
		'2abdd19ad3efab0413b42772a586faa19dedb16d35f665f90d598046a2132c4a'
		'd1e71001545ceaa44e63c04345591e7aadbfd330af82a0d8a1da5643e791ff0f',
		100),
	BlockRecord(
		2,
		'2015-03-29 20:34:19+00:00',  # UTC timestamp from convert_timestamp_to_datetime
		201000000,
		3,
		80000000000000,
		'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
		Address('TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF'),
		PublicKey('f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd'),
		'1b81379847241e45da86b27911e5c9a9192ec04f644d98019657d32838b49c14'
		'3eaa4815a3028b80f9affdbf0b94cd620f7a925e02783dda67b8627b69ddf70e',
		200),
]

ACCOUNTS = [
	AccountRecord(
		Address('TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I'),
		PublicKey('5451f450416d214b14f0375ce06c3451eeb784f7bcd25ae1072ba7e403940a58'),
		None,
		0.123456,
		1000000,
		99999,
		[],
		10,
		'LOCKED',
		'INACTIVE',
		None,
		[],
		[])
]

MOSAICS = [
	MosaicRecord(
		root_namespace='nem',
		namespace_name='nem.xem',
		description='network currency',
		creator=PublicKey('f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd'),
		registered_height=1,
		initial_supply=8999999999000000,
		total_supply=8999999999000000,
		divisibility=6,
		supply_mutable=False,
		transferable=True,
		levy_type=None,
		levy_namespace_name=None,
		levy_fee=None,
		levy_recipient=None
	)
]

TRANSACTIONS = [
	TransactionRecord(
		transaction_hash='438cf6375dab5a0d32f9b7bf151d4539e00a590f7c022d5572c7d41815a24be4',
		height=2,
		sender_public_key=PublicKey('f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd'),
		fee=150000,
		timestamp='2015-03-29 00:06:25+00:00',
		deadline='2015-03-29 20:34:19+00:00',
		amount=2000000,
		signature=(
			'1b81379847241e45da86b27911e5c9a9192ec04f644d98019657d32838b49c14'
			'3eaa4815a3028b80f9affdbf0b94cd620f7a925e02783dda67b8627b69ddf70e'
		),
		transaction_type=257,
		is_inner=False,
		sender_address=Address('TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF'),
		recipient_address=Address('TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I'),
		payload='{}'
	)
]

# endregion


class NemDatabaseTest(unittest.TestCase):

	def setUp(self):
		self.postgresql = testing.postgresql.Postgresql()
		self.db_config = DatabaseConfig(**self.postgresql.dsn(), password='')

	def tearDown(self):
		# Destroy the temporary PostgreSQL database
		self.postgresql.stop()

	@staticmethod
	def _fetch_account_from_db(cursor, address):
		"""Helper method to fetch account data from database."""

		cursor.execute(
			'''
			SELECT
				encode(address, 'hex'),
				encode(public_key, 'hex'),
				encode(remote_address, 'hex'),
				importance::TEXT,
				balance,
				vested_balance,
				mosaics,
				harvested_fees,
				harvested_blocks,
				status,
				remote_status,
				last_harvested_height,
				min_cosignatories,
				cosignatory_of,
				cosignatories
			FROM accounts
			WHERE address = %s
			''',
			(address.bytes,)
		)
		return cursor.fetchone()

	@staticmethod
	def _fetch_namespace_from_db(cursor, root_namespace):
		"""Helper method to fetch namespace data from database."""

		cursor.execute(
			'''
			SELECT
				root_namespace,
				encode(owner, 'hex'),
				registered_height,
				expiration_height,
				sub_namespaces
			FROM namespaces
			WHERE root_namespace = %s
			''',
			(root_namespace,)
		)

		return cursor.fetchone()

	def _fetch_mosaic_from_db(self, cursor, namespace_name):  # pylint: disable=no-self-use
		"""Helper method to fetch mosaic data from database."""

		# pylint: disable=duplicate-code
		cursor.execute(
			'''
			SELECT
				root_namespace,
				namespace_name,
				description,
				encode(creator, 'hex'),
				registered_height,
				initial_supply,
				total_supply,
				divisibility,
				supply_mutable,
				transferable,
				levy_type,
				levy_namespace_name,
				levy_fee,
				encode(levy_recipient, 'hex')
			FROM mosaics
			WHERE namespace_name = %s
			''',
			(namespace_name,)
		)

		return cursor.fetchone()

	def test_can_create_tables(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			# Act:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()
			cursor.execute(
				'''
				SELECT table_name
				FROM information_schema.tables
				WHERE table_schema = 'public'
				ORDER BY table_name
				'''
			)
			results = cursor.fetchall()

		# Assert:
		self.assertEqual(len(results), 6)
		self.assertEqual(results[0][0], 'accounts')
		self.assertEqual(results[1][0], 'blocks')
		self.assertEqual(results[2][0], 'mosaics')
		self.assertEqual(results[3][0], 'namespaces')
		self.assertEqual(results[4][0], 'transactions')
		self.assertEqual(results[5][0], 'transactions_mosaic')

	def test_can_insert_block(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()

			# Act:
			nem_database.insert_block(cursor, BLOCKS[0])

			nem_database.connection.commit()
			cursor.execute(
				'''
				SELECT
					height,
					timestamp,
					total_fee,
					total_transactions,
					difficulty,
					encode(hash, 'hex'),
					encode(beneficiary, 'hex'),
					encode(signer, 'hex'),
					encode(signature, 'hex'),
					size
				FROM blocks
				WHERE height = %s
				''',
				(BLOCKS[0].height, )
			)
			result = cursor.fetchone()

		# Assert:
		self.assertIsNotNone(result)
		expected_result = (
			1,
			datetime.datetime(2015, 3, 29, 0, 6, 25),
			102000000,
			5,
			100000000000000,
			BLOCKS[0].block_hash,
			Address(BLOCKS[0].beneficiary).bytes.hex(),
			PublicKey(BLOCKS[0].signer).bytes.hex(),
			BLOCKS[0].signature,
			BLOCKS[0].size
		)
		self.assertEqual(result, expected_result)

	def test_cannot_insert_same_block_multiple_times(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()

			nem_database.insert_block(cursor, BLOCKS[0])

			# Act + Assert:
			with self.assertRaises(psycopg2.IntegrityError):
				nem_database.insert_block(cursor, BLOCKS[0])

	def test_can_get_current_height(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()

			for block in BLOCKS:
				nem_database.insert_block(cursor, block)

			nem_database.connection.commit()

			# Act:
			result = nem_database.get_current_height()

		# Assert:
		self.assertEqual(result, 2)

	def test_can_get_current_height_is_zero_database_empty(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			# Act:
			result = nem_database.get_current_height()

		# Assert:
		self.assertEqual(result, 0)

	def test_can_insert_account(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()

			# Act:
			nem_database.upsert_account(
				cursor,
				ACCOUNTS[0]
			)

			nem_database.connection.commit()
			result = self._fetch_account_from_db(cursor, ACCOUNTS[0].address)

		# Assert:
		self.assertIsNotNone(result)
		self.assertEqual(result, (
			ACCOUNTS[0].address.bytes.hex(),
			ACCOUNTS[0].public_key.bytes.hex(),
			None,
			'0.1234560000',
			1000000,
			99999,
			[],
			0,
			10,
			'LOCKED',
			'INACTIVE',
			0,
			None,
			None,
			None)
		)

	def test_can_update_account_by_address_conflict(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()

			# insert initial account
			nem_database.upsert_account(
				cursor,
				ACCOUNTS[0]
			)

			# Act:
			nem_database.upsert_account(
				cursor,
				ACCOUNTS[0]._replace(balance=2000000)
			)

			nem_database.connection.commit()
			result = self._fetch_account_from_db(cursor, ACCOUNTS[0].address)

		# Assert:
		self.assertIsNotNone(result)
		self.assertEqual(result, (
			ACCOUNTS[0].address.bytes.hex(),
			ACCOUNTS[0].public_key.bytes.hex(),
			None,
			'0.1234560000',
			2000000,
			99999,
			[],
			0,
			10,
			'LOCKED',
			'INACTIVE',
			0,
			None,
			None,
			None)
		)

	def test_can_update_account_harvested_fees(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()

			# insert initial account
			nem_database.upsert_account(
				cursor,
				ACCOUNTS[0]
			)

			# setup initial harvested fees:
			nem_database.update_account_harvested_fees(
				cursor,
				Address(ACCOUNTS[0].address),
				500000,
				10
			)

			# Act:
			nem_database.update_account_harvested_fees(
				cursor,
				Address(ACCOUNTS[0].address),
				250000,
				20
			)

			nem_database.connection.commit()
			result = self._fetch_account_from_db(cursor, ACCOUNTS[0].address)

		# Assert:
		self.assertEqual(result[7], 750000)  # harvested_fees
		self.assertEqual(result[11], 20)      # last_harvested_height

	def test_can_insert_namespace(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()

			# Act:
			nem_database.upsert_namespace(
				cursor,
				namespace=NamespaceRecord(
					root_namespace='root',
					owner=PublicKey('8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9'),
					registered_height=100,
					expiration_height=200
				)
			)

			nem_database.connection.commit()
			result = self._fetch_namespace_from_db(cursor, 'root')

		# Assert:
		self.assertIsNotNone(result)
		self.assertEqual(result, (
			'root',
			'8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9',
			100,
			200,
			[]
		))

	def test_can_update_namespace_by_root_namespace_conflict(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()

			# insert initial namespace
			nem_database.upsert_namespace(
				cursor,
				namespace=NamespaceRecord(
					root_namespace='root',
					owner=PublicKey('8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9'),
					registered_height=100,
					expiration_height=200
				)
			)

			# Act:
			nem_database.upsert_namespace(
				cursor,
				namespace=NamespaceRecord(
					root_namespace='root',
					owner=PublicKey('f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd'),
					registered_height=150,
					expiration_height=250
				)
			)

			nem_database.connection.commit()
			result = self._fetch_namespace_from_db(cursor, 'root')

		# Assert:
		self.assertIsNotNone(result)
		self.assertEqual(result, (
			'root',
			'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
			150,
			250,
			[]
		))

	def test_can_update_sub_namespaces(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()

			# insert initial namespace
			nem_database.upsert_namespace(
				cursor,
				namespace=NamespaceRecord(
					root_namespace='root',
					owner=PublicKey('8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9'),
					registered_height=100,
					expiration_height=200
				)
			)

			# Act:
			nem_database.update_sub_namespaces(
				cursor,
				'sub1',
				'root'
			)

			nem_database.connection.commit()
			result = self._fetch_namespace_from_db(cursor, 'root')

		# Assert:
		self.assertIsNotNone(result)
		self.assertEqual(result, (
			'root',
			'8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9',
			100,
			200,
			['sub1']
		))

	def test_can_insert_mosaic(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()

			# Act:
			nem_database.upsert_mosaic(
				cursor,
				mosaic_definition=MOSAICS[0]
			)

			nem_database.connection.commit()

			result = self._fetch_mosaic_from_db(cursor, 'nem.xem')

		# Assert:
		self.assertIsNotNone(result)
		self.assertEqual(result, (
			'nem',
			'nem.xem',
			'network currency',
			'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
			1,
			8999999999000000,
			8999999999000000,
			6,
			False,
			True,
			None,
			None,
			None,
			None
		))

	def test_can_update_mosaic_by_namespace_name_conflict(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()

			# insert initial mosaic
			nem_database.upsert_mosaic(
				cursor,
				mosaic_definition=MOSAICS[0]
			)

			# Act:
			nem_database.upsert_mosaic(
				cursor,
				mosaic_definition=MOSAICS[0]._replace(
					description='updated description'
				)
			)

			nem_database.connection.commit()

			result = self._fetch_mosaic_from_db(cursor, 'nem.xem')

		# Assert:
		self.assertIsNotNone(result)
		self.assertEqual(result, (
			'nem',
			'nem.xem',
			'updated description',
			'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
			1,
			8999999999000000,
			8999999999000000,
			6,
			False,
			True,
			None,
			None,
			None,
			None
		))

	def _assert_mosaic_total_supply(self, is_supply_mutable, adjustment, expected_total_supply):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()

			# insert initial mosaic
			nem_database.upsert_mosaic(
				cursor,
				mosaic_definition=MOSAICS[0]._replace(
					total_supply=1000,
					supply_mutable=is_supply_mutable
				)
			)

			# Act:
			nem_database.update_mosaic_total_supply(
				cursor,
				namespace_name='nem.xem',
				adjustment=adjustment
			)

			nem_database.connection.commit()

			result = self._fetch_mosaic_from_db(cursor, 'nem.xem')

		# Assert:
		self.assertIsNotNone(result)
		self.assertEqual(result[6], expected_total_supply)  # total_supply

	def test_can_increase_update_mosaic_total_supply(self):
		self._assert_mosaic_total_supply(
			is_supply_mutable=True,
			adjustment=3000,
			expected_total_supply=4000
		)

	def test_can_decrease_update_mosaic_total_supply(self):
		self._assert_mosaic_total_supply(
			is_supply_mutable=True,
			adjustment=-3000,
			expected_total_supply=0
		)

	def test_cannot_update_mosaic_total_supply_if_supply_immutable(self):
		self._assert_mosaic_total_supply(
			is_supply_mutable=False,
			adjustment=3000,
			expected_total_supply=1000
		)

	def test_can_insert_transactions(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()

			# Act:
			nem_database.insert_transaction(
				cursor,
				transaction=TRANSACTIONS[0]
			)

			nem_database.connection.commit()

			cursor.execute(
				'''
				SELECT
					encode(transaction_hash, 'hex'),
					transaction_type,
					height,
					encode(sender_public_key, 'hex'),
					encode(sender_address, 'hex'),
					encode(recipient_address, 'hex'),
					fee,
					timestamp,
					deadline,
					encode(signature, 'hex'),
					amount,
					is_inner,
					payload
				FROM transactions
				WHERE id = %s
				''',
				(1,)
			)
			result = cursor.fetchone()

		# Assert:
		self.assertIsNotNone(result)
		self.assertEqual(result, (
			TRANSACTIONS[0].transaction_hash,
			257,
			2,
			TRANSACTIONS[0].sender_public_key.bytes.hex(),
			TRANSACTIONS[0].sender_address.bytes.hex(),
			TRANSACTIONS[0].recipient_address.bytes.hex(),
			150000,
			datetime.datetime(2015, 3, 29, 0, 6, 25),
			datetime.datetime(2015, 3, 29, 20, 34, 19),
			TRANSACTIONS[0].signature,
			2000000,
			False,
			'{}'
		))

	def test_insert_transaction_mosaic(self):
		# Arrange:
		with NemDatabase(self.db_config) as nem_database:
			nem_database.create_tables()

			cursor = nem_database.connection.cursor()

			nem_database.insert_transaction(
				cursor,
				transaction=TRANSACTIONS[0]
			)

			# Act:
			nem_database.insert_transaction_mosaic(
				cursor,
				transaction_id=1,
				mosaic=Mosaic(
					namespace_name='nem.xem',
					quantity=2000000
				)
			)

			nem_database.connection.commit()

			cursor.execute(
				'''
				SELECT
					namespace_name,
					quantity
				FROM transactions_mosaic
				WHERE namespace_name = %s
				''',
				('nem.xem',)
			)
			result = cursor.fetchone()

		# Assert:
		self.assertIsNotNone(result)
		self.assertEqual(result, (
			'nem.xem',
			2000000
		))
