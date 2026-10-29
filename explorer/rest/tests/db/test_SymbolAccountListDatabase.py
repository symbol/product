from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest import TestCase

import pytest
from common.symbol.NativeMosaic import NativeMosaicInfo
from psycopg2 import Error as PsycopgError
from symbolchain.symbol.Network import Address

from rest.db.SymbolDatabase import AccountListQuery, AccountListRecord, AccountSortField, MosaicRecord, SymbolDatabase
from rest.db.SymbolDatabaseCommon import SymbolDataUnavailable

from ..test.SymbolAccountListTestUtils import (
	CUSTOM_MOSAIC_ID,
	NATIVE_MOSAIC_ID,
	REFRESH_COMPLETED_AT,
	FailingAccountListDatabase,
	PausingAccountListDatabase,
	account_address,
	create_account_list_entries,
	create_refresh_entry,
	seed_current_mosaic,
	seed_refresh_run
)
from ..test.SymbolAccountTestUtils import seed_alias
from ..test.SymbolBlockTestUtils import create_symbol_block, create_symbol_sync_state
from ..test.SymbolDatabaseTestUtils import read_during_database_snapshot, symbol_test_database

NATIVE_MOSAIC_INFO = NativeMosaicInfo(NATIVE_MOSAIC_ID, 6)
NOW = datetime(2026, 1, 1, 2, tzinfo=timezone.utc)


def list_query(sort_field, mosaic_id=None, limit=100, offset=0, is_harvesting=False):
	return AccountListQuery(sort_field, mosaic_id, limit, offset, is_harvesting)


def seed_accounts(puller_database, run_id='selected-run', completed_at=REFRESH_COMPLETED_AT, variant=None):
	"""Seeds the shared refresh fixture through the existing Puller writer."""

	entries = create_account_list_entries(run_id, is_new=variant == 'new')
	seed_refresh_run(puller_database, run_id, entries, completed_at=completed_at)
	return entries


