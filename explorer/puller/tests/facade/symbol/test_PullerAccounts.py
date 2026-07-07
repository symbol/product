import asyncio
from datetime import datetime, timedelta, timezone

from puller.model.symbol.Account import create_account_row

from .puller_test_utils import (
	BENEFICIARY_ADDRESS,
	NATIVE_MOSAIC_ID,
	FakeConnector,
	SymbolPullerTestBase,
	create_account_item,
	set_symbol_connector
)


class SymbolPullerAccountsTest(SymbolPullerTestBase):
	def _address_text(self, address_hex=BENEFICIARY_ADDRESS):
		return str(self.puller.symbol_facade.network.address_class(bytes.fromhex(address_hex)))

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

	def test_refresh_dirty_accounts_for_batch_upserts_beneficiary_account_once_per_batch(self):
		# Arrange:
		address_text = self._address_text()
		connector = FakeConnector(
			1,
			{},
			account_by_address={address_text: create_account_item(importance='321')}
		)
		set_symbol_connector(self.puller, connector)
		block_rows = [
			{
				'height': 1,
				'beneficiary_address': bytes.fromhex(BENEFICIARY_ADDRESS),
				'timestamp': datetime.now(timezone.utc) - timedelta(days=8)
			},
			{
				'height': 2,
				'beneficiary_address': bytes.fromhex(BENEFICIARY_ADDRESS),
				'timestamp': datetime.now(timezone.utc)
			}
		]

		# Act:
		asyncio.run(self.puller._refresh_dirty_accounts_for_batch(block_rows, NATIVE_MOSAIC_ID, 6))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(1, connector.paths.count(f'accounts/{address_text}'))
		self.assertEqual((321, 0, True, True, 2), self._fetch_account_current_state())

	def test_refresh_dirty_accounts_for_batch_uses_latest_beneficiary_block_when_recent_block_is_first(self):
		# Arrange:
		address_text = self._address_text()
		connector = FakeConnector(
			1,
			{},
			account_by_address={address_text: create_account_item(importance='321')}
		)
		set_symbol_connector(self.puller, connector)
		block_rows = [
			{
				'height': 2,
				'beneficiary_address': bytes.fromhex(BENEFICIARY_ADDRESS),
				'timestamp': datetime.now(timezone.utc)
			},
			{
				'height': 1,
				'beneficiary_address': bytes.fromhex(BENEFICIARY_ADDRESS),
				'timestamp': datetime.now(timezone.utc) - timedelta(days=8)
			}
		]

		# Act:
		asyncio.run(self.puller._refresh_dirty_accounts_for_batch(block_rows, NATIVE_MOSAIC_ID, 6))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(1, connector.paths.count(f'accounts/{address_text}'))
		self.assertEqual((321, 0, True, True, 2), self._fetch_account_current_state())

	def test_refresh_dirty_accounts_for_batch_preserves_importance_percentage(self):
		# Arrange:
		address_text = self._address_text()
		account_row, mosaic_rows = self._create_current_account_row(importance='100')
		account_row['importance_percentage'] = 0.5
		self.puller.symbol_db.upsert_account_current_state(account_row, mosaic_rows)
		connector = FakeConnector(
			1,
			{},
			account_by_address={address_text: create_account_item(importance='200')}
		)
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller._refresh_dirty_accounts_for_batch([{  # pylint: disable=protected-access
			'height': 3,
			'beneficiary_address': bytes.fromhex(BENEFICIARY_ADDRESS),
			'timestamp': datetime.now(timezone.utc)
		}], NATIVE_MOSAIC_ID, 6))

		# Assert:
		self.assertEqual(200, self._fetch_account_current_state()[0])
		self.assertEqual(0.5, float(self._fetch_account_current_state()[1]))

	def test_refresh_dirty_accounts_for_batch_leaves_old_harvesting_active_value_unchanged(self):
		# Arrange:
		address_text = self._address_text()
		account_row, mosaic_rows = self._create_current_account_row()
		account_row['is_harvesting_active'] = False
		self.puller.symbol_db.upsert_account_current_state(account_row, mosaic_rows)
		connector = FakeConnector(
			1,
			{},
			account_by_address={address_text: create_account_item(importance='200')}
		)
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller._refresh_dirty_accounts_for_batch([{  # pylint: disable=protected-access
			'height': 3,
			'beneficiary_address': bytes.fromhex(BENEFICIARY_ADDRESS),
			'timestamp': datetime.now(timezone.utc) - timedelta(days=8)
		}], NATIVE_MOSAIC_ID, 6))

		# Assert:
		self.assertEqual(False, self._fetch_account_current_state()[2])

	def test_refresh_dirty_accounts_for_batch_upserts_multisig(self):
		# Arrange:
		address_text = self._address_text()
		connector = FakeConnector(
			1,
			{},
			account_by_address={address_text: create_account_item()},
			multisig_by_address={address_text: {
				'multisig': {
					'minApproval': 2,
					'minRemoval': 1,
					'cosignatoryAddresses': ['AA' * 24],
					'multisigAddresses': ['BB' * 24]
				}
			}}
		)
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller._refresh_dirty_accounts_for_batch([{  # pylint: disable=protected-access
			'height': 3,
			'beneficiary_address': bytes.fromhex(BENEFICIARY_ADDRESS),
			'timestamp': datetime.now(timezone.utc)
		}], NATIVE_MOSAIC_ID, 6))

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
		address_text = self._address_text()
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
		connector = FakeConnector(
			1,
			{},
			account_by_address={address_text: create_account_item()}
		)
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller._refresh_dirty_accounts_for_batch([{  # pylint: disable=protected-access
			'height': 3,
			'beneficiary_address': bytes.fromhex(BENEFICIARY_ADDRESS),
			'timestamp': datetime.now(timezone.utc)
		}], NATIVE_MOSAIC_ID, 6))

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_multisig')

		self.assertEqual((0,), cursor.fetchone())

	def test_get_native_mosaic_info_is_memoized(self):
		# Arrange:
		connector = FakeConnector(1, {})
		set_symbol_connector(self.puller, connector)

		# Act:
		first_result = asyncio.run(self.puller._get_native_mosaic_info())  # pylint: disable=protected-access
		second_result = asyncio.run(self.puller._get_native_mosaic_info())  # pylint: disable=protected-access

		# Assert:
		self.assertEqual((NATIVE_MOSAIC_ID, 6), first_result)
		self.assertEqual(first_result, second_result)
		self.assertEqual(['network/properties', f'mosaics/{NATIVE_MOSAIC_ID}'], connector.paths)

	def _create_current_account_row(self, address_hex=BENEFICIARY_ADDRESS, **overrides):
		return create_account_row(
			create_account_item(address_hex, **overrides),
			self.puller.symbol_facade.network,
			1,
			NATIVE_MOSAIC_ID,
			6)
