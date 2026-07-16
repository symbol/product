# pylint: disable=duplicate-code,too-many-lines
import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from psycopg2 import Error as PsycopgError
from symbolchain.sc import ReceiptType
from symbolchain.symbol.Network import Address
from symbollightapi.model.Exceptions import NodeException

from puller.db.SymbolDatabase import SymbolDatabase
from puller.facade.SymbolPuller import ACCOUNT_BATCH_FETCH_SIZE
from puller.model.symbol.Account import create_account_row
from puller.model.symbol.Block import create_block_row

from .puller_test_utils import (
	BENEFICIARY_ADDRESS,
	NATIVE_MOSAIC_ID,
	RECIPIENT_ADDRESS,
	FakeConnector,
	SymbolPullerTestBase,
	create_account_item,
	create_node_block,
	create_node_transaction,
	create_statement_item,
	set_symbol_connector,
	statement_path,
	transaction_path
)


class MalformedAccountsBatchConnector(FakeConnector):
	async def post(self, url_path, request_payload, *_):
		self.paths.append(url_path)
		if 'accounts' == url_path:
			return {'data': []}

		raise KeyError(url_path)


def _address_hex(index):
	return f'98{index:046X}'


def _strip_id(rest_record):
	return {key: value for key, value in rest_record.items() if 'id' != key}


def _expected_importance_percentage(importance, total_importance):
	return (Decimal(importance) / Decimal(total_importance)).quantize(Decimal('0.00000000000000000001'))


class FailingAccountsConnector(FakeConnector):
	async def get(self, url_path, *args):
		if url_path.startswith('accounts?pageSize=100&pageNumber=2'):
			raise RuntimeError('page 2 failed')

		return await super().get(url_path, *args)


class RefreshFailureError(RuntimeError):
	"""Identifies the refresh operation error independently from state persistence errors."""


class FailureStateRecordingError(RuntimeError):
	"""Identifies the failure-state persistence error in the test adapter."""


class RefreshFailureConnector(FakeConnector):
	def __init__(self, refresh_error):
		super().__init__(1, {}, account_pages={1: []})
		self.refresh_error = refresh_error

	async def get(self, url_path, *args):
		if url_path.startswith('accounts?pageSize=100&pageNumber=1'):
			raise self.refresh_error

		return await super().get(url_path, *args)


class FailureStateRecordingDatabase:
	def __init__(self, database):
		self.database = database
		self.failure_state_errors = []

	def __getattr__(self, name):
		return getattr(self.database, name)

	def mark_account_refresh_failed(self, last_error):
		self.failure_state_errors.append(last_error)
		raise FailureStateRecordingError('failure-state persistence failed')


class MalformedAccountsConnector(FakeConnector):
	async def get(self, url_path, *args):
		if url_path.startswith('accounts?pageSize=100&pageNumber=1'):
			self.paths.append(url_path)
			return {'pagination': {'pageNumber': 1}}

		return await super().get(url_path, *args)


