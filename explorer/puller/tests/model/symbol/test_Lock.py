# pylint: disable=too-many-public-methods
from unittest import TestCase

from puller.model.symbol.Lock import (
	LOCK_HASH_ALGORITHM_LABELS,
	LOCK_STATUS_LABELS,
	create_hash_lock_key,
	create_hash_lock_key_from_hex,
	create_hash_lock_row,
	create_secret_lock_row,
	create_secret_lock_search_key,
	create_secret_lock_search_key_from_hex_secret,
	lock_hash_algorithm_label,
	lock_status_label
)
from tests.test.SymbolLockTestUtils import create_expected_secret_lock_row, create_secret_lock_item

OWNER_ADDRESS = '98' + '11' * 23
RECIPIENT_ADDRESS = '98' + '22' * 23
HASH = 'AA' * 32
COMPOSITE_HASH = 'BB' * 32
SECRET = 'CC' * 32
MOSAIC_ID = '72C0212E67A08BCE'


def create_hash_lock_item(**overrides):
	lock = {
		'hash': HASH,
		'ownerAddress': OWNER_ADDRESS,
		'mosaicId': MOSAIC_ID,
		'amount': '1234',
		'endHeight': '5678',
		'status': 0
	}
	lock.update(overrides)
	return {'lock': lock, 'id': 'hash-item'}


