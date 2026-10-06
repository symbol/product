from datetime import datetime, timezone
from threading import Event

from symbolchain.CryptoTypes import PublicKey
from symbolchain.symbol.Network import Address, Network

from rest.db.SymbolDatabase import SymbolDatabase

from .SymbolAccountTestUtils import create_symbol_account_row

NATIVE_MOSAIC_ID = '72C0212E67A08BCE'
CUSTOM_MOSAIC_ID = '1234567890ABCDEF'
REFRESH_COMPLETED_AT = datetime(2026, 1, 1, tzinfo=timezone.utc)


def account_address(identity):
	"""Returns a deterministic valid testnet address for an integer identity."""

	return Network.TESTNET.public_key_to_address(PublicKey(bytes([identity]) * PublicKey.SIZE)).bytes


def create_refresh_entry(  # pylint: disable=too-many-arguments,too-many-positional-arguments
	refresh_run_id,
	identity,
	search_order,
	importance,
	importance_percentage=None,
	mosaic_rows=None,
	public_key=None,
	account_type='main'
):
	"""Builds one Puller account-refresh page entry."""
	address = account_address(identity)
	account_row = create_symbol_account_row(
		address=address,
		address_text=str(Address(address)),
		public_key=public_key,
		account_type=account_type,
		importance=importance,
		importance_percentage=importance_percentage if importance_percentage is not None else importance,
		address_height=identity,
		last_seen_height=100)
	return {
		'refresh_run_id': refresh_run_id,
		'account_search_order': search_order,
		'account_row': account_row,
		'mosaic_rows': [
			{
				'address': address,
				'mosaic_id': mosaic_id,
				'amount': amount,
				'updated_at_height': 100
			}
			for mosaic_id, amount in (mosaic_rows or [])
		],
		'snapshot_height': 100,
		'snapshot_at': REFRESH_COMPLETED_AT
	}


def seed_refresh_run(  # pylint: disable=too-many-arguments,too-many-positional-arguments
	puller_database, refresh_run_id, entries, native_mosaic_id=NATIVE_MOSAIC_ID,
	completed_at=REFRESH_COMPLETED_AT, completed_height=100):
	"""Writes and finalizes one complete account-refresh run."""
	puller_database.upsert_account_refresh_page(entries, last_scanned_page=1)
	puller_database.finalize_account_refresh(refresh_run_id, native_mosaic_id, completed_height, completed_at)


def seed_current_mosaic(puller_database, mosaic_id, divisibility=0, owner_address=None):
	"""Writes one current mosaic metadata row used by list enrichment."""
	owner_address = owner_address or account_address(99)
	puller_database.upsert_mosaic({
		'mosaic_id': mosaic_id,
		'owner_address': owner_address,
		'start_height': 1,
		'duration': 0,
		'expiration_height': None,
		'supply': 1000,
		'divisibility': divisibility,
		'flags': 0, 'supply_mutable': False, 'transferable': True, 'restrictable': False, 'revokable': False,
		'raw_payload': {'mosaicId': mosaic_id},
		'updated_at_height': 100
	})


def seed_alias(puller_database, artifact_type, artifact_id, name):
	"""Writes one current account or mosaic alias row."""
	with puller_database.connection.cursor() as cursor:
		cursor.execute(
			'''INSERT INTO symbol_alias_names (artifact_type, artifact_id, name, updated_at_height)
			VALUES (%s, %s, %s, %s)''',
			(artifact_type, artifact_id, name, 100))
	puller_database.connection.commit()


def create_account_list_entries(run_id='selected-run', is_new=False):
	"""Creates four shared addresses with divergent snapshot values across runs."""

	if is_new:
		return [
			create_refresh_entry(
				run_id, 1, 3, 1, public_key=bytes([11]) * 32,
				mosaic_rows=[(NATIVE_MOSAIC_ID, 10), (CUSTOM_MOSAIC_ID, 200)]),
			create_refresh_entry(
				run_id, 2, 2, 4, public_key=bytes([12]) * 32, account_type='remote',
				mosaic_rows=[(NATIVE_MOSAIC_ID, 20), (CUSTOM_MOSAIC_ID, 10)]),
			create_refresh_entry(
				run_id, 3, 1, 2, public_key=bytes([13]) * 32,
				mosaic_rows=[(NATIVE_MOSAIC_ID, 25), (CUSTOM_MOSAIC_ID, 25)]),
			create_refresh_entry(
				run_id, 4, 0, 3, public_key=bytes([14]) * 32,
				mosaic_rows=[(NATIVE_MOSAIC_ID, 0), (CUSTOM_MOSAIC_ID, 300)])
		]

	return [
		create_refresh_entry(run_id, 1, 2, 4, mosaic_rows=[(NATIVE_MOSAIC_ID, 50), (CUSTOM_MOSAIC_ID, 100)]),
		create_refresh_entry(run_id, 2, 0, 1, mosaic_rows=[(NATIVE_MOSAIC_ID, 0), (CUSTOM_MOSAIC_ID, 0)]),
		create_refresh_entry(run_id, 3, 1, 3, mosaic_rows=[(NATIVE_MOSAIC_ID, 50), (CUSTOM_MOSAIC_ID, 100)]),
		create_refresh_entry(run_id, 4, 3, 2, mosaic_rows=[(CUSTOM_MOSAIC_ID, 200)])
	]


class PausingAccountListDatabase(SymbolDatabase):
	"""Lets a separate writer commit after the reader establishes its snapshot."""

	def __init__(self, db_config, native_mosaic_info, clock):
		super().__init__(db_config, native_mosaic_info, clock)
		self.state_read_event = Event()
		self.allow_query_event = Event()
		self.transaction_settings = None

	def _fetch_sync_state(self, cursor):  # pylint: disable=arguments-differ
		state = super()._fetch_sync_state(cursor)
		cursor.execute('SHOW transaction_isolation')
		isolation = cursor.fetchone()[0]
		cursor.execute('SHOW transaction_read_only')
		self.transaction_settings = (isolation, cursor.fetchone()[0])
		self.state_read_event.set()
		if not self.allow_query_event.wait(timeout=5):
			raise RuntimeError('Timed out waiting for snapshot writer')

		return state


class FailingAccountListDatabase(SymbolDatabase):
	"""Injects a real SQL error after the public entrypoint has read its page."""

	def __init__(self, db_config, native_mosaic_info, clock):
		super().__init__(db_config, native_mosaic_info, clock)
		self.should_fail = True

	def _fetch_account_list_mosaics(self, cursor, run_id, addresses):  # pylint: disable=arguments-differ
		if self.should_fail:
			cursor.execute('SELECT missing_account_list_column FROM symbol_account_refresh_mosaics')

		return super()._fetch_account_list_mosaics(cursor, run_id, addresses)
