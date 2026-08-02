from unittest import TestCase

from symbolchain.sc import TransactionType

from puller.model.symbol.Metadata import (
	METADATA_TRANSACTION_TYPE_LABELS,
	METADATA_TYPE_LABELS,
	METADATA_TYPE_NUMBERS,
	canonical_metadata_hex,
	canonical_metadata_key,
	create_metadata_row,
	metadata_target_from_relations
)
from tests.test.SymbolMetadataTestUtils import create_expected_metadata_row, create_metadata_item


class MetadataTest(TestCase):
	def _assert_canonical_metadata_hex_rejected(self, value):
		# Act + Assert:
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol Metadata scoped metadata key'):
			canonical_metadata_hex(value, 'scoped metadata key')

	def _assert_canonical_metadata_key_rejected(self, overrides, error):
		# Arrange:
		valid_key = {
			'metadata_type': 'mosaic',
			'source_address': b'source',
			'target_address': b'target',
			'scoped_metadata_key': '0000000000000001',
			'target_id': '0000000000000002'
		}

		# Act + Assert:
		with self.assertRaisesRegex(ValueError, error):
			canonical_metadata_key({**valid_key, **overrides})

	def test_metadata_type_labels_match_independent_expected_values(self):
		self.assertEqual({0: 'account', 1: 'mosaic', 2: 'namespace'}, METADATA_TYPE_LABELS)

	def test_metadata_type_numbers_match_independent_expected_values(self):
		self.assertEqual({'account': 0, 'mosaic': 1, 'namespace': 2}, METADATA_TYPE_NUMBERS)

	def test_metadata_transaction_type_labels_match_independent_expected_values(self):
		self.assertEqual({
			TransactionType.ACCOUNT_METADATA.value: 'account',
			TransactionType.MOSAIC_METADATA.value: 'mosaic',
			TransactionType.NAMESPACE_METADATA.value: 'namespace'
		}, METADATA_TRANSACTION_TYPE_LABELS)

	def test_create_metadata_row_normalizes_account_and_preserves_wrapper(self):
		# Arrange:
		item = create_metadata_item()
		expected_row = create_expected_metadata_row(
			item, 123, composite_hash=bytes.fromhex('11' * 32), metadata_type='account',
			target_id=None, value_utf8='hello')

		# Act:
		row = create_metadata_row(item, 123)

		# Assert:
		self.assertEqual(expected_row, row)

	def test_create_metadata_row_preserves_mosaic_target_id(self):
		# Arrange:
		mosaic_item = create_metadata_item(metadata_type=1, target_id='72C0212E67A08BCE')

		# Act:
		row = create_metadata_row(mosaic_item, 123)

		# Assert:
		self.assertEqual(create_expected_metadata_row(
			mosaic_item, 123, composite_hash=bytes.fromhex('11' * 32), metadata_type='mosaic',
			target_id='72C0212E67A08BCE', value_utf8='hello'), row)

	def test_create_metadata_row_preserves_namespace_target_id(self):
		# Arrange:
		namespace_item = create_metadata_item(metadata_type=2, target_id='A95F1F8A96159516')

		# Act:
		row = create_metadata_row(namespace_item, 123)

		# Assert:
		self.assertEqual(create_expected_metadata_row(
			namespace_item, 123, composite_hash=bytes.fromhex('11' * 32), metadata_type='namespace',
			target_id='A95F1F8A96159516', value_utf8='hello'), row)

	def test_create_metadata_row_canonicalizes_scoped_key_and_target_id(self):
		# Arrange:
		item = create_metadata_item(
			metadata_type=1,
			target_id='abcdef0123456789',
			scoped_metadata_key='1234567890abcdef')

		# Act:
		row = create_metadata_row(item, 123)

		# Assert:
		self.assertEqual('1234567890ABCDEF', row['scoped_metadata_key'])
		self.assertEqual('ABCDEF0123456789', row['target_id'])

	def test_canonical_metadata_hex_rejects_invalid_values(self):
		for value in (None, 123, '', '1', ' 1234567890ABCDE', '1234567890ABCDEG'):
			with self.subTest(value=value):
				self._assert_canonical_metadata_hex_rejected(value)

	def test_canonical_metadata_key_rejects_inapplicable_target_ids(self):
		# Arrange:
		key = {
			'metadata_type': 'account',
			'source_address': b'source',
			'target_address': b'target',
			'scoped_metadata_key': '0000000000000001',
			'target_id': '0000000000000002'
		}

		# Act + Assert:
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol account Metadata target id$'):
			canonical_metadata_key(key)

	def test_canonical_metadata_key_rejects_non_object_key(self):
		# Act + Assert:
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol Metadata natural key$'):
			canonical_metadata_key([])

	def test_canonical_metadata_key_rejects_invalid_required_fields(self):
		for overrides, error in (
			({'metadata_type': 'invalid'}, 'Invalid Symbol Metadata type'),
			({'source_address': None}, 'Invalid Symbol Metadata source address'),
			({'target_address': None}, 'Invalid Symbol Metadata target address'),
			({'target_id': None}, 'Invalid Symbol mosaic Metadata target id')):
			with self.subTest(overrides=overrides):
				self._assert_canonical_metadata_key_rejected(overrides, error)

	def test_metadata_target_from_relations_returns_mosaic_target_id(self):
		# Arrange:
		metadata_target_rows = [{
			'mosaic_id': '72C0212E67A08BCE',
			'amount': 0,
			'position': 0
		}]

		# Act:
		target_id = metadata_target_from_relations('mosaic', metadata_target_rows)

		# Assert:
		self.assertEqual('72C0212E67A08BCE', target_id)

	def test_metadata_target_from_relations_returns_none_for_metadata_without_target_relation(self):
		for metadata_type in ('account', 'namespace'):
			with self.subTest(metadata_type=metadata_type):
				# Act:
				target_id = metadata_target_from_relations(metadata_type, [])

				# Assert:
				self.assertIsNone(target_id)

	def test_metadata_target_from_relations_rejects_invalid_mosaic_relation_count(self):
		for metadata_target_rows in ([], [
			{'mosaic_id': '72C0212E67A08BCE', 'amount': 0, 'position': 0},
			{'mosaic_id': 'A95F1F8A96159516', 'amount': 0, 'position': 0}
		]):
			with self.subTest(count=len(metadata_target_rows)):
				# Act + Assert:
				with self.assertRaisesRegex(ValueError, '^Invalid Symbol mosaic Metadata target relation count$'):
					metadata_target_from_relations('mosaic', metadata_target_rows)

	def test_metadata_target_from_relations_rejects_invalid_mosaic_relation_sentinels(self):
		for amount, position in ((1, 0), (0, 1)):
			with self.subTest(amount=amount, position=position):
				# Arrange:
				metadata_target_rows = [{
					'mosaic_id': '72C0212E67A08BCE',
					'amount': amount,
					'position': position
				}]

				# Act + Assert:
				with self.assertRaisesRegex(ValueError, '^Invalid Symbol mosaic Metadata target relation$'):
					metadata_target_from_relations('mosaic', metadata_target_rows)

	def test_metadata_target_from_relations_rejects_inapplicable_relation(self):
		metadata_target_rows = [{
			'mosaic_id': '72C0212E67A08BCE',
			'amount': 0,
			'position': 0
		}]
		for metadata_type in ('account', 'namespace'):
			with self.subTest(metadata_type=metadata_type):
				# Act + Assert:
				with self.assertRaisesRegex(ValueError, f'^Invalid Symbol {metadata_type} Metadata target relation$'):
					metadata_target_from_relations(metadata_type, metadata_target_rows)

	def test_create_metadata_row_decodes_clean_utf8_value(self):
		# Arrange:
		clean_item = create_metadata_item(value='E38182E38184')

		# Act:
		row = create_metadata_row(clean_item, 123)

		# Assert:
		self.assertEqual('あい', row['value_utf8'])

	def test_create_metadata_row_replaces_invalid_utf8_value(self):
		# Arrange:
		invalid_item = create_metadata_item(value='C3')

		# Act:
		row = create_metadata_row(invalid_item, 123)

		# Assert:
		self.assertEqual('�', row['value_utf8'])

	def test_create_metadata_row_rejects_unsupported_type(self):
		# Arrange:
		item = create_metadata_item(metadata_type=99)

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, '^Unsupported Symbol metadata type 99$'):
			create_metadata_row(item, 123)