class LockTest(TestCase):
	def test_lock_status_and_hash_algorithm_mappings_are_exact(self):
		# Arrange:
		expected_status_labels = {0: 'unused', 1: 'used'}
		expected_algorithm_labels = {0: 'sha3_256', 1: 'hash160', 2: 'hash256'}

		# Act:
		status_labels = LOCK_STATUS_LABELS
		algorithm_labels = LOCK_HASH_ALGORITHM_LABELS

		# Assert:
		self.assertEqual(expected_status_labels, status_labels)
		self.assertEqual(expected_algorithm_labels, algorithm_labels)

	def test_create_hash_lock_row_returns_the_complete_normalized_row(self):
		# Arrange:
		item = create_hash_lock_item()

		# Act:
		row = create_hash_lock_row(item, 123)

		# Assert:
		self.assertEqual({
			'hash': bytes.fromhex(HASH),
			'owner_address': bytes.fromhex(OWNER_ADDRESS),
			'mosaic_id': MOSAIC_ID,
			'amount': 1234,
			'end_height': 5678,
			'status': 'unused',
			'raw_payload': item,
			'updated_at_height': 123
		}, row)

	def test_create_secret_lock_row_returns_the_complete_normalized_row(self):
		# Arrange:
		item = create_secret_lock_item()

		# Act:
		row = create_secret_lock_row(item, 123)

		# Assert:
		self.assertEqual(create_expected_secret_lock_row(item, 123), row)

	def test_create_hash_lock_key_requires_exactly_32_bytes(self):
		# Arrange:
		invalid_hash = b'not-a-hash'

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol Hash Lock key$'):
			create_hash_lock_key(invalid_hash)

	def test_create_hash_lock_key_from_hex_rejects_non_hex_and_wrong_length(self):
		# Arrange:
		invalid_values = ('not-hex', 'AA' * 31, 'AA' * 33)

		# Act / Assert:
		for invalid_value in invalid_values:
			with self.subTest(invalid_value=invalid_value):
				with self.assertRaisesRegex(ValueError, '^Invalid Symbol Hash Lock key$'):
					create_hash_lock_key_from_hex(invalid_value)

	def test_create_hash_lock_key_from_hex_rejects_a_non_string(self):
		# Arrange:
		invalid_hash = None

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol Hash Lock key$'):
			create_hash_lock_key_from_hex(invalid_hash)

	def test_create_secret_lock_search_key_supports_unknown_owner(self):
		# Arrange:
		recipient = bytes.fromhex(RECIPIENT_ADDRESS)
		secret = bytes.fromhex(SECRET)

		# Act:
		key = create_secret_lock_search_key(None, recipient, secret, 'hash160')

		# Assert:
		self.assertEqual((None, recipient, secret, 'hash160'), key)

	def test_create_secret_lock_search_key_from_hex_secret_returns_the_complete_key(self):
		# Arrange:
		owner = bytes.fromhex(OWNER_ADDRESS)
		recipient = bytes.fromhex(RECIPIENT_ADDRESS)

		# Act:
		key = create_secret_lock_search_key_from_hex_secret(owner, recipient, SECRET, 'sha3_256')

		# Assert:
		self.assertEqual((owner, recipient, bytes.fromhex(SECRET), 'sha3_256'), key)

	def test_mapping_helpers_reject_unsupported_values(self):
		# Arrange:
		invalid_status = 99
		invalid_algorithm = 99

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, '^Unsupported Symbol lock status type 99$'):
			lock_status_label(invalid_status)
		with self.assertRaisesRegex(ValueError, '^Unsupported Symbol lock hash algorithm type 99$'):
			lock_hash_algorithm_label(invalid_algorithm)

	def test_lock_status_label_rejects_non_integer_values(self):
		# Arrange:
		invalid_values = (True, False, 0.0, 1.0, '1')

		# Act / Assert:
		for invalid_value in invalid_values:
			with self.subTest(invalid_value=invalid_value):
				with self.assertRaisesRegex(ValueError, f'^Unsupported Symbol lock status type {invalid_value}$'):
					lock_status_label(invalid_value)

	def test_lock_hash_algorithm_label_rejects_non_integer_values(self):
		# Arrange:
		invalid_values = (True, False, 0.0, 1.0, '1')

		# Act / Assert:
		for invalid_value in invalid_values:
			with self.subTest(invalid_value=invalid_value):
				with self.assertRaisesRegex(
					ValueError, f'^Unsupported Symbol lock hash algorithm type {invalid_value}$'):
					lock_hash_algorithm_label(invalid_value)

	def test_create_hash_lock_row_accepts_nonnegative_integer_and_decimal_integer_string_numeric_fields(self):
		# Arrange:
		hash_item = create_hash_lock_item(amount=1234, endHeight='5678')

		# Act:
		hash_row = create_hash_lock_row(hash_item, 123)

		# Assert:
		self.assertEqual((1234, 5678), (hash_row['amount'], hash_row['end_height']))

	def test_create_secret_lock_row_accepts_nonnegative_integer_and_decimal_integer_string_numeric_fields(self):
		# Arrange:
		secret_item = create_secret_lock_item(amount='1234', endHeight=5678)

		# Act:
		secret_row = create_secret_lock_row(secret_item, 123)

		# Assert:
		self.assertEqual((1234, 5678), (secret_row['amount'], secret_row['end_height']))

	def test_create_hash_lock_row_rejects_noncanonical_numeric_fields_with_deterministic_errors(self):
		# Arrange:
		invalid_values = (True, 1.0, 1.5, '1.5', '1e3', '', ' 1', '1 ', '-1', None)

		# Act / Assert:
		for field_name in ('amount', 'endHeight'):
			for invalid_value in invalid_values:
				with self.subTest(field_name=field_name, invalid_value=invalid_value):
					with self.assertRaisesRegex(ValueError, f'^Invalid Symbol Hash Lock {field_name}$'):
						create_hash_lock_row(create_hash_lock_item(**{field_name: invalid_value}), 123)

	def test_create_secret_lock_row_rejects_noncanonical_numeric_fields_with_deterministic_errors(self):
		# Arrange:
		invalid_values = (True, 1.0, 1.5, '1.5', '1e3', '', ' 1', '1 ', '-1', None)

		# Act / Assert:
		for field_name in ('amount', 'endHeight'):
			for invalid_value in invalid_values:
				with self.subTest(field_name=field_name, invalid_value=invalid_value):
					with self.assertRaisesRegex(ValueError, f'^Invalid Symbol Secret Lock {field_name}$'):
						create_secret_lock_row(create_secret_lock_item(**{field_name: invalid_value}), 123)

	def test_create_hash_lock_row_rejects_a_malformed_wrapper(self):
		# Arrange:
		invalid_item = {}

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, '^Malformed Symbol Hash Lock response$'):
			create_hash_lock_row(invalid_item, 123)

	def test_create_hash_lock_row_rejects_each_invalid_field(self):
		# Arrange:
		invalid_fields = {
			'hash': 'not-hex',
			'ownerAddress': OWNER_ADDRESS[:-2],
			'mosaicId': 'not-hex',
			'amount': True,
			'endHeight': 'not-number',
			'status': 99
		}

		# Act / Assert:
		for field_name, invalid_value in invalid_fields.items():
			item = create_hash_lock_item(**{field_name: invalid_value})
			with self.subTest(field_name=field_name):
				with self.assertRaises(ValueError):
					create_hash_lock_row(item, 123)

	def test_create_secret_lock_row_rejects_each_invalid_field(self):
		# Arrange:
		invalid_fields = {
			'compositeHash': 'not-hex',
			'ownerAddress': OWNER_ADDRESS[:-2],
			'recipientAddress': RECIPIENT_ADDRESS[:-2],
			'secret': 'not-hex',
			'hashAlgorithm': 99,
			'mosaicId': 'not-hex',
			'amount': True,
			'endHeight': 'not-number',
			'status': 99
		}

		# Act / Assert:
		for field_name, invalid_value in invalid_fields.items():
			item = create_secret_lock_item(**{field_name: invalid_value})
			with self.subTest(field_name=field_name):
				with self.assertRaises(ValueError):
					create_secret_lock_row(item, 123)

	def test_create_secret_lock_search_key_rejects_invalid_owner(self):
		# Arrange:
		invalid_owner = b'owner'

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol Secret Lock owner address$'):
			create_secret_lock_search_key(invalid_owner, bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'sha3_256')

	def test_create_secret_lock_search_key_rejects_invalid_recipient_secret_and_algorithm(self):
		# Arrange:
		owner = bytes.fromhex(OWNER_ADDRESS)

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol Secret Lock recipient address$'):
			create_secret_lock_search_key(owner, b'recipient', bytes.fromhex(SECRET), 'sha3_256')
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol Secret Lock secret$'):
			create_secret_lock_search_key(owner, bytes.fromhex(RECIPIENT_ADDRESS), b'secret', 'sha3_256')
		with self.assertRaisesRegex(ValueError, '^Unsupported Symbol Secret Lock hash algorithm invalid$'):
			create_secret_lock_search_key(owner, bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'invalid')

	def test_create_secret_lock_search_key_from_hex_secret_rejects_non_hex_secret(self):
		# Arrange:
		owner = bytes.fromhex(OWNER_ADDRESS)
		recipient = bytes.fromhex(RECIPIENT_ADDRESS)

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol Secret Lock secret$'):
			create_secret_lock_search_key_from_hex_secret(owner, recipient, 'not-hex', 'sha3_256')

	def test_create_secret_lock_search_key_from_hex_secret_rejects_a_non_string_secret(self):
		# Arrange:
		owner = bytes.fromhex(OWNER_ADDRESS)
		recipient = bytes.fromhex(RECIPIENT_ADDRESS)

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol Secret Lock secret$'):
			create_secret_lock_search_key_from_hex_secret(owner, recipient, None, 'sha3_256')

	def test_create_hash_lock_row_rejects_invalid_hex_with_the_expected_field_length(self):
		# Arrange:
		item = create_hash_lock_item(hash='GG' * 32)

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol Hash Lock hash$'):
			create_hash_lock_row(item, 123)

	def test_create_secret_lock_row_rejects_invalid_mosaic_hex_with_the_expected_field_length(self):
		# Arrange:
		item = create_secret_lock_item(mosaicId='GG' * 8)

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol Secret Lock mosaicId$'):
			create_secret_lock_row(item, 123)
