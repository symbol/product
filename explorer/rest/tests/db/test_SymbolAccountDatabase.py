from decimal import Decimal
from unittest import TestCase

from psycopg2.extras import Json

from rest.db.SymbolDatabase import AccountRecord, MosaicRecord, MultisigRecord, SymbolDatabase, SymbolDataUnavailable
from rest.model.symbol.validation import SymbolDataInvalid

from ..test.SymbolAccountTestUtils import ACCOUNT_ADDRESS, OTHER_ADDRESS, PUBLIC_KEY, create_symbol_account_row, seed_alias
from ..test.SymbolBlockTestUtils import create_symbol_sync_state
from ..test.SymbolDatabaseTestUtils import PausingAfterSyncStateReadSymbolDatabase, read_during_database_snapshot, symbol_test_database


def create_account_mosaic_row(mosaic_id='72C0212E67A08BCE', amount=70000000, address=ACCOUNT_ADDRESS):
	return {
		'address': address,
		'mosaic_id': mosaic_id,
		'amount': amount,
		'updated_at_height': 100
	}


def seed_account(puller_database, account_row=None, mosaic_rows=None):
	puller_database.upsert_account_current_state(
		account_row or create_symbol_account_row(),
		mosaic_rows if mosaic_rows is not None else [create_account_mosaic_row()])


def seed_account_alias(puller_database, name, artifact_id='TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY'):
	seed_alias(puller_database, 'account', artifact_id, name)


ACCOUNT_B_PUBLIC_KEY = bytes.fromhex('03' * 32)


def create_account_b_row():
	return create_symbol_account_row(
		address=OTHER_ADDRESS,
		address_text='TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
		public_key=ACCOUNT_B_PUBLIC_KEY,
		account_type='remote',
		address_height=456,
		importance_percentage=Decimal('0.075'),
		linked_public_key=bytes.fromhex('33' * 32),
		node_public_key=bytes.fromhex('44' * 32),
		vrf_public_key=bytes.fromhex('55' * 32),
		voting_public_keys=Json([{'publicKey': 'CD' * 32, 'startEpoch': 300, 'endEpoch': 400}]),
		activity_buckets=Json([{
			'startHeight': '9',
			'totalFeesPaid': '7654321',
			'beneficiaryCount': 4,
			'rawScore': '6000000000'
		}]))


