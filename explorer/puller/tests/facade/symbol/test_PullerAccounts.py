import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from symbolchain.sc import ReceiptType
from symbolchain.symbol.Network import Address
from symbollightapi.model.Exceptions import NodeException

from puller.facade.SymbolPuller import ACCOUNT_BATCH_FETCH_SIZE
from puller.model.symbol.Account import create_account_row

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


class MalformedAccountsConnector(FakeConnector):
	async def post(self, url_path, request_payload, *_):
		self.paths.append(url_path)
		if 'accounts' == url_path:
			return {'data': []}

		raise KeyError(url_path)


class SymbolPullerAccountsTest(SymbolPullerTestBase):
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

	def test_refresh_dirty_accounts_for_batch_does_not_mark_transaction_participant_as_active_harvester(self):
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
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [self._create_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [create_node_transaction(1, recipientAddress=BENEFICIARY_ADDRESS)]}
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
		beneficiary_address_text = self._address_text(RECIPIENT_ADDRESS)
		participant_address_text = self._address_text(BENEFICIARY_ADDRESS)
		connector = FakeConnector(
			1,
			{0: [self._create_block(1, beneficiaryAddress=RECIPIENT_ADDRESS)]},
			transactions_by_path={
				transaction_path(1, 1): {
					'data': [
						create_node_transaction(
							1,
							transaction_hash=f'{index:064X}',
							transaction_id=f'transaction-{index}',
							recipientAddress=BENEFICIARY_ADDRESS)
						for index in range(2)
					]
				}
			},
			account_by_address=self._account_by_address_text(RECIPIENT_ADDRESS, BENEFICIARY_ADDRESS))

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
		connector = MalformedAccountsConnector(1, {0: [self._create_block(1)]})

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

	def _create_current_account_row(self, address_hex=BENEFICIARY_ADDRESS, **overrides):
		return create_account_row(
			create_account_item(address_hex, **overrides),
			self.puller.symbol_facade.network,
			1,
			NATIVE_MOSAIC_ID,
			6)
