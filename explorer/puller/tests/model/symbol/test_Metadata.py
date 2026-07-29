from unittest import TestCase

from symbolchain.sc import TransactionType

from puller.model.symbol.Metadata import METADATA_TRANSACTION_TYPE_LABELS, METADATA_TYPE_LABELS, METADATA_TYPE_NUMBERS, create_metadata_row
from tests.test.SymbolMetadataTestUtils import create_expected_metadata_row, create_metadata_item


class MetadataTest(TestCase):
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