class SymbolAccountListDatabaseTest(TestCase):
	@staticmethod
	def _create_database(db_config):
		return SymbolDatabase(db_config, NATIVE_MOSAIC_INFO, clock=lambda: NOW)

	def _assert_account_list_order(self, query, expected_addresses):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_accounts(writer)
			with self._create_database(config) as database:
				# Act:
				result = database.get_account_list(query, 7200, 7)

		# Assert:
		self.assertEqual(expected_addresses, [row.address for row in result])

	def test_get_account_list_orders_id_by_account_search_order(self):
		self._assert_account_list_order(
			list_query(AccountSortField.ID), [account_address(2), account_address(3), account_address(1), account_address(4)])

	def test_get_account_list_orders_importance_descending(self):
		self._assert_account_list_order(
			list_query(AccountSortField.IMPORTANCE), [account_address(1), account_address(3), account_address(4), account_address(2)])

	def test_get_account_list_orders_native_balance_descending_with_address_ties(self):
		self._assert_account_list_order(
			list_query(AccountSortField.BALANCE, NATIVE_MOSAIC_ID), [account_address(3), account_address(1), account_address(2)])

	def test_get_account_list_filters_harvesting_before_rank_pagination(self):
		# Arrange: account 1 is exactly at cutoff; account 2 is signer-only; account 3 is recent; account 4 is above the watermark.
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_accounts(writer)
			writer.upsert_blocks([
				create_symbol_block(1, timestamp=NOW - timedelta(days=7), beneficiary_address=account_address(1), signer_address=account_address(2)),
				create_symbol_block(2, timestamp=NOW - timedelta(days=7, seconds=1), beneficiary_address=account_address(2)),
				create_symbol_block(3, timestamp=NOW + timedelta(seconds=1), beneficiary_address=account_address(3)),
				{
					**create_symbol_block(1, timestamp=NOW, beneficiary_address=account_address(4)),
					'height': 101, 'hash': bytes([101]) * 32, 'previous_hash': bytes([100]) * 32
				}
			])
			with self._create_database(config) as database:
				# Act:
				result = database.get_account_list(list_query(AccountSortField.ID, limit=1, is_harvesting=True), 7200, 7)

		# Assert:
		self.assertEqual([account_address(3)], [row.address for row in result])
		self.assertEqual([True], [row.is_harvesting_active for row in result])

	def test_get_account_list_harvesting_uses_beneficiary_boundaries_and_watermark(self):
		# Arrange: beneficiary activity includes before, equal, and after cutoff cases;
		# signer-only and above-watermark blocks are decoys. Persisted flags are stale.
		cutoff = NOW - timedelta(days=7)
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_accounts(writer)
			writer.upsert_blocks([
				create_symbol_block(1, timestamp=cutoff - timedelta(seconds=1), beneficiary_address=account_address(1)),
				create_symbol_block(2, timestamp=cutoff, beneficiary_address=account_address(99), signer_address=account_address(2)),
				create_symbol_block(3, timestamp=cutoff, beneficiary_address=account_address(3), signer_address=account_address(2)),
				create_symbol_block(4, timestamp=cutoff + timedelta(seconds=1), beneficiary_address=account_address(4)),
				create_symbol_block(5, timestamp=NOW - timedelta(seconds=1), beneficiary_address=account_address(4)),
				{
					**create_symbol_block(1, timestamp=NOW, beneficiary_address=account_address(1)),
					'height': 101, 'hash': bytes([101]) * 32, 'previous_hash': bytes([100]) * 32
				}
			])
			with writer.connection.cursor() as cursor:
				cursor.execute('UPDATE symbol_accounts SET is_harvesting_active = TRUE WHERE address = %s', (account_address(1),))
			writer.connection.commit()
			with self._create_database(config) as database:
				# Act: compute both filtered and unfiltered views from the same snapshot.
				active = database.get_account_list(list_query(AccountSortField.ID, is_harvesting=True), 7200, 7)
				all_records = database.get_account_list(list_query(AccountSortField.ID), 7200, 7)

		# Assert: equality is inclusive, signer-only is ignored, and watermark is inclusive boundary.
		self.assertEqual([account_address(3), account_address(4)], [row.address for row in active])
		self.assertEqual([False, True, False, True], [row.is_harvesting_active for row in all_records])

	def test_get_account_list_filters_before_offset_for_all_scopes(self):
		for sort_field, mosaic_id, expected in (
			(AccountSortField.ID, None, [1]),
			(AccountSortField.IMPORTANCE, None, [3]),
			(AccountSortField.BALANCE, NATIVE_MOSAIC_ID, [1]),
			(AccountSortField.BALANCE, CUSTOM_MOSAIC_ID, [3]),
			(AccountSortField.HEIGHT, None, [3])
		):
			with self.subTest(sort_field=sort_field, mosaic_id=mosaic_id):
				# Arrange: inactive account 2 precedes active accounts in ID rank.
				with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
					seed_accounts(writer)
					writer.upsert_blocks([
						create_symbol_block(1, timestamp=NOW, beneficiary_address=account_address(3)),
						create_symbol_block(2, timestamp=NOW, beneficiary_address=account_address(1)),
						create_symbol_block(3, timestamp=NOW, beneficiary_address=account_address(4))
					])
					with self._create_database(config) as database:
						# Act:
						result = database.get_account_list(
							list_query(sort_field, mosaic_id, limit=1, offset=1, is_harvesting=True), 7200, 7)

				# Assert:
				self.assertEqual([account_address(identity) for identity in expected], [row.address for row in result])

	def test_get_account_list_filtered_short_and_empty_pages(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_accounts(writer)
			writer.upsert_blocks([
				create_symbol_block(1, timestamp=NOW, beneficiary_address=account_address(3)),
				create_symbol_block(2, timestamp=NOW, beneficiary_address=account_address(1)),
				create_symbol_block(3, timestamp=NOW, beneficiary_address=account_address(4))
			])
			with self._create_database(config) as database:
				# Act:
				short_page = database.get_account_list(list_query(AccountSortField.ID, limit=2, offset=2, is_harvesting=True), 7200, 7)
				empty_page = database.get_account_list(list_query(AccountSortField.ID, limit=2, offset=3, is_harvesting=True), 7200, 7)

		# Assert:
		self.assertEqual([account_address(4)], [row.address for row in short_page])
		self.assertEqual([], empty_page)

	def test_get_account_list_rejects_corrupt_rank_with_harvesting_filter(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_accounts(writer)
			writer.upsert_blocks([create_symbol_block(1, timestamp=NOW, beneficiary_address=account_address(3))])
			with writer.connection.cursor() as cursor:
				cursor.execute(
					'UPDATE symbol_account_list_ranks SET address = %s WHERE refresh_run_id = %s AND rank_scope = %s AND rank = 0',
					(account_address(99), 'selected-run', 'ID'))
			writer.connection.commit()
			with self._create_database(config) as database:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable) as context:
					database.get_account_list(list_query(AccountSortField.ID, is_harvesting=True), 7200, 7)
				self.assertEqual('Symbol account list ranks are unavailable', str(context.exception))

	def test_get_account_list_orders_height_from_current_accounts_and_rejects_missing_rows(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_accounts(writer)
			with writer.connection.cursor() as cursor:
				cursor.execute(
					'UPDATE symbol_accounts SET address_height = CASE WHEN address = %s THEN 10 WHEN address = %s THEN 10 '
					'WHEN address = %s THEN NULL ELSE 5 END',
					(account_address(1), account_address(2), account_address(3)))
			writer.connection.commit()
			with self._create_database(config) as database:
				# Act:
				result = database.get_account_list(list_query(AccountSortField.HEIGHT), 7200, 7)

			# Assert:
			self.assertEqual(
				[account_address(1), account_address(2), account_address(4), account_address(3)],
				[row.address for row in result])

			# Arrange: a missing current row invalidates the complete HEIGHT population.
			with writer.connection.cursor() as cursor:
				cursor.execute('DELETE FROM symbol_account_mosaics WHERE address = %s', (account_address(4),))
				cursor.execute('DELETE FROM symbol_accounts WHERE address = %s', (account_address(4),))
			writer.connection.commit()
			with self._create_database(config) as database:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable) as context:
					database.get_account_list(list_query(AccountSortField.HEIGHT), 7200, 7)
				self.assertEqual('Symbol account height data is unavailable', str(context.exception))

	def test_get_account_list_bulk_multisig_uses_cosignatories_only(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_accounts(writer)
			for identity, cosignatories, multisig_addresses in (
				(2, [], [account_address(1)]),
				(3, [account_address(1)], []),
				(1, [account_address(2)], [account_address(3)])):
				writer.upsert_multisig(account_address(identity), {
					'address': account_address(identity), 'min_approval': 1, 'min_removal': 1,
					'cosignatory_addresses': cosignatories, 'multisig_addresses': multisig_addresses,
					'updated_at_height': 100
				})
			with self._create_database(config) as database:
				# Act:
				result = database.get_account_list(list_query(AccountSortField.ID), 7200, 7)

		# Assert:
		self.assertEqual([False, True, True, False], [row.multisig is not None and bool(row.multisig.cosignatory_addresses) for row in result])

	def test_get_account_list_distinguishes_native_zero_and_missing_rows(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (db_config, puller_database):
			seed_accounts(puller_database)
			database = self._create_database(db_config)
			try:
				# Act:
				all_accounts = database.get_account_list(list_query(AccountSortField.ID), 7200, 7)
				native_holders = database.get_account_list(list_query(AccountSortField.BALANCE, NATIVE_MOSAIC_ID), 7200, 7)
			finally:
				database.close()

		# Assert:
		self.assertEqual([account_address(2), account_address(3), account_address(1), account_address(4)], [row.address for row in all_accounts])
		self.assertEqual([account_address(3), account_address(1), account_address(2)], [row.address for row in native_holders])
		self.assertFalse(any(mosaic.mosaic_id == NATIVE_MOSAIC_ID for mosaic in next(
			row for row in all_accounts if row.address == account_address(4)).mosaics))

	def test_get_account_list_custom_balance_is_independent_and_has_no_rank_requirement(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (db_config, puller_database):
			seed_accounts(puller_database)
			with puller_database.connection.cursor() as cursor:
				cursor.execute(
					'DELETE FROM symbol_account_list_ranks WHERE refresh_run_id = %s AND rank_scope = %s',
					('selected-run', f'BALANCE:{CUSTOM_MOSAIC_ID}'))
			puller_database.connection.commit()
			database = self._create_database(db_config)
			try:
				# Act:
				result = database.get_account_list(list_query(AccountSortField.BALANCE, CUSTOM_MOSAIC_ID), 7200, 7)
			finally:
				database.close()

		# Assert:
		self.assertEqual([account_address(4), account_address(3), account_address(1), account_address(2)], [row.address for row in result])
		self.assertEqual(CUSTOM_MOSAIC_ID, result[0].balance_mosaic_id)

	def test_get_account_list_returns_empty_for_unknown_custom_mosaic(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_accounts(writer)
			with self._create_database(config) as database:
				# Act:
				result = database.get_account_list(list_query(AccountSortField.BALANCE, 'FEDCBA9876543210'), 7200, 7)

		# Assert:
		self.assertEqual([], result)

	def test_get_account_list_returns_empty_for_offset_beyond_healthy_id_ranks(self):
		# Arrange: the successful run has four Accounts and complete ID ranks.
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_accounts(writer)
			with self._create_database(config) as database:
				# Act:
				result = database.get_account_list(list_query(AccountSortField.ID, offset=100000), 7200, 7)

		# Assert:
		self.assertEqual([], result)

	def test_get_account_list_rejects_refreshing_or_unhealthy_refresh(self):
		for status in ('refreshing', 'unhealthy'):
			with self.subTest(refresh_status=status):
				# Arrange: every status owns a fresh healthy sync state and successful refresh run.
				with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
					seed_accounts(writer)
					writer.upsert_account_refresh_state({'status': status})
					with self._create_database(config) as database:
						# Act:
						with self.assertRaises(SymbolDataUnavailable) as context:
							database.get_account_list(list_query(AccountSortField.ID), 7200, 7)

						# Assert:
						self.assertEqual('Symbol account refresh data is unavailable', str(context.exception))

	def test_get_account_list_rejects_repairing_sync_with_healthy_refresh(self):
		# Arrange: create a healthy successful refresh, then change only the sync gate.
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_accounts(writer)
			writer.upsert_sync_state(create_symbol_sync_state(100, 100, status='repairing'))
			with self._create_database(config) as database:
				# Act:
				with self.assertRaises(SymbolDataUnavailable) as context:
					database.get_account_list(list_query(AccountSortField.ID), 7200, 7)

				# Assert:
				self.assertEqual('Symbol account data is unavailable', str(context.exception))

	def test_get_account_list_rejects_each_required_rank_corruption(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (db_config, puller_database):
			seed_accounts(puller_database)
			database = self._create_database(db_config)
			try:
				mutations = (
					('address', 'UPDATE symbol_account_list_ranks SET address = %s WHERE refresh_run_id = %s AND rank_scope = %s AND rank = 0',
						(account_address(99), 'selected-run', 'ID')),
					('duplicate member', 'UPDATE symbol_account_list_ranks SET address = %s WHERE refresh_run_id = %s AND rank_scope = %s AND rank = 1',
						(account_address(2), 'selected-run', 'ID')),
					('rank hole', 'DELETE FROM symbol_account_list_ranks WHERE refresh_run_id = %s AND rank_scope = %s AND rank = 1',
						('selected-run', 'ID')),
					('extra rank', 'INSERT INTO symbol_account_list_ranks '
						'(refresh_run_id, rank_scope, rank, address, sort_value_numeric, mosaic_id) VALUES (%s, %s, %s, %s, %s, %s)',
						('selected-run', 'ID', 4, account_address(99), None, None)),
					('sort value', 'UPDATE symbol_account_list_ranks SET sort_value_numeric = 99 '
						'WHERE refresh_run_id = %s AND rank_scope = %s AND rank = 0',
						('selected-run', 'IMPORTANCE')),
					('mosaic', 'UPDATE symbol_account_list_ranks SET mosaic_id = %s WHERE refresh_run_id = %s AND rank_scope = %s AND rank = 0',
						('0000000000000001', 'selected-run', f'BALANCE:{NATIVE_MOSAIC_ID}')),
				)
				for name, statement, parameters in mutations:
					with self.subTest(name=name):
						# Arrange: corrupt one requested scope before the read.
						with puller_database.connection.cursor() as cursor:
							cursor.execute(statement, parameters)
						puller_database.connection.commit()
						query = {
							'sort value': list_query(AccountSortField.IMPORTANCE),
							'mosaic': list_query(AccountSortField.BALANCE, NATIVE_MOSAIC_ID)
						}.get(name, list_query(AccountSortField.ID))

						# Act:
						with self.assertRaises(SymbolDataUnavailable) as context:
							database.get_account_list(query, 7200, 7)

						# Assert:
						self.assertEqual('Symbol account list ranks are unavailable', str(context.exception))

						# Cleanup: rebuild all ranks before the next corruption case.
						puller_database.finalize_account_refresh('selected-run', NATIVE_MOSAIC_ID, 100, REFRESH_COMPLETED_AT)
			finally:
				database.close()

	def test_get_account_list_reuses_pool_after_sql_failure(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_accounts(writer)
			with FailingAccountListDatabase(config, NATIVE_MOSAIC_INFO, lambda: NOW) as database:
				# Act: fail after reading the page through the public DB entrypoint.
				with self.assertRaises(PsycopgError) as context:
					database.get_account_list(list_query(AccountSortField.ID), 7200, 7)

				# Assert:
				self.assertIsInstance(context.exception, PsycopgError)

				# Arrange: stop the injection while retaining the same connection pool.
				database.should_fail = False

				# Act:
				result = database.get_account_list(list_query(AccountSortField.ID), 7200, 7)

				# Assert:
				self.assertEqual(_expected_records(_old_record_rows()), result)


def _expected_records(rows, balance_id=NATIVE_MOSAIC_ID, custom_metadata=None, namespace_names=None):
	metadata_id, divisibility, owner, aliases = custom_metadata or (None, None, None, ())
	return [AccountListRecord(
		account_address(identity), public_key, account_type, Decimal(ratio), balance_id,
		(namespace_names or {}).get(identity, ()), tuple(MosaicRecord(
			mosaic_id, amount, metadata_id if mosaic_id == CUSTOM_MOSAIC_ID else None,
			divisibility if mosaic_id == CUSTOM_MOSAIC_ID else None,
			owner if mosaic_id == CUSTOM_MOSAIC_ID else None,
			aliases if mosaic_id == CUSTOM_MOSAIC_ID else ()) for mosaic_id, amount in mosaic_rows))
		for identity, ratio, public_key, account_type, mosaic_rows in rows]


def _old_record_rows():
	return [
		(2, '0.1', None, 'main', [(CUSTOM_MOSAIC_ID, 0), (NATIVE_MOSAIC_ID, 0)]),
		(3, '0.3', None, 'main', [(CUSTOM_MOSAIC_ID, 100), (NATIVE_MOSAIC_ID, 50)]),
		(1, '0.4', None, 'main', [(CUSTOM_MOSAIC_ID, 100), (NATIVE_MOSAIC_ID, 50)]),
		(4, '0.2', None, 'main', [(CUSTOM_MOSAIC_ID, 200)])
	]


def _new_record_rows():
	return [
		(4, '0.3', bytes([14]) * 32, 'main', [(CUSTOM_MOSAIC_ID, 300), (NATIVE_MOSAIC_ID, 0)]),
		(3, '0.2', bytes([13]) * 32, 'main', [(CUSTOM_MOSAIC_ID, 25), (NATIVE_MOSAIC_ID, 25)]),
		(2, '0.4', bytes([12]) * 32, 'remote', [(CUSTOM_MOSAIC_ID, 10), (NATIVE_MOSAIC_ID, 20)]),
		(1, '0.1', bytes([11]) * 32, 'main', [(CUSTOM_MOSAIC_ID, 200), (NATIVE_MOSAIC_ID, 10)])
	]


@pytest.mark.parametrize('sort_field,mosaic_id,indices', [
	(AccountSortField.ID, None, [0, 1, 2, 3]),
	(AccountSortField.IMPORTANCE, None, [2, 1, 3, 0]),
	(AccountSortField.BALANCE, NATIVE_MOSAIC_ID, [1, 2, 0]),
	(AccountSortField.BALANCE, CUSTOM_MOSAIC_ID, [3, 1, 2, 0])
], ids=['id', 'importance', 'native-balance', 'custom-balance'])
def test_list_excludes_other_run_decoys(sort_field, mosaic_id, indices):
	# Arrange: same addresses, different values/order; failed run also overwrites current rows.
	with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
		seed_accounts(writer, 'old-run', variant='new')
		seed_accounts(writer)
		failed_entries = create_account_list_entries('failed-run', is_new=True)
		failed_entries.append(create_refresh_entry('failed-run', 5, 4, 10, mosaic_rows=[(CUSTOM_MOSAIC_ID, 900)]))
		writer.upsert_account_refresh_page(failed_entries, last_scanned_page=1)
		writer.upsert_account_refresh_state({'status': 'healthy'})
		expected = _expected_records([_old_record_rows()[index] for index in indices], mosaic_id or NATIVE_MOSAIC_ID)
		with SymbolDatabase(config, NATIVE_MOSAIC_INFO, clock=lambda: NOW) as reader:
			# Act:
			result = reader.get_account_list(list_query(sort_field, mosaic_id), 7200, 7)

	# Assert:
	assert expected == result


@pytest.mark.parametrize('change', ['run', 'metadata'])
def test_list_db_repeatable_read(change):
	# Arrange:
	with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
		seed_accounts(writer, 'old-run')
		seed_accounts(writer, 'new-run', variant='new')
		writer.upsert_account_refresh_state({'last_successful_run_id': 'old-run'})
		seed_current_mosaic(writer, CUSTOM_MOSAIC_ID, 2, account_address(1))
		seed_alias(writer, 'account', str(Address(account_address(1))), 'before.account')
		seed_alias(writer, 'mosaic', CUSTOM_MOSAIC_ID, 'before.mosaic')
		before_metadata = (CUSTOM_MOSAIC_ID, 2, account_address(1), ('before.mosaic',))
		expected_old = _expected_records(_old_record_rows(), custom_metadata=before_metadata, namespace_names={1: ('before.account',)})

		def update():
			if change == 'run':
				writer.upsert_account_refresh_state({'last_successful_run_id': 'new-run'})
			else:
				with writer.connection.cursor() as cursor:
					cursor.execute('UPDATE symbol_alias_names SET name = \'after.account\' WHERE artifact_type = \'account\'')
					cursor.execute('UPDATE symbol_alias_names SET name = \'after.mosaic\' WHERE artifact_type = \'mosaic\'')
					cursor.execute(
						'UPDATE symbol_mosaics SET divisibility = 3, owner_address = %s WHERE mosaic_id = %s',
						(account_address(4), CUSTOM_MOSAIC_ID))
				writer.connection.commit()

		with PausingAccountListDatabase(config, NATIVE_MOSAIC_INFO, lambda: NOW) as reader:
			# Act:
			result = read_during_database_snapshot(reader, lambda: reader.get_account_list(list_query(AccountSortField.ID), 7200, 7), update)
			next_result = reader.get_account_list(list_query(AccountSortField.ID), 7200, 7)

	# Assert:
	assert ('repeatable read', 'on') == reader.transaction_settings
	assert expected_old == result
	if change == 'run':
		assert _expected_records(_new_record_rows(), custom_metadata=before_metadata, namespace_names={1: ('before.account',)}) == next_result
	else:
		assert _expected_records(
			_old_record_rows(), custom_metadata=(CUSTOM_MOSAIC_ID, 3, account_address(4), ('after.mosaic',)),
			namespace_names={1: ('after.account',)}) == next_result


@pytest.mark.parametrize('seconds', [pytest.param(7199, id='before-max-age'), pytest.param(7200, id='at-max-age')])
def test_list_allows_fresh_age_boundary(seconds):
	# Arrange:
	with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
		seed_accounts(writer)
		with SymbolDatabase(config, NATIVE_MOSAIC_INFO, clock=lambda: REFRESH_COMPLETED_AT + timedelta(seconds=seconds)) as reader:
			# Act:
			result = reader.get_account_list(list_query(AccountSortField.ID), 7200, 7)

	# Assert:
	assert _expected_records(_old_record_rows()) == result


def test_list_rejects_expired_refresh():
	# Arrange:
	with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
		seed_accounts(writer)
		with SymbolDatabase(config, NATIVE_MOSAIC_INFO, clock=lambda: REFRESH_COMPLETED_AT + timedelta(seconds=7201)) as reader:
			# Act:
			with pytest.raises(SymbolDataUnavailable) as exception_info:
				reader.get_account_list(list_query(AccountSortField.ID), 7200, 7)

	# Assert:
	assert 'Symbol account refresh data is unavailable' == str(exception_info.value)


def test_list_importance_desc_and_ties():
	# Arrange:
	with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
		entries = [
			create_refresh_entry('tie-run', identity, order, importance)
			for identity, order, importance in ((1, 0, 5), (2, 1, 1), (3, 2, 5))
		]
		seed_refresh_run(writer, 'tie-run', entries)
		with SymbolDatabase(config, NATIVE_MOSAIC_INFO, clock=lambda: NOW) as reader:
			# Act:
			result = reader.get_account_list(list_query(AccountSortField.IMPORTANCE), 7200, 7)

	# Assert:
	assert [account_address(3), account_address(1), account_address(2)] == [row.address for row in result]
	assert [(), (), ()] == [row.mosaics for row in result]


def test_list_native_empty_without_rows():
	# Arrange:
	with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
		seed_refresh_run(writer, 'native-empty-run', [create_refresh_entry('native-empty-run', 1, 0, 1)])
		with SymbolDatabase(config, NATIVE_MOSAIC_INFO, clock=lambda: NOW) as reader:
			# Act:
			result = reader.get_account_list(list_query(AccountSortField.BALANCE, NATIVE_MOSAIC_ID), 7200, 7)

	# Assert:
	assert [] == result


def test_list_empty_successful_run():
	# Arrange:
	with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
		seed_refresh_run(writer, 'empty-run', [])
		with SymbolDatabase(config, NATIVE_MOSAIC_INFO, clock=lambda: NOW) as reader:
			# Act:
			result = reader.get_account_list(list_query(AccountSortField.ID), 7200, 7)

	# Assert:
	assert [] == result


@pytest.mark.parametrize('chain_height,finalized_epoch,naive_clock', [
	pytest.param(200, 1, False, id='healthy-chain-lag'),
	pytest.param(100, None, False, id='missing-finalized-epoch'),
	pytest.param(100, 1, True, id='naive-clock-is-utc')
])
def test_list_allows_healthy_context(chain_height, finalized_epoch, naive_clock):
	# Arrange:
	sync_state = create_symbol_sync_state(100, 100, chain_height=chain_height, finalized_epoch=finalized_epoch)
	with symbol_test_database(sync_state) as (config, writer):
		seed_accounts(writer)
		clock = NOW.replace(tzinfo=None) if naive_clock else NOW
		with SymbolDatabase(config, NATIVE_MOSAIC_INFO, clock=lambda: clock) as reader:
			# Act:
			result = reader.get_account_list(list_query(AccountSortField.ID), 7200, 7)

	# Assert:
	assert _expected_records(_old_record_rows()) == result


def test_list_custom_keeps_zero_holders():
	# Arrange: IDs 4/5 are Accounts but have no selected custom row; ID 2 has a persisted zero.
	with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
		entries = [
			create_refresh_entry('custom-holders-run', 1, 0, 1, mosaic_rows=[(CUSTOM_MOSAIC_ID, 100)]),
			create_refresh_entry('custom-holders-run', 2, 1, 1, mosaic_rows=[(CUSTOM_MOSAIC_ID, 0)]),
			create_refresh_entry('custom-holders-run', 3, 2, 1, mosaic_rows=[(CUSTOM_MOSAIC_ID, 100)]),
			create_refresh_entry('custom-holders-run', 4, 3, 1),
			create_refresh_entry('custom-holders-run', 5, 4, 1, mosaic_rows=[('0000000000000001', 999)])
		]
		seed_refresh_run(writer, 'custom-holders-run', entries)
		with SymbolDatabase(config, NATIVE_MOSAIC_INFO, clock=lambda: NOW) as reader:
			# Act:
			result = reader.get_account_list(list_query(AccountSortField.BALANCE, CUSTOM_MOSAIC_ID), 7200, 7)

	# Assert:
	assert _expected_records([
		(3, '.2', None, 'main', [(CUSTOM_MOSAIC_ID, 100)]),
		(1, '.2', None, 'main', [(CUSTOM_MOSAIC_ID, 100)]),
		(2, '.2', None, 'main', [(CUSTOM_MOSAIC_ID, 0)])
	], CUSTOM_MOSAIC_ID) == result


@pytest.mark.parametrize('statement,parameters', [
	('DELETE FROM symbol_account_list_ranks WHERE refresh_run_id = %s AND rank_scope = %s', ('selected-run', 'ID')),
	('UPDATE symbol_account_list_ranks SET rank = rank + 1 WHERE refresh_run_id = %s AND rank_scope = %s AND rank = 3',
		('selected-run', 'ID')),
	(
		'UPDATE symbol_account_list_ranks SET address = CASE rank WHEN 0 THEN %s WHEN 1 THEN %s ELSE address END '
		'WHERE refresh_run_id = %s AND rank_scope = %s', (account_address(3), account_address(2), 'selected-run', 'ID'))
], ids=['missing-scope', 'rank-gap', 'continuous-but-wrong-order'])
def test_list_rejects_bad_rank_deep_page(statement, parameters):
	# Arrange: last case has continuous ranks and unique members but the wrong order.
	with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
		seed_accounts(writer)
		with writer.connection.cursor() as cursor:
			cursor.execute(statement, parameters)
		writer.connection.commit()
		with SymbolDatabase(config, NATIVE_MOSAIC_INFO, clock=lambda: NOW) as reader:
			# Act:
			with pytest.raises(SymbolDataUnavailable) as exception_info:
				reader.get_account_list(list_query(AccountSortField.ID, offset=100000), 7200, 7)

	# Assert:
	assert 'Symbol account list ranks are unavailable' == str(exception_info.value)


def test_list_aliases_without_mosaics():
	# Arrange: account 1 has aliases but no Mosaic rows; other page members cover multiple IDs.
	with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
		entries = create_account_list_entries()
		entries[0]['mosaic_rows'] = []
		seed_refresh_run(writer, 'selected-run', entries)
		seed_current_mosaic(writer, CUSTOM_MOSAIC_ID, 2, account_address(1))
		alias_rows = (
			('account', str(Address(account_address(1))), 'zeta'),
			('account', str(Address(account_address(1))), 'alpha'),
			('account', str(Address(account_address(2))), 'beta'),
			('mosaic', CUSTOM_MOSAIC_ID, 'zeta'),
			('mosaic', CUSTOM_MOSAIC_ID, 'alpha'),
			('mosaic', NATIVE_MOSAIC_ID, 'omega'),
			('mosaic', NATIVE_MOSAIC_ID, 'mu'),
			('namespace', str(Address(account_address(1))), 'not.an.account.alias'))
		for artifact_type, artifact_id, name in alias_rows:
			seed_alias(writer, artifact_type, artifact_id, name)
		with SymbolDatabase(config, NATIVE_MOSAIC_INFO, clock=lambda: NOW) as reader:
			# Act:
			result = reader.get_account_list(list_query(AccountSortField.ID), 7200, 7)

	# Assert:
	records = {record.address: record for record in result}
	assert ('alpha', 'zeta') == records[account_address(1)].namespaces
	assert () == records[account_address(1)].mosaics
	assert ('beta',) == records[account_address(2)].namespaces
	assert (
		(CUSTOM_MOSAIC_ID, ('alpha', 'zeta')),
		(NATIVE_MOSAIC_ID, ('mu', 'omega'))
	) == tuple((mosaic.mosaic_id, mosaic.alias_names) for mosaic in records[account_address(3)].mosaics)


def test_list_rejects_missing_native():
	# Arrange:
	with symbol_test_database() as (config, _):
		with SymbolDatabase(config) as reader:
			# Act:
			with pytest.raises(SymbolDataUnavailable) as exception_info:
				reader.get_account_list(list_query(AccountSortField.ID), 7200, 7)

	# Assert:
	assert 'Symbol account list native mosaic is unavailable' == str(exception_info.value)


@pytest.mark.parametrize('seconds,is_active', [(-1, False), (0, True), (1, True)], ids=['before', 'equal', 'after'])
def test_list_harvesting_cutoff(seconds, is_active):
	# Arrange: the sole block is at the watermark and the persisted flag deliberately disagrees.
	with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
		seed_accounts(writer)
		block = create_symbol_block(
			1, timestamp=NOW - timedelta(days=7) + timedelta(seconds=seconds),
			beneficiary_address=account_address(1), signer_address=account_address(2))
		block['height'] = 100
		writer.upsert_blocks([block])
		with writer.connection.cursor() as cursor:
			cursor.execute('UPDATE symbol_accounts SET is_harvesting_active = %s WHERE address = %s', (not is_active, account_address(1)))
		writer.connection.commit()
		with SymbolDatabase(config, NATIVE_MOSAIC_INFO, clock=lambda: NOW) as reader:
			# Act:
			rows = reader.get_account_list(list_query(AccountSortField.ID), 7200, 7)
			filtered = reader.get_account_list(list_query(AccountSortField.ID, is_harvesting=True), 7200, 7)

	# Assert:
	assert [False, False, is_active, False] == [row.is_harvesting_active for row in rows]
	assert ([account_address(1)] if is_active else []) == [row.address for row in filtered]
