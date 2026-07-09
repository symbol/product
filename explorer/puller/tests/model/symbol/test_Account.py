from unittest import TestCase

from psycopg2.extras import Json
from symbolchain.symbol.Network import Network

from puller.model.symbol.Account import (
	HARVESTING_ELIGIBLE_MAX_NATIVE_BALANCE,
	HARVESTING_ELIGIBLE_MIN_NATIVE_BALANCE,
	create_account_row,
	create_multisig_row
)

ADDRESS = '9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95'
NATIVE_MOSAIC_ID = '72C0212E67A08BCE'
DIVISIBILITY = 6


def _create_account_item(**account_overrides):
	account = {
		'address': ADDRESS,
		'addressHeight': '11',
		'publicKey': '1' * 64,
		'accountType': 0,
		'supplementalPublicKeys': {
			'linked': {'publicKey': '2' * 64},
			'node': {'publicKey': '3' * 64},
			'vrf': {'publicKey': '4' * 64},
			'voting': {'publicKeys': [{'publicKey': '5' * 64, 'startEpoch': 1, 'endEpoch': 2}]}
		},
		'activityBuckets': [{'startHeight': '1', 'totalFeesPaid': '2'}],
		'mosaics': [{'id': NATIVE_MOSAIC_ID, 'amount': str(20_000 * 10 ** DIVISIBILITY)}],
		'importance': '123',
		'importanceHeight': '10'
	}
	account.update(account_overrides)

	return {'account': account, 'id': 'search-id'}


def _plain_value(value):
	return value.adapted if isinstance(value, Json) else value