class SymbolPullerAccountsTest(SymbolPullerTestBase):  # pylint: disable=too-many-public-methods
	@staticmethod
	def _address_text(address_hex=BENEFICIARY_ADDRESS):
		return str(Address.from_decoded_address_hex_string(address_hex))

	def _account_by_address_text(self, *address_hex_values):
		return {
			self._address_text(address_hex): create_account_item(address_hex=address_hex)
			for address_hex in address_hex_values
		}

	def _fetch_account_current_state(self, address_hex=BENEFICIARY_ADDRESS):
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'''
			SELECT importance, importance_percentage, is_harvesting_active, is_eligible_for_harvesting, last_seen_height
			FROM symbol_accounts
			WHERE address = %s
			''',
			(bytes.fromhex(address_hex),))

		return cursor.fetchone()

	def _fetch_account_count(self, address_hex=BENEFICIARY_ADDRESS):
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'SELECT COUNT(*) FROM symbol_accounts WHERE address = %s',
			(bytes.fromhex(address_hex),))

		return cursor.fetchone()[0]

	@staticmethod
	def _create_rollback_sync_state(status='repairing'):
		return {
			'status': status,
			'chain_height': 1,
			'finalized_height': 0,
			'finalized_hash': b'finalized',
			'finalized_epoch': 0,
			'finalized_point': 0,
			'last_synced_height': 0,
			'last_synced_block_hash': b'last'
		}

	@staticmethod
	def _raw_network_timestamp(days_ago=0):
		return str(int(((datetime.now(timezone.utc) - timedelta(days=days_ago)).timestamp() - 100) * 1000))

	def _create_block(self, height, days_ago=0, **block_overrides):
		return create_node_block(height, timestamp=self._raw_network_timestamp(days_ago), **block_overrides)

	def _sync_blocks(self, blocks, account_item=None, multisig_by_address=None):
		address_text = self._address_text()
		connector = FakeConnector(
			max(int(block['block']['height']) for block in blocks),
			{0: blocks},
			account_by_address={address_text: account_item or create_account_item()},
			multisig_by_address=multisig_by_address)

		self._sync_with_connector(connector)

		return connector

	def test_refresh_dirty_accounts_for_batch_upserts_beneficiary_account_once_per_batch(self):
		# Arrange:
		address_text = self._address_text()
		blocks = [self._create_block(1), self._create_block(2)]

		# Act:
		connector = self._sync_blocks(blocks, create_account_item(importance='321'))

		# Assert:
		self.assertEqual(1, connector.paths.count('accounts'))
		self.assertEqual([{'addresses': [address_text]}], connector.post_payloads)
		self.assertEqual((321, 0, True, True, 2), self._fetch_account_current_state())

	def test_refresh_dirty_accounts_for_batch_does_not_mark_transaction_participant_as_inactive_harvester(self):
		# Arrange:
		account_row, mosaic_rows = self._create_current_account_row(address_hex=RECIPIENT_ADDRESS, importance='100')
		account_row['is_harvesting_active'] = True
		self.puller.symbol_db.upsert_account_current_state(account_row, mosaic_rows)
		connector = FakeConnector(
			1,
			{0: [self._create_block(1, days_ago=8)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [create_node_transaction(1)]}
			},
			account_by_address=self._account_by_address_text(BENEFICIARY_ADDRESS, RECIPIENT_ADDRESS))

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(
			(100, 0, True, True, 1),
			self._fetch_account_current_state(RECIPIENT_ADDRESS))

	def test_refresh_dirty_accounts_for_batch_ignores_namespace_alias_transaction_participant(self):
		# Arrange:
		alias_address = '99065A28385EB5AE88000000000000000000000000000000'
		beneficiary_address_text = self._address_text()
		connector = FakeConnector(
			1,
			{0: [self._create_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {
					'data': [create_node_transaction(1, recipientAddress=alias_address)]
				}
			},
			account_by_address=self._account_by_address_text(BENEFICIARY_ADDRESS))

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([{'addresses': [beneficiary_address_text]}], connector.post_payloads)

	def test_refresh_dirty_accounts_for_batch_prefers_beneficiary_timestamp_when_address_is_also_transaction_participant(self):
		# Arrange: BENEFICIARY_ADDRESS is only a transaction participant at height 1 (old block, outside the
		# harvesting-active window) and the block beneficiary at height 2 (recent block, inside the window) —
		# if the wrong source's timestamp were used, is_harvesting_active would come out False.
		connector = FakeConnector(
			2,
			{0: [self._create_block(1, days_ago=8), self._create_block(2)]},
			transactions_by_path={
				transaction_path(1, 2): {'data': [create_node_transaction(1, recipientAddress=BENEFICIARY_ADDRESS)]}
			},
			account_by_address=self._account_by_address_text(BENEFICIARY_ADDRESS))

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(1, connector.paths.count('accounts'))
		self.assertEqual([{'addresses': [self._address_text()]}], connector.post_payloads)
		self.assertEqual(True, self._fetch_account_current_state()[2])

	def test_refresh_dirty_accounts_for_batch_deduplicates_repeated_transaction_participant_addresses(self):
		# Arrange:
		beneficiary_address_text = self._address_text(BENEFICIARY_ADDRESS)
		participant_address_text = self._address_text(RECIPIENT_ADDRESS)
		connector = FakeConnector(
			1,
			{0: [self._create_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {
					'data': [
						create_node_transaction(
							1,
							transaction_hash=f'{index:064X}',
							transaction_id=f'transaction-{index}')
						for index in range(2)
					]
				}
			},
			account_by_address=self._account_by_address_text(BENEFICIARY_ADDRESS, RECIPIENT_ADDRESS))

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(1, connector.paths.count('accounts'))
		self.assertEqual(
			sorted([beneficiary_address_text, participant_address_text]),
			sorted(connector.post_payloads[0]['addresses']))

	def test_refresh_dirty_accounts_for_batch_includes_balance_change_receipt_target_address_without_matching_transaction(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [self._create_block(1)]},
			statement_pages={
				statement_path(1, 1): {
					'data': [create_statement_item(
						1,
						100,
						ReceiptType.LOCK_HASH_EXPIRED.value,
						targetAddress=RECIPIENT_ADDRESS)]
				}
			})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(1, self._fetch_account_count(RECIPIENT_ADDRESS))

	def test_refresh_dirty_accounts_for_batch_includes_balance_transfer_receipt_sender_and_recipient_addresses(self):
		# Arrange:
		recipient_address = '980202020202020202020202020202020202020202020202'
		connector = FakeConnector(
			1,
			{0: [self._create_block(1)]},
			statement_pages={
				statement_path(1, 1): {
					'data': [create_statement_item(
						1,
						100,
						ReceiptType.MOSAIC_RENTAL_FEE.value,
						senderAddress=RECIPIENT_ADDRESS,
						recipientAddress=recipient_address)]
				}
			})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(
			sorted([
				self._address_text(BENEFICIARY_ADDRESS),
				self._address_text(RECIPIENT_ADDRESS),
				self._address_text(recipient_address)
			]),
			sorted(connector.post_payloads[0]['addresses']))

	def test_refresh_dirty_accounts_for_batch_deduplicates_receipt_target_address_already_dirty_from_beneficiary(self):
		# Arrange:
		beneficiary_address_text = self._address_text()
		connector = FakeConnector(
			1,
			{0: [self._create_block(1)]},
			statement_pages={
				statement_path(1, 1): {
					'data': [create_statement_item(
						1,
						100,
						ReceiptType.HARVEST_FEE.value,
						targetAddress=BENEFICIARY_ADDRESS)]
				}
			})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(1, connector.paths.count('accounts'))
		self.assertEqual([{'addresses': [beneficiary_address_text]}], connector.post_payloads)

	def test_refresh_dirty_accounts_for_batch_ignores_receipts_without_address_fields(self):
		# Arrange:
		beneficiary_address_text = self._address_text()
		connector = FakeConnector(
			1,
			{0: [self._create_block(1)]},
			statement_pages={
				statement_path(1, 1): {'data': [create_statement_item(1, 100)]}
			})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(1, connector.paths.count('accounts'))
		self.assertEqual([{'addresses': [beneficiary_address_text]}], connector.post_payloads)

	def test_refresh_dirty_accounts_for_batch_chunks_account_fetches(self):
		# Arrange:
		participant_addresses = [
			f'98{index:046X}'
			for index in range(1, ACCOUNT_BATCH_FETCH_SIZE + 2)
		]
		transactions = [
			create_node_transaction(
				1,
				transaction_hash=f'{index:064X}',
				transaction_id=f'transaction-{index}',
				recipientAddress=address)
			for index, address in enumerate(participant_addresses)
		]
		connector = FakeConnector(
			1,
			{0: [self._create_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': transactions[:ACCOUNT_BATCH_FETCH_SIZE]},
				transaction_path(1, 1, 2): {'data': transactions[ACCOUNT_BATCH_FETCH_SIZE:]}
			})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(2, connector.paths.count('accounts'))
		self.assertEqual([ACCOUNT_BATCH_FETCH_SIZE, 2], [len(payload['addresses']) for payload in connector.post_payloads])

	def test_refresh_dirty_accounts_for_batch_rejects_malformed_accounts_batch_response(self):
		# Arrange:
		connector = MalformedAccountsBatchConnector(1, {0: [self._create_block(1)]})

		# Act / Assert:
		self._assert_sync_rejects_node_response(connector, ValueError, 'Malformed Symbol accounts batch response')

	def test_refresh_dirty_accounts_for_batch_rejects_missing_accounts_batch_item(self):
		# Arrange:
		address_text = self._address_text()
		connector = FakeConnector(
			1,
			{0: [self._create_block(1)]},
			account_by_address={address_text: create_account_item(address_hex=RECIPIENT_ADDRESS)})

		# Act / Assert:
		self._assert_sync_rejects_node_response(connector, ValueError, 'Missing Symbol accounts batch item for address')

	def test_refresh_dirty_accounts_for_batch_uses_latest_beneficiary_block_when_recent_block_is_second(self):
		# Arrange:
		account_row, mosaic_rows = self._create_current_account_row()
		account_row['is_harvesting_active'] = False
		self.puller.symbol_db.upsert_account_current_state(account_row, mosaic_rows)
		blocks = [self._create_block(1, days_ago=8), self._create_block(2)]

		# Act:
		self._sync_blocks(blocks, create_account_item(importance='321'))

		# Assert:
		self.assertEqual((321, 0, True, True, 2), self._fetch_account_current_state())

	def test_refresh_dirty_accounts_for_batch_preserves_importance_percentage(self):
		# Arrange:
		account_row, mosaic_rows = self._create_current_account_row(importance='100')
		account_row['importance_percentage'] = 0.5
		self.puller.symbol_db.upsert_account_current_state(account_row, mosaic_rows)
		blocks = [self._create_block(1)]

		# Act:
		self._sync_blocks(blocks, create_account_item(importance='200'))

		# Assert:
		self.assertEqual((200, Decimal('0.5'), True, True, 1), self._fetch_account_current_state())

	def test_refresh_dirty_accounts_for_batch_leaves_old_harvesting_active_value_unchanged(self):
		# Arrange:
		account_row, mosaic_rows = self._create_current_account_row()
		account_row['is_harvesting_active'] = False
		self.puller.symbol_db.upsert_account_current_state(account_row, mosaic_rows)
		blocks = [self._create_block(1, days_ago=8)]

		# Act:
		self._sync_blocks(blocks, create_account_item(importance='200'))

		# Assert:
		self.assertEqual(False, self._fetch_account_current_state()[2])

	def test_refresh_dirty_accounts_for_batch_upserts_multisig(self):
		# Arrange:
		address_text = self._address_text()
		blocks = [self._create_block(1)]
		multisig_by_address = {
			address_text: {
				'multisig': {
					'minApproval': 2,
					'minRemoval': 1,
					'cosignatoryAddresses': ['AA' * 24],
					'multisigAddresses': ['BB' * 24]
				}
			}
		}

		# Act:
		self._sync_blocks(blocks, multisig_by_address=multisig_by_address)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT min_approval, min_removal, cosignatory_addresses, multisig_addresses FROM symbol_multisig')

		result = cursor.fetchone()
		self.assertEqual(2, result[0])
		self.assertEqual(1, result[1])
		self.assertEqual([bytes.fromhex('AA' * 24)], [bytes(value) for value in result[2]])
		self.assertEqual([bytes.fromhex('BB' * 24)], [bytes(value) for value in result[3]])

	def test_refresh_dirty_accounts_for_batch_deletes_multisig_when_node_returns_not_found(self):
		# Arrange:
		account_row, mosaic_rows = self._create_current_account_row()
		self.puller.symbol_db.upsert_account_current_state(account_row, mosaic_rows)
		self.puller.symbol_db.upsert_multisig(bytes.fromhex(BENEFICIARY_ADDRESS), {
			'address': bytes.fromhex(BENEFICIARY_ADDRESS),
			'min_approval': 1,
			'min_removal': 1,
			'cosignatory_addresses': [],
			'multisig_addresses': [],
			'updated_at_height': 2
		})
		blocks = [self._create_block(1)]

		# Act:
		self._sync_blocks(blocks)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_multisig')

		self.assertEqual((0,), cursor.fetchone())

	def test_refresh_dirty_accounts_for_batch_does_not_upsert_account_when_multisig_fetch_fails(self):
		# Arrange:
		address_text = self._address_text()
		connector = FakeConnector(
			1,
			{0: [self._create_block(1)]},
			account_by_address={address_text: create_account_item()},
			multisig_by_address={address_text: {'code': 'InternalError', 'message': 'boom'}})
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(NodeException, 'InternalError: boom'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(0, self._fetch_account_count())

	def test_get_native_mosaic_info_is_memoized(self):
		# Arrange:
		connector = FakeConnector(1, {0: [self._create_block(1)]})

		# Act:
		self._sync_with_connector(connector)
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(1, connector.paths.count('network/properties'))
		self.assertEqual(1, connector.paths.count(f'mosaics/{NATIVE_MOSAIC_ID}'))

	def test_refresh_accounts_pages_all_accounts_and_assigns_search_order_across_pages(self):
		# Arrange:
		page1 = []
		for index in range(100):
			page1.append(_strip_id(create_account_item(_address_hex(index), f'id-{index}', importance=str(index + 1))))
		page2 = [_strip_id(create_account_item(_address_hex(100), 'id-100', importance='101'))]
		connector = FakeConnector(101, {}, account_pages={1: page1, 2: page2})
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.refresh_accounts())

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'''
			SELECT address, account_search_order
			FROM symbol_account_refresh_accounts
			ORDER BY account_search_order
		'''
		)
		results = [(bytes(address), search_order) for address, search_order in cursor.fetchall()]

		self.assertEqual(101, len(results))
		self.assertEqual((bytes.fromhex(_address_hex(0)), 0), results[0])
		self.assertEqual((bytes.fromhex(_address_hex(99)), 99), results[99])
		self.assertEqual((bytes.fromhex(_address_hex(100)), 100), results[100])
		self.assertEqual([
			'chain/info',
			'network/properties',
			f'mosaics/{NATIVE_MOSAIC_ID}',
			'accounts?pageSize=100&pageNumber=1&orderBy=id&order=desc',
			'accounts?pageSize=100&pageNumber=2&orderBy=id&order=desc'
		], connector.paths)

	def _assert_complete_refresh_state(self, state):
		# Assert:
		self.assertEqual('healthy', state['status'])
		self.assertEqual(2, state['last_scanned_page'])
		self.assertEqual(101, state['last_completed_height'])
		self.assertIsNotNone(state['last_started_at'])
		self.assertIsNotNone(state['last_completed_at'])
		self.assertIsNone(state['last_error'])

	def _assert_complete_current_account_state(self):
		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'''
			SELECT address, importance, importance_percentage, is_harvesting_active, is_eligible_for_harvesting, last_seen_height
			FROM symbol_accounts
			ORDER BY last_seen_height, address
			''')
		actual_results = [
			(bytes(address), importance, importance_percentage, is_active, is_eligible, last_seen_height)
			for address, importance, importance_percentage, is_active, is_eligible, last_seen_height in cursor.fetchall()
		]
		expected_results = [
			(bytes.fromhex(_address_hex(index)), index + 1, _expected_importance_percentage(index + 1, 5253), False, True, 101)
			for index in range(100)
		]
		expected_results.extend([
			(bytes.fromhex(_address_hex(100)), 101, _expected_importance_percentage(101, 5253), False, True, 101),
			(bytes.fromhex(_address_hex(101)), 102, _expected_importance_percentage(102, 5253), False, False, 101)
		])

		self.assertEqual(expected_results, actual_results)

	def _assert_complete_account_snapshot(self, refresh_run_id):
		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'''
			SELECT address, account_search_order, importance, importance_percentage, snapshot_height
			FROM symbol_account_refresh_accounts
			WHERE refresh_run_id = %s
			ORDER BY account_search_order
			''',
			(refresh_run_id,))
		actual_results = [
			(bytes(address), search_order, importance, importance_percentage, snapshot_height)
			for address, search_order, importance, importance_percentage, snapshot_height in cursor.fetchall()
		]
		expected_results = [
			(bytes.fromhex(_address_hex(index)), index, index + 1, _expected_importance_percentage(index + 1, 5253), 101)
			for index in range(100)
		]
		expected_results.extend([
			(bytes.fromhex(_address_hex(100)), 100, 101, _expected_importance_percentage(101, 5253), 101),
			(bytes.fromhex(_address_hex(101)), 101, 102, _expected_importance_percentage(102, 5253), 101)
		])

		self.assertEqual(expected_results, actual_results)

	def _assert_complete_mosaic_snapshot(self, refresh_run_id):
		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'''
			SELECT address, mosaic_id, amount
			FROM symbol_account_refresh_mosaics
			WHERE refresh_run_id = %s
			ORDER BY address, mosaic_id
			''',
			(refresh_run_id,))
		actual_results = sorted((bytes(address), mosaic_id, amount) for address, mosaic_id, amount in cursor.fetchall())
		expected_results = [
			(bytes.fromhex(_address_hex(index)), NATIVE_MOSAIC_ID, (index + 1) * 20_000 * 10 ** 6)
			for index in range(100)
		]
		expected_results.extend([
			(bytes.fromhex(_address_hex(100)), NATIVE_MOSAIC_ID, 40_000 * 10 ** 6),
			(bytes.fromhex(_address_hex(100)), 'E74B99BA41F4AFEE', 2000)
		])

		self.assertEqual(expected_results, actual_results)

	def _assert_complete_rank_results(self, refresh_run_id):
		# Assert:
		expected_rank_addresses = {
			'ID': [bytes.fromhex(_address_hex(index)) for index in range(102)],
			'IMPORTANCE': [bytes.fromhex(_address_hex(index)) for index in reversed(range(102))],
			f'BALANCE:{NATIVE_MOSAIC_ID}': [
				bytes.fromhex(_address_hex(index))
				for index in sorted(
					range(101),
					key=lambda value: (
						-(40_000 if 100 == value else (value + 1) * 20_000),
						_address_hex(value)))
			]
		}
		cursor = self.puller.symbol_db.connection.cursor()
		for rank_scope, expected_addresses in expected_rank_addresses.items():
			expected_rank_address_pairs = list(enumerate(expected_addresses))  # rank is 0-based
			cursor.execute(
				'''
				SELECT rank, address
				FROM symbol_account_list_ranks
				WHERE refresh_run_id = %s AND rank_scope = %s
				ORDER BY rank
				''',
				(refresh_run_id, rank_scope))
			self.assertEqual(
				expected_rank_address_pairs,
				[(rank, bytes(address)) for rank, address in cursor.fetchall()])

	def test_refresh_accounts_persists_complete_two_page_snapshot_and_rank_results(self):
		# Arrange:
		page1 = [
			create_account_item(
				_address_hex(index),
				f'id-{index}',
				importance=str(index + 1),
				mosaics=[{'id': NATIVE_MOSAIC_ID, 'amount': str((index + 1) * 20_000 * 10 ** 6)}])
			for index in range(100)
		]
		page2 = [
			create_account_item(
				_address_hex(100),
				'id-100',
				importance='101',
				mosaics=[
					{'id': NATIVE_MOSAIC_ID, 'amount': str(40_000 * 10 ** 6)},
					{'id': 'E74B99BA41F4AFEE', 'amount': '2000'}
				]),
			create_account_item(
				_address_hex(101),
				'id-101',
				importance='102',
				mosaics=[])
		]
		connector = FakeConnector(101, {}, account_pages={1: page1, 2: page2})
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.refresh_accounts())

		# Assert:
		state = self.puller.symbol_db.get_account_refresh_state()
		self._assert_complete_refresh_state(state)
		self._assert_complete_current_account_state()
		self._assert_complete_account_snapshot(state['last_successful_run_id'])
		self._assert_complete_mosaic_snapshot(state['last_successful_run_id'])
		self._assert_complete_rank_results(state['last_successful_run_id'])

	def test_refresh_accounts_rolls_back_failed_page_and_records_original_database_error(self):
		# Arrange:
		self.puller.symbol_db.upsert_account_refresh_state({
			'status': 'healthy',
			'last_successful_run_id': 'previous-run',
			'last_completed_height': 10
		})
		invalid_mosaic_item = create_account_item(
			_address_hex(1),
			mosaics=[{'id': 'F' * 17, 'amount': '1'}])
		connector = FakeConnector(1, {}, account_pages={1: [invalid_mosaic_item]})
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaises(PsycopgError) as error_context:
			asyncio.run(self.puller.refresh_accounts())

		# Assert:
		state = self.puller.symbol_db.get_account_refresh_state()
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_accounts')
		current_count = cursor.fetchone()
		cursor.execute('SELECT COUNT(*) FROM symbol_account_refresh_accounts')
		snapshot_count = cursor.fetchone()
		self.assertEqual('previous-run', state['last_successful_run_id'])
		self.assertEqual('unhealthy', state['status'])
		self.assertEqual(str(error_context.exception), state['last_error'])
		self.assertEqual((0,), current_count)
		self.assertEqual((0,), snapshot_count)

	def test_refresh_accounts_preserves_original_error_when_failure_state_recording_fails(self):
		# Arrange:
		refresh_error = RefreshFailureError('refresh request failed')
		connector = RefreshFailureConnector(refresh_error)
		set_symbol_connector(self.puller, connector)
		database = self.puller.symbol_db
		failure_state_database = FailureStateRecordingDatabase(database)
		self.puller.symbol_db = failure_state_database

		try:
			# Act:
			with self.assertRaisesRegex(RefreshFailureError, 'refresh request failed') as context:
				asyncio.run(self.puller.refresh_accounts())
		finally:
			self.puller.symbol_db = database

		# Assert:
		self.assertIs(refresh_error, context.exception)
		self.assertEqual([str(refresh_error)], failure_state_database.failure_state_errors)

	def test_rollback_re_raises_database_error(self):
		# Arrange:
		database = self.exit_stack.enter_context(SymbolDatabase(self.db_config))
		sync_state = self._create_rollback_sync_state(status='invalid')

		# Act:
		with self.assertRaises(PsycopgError):
			database.repair_rollback_from_height(1, sync_state)

	def test_refresh_accounts_can_restart_with_new_successful_run(self):  # pylint: disable=too-many-locals
		# Arrange:
		first_mosaic_amount = 20_000 * 10 ** 6
		second_mosaic_amount = 30_000 * 10 ** 6
		page = [create_account_item(
			_address_hex(1),
			'id-1',
			importance='10',
			mosaics=[{'id': NATIVE_MOSAIC_ID, 'amount': str(first_mosaic_amount)}])]
		connector = FakeConnector(1, {}, account_pages={1: page})
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.refresh_accounts())
		first_run_id = self.puller.symbol_db.get_account_refresh_state()['last_successful_run_id']
		page[0]['account']['mosaics'][0]['amount'] = str(second_mosaic_amount)
		asyncio.run(self.puller.refresh_accounts())
		second_run_id = self.puller.symbol_db.get_account_refresh_state()['last_successful_run_id']

		# Assert:
		expected_address = bytes.fromhex(_address_hex(1))

		def fetch_run_results(refresh_run_id):
			cursor = self.puller.symbol_db.connection.cursor()
			cursor.execute(
				'''
				SELECT refresh_run_id, address, account_search_order
				FROM symbol_account_refresh_accounts
				WHERE refresh_run_id = %s
				ORDER BY account_search_order
				''',
				(refresh_run_id,))
			account_results = [
				(run_id, bytes(address), account_search_order)
				for run_id, address, account_search_order in cursor.fetchall()
			]
			cursor.execute(
				'''
				SELECT refresh_run_id, address, mosaic_id, amount
				FROM symbol_account_refresh_mosaics
				WHERE refresh_run_id = %s
				ORDER BY address, mosaic_id
				''',
				(refresh_run_id,))
			mosaic_results = [
				(run_id, bytes(address), mosaic_id, amount)
				for run_id, address, mosaic_id, amount in cursor.fetchall()
			]
			cursor.execute(
				'''
				SELECT refresh_run_id, rank_scope, rank, address
				FROM symbol_account_list_ranks
				WHERE refresh_run_id = %s
				ORDER BY rank_scope, rank
				''',
				(refresh_run_id,))
			rank_results = [
				(run_id, rank_scope, rank, bytes(address))
				for run_id, rank_scope, rank, address in cursor.fetchall()
			]
			return account_results, mosaic_results, rank_results

		first_results = fetch_run_results(first_run_id)
		second_results = fetch_run_results(second_run_id)
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'''
			SELECT address, mosaic_id, amount
			FROM symbol_account_mosaics
			ORDER BY address, mosaic_id
			''')
		current_mosaic_results = [
			(bytes(address), mosaic_id, amount)
			for address, mosaic_id, amount in cursor.fetchall()
		]

		self.assertNotEqual(first_run_id, second_run_id)
		first_expected_account_results = [(first_run_id, expected_address, 0)]
		first_expected_mosaic_results = [
			(first_run_id, expected_address, NATIVE_MOSAIC_ID, first_mosaic_amount)
		]
		first_expected_rank_results = [
			(first_run_id, f'BALANCE:{NATIVE_MOSAIC_ID}', 0, expected_address),
			(first_run_id, 'ID', 0, expected_address),
			(first_run_id, 'IMPORTANCE', 0, expected_address)
		]
		self.assertEqual(
			(first_expected_account_results, first_expected_mosaic_results, first_expected_rank_results),
			first_results)
		second_expected_account_results = [(second_run_id, expected_address, 0)]
		second_expected_mosaic_results = [
			(second_run_id, expected_address, NATIVE_MOSAIC_ID, second_mosaic_amount)
		]
		second_expected_rank_results = [
			(second_run_id, f'BALANCE:{NATIVE_MOSAIC_ID}', 0, expected_address),
			(second_run_id, 'ID', 0, expected_address),
			(second_run_id, 'IMPORTANCE', 0, expected_address)
		]
		self.assertEqual(
			(second_expected_account_results, second_expected_mosaic_results, second_expected_rank_results),
			second_results)
		self.assertEqual(
			[(expected_address, NATIVE_MOSAIC_ID, second_mosaic_amount)],
			current_mosaic_results)

	def test_refresh_accounts_rejects_malformed_accounts_page_response(self):
		# Arrange:
		connector = MalformedAccountsConnector(1, {})
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, 'Malformed Symbol accounts page response'):
			asyncio.run(self.puller.refresh_accounts())

		# Assert:
		self.assertEqual('unhealthy', self.puller.symbol_db.get_account_refresh_state()['status'])

	def test_refresh_accounts_recomputes_harvesting_active_for_every_visited_account(self):
		# Arrange:
		active_address = _address_hex(1)
		inactive_address = _address_hex(2)
		account_row, mosaic_rows = self._create_current_account_row(inactive_address, importance='100')
		account_row['is_harvesting_active'] = True
		self.puller.symbol_db.upsert_account_current_state(account_row, mosaic_rows)
		self.puller.symbol_db.upsert_blocks([
			self._create_block_row(1, inactive_address, datetime.now(timezone.utc) - timedelta(days=8)),
			self._create_block_row(2, active_address, datetime.now(timezone.utc) - timedelta(days=1))
		])
		connector = FakeConnector(2, {}, account_pages={
			1: [
				create_account_item(active_address, 'active', importance='100'),
				create_account_item(inactive_address, 'inactive', importance='100')
			]
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.refresh_accounts())

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT address, is_harvesting_active FROM symbol_accounts ORDER BY address')

		self.assertEqual([
			(bytes.fromhex(active_address), True),
			(bytes.fromhex(inactive_address), False)
		], [(bytes(address), is_active) for address, is_active in cursor.fetchall()])

	def test_refresh_accounts_marks_failed_run_unhealthy_without_changing_previous_successful_run(self):
		# Arrange:
		self.puller.symbol_db.upsert_account_refresh_state({
			'status': 'healthy',
			'last_successful_run_id': 'previous-run',
			'last_completed_height': 10
		})
		page1 = [create_account_item(_address_hex(index), f'id-{index}') for index in range(100)]
		connector = FailingAccountsConnector(101, {}, account_pages={1: page1})
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(RuntimeError, 'page 2 failed'):
			asyncio.run(self.puller.refresh_accounts())

		# Assert:
		state = self.puller.symbol_db.get_account_refresh_state()
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_account_refresh_accounts')

		self.assertEqual('previous-run', state['last_successful_run_id'])
		self.assertEqual('unhealthy', state['status'])
		self.assertEqual('page 2 failed', state['last_error'])
		self.assertEqual((100,), cursor.fetchone())

	def _create_current_account_row(self, address_hex=BENEFICIARY_ADDRESS, **overrides):
		return create_account_row(
			create_account_item(address_hex, **overrides),
			self.puller.symbol_facade.network,
			1,
			NATIVE_MOSAIC_ID,
			6)

	def _create_block_row(self, height, beneficiary_address, timestamp):
		return create_block_row(
			create_node_block(height, beneficiaryAddress=beneficiary_address),
			0,
			self.puller.symbol_facade.network
		) | {'timestamp': timestamp}
