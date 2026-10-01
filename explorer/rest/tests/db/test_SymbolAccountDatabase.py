from decimal import Decimal
from threading import Event
from unittest import TestCase

from rest.db.SymbolDatabase import SymbolAccountRecord, SymbolDatabase, SymbolDataUnavailable, SymbolMosaicRecord, SymbolMultisigRecord
from rest.model.symbol.validation import SymbolDataInvalid

from ..test.SymbolAccountTestUtils import ACCOUNT_ADDRESS, OTHER_ADDRESS, PUBLIC_KEY, create_symbol_account_row
from ..test.SymbolBlockTestUtils import create_symbol_sync_state
from ..test.SymbolDatabaseTestUtils import read_during_database_snapshot, symbol_test_database


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
	cursor = puller_database.connection.cursor()
	try:
		cursor.execute(
			'''INSERT INTO symbol_alias_names (artifact_type, artifact_id, name, updated_at_height)
			VALUES ('account', %s, %s, 100)''',
			(artifact_id, name))
		puller_database.connection.commit()
	finally:
		cursor.close()


class SymbolAccountDatabaseTest(TestCase):
	def test_get_account_reads_current_state_by_address_and_exact_public_key(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(last_synced_height=100, finalized_height=100)) as (db_config, puller_database):
			seed_account(puller_database)
			expected = SymbolAccountRecord(
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
				mosaics=(SymbolMosaicRecord(
					mosaic_id='72C0212E67A08BCE',
					amount=70000000,
					metadata_mosaic_id=None,
					divisibility=None,
					owner_address=None,
					alias_names=()),))
			database = SymbolDatabase(db_config)
			try:
				# Act:
				by_address = database.get_account(address=ACCOUNT_ADDRESS)
				by_public_key = database.get_account(public_key=PUBLIC_KEY)
			finally:
				database.close()

		# Assert:
		self.assertEqual(expected, _normalize_account_binary_fields(by_address))
		self.assertEqual(expected, _normalize_account_binary_fields(by_public_key))

	def test_get_account_reads_state_and_current_rows_from_one_snapshot(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(last_synced_height=100, finalized_height=100)) as (db_config, puller_database):
			seed_account(puller_database)
			with PausingSymbolAccountDatabase(db_config) as database:
				updated_account = create_symbol_account_row()
				updated_mosaics = [create_account_mosaic_row(amount=90000000)]

				# Act:
				result = read_during_database_snapshot(
					database,
					lambda: database.get_account(address=ACCOUNT_ADDRESS),
					lambda: puller_database.upsert_account_current_state(updated_account, updated_mosaics))

		# Assert:
		self.assertEqual(70000000, result.mosaics[0].amount)

	def test_get_account_rejects_unavailable_state_before_lookup(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(last_synced_height=100, finalized_height=None)) as (db_config, puller_database):
			seed_account(puller_database, create_symbol_account_row(voting_public_keys=[]))
			database = SymbolDatabase(db_config)
			try:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable):
					database.get_account(address=ACCOUNT_ADDRESS)
			finally:
				database.close()

	def test_get_account_rejects_unreadable_watermark(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(last_synced_height=0, finalized_height=1)) as (db_config, _):
			database = SymbolDatabase(db_config)
			try:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable):
					database.get_account(address=ACCOUNT_ADDRESS)
			finally:
				database.close()

	def test_get_account_rejects_missing_sync_state_before_lookup(self):
		# Arrange:
		with symbol_test_database() as (db_config, _):
			database = SymbolDatabase(db_config)
			try:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable):
					database.get_account(public_key=PUBLIC_KEY)
			finally:
				database.close()

	def test_get_account_rejects_null_watermark(self):
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=100, finalized_height=100)
		sync_state['last_synced_height'] = None
		sync_state['last_synced_block_hash'] = None
		with symbol_test_database(sync_state) as (db_config, _):
			database = SymbolDatabase(db_config)
			try:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable):
					database.get_account(address=ACCOUNT_ADDRESS)
			finally:
				database.close()

	def test_get_account_rejects_invalid_finalized_epoch(self):
		# Arrange:
		sync_state = create_symbol_sync_state(last_synced_height=1, finalized_height=1, finalized_epoch=-1)
		with symbol_test_database(sync_state) as (db_config, _):
			database = SymbolDatabase(db_config)
			try:
				# Act + Assert:
				with self.assertRaises(SymbolDataInvalid):
					database.get_account(address=ACCOUNT_ADDRESS)
			finally:
				database.close()

	def test_get_account_rejects_saved_address_with_wrong_byte_length(self):
		# Arrange:
		invalid_address = bytes.fromhex('01' * 23)
		with symbol_test_database(create_symbol_sync_state(last_synced_height=1, finalized_height=1)) as (db_config, puller_database):
			seed_account(puller_database, create_symbol_account_row(address=invalid_address), [])
			database = SymbolDatabase(db_config)
			try:
				# Act + Assert:
				with self.assertRaises(SymbolDataInvalid):
					database.get_account(public_key=PUBLIC_KEY)
			finally:
				database.close()

	def test_get_account_allows_clean_sync_lag(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(
			last_synced_height=10,
			finalized_height=10,
			chain_height=100)) as (db_config, puller_database):
			seed_account(puller_database)
			database = SymbolDatabase(db_config)
			try:
				# Act:
				result = database.get_account(address=ACCOUNT_ADDRESS)
			finally:
				database.close()

		# Assert:
		self.assertIsNotNone(result)

	def test_get_account_rejects_nonhealthy_or_dirty_state(self):
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
						with self.assertRaises(SymbolDataUnavailable):
							database.get_account(address=ACCOUNT_ADDRESS)
			finally:
				database.close()

	def test_get_multisig_returns_saved_order_and_all_related_addresses(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(last_synced_height=100, finalized_height=None)) as (db_config, puller_database):
			seed_account(puller_database)
			puller_database.upsert_multisig(ACCOUNT_ADDRESS, {
				'address': ACCOUNT_ADDRESS,
				'min_approval': 2,
				'min_removal': 1,
				'cosignatory_addresses': [OTHER_ADDRESS, ACCOUNT_ADDRESS, OTHER_ADDRESS],
				'multisig_addresses': [OTHER_ADDRESS, ACCOUNT_ADDRESS, OTHER_ADDRESS],
				'updated_at_height': 100
			})
			database = SymbolDatabase(db_config)
			try:
				# Act:
				result = database.get_multisig(ACCOUNT_ADDRESS)
			finally:
				database.close()

		# Assert:
		expected = SymbolMultisigRecord(
			min_approval=2,
			min_removal=1,
			cosignatory_addresses=[OTHER_ADDRESS, ACCOUNT_ADDRESS, OTHER_ADDRESS],
			multisig_addresses=[OTHER_ADDRESS, ACCOUNT_ADDRESS, OTHER_ADDRESS])
		self.assertEqual(expected, _normalize_multisig_binary_fields(result))

	def test_get_multisig_returns_none_without_account(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(last_synced_height=100, finalized_height=None)) as (db_config, _):
			database = SymbolDatabase(db_config)
			try:
				# Act:
				result = database.get_multisig(OTHER_ADDRESS)
			finally:
				database.close()

		# Assert:
		self.assertIsNone(result)

	def test_get_account_returns_aliases_in_database_order(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(last_synced_height=100, finalized_height=100)) as (db_config, puller_database):
			seed_account(puller_database)
			seed_account_alias(puller_database, 'zeta')
			seed_account_alias(puller_database, 'alpha')
			database = SymbolDatabase(db_config)
			try:
				# Act:
				result = database.get_account(address=ACCOUNT_ADDRESS)
			finally:
				database.close()

		# Assert:
		self.assertEqual(('alpha', 'zeta'), result.alias_names)