class AccountTest(TestCase):
	def test_create_account_row_populates_account_and_mosaic_rows(self):
		# Arrange:
		item = _create_account_item()

		# Act:
		account_row, mosaic_rows = create_account_row(item, Network.TESTNET, 99, NATIVE_MOSAIC_ID, DIVISIBILITY)

		# Assert:
		self.assertEqual({
			'address': bytes.fromhex(ADDRESS),
			'address_text': str(Network.TESTNET.address_class(bytes.fromhex(ADDRESS))),
			'public_key': bytes.fromhex('1' * 64),
			'account_type': 'unlinked',
			'address_height': 11,
			'importance': 123,
			'importance_percentage': 0,
			'is_harvesting_active': None,
			'is_eligible_for_harvesting': True,
			'linked_public_key': bytes.fromhex('2' * 64),
			'node_public_key': bytes.fromhex('3' * 64),
			'vrf_public_key': bytes.fromhex('4' * 64),
			'voting_public_keys': [{'publicKey': '5' * 64, 'startEpoch': 1, 'endEpoch': 2}],
			'activity_buckets': [{'startHeight': '1', 'totalFeesPaid': '2'}],
			'raw_payload': item,
			'first_seen_height': 99,
			'last_seen_height': 99
		}, {
			key: _plain_value(value)
			for key, value in account_row.items()
		})
		self.assertEqual([{
			'address': bytes.fromhex(ADDRESS),
			'mosaic_id': NATIVE_MOSAIC_ID,
			'amount': 20_000 * 10 ** DIVISIBILITY,
			'updated_at_height': 99
		}], mosaic_rows)

	def test_create_account_row_stores_zero_public_key_as_none(self):
		# Arrange:
		item = _create_account_item(publicKey='0' * 128)

		# Act:
		account_row, _ = create_account_row(item, Network.TESTNET, 99, NATIVE_MOSAIC_ID, DIVISIBILITY)

		# Assert:
		self.assertIsNone(account_row['public_key'])
		self.assertEqual(11, account_row['address_height'])

	def test_create_account_row_uses_address_height_not_observed_height(self):
		# Arrange:
		item = _create_account_item(addressHeight='1234')

		# Act:
		account_row, _ = create_account_row(item, Network.TESTNET, 99, NATIVE_MOSAIC_ID, DIVISIBILITY)

		# Assert:
		self.assertEqual(1234, account_row['address_height'])

	def _assert_account_type_maps_to_label(self, account_type, expected_label):
		# Arrange:
		item = _create_account_item(accountType=account_type)

		# Act:
		account_row, _ = create_account_row(item, Network.TESTNET, 99, NATIVE_MOSAIC_ID, DIVISIBILITY)

		# Assert:
		self.assertEqual(expected_label, account_row['account_type'])

	def test_create_account_row_maps_account_type_unlinked(self):
		self._assert_account_type_maps_to_label(0, 'unlinked')

	def test_create_account_row_maps_account_type_main(self):
		self._assert_account_type_maps_to_label(1, 'main')

	def test_create_account_row_maps_account_type_remote(self):
		self._assert_account_type_maps_to_label(2, 'remote')

	def test_create_account_row_maps_account_type_remote_unlinked(self):
		self._assert_account_type_maps_to_label(3, 'remoteUnlinked')

	def test_create_account_row_rejects_unknown_account_type(self):
		# Arrange:
		item = _create_account_item(accountType=4)

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, 'Unsupported Symbol account type 4'):
			create_account_row(item, Network.TESTNET, 99, NATIVE_MOSAIC_ID, DIVISIBILITY)

	def test_create_account_row_rejects_non_numeric_account_type(self):
		# Arrange:
		item = _create_account_item(accountType='invalid')

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, 'Unsupported Symbol account type invalid'):
			create_account_row(item, Network.TESTNET, 99, NATIVE_MOSAIC_ID, DIVISIBILITY)

	def _assert_harvesting_eligibility(self, native_balance_raw, expected):
		# Arrange:
		item = _create_account_item(mosaics=[{'id': NATIVE_MOSAIC_ID, 'amount': str(native_balance_raw)}])

		# Act:
		account_row, _ = create_account_row(item, Network.TESTNET, 99, NATIVE_MOSAIC_ID, DIVISIBILITY)

		# Assert:
		self.assertEqual(expected, account_row['is_eligible_for_harvesting'])

	def test_create_account_row_marks_lower_boundary_balance_as_eligible(self):
		self._assert_harvesting_eligibility(HARVESTING_ELIGIBLE_MIN_NATIVE_BALANCE * 10 ** DIVISIBILITY, True)

	def test_create_account_row_rejects_balance_one_raw_unit_below_lower_boundary(self):
		self._assert_harvesting_eligibility(HARVESTING_ELIGIBLE_MIN_NATIVE_BALANCE * 10 ** DIVISIBILITY - 1, False)

	def test_create_account_row_rejects_upper_boundary_balance(self):
		self._assert_harvesting_eligibility(HARVESTING_ELIGIBLE_MAX_NATIVE_BALANCE * 10 ** DIVISIBILITY, False)

	def test_create_account_row_marks_balance_one_raw_unit_below_upper_boundary_as_eligible(self):
		self._assert_harvesting_eligibility(HARVESTING_ELIGIBLE_MAX_NATIVE_BALANCE * 10 ** DIVISIBILITY - 1, True)

	def test_create_account_row_rejects_zero_balance(self):
		self._assert_harvesting_eligibility(0, False)

	def test_create_account_row_rejects_missing_native_mosaic(self):
		# Arrange:
		item = _create_account_item(mosaics=[{'id': '0000000000000001', 'amount': str(1_000_000 * 10 ** DIVISIBILITY)}])

		# Act:
		account_row, _ = create_account_row(item, Network.TESTNET, 99, NATIVE_MOSAIC_ID, DIVISIBILITY)

		# Assert:
		self.assertFalse(account_row['is_eligible_for_harvesting'])

	def test_create_multisig_row_returns_none_for_absent_multisig(self):
		# Act:
		row = create_multisig_row(bytes.fromhex(ADDRESS), None, 50)

		# Assert:
		self.assertIsNone(row)

	def test_create_multisig_row_maps_fields(self):
		# Arrange:
		multisig_json = {
			'minApproval': 2,
			'minRemoval': 1,
			'cosignatoryAddresses': ['AA' * 24, 'BB' * 24],
			'multisigAddresses': ['CC' * 24]
		}

		# Act:
		row = create_multisig_row(bytes.fromhex(ADDRESS), multisig_json, 50)

		# Assert:
		self.assertEqual({
			'address': bytes.fromhex(ADDRESS),
			'min_approval': 2,
			'min_removal': 1,
			'cosignatory_addresses': [bytes.fromhex('AA' * 24), bytes.fromhex('BB' * 24)],
			'multisig_addresses': [bytes.fromhex('CC' * 24)],
			'updated_at_height': 50
		}, row)