class SymbolAccountDatabaseTest(TestCase):
	def test_try_get_account_reads_current_state_by_address_and_exact_public_key(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(last_synced_height=100, finalized_height=100)) as (db_config, puller_database):
			seed_account(puller_database)
			expected = AccountRecord(
				address=ACCOUNT_ADDRESS,
				public_key=PUBLIC_KEY,
				account_type='main',
				address_height=123,
				importance_percentage=Decimal('0.025'),
				linked_public_key=bytes.fromhex('11' * 32),
				node_public_key=bytes.fromhex('22' * 32),
				vrf_public_key=bytes.fromhex('00' * 32),
				voting_public_keys=[{'publicKey': 'AB' * 32, 'startEpoch': '100', 'endEpoch': '200'}],
				activity_buckets=[{
					'startHeight': '0',
					'totalFeesPaid': '1234567',
					'beneficiaryCount': 2,
					'rawScore': '5000000000'
				}],
				finalized_epoch=2,
				alias_names=(),
				mosaics=(MosaicRecord(
					mosaic_id='72C0212E67A08BCE',
					amount=70000000,
					metadata_mosaic_id=None,
					divisibility=None,
					owner_address=None,
					alias_names=()),))
			database = SymbolDatabase(db_config)
			try:
				# Act:
				by_address = database.try_get_account(address=ACCOUNT_ADDRESS)
				by_public_key = database.try_get_account(public_key=PUBLIC_KEY)
			finally:
				database.close()

		# Assert:
		self.assertEqual(expected, _normalize_account_binary_fields(by_address))
		self.assertEqual(expected, _normalize_account_binary_fields(by_public_key))

	def test_try_get_account_filters_multisig_by_account_address(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(last_synced_height=100, finalized_height=100)) as (db_config, puller_database):
			seed_account(puller_database)
			seed_account(puller_database, create_account_b_row(), [])
			puller_database.upsert_multisig(ACCOUNT_ADDRESS, {
				'address': ACCOUNT_ADDRESS,
				'min_approval': 6,
				'min_removal': 5,
				'cosignatory_addresses': [OTHER_ADDRESS],
				'multisig_addresses': [ACCOUNT_ADDRESS, OTHER_ADDRESS],
				'updated_at_height': 100
			})
			database = SymbolDatabase(db_config)
			try:
				# Act:
				account_a = database.try_get_account(address=ACCOUNT_ADDRESS)
				account_b_by_address = database.try_get_account(address=OTHER_ADDRESS)
				account_b_by_public_key = database.try_get_account(public_key=ACCOUNT_B_PUBLIC_KEY)
			finally:
				database.close()

		# Assert:
		self.assertEqual(
			MultisigRecord(6, 5, [OTHER_ADDRESS], [ACCOUNT_ADDRESS, OTHER_ADDRESS]),
			_normalize_multisig_binary_fields(account_a.multisig))
		expected_b = AccountRecord(
			address=OTHER_ADDRESS,
			public_key=ACCOUNT_B_PUBLIC_KEY,
			account_type='remote',
			address_height=456,
			importance_percentage=Decimal('0.075'),
			linked_public_key=bytes.fromhex('33' * 32),
			node_public_key=bytes.fromhex('44' * 32),
			vrf_public_key=bytes.fromhex('55' * 32),
			voting_public_keys=[{'publicKey': 'CD' * 32, 'startEpoch': 300, 'endEpoch': 400}],
			activity_buckets=[{
				'startHeight': '9',
				'totalFeesPaid': '7654321',
				'beneficiaryCount': 4,
				'rawScore': '6000000000'
			}],
			finalized_epoch=2,
			alias_names=(),
			mosaics=(),
			multisig=None)
		self.assertEqual(expected_b, _normalize_account_binary_fields(account_b_by_address))
		self.assertEqual(expected_b, _normalize_account_binary_fields(account_b_by_public_key))

	def test_try_get_account_reads_state_and_multisig_from_one_snapshot(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(last_synced_height=100, finalized_height=100)) as (db_config, puller_database):
			seed_account(puller_database)
			seed_account_alias(puller_database, 'before-account')
			seed_alias(puller_database, 'mosaic', '72C0212E67A08BCE', 'before-mosaic')
			puller_database.upsert_multisig(ACCOUNT_ADDRESS, {
				'address': ACCOUNT_ADDRESS,
				'min_approval': 2,
				'min_removal': 1,
				'cosignatory_addresses': [OTHER_ADDRESS],
				'multisig_addresses': [ACCOUNT_ADDRESS],
				'updated_at_height': 100
			})
			with PausingAfterSyncStateReadSymbolDatabase(db_config) as database:
				updated_account = create_symbol_account_row()
				updated_mosaics = [create_account_mosaic_row(amount=90000000)]

				def update_current_rows():
					puller_database.upsert_account_current_state(updated_account, updated_mosaics)
					seed_account_alias(puller_database, 'after-account')
					seed_alias(puller_database, 'mosaic', '72C0212E67A08BCE', 'after-mosaic')
					puller_database.upsert_multisig(ACCOUNT_ADDRESS, {
						'address': ACCOUNT_ADDRESS,
						'min_approval': 4,
						'min_removal': 3,
						'cosignatory_addresses': [ACCOUNT_ADDRESS],
						'multisig_addresses': [OTHER_ADDRESS],
						'updated_at_height': 100
					})

				# Act:
				result = read_during_database_snapshot(
					database,
					lambda: database.try_get_account(address=ACCOUNT_ADDRESS),
					update_current_rows)

		# Assert:
		self.assertEqual(70000000, result.mosaics[0].amount)
		self.assertEqual(('before-account',), result.alias_names)
		self.assertEqual(('before-mosaic',), result.mosaics[0].alias_names)
		self.assertEqual(
			MultisigRecord(2, 1, [OTHER_ADDRESS], [ACCOUNT_ADDRESS]),
			_normalize_multisig_binary_fields(result.multisig))

	def test_try_get_account_rejects_unavailable_state_before_lookup(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(last_synced_height=100, finalized_height=None)) as (db_config, puller_database):
			seed_account(puller_database, create_symbol_account_row(voting_public_keys=[]))
			database = SymbolDatabase(db_config)
			try:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable) as context:
					database.try_get_account(address=ACCOUNT_ADDRESS)
				self.assertEqual('Symbol account data is unavailable', str(context.exception))
			finally:
				database.close()

	def test_try_get_account_rejects_unreadable_watermark(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(last_synced_height=0, finalized_height=1)) as (db_config, _):
			database = SymbolDatabase(db_config)
			try:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable) as context:
					database.try_get_account(address=ACCOUNT_ADDRESS)
				self.assertEqual('Symbol account data is unavailable', str(context.exception))
			finally:
				database.close()

	def test_try_get_account_rejects_missing_sync_state_before_lookup(self):
		# Arrange:
		with symbol_test_database() as (db_config, _):
			database = SymbolDatabase(db_config)
			try:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable) as context:
					database.try_get_account(public_key=PUBLIC_KEY)
				self.assertEqual('Symbol account data is unavailable', str(context.exception))
			finally:
				database.close()

	def test_try_get_account_rejects_null_watermark(self):
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=100, finalized_height=100)
		sync_state['last_synced_height'] = None
		sync_state['last_synced_block_hash'] = None
		with symbol_test_database(sync_state) as (db_config, _):
			database = SymbolDatabase(db_config)
			try:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable) as context:
					database.try_get_account(address=ACCOUNT_ADDRESS)
				self.assertEqual('Symbol account data is unavailable', str(context.exception))
			finally:
				database.close()

	def test_try_get_account_rejects_invalid_finalized_epoch(self):
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=1, finalized_height=1, finalized_epoch=-1)
		with symbol_test_database(sync_state) as (db_config, _):
			database = SymbolDatabase(db_config)
			try:
				# Act + Assert:
				with self.assertRaises(SymbolDataInvalid) as context:
					database.try_get_account(address=ACCOUNT_ADDRESS)
				self.assertEqual('sync_state.finalized_epoch: invalid integer', str(context.exception))
			finally:
				database.close()

	def test_try_get_account_rejects_saved_address_with_wrong_byte_length(self):
		# Arrange:
		invalid_address = bytes.fromhex('01' * 23)
		with symbol_test_database(create_symbol_sync_state(last_synced_height=1, finalized_height=1)) as (db_config, puller_database):
			seed_account(puller_database, create_symbol_account_row(address=invalid_address), [])
			database = SymbolDatabase(db_config)
			try:
				# Act + Assert:
				with self.assertRaises(SymbolDataInvalid) as context:
					database.try_get_account(public_key=PUBLIC_KEY)
				self.assertEqual('accounts.address: invalid byte length', str(context.exception))
			finally:
				database.close()

	def test_try_get_account_allows_clean_sync_lag(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(
			last_synced_height=10,
			finalized_height=10,
			chain_height=100)) as (db_config, puller_database):
			seed_account(puller_database)
			database = SymbolDatabase(db_config)
			try:
				# Act:
				result = database.try_get_account(address=ACCOUNT_ADDRESS)
			finally:
				database.close()

		# Assert:
		self.assertIsNotNone(result)

	def test_try_get_account_rejects_nonhealthy_or_dirty_state(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(
			last_synced_height=10,
			finalized_height=10,
			chain_height=100)) as (db_config, puller_database):
			seed_account(puller_database)
			database = SymbolDatabase(db_config)
			try:
				for status, dirty_state_from_height in (
					('repairing', None),
					('unhealthy', None),
					('initialized', None),
					('healthy', 5),
					('healthy', 11)):
					with self.subTest(status=status, dirty_state_from_height=dirty_state_from_height):
						puller_database.upsert_sync_state(create_symbol_sync_state(
							last_synced_height=10,
							finalized_height=10,
							chain_height=100,
							status=status,
							dirty_state_from_height=dirty_state_from_height))

						# Act + Assert:
						with self.assertRaises(SymbolDataUnavailable) as context:
							database.try_get_account(address=ACCOUNT_ADDRESS)
						self.assertEqual('Symbol account data is unavailable', str(context.exception))
			finally:
				database.close()

	def test_try_get_account_returns_aliases_in_database_order(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(last_synced_height=100, finalized_height=100)) as (db_config, puller_database):
			seed_account(puller_database)
			seed_account_alias(puller_database, 'zeta')
			seed_account_alias(puller_database, 'alpha')
			database = SymbolDatabase(db_config)
			try:
				# Act:
				result = database.try_get_account(address=ACCOUNT_ADDRESS)
			finally:
				database.close()

		# Assert:
		self.assertEqual(('alpha', 'zeta'), result.alias_names)

	def test_try_get_account_returns_sorted_mosaic_aliases_for_all_saved_ids(self):
		# Arrange: two saved Mosaic IDs, unsorted aliases on one, no aliases on the other,
		# and an account alias decoy sharing the first artifact ID.
		custom_id = '1234567890ABCDEF'
		native_id = '72C0212E67A08BCE'
		with symbol_test_database(create_symbol_sync_state(last_synced_height=100, finalized_height=100)) as (db_config, puller_database):
			seed_account(puller_database, mosaic_rows=[
				create_account_mosaic_row(native_id), create_account_mosaic_row(custom_id, 123)])
			seed_alias(puller_database, 'mosaic', custom_id, 'zeta')
			seed_alias(puller_database, 'mosaic', custom_id, 'alpha')
			seed_alias(puller_database, 'account', custom_id, 'decoy')
			database = SymbolDatabase(db_config)
			try:
				# Act:
				result = database.try_get_account(address=ACCOUNT_ADDRESS)
			finally:
				database.close()

		# Assert:
		self.assertEqual((('alpha', 'zeta'), ()), tuple(mosaic.alias_names for mosaic in result.mosaics))

	def test_try_get_account_separates_account_and_mosaic_aliases_and_ignores_decoys(self):
		# Arrange:
		mosaic_id = '1234567890ABCDEF'
		with symbol_test_database(create_symbol_sync_state(last_synced_height=100, finalized_height=100)) as (db_config, puller_database):
			seed_account(puller_database, mosaic_rows=[
				create_account_mosaic_row(),
				create_account_mosaic_row(mosaic_id=mosaic_id, amount=2)])
			seed_alias(puller_database, 'account', 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY', 'zeta')
			seed_alias(puller_database, 'account', 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY', 'alpha')
			seed_alias(puller_database, 'mosaic', '72C0212E67A08BCE', 'native-zeta')
			seed_alias(puller_database, 'mosaic', '72C0212E67A08BCE', 'native-alpha')
			seed_alias(puller_database, 'mosaic', mosaic_id, 'other')
			seed_alias(puller_database, 'mosaic', 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY', 'wrong-type')
			seed_alias(puller_database, 'account', '72C0212E67A08BCE', 'wrong-type')
			seed_alias(puller_database, 'mosaic', '0000000000000001', 'unrelated')
			database = SymbolDatabase(db_config)
			try:
				# Act:
				result = database.try_get_account(address=ACCOUNT_ADDRESS)
			finally:
				database.close()

		# Assert:
		self.assertEqual(('alpha', 'zeta'), result.alias_names)
		self.assertEqual((
			MosaicRecord('1234567890ABCDEF', 2, None, None, None, ('other',)),
			MosaicRecord('72C0212E67A08BCE', 70000000, None, None, None, ('native-alpha', 'native-zeta'))), result.mosaics)

	def test_try_get_account_reads_account_aliases_when_mosaics_are_absent(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(last_synced_height=100, finalized_height=100)) as (db_config, puller_database):
			seed_account(puller_database, mosaic_rows=[])
			seed_account_alias(puller_database, 'account-name')
			database = SymbolDatabase(db_config)
			try:
				# Act:
				result = database.try_get_account(address=ACCOUNT_ADDRESS)
			finally:
				database.close()

		# Assert:
		self.assertEqual(('account-name',), result.alias_names)
		self.assertEqual((), result.mosaics)


def _normalize_account_binary_fields(record):
	"""Normalizes PostgreSQL bytea memoryviews for value-based record comparisons."""

	multisig = None if record.multisig is None else _normalize_multisig_binary_fields(record.multisig)
	return record._replace(
		address=bytes(record.address),
		public_key=bytes(record.public_key) if record.public_key is not None else None,
		linked_public_key=bytes(record.linked_public_key) if record.linked_public_key is not None else None,
		node_public_key=bytes(record.node_public_key) if record.node_public_key is not None else None,
		vrf_public_key=bytes(record.vrf_public_key) if record.vrf_public_key is not None else None,
		mosaics=tuple(mosaic._replace(
			owner_address=bytes(mosaic.owner_address) if mosaic.owner_address is not None else None) for mosaic in record.mosaics),
		multisig=multisig)


def _normalize_multisig_binary_fields(record):
	"""Normalizes PostgreSQL bytea memoryviews for value-based record comparisons."""

	return record._replace(
		cosignatory_addresses=[bytes(address) for address in record.cosignatory_addresses],
		multisig_addresses=[bytes(address) for address in record.multisig_addresses])