def _normalize_account_binary_fields(record):
	"""Normalizes PostgreSQL bytea memoryviews for value-based record comparisons."""

	return record._replace(
		address=bytes(record.address),
		public_key=bytes(record.public_key) if record.public_key is not None else None,
		linked_public_key=bytes(record.linked_public_key) if record.linked_public_key is not None else None,
		node_public_key=bytes(record.node_public_key) if record.node_public_key is not None else None,
		vrf_public_key=bytes(record.vrf_public_key) if record.vrf_public_key is not None else None,
		mosaics=tuple(mosaic._replace(
			owner_address=bytes(mosaic.owner_address) if mosaic.owner_address is not None else None) for mosaic in record.mosaics))


def _normalize_multisig_binary_fields(record):
	"""Normalizes PostgreSQL bytea memoryviews for value-based record comparisons."""

	return record._replace(
		cosignatory_addresses=[bytes(address) for address in record.cosignatory_addresses],
		multisig_addresses=[bytes(address) for address in record.multisig_addresses])


class PausingSymbolAccountDatabase(SymbolDatabase):
	"""Pauses after sync state read to prove account reads use one snapshot."""

	def __init__(self, db_config):
		super().__init__(db_config)
		self.state_read_event = Event()
		self.allow_query_event = Event()

	def _fetch_sync_state(self, cursor):  # pylint: disable=arguments-differ
		sync_state = super()._fetch_sync_state(cursor)
		self.state_read_event.set()
		if not self.allow_query_event.wait(timeout=5):
			raise RuntimeError('Timed out waiting for snapshot interleaving')

		return sync_state
