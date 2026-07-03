# pylint: disable=duplicate-code
from unittest import TestCase

from symbolchain.sc import ReceiptType

from puller.model.symbol.Receipt import INFLATION_RECEIPT_TYPE, RECEIPT_TYPE_GROUPS, RECEIPT_TYPE_LABELS, create_receipt_rows

TARGET_ADDRESS = '98' * 24
SENDER_ADDRESS = '99' * 24
RECIPIENT_ADDRESS = '9A' * 24


def _create_statement_item(receipts, **overrides):
	statement = {
		'height': '12',
		'source': {'primaryId': 7, 'secondaryId': 3},
		'receipts': receipts
	}
	statement.update(overrides)

	return {'statement': statement, 'id': 'statement-id', 'meta': {'timestamp': '0'}}


class ReceiptTest(TestCase):

	def test_receipt_type_groups_maps_supported_types_to_documented_groups(self):
		# Arrange / Act / Assert:
		self.assertEqual({
			ReceiptType.HARVEST_FEE.value: 'balanceChange',
			ReceiptType.LOCK_HASH_CREATED.value: 'balanceChange',
			ReceiptType.LOCK_HASH_COMPLETED.value: 'balanceChange',
			ReceiptType.LOCK_HASH_EXPIRED.value: 'balanceChange',
			ReceiptType.LOCK_SECRET_CREATED.value: 'balanceChange',
			ReceiptType.LOCK_SECRET_COMPLETED.value: 'balanceChange',
			ReceiptType.LOCK_SECRET_EXPIRED.value: 'balanceChange',
			ReceiptType.MOSAIC_RENTAL_FEE.value: 'balanceTransfer',
			ReceiptType.NAMESPACE_RENTAL_FEE.value: 'balanceTransfer',
			ReceiptType.MOSAIC_EXPIRED.value: 'artifactExpiry',
			ReceiptType.NAMESPACE_EXPIRED.value: 'artifactExpiry',
			ReceiptType.NAMESPACE_DELETED.value: 'artifactExpiry',
			ReceiptType.INFLATION.value: 'inflation'
		}, RECEIPT_TYPE_GROUPS)

	def test_receipt_type_labels_maps_supported_types_to_documented_labels(self):
		# Arrange / Act / Assert:
		self.assertEqual({
			ReceiptType.MOSAIC_RENTAL_FEE.value: 'mosaicRentalFee',
			ReceiptType.NAMESPACE_RENTAL_FEE.value: 'namespaceRentalFee',
			ReceiptType.HARVEST_FEE.value: 'harvestFee',
			ReceiptType.LOCK_HASH_COMPLETED.value: 'lockHashCompleted',
			ReceiptType.LOCK_HASH_EXPIRED.value: 'lockHashExpired',
			ReceiptType.LOCK_SECRET_COMPLETED.value: 'lockSecretCompleted',
			ReceiptType.LOCK_SECRET_EXPIRED.value: 'lockSecretExpired',
			ReceiptType.LOCK_HASH_CREATED.value: 'lockHashCreated',
			ReceiptType.LOCK_SECRET_CREATED.value: 'lockSecretCreated',
			ReceiptType.MOSAIC_EXPIRED.value: 'mosaicExpired',
			ReceiptType.NAMESPACE_EXPIRED.value: 'namespaceExpired',
			ReceiptType.NAMESPACE_DELETED.value: 'namespaceDeleted',
			ReceiptType.INFLATION.value: 'inflation'
		}, RECEIPT_TYPE_LABELS)
		self.assertEqual('inflation', INFLATION_RECEIPT_TYPE)

	def test_create_receipt_rows_populates_balance_change_fields(self):
		# Arrange:
		statement_item = _create_statement_item([{
			'version': 1,
			'type': ReceiptType.HARVEST_FEE.value,
			'targetAddress': TARGET_ADDRESS,
			'mosaicId': '72C0212E67A08BCE',
			'amount': '123'
		}])

		# Act:
		rows = create_receipt_rows(statement_item)

		# Assert:
		self.assertEqual([{
			'height': 12,
			'receipt_type': 'harvestFee',
			'receipt_group': 'balanceChange',
			'version': 1,
			'source_primary_id': 7,
			'source_secondary_id': 3,
			'sender_address': None,
			'recipient_address': None,
			'target_address': bytes.fromhex(TARGET_ADDRESS),
			'mosaic_id': '72C0212E67A08BCE',
			'amount': 123,
			'artifact_id': None,
			'raw_payload': statement_item['statement']['receipts'][0]
		}], rows)

	def test_create_receipt_rows_allows_missing_balance_change_address(self):
		# Arrange:
		statement_item = _create_statement_item([{
			'version': 1,
			'type': ReceiptType.HARVEST_FEE.value,
			'mosaicId': '72C0212E67A08BCE',
			'amount': '123'
		}])

		# Act:
		rows = create_receipt_rows(statement_item)

		# Assert:
		self.assertIsNone(rows[0]['target_address'])

	def test_create_receipt_rows_populates_balance_transfer_fields(self):
		# Arrange:
		statement_item = _create_statement_item([{
			'version': 1,
			'type': ReceiptType.MOSAIC_RENTAL_FEE.value,
			'senderAddress': SENDER_ADDRESS,
			'recipientAddress': RECIPIENT_ADDRESS,
			'mosaicId': '72C0212E67A08BCE',
			'amount': '456'
		}])

		# Act:
		rows = create_receipt_rows(statement_item)

		# Assert:
		self.assertEqual([{
			'height': 12,
			'receipt_type': 'mosaicRentalFee',
			'receipt_group': 'balanceTransfer',
			'version': 1,
			'source_primary_id': 7,
			'source_secondary_id': 3,
			'sender_address': bytes.fromhex(SENDER_ADDRESS),
			'recipient_address': bytes.fromhex(RECIPIENT_ADDRESS),
			'target_address': None,
			'mosaic_id': '72C0212E67A08BCE',
			'amount': 456,
			'artifact_id': None,
			'raw_payload': statement_item['statement']['receipts'][0]
		}], rows)

	def test_create_receipt_rows_populates_artifact_expiry_fields(self):
		# Arrange:
		statement_item = _create_statement_item([{
			'version': 1,
			'type': ReceiptType.NAMESPACE_EXPIRED.value,
			'artifactId': 'ABCDEF0123456789'
		}])

		# Act:
		rows = create_receipt_rows(statement_item)

		# Assert:
		self.assertEqual([{
			'height': 12,
			'receipt_type': 'namespaceExpired',
			'receipt_group': 'artifactExpiry',
			'version': 1,
			'source_primary_id': 7,
			'source_secondary_id': 3,
			'sender_address': None,
			'recipient_address': None,
			'target_address': None,
			'mosaic_id': None,
			'amount': 0,
			'artifact_id': 'ABCDEF0123456789',
			'raw_payload': statement_item['statement']['receipts'][0]
		}], rows)

	def test_create_receipt_rows_populates_inflation_fields(self):
		# Arrange:
		statement_item = _create_statement_item([{
			'version': 1,
			'type': ReceiptType.INFLATION.value,
			'mosaicId': '72C0212E67A08BCE',
			'amount': '789'
		}])

		# Act:
		rows = create_receipt_rows(statement_item)

		# Assert:
		self.assertEqual([{
			'height': 12,
			'receipt_type': 'inflation',
			'receipt_group': 'inflation',
			'version': 1,
			'source_primary_id': 7,
			'source_secondary_id': 3,
			'sender_address': None,
			'recipient_address': None,
			'target_address': None,
			'mosaic_id': '72C0212E67A08BCE',
			'amount': 789,
			'artifact_id': None,
			'raw_payload': statement_item['statement']['receipts'][0]
		}], rows)

	def test_create_receipt_rows_skips_unsupported_receipts(self):
		# Arrange:
		statement_item = _create_statement_item([{
			'version': 1,
			'type': ReceiptType.ADDRESS_ALIAS_RESOLUTION.value
		}])

		# Act:
		rows = create_receipt_rows(statement_item)

		# Assert:
		self.assertEqual([], rows)

	def test_create_receipt_rows_uses_statement_source_for_all_receipts(self):
		# Arrange:
		statement_item = _create_statement_item([
			{
				'version': 1,
				'type': ReceiptType.INFLATION.value,
				'mosaicId': '72C0212E67A08BCE',
				'amount': '1'
			},
			{
				'version': 1,
				'type': ReceiptType.MOSAIC_EXPIRED.value,
				'artifactId': 'ABCDEF0123456789'
			}
		])

		# Act:
		rows = create_receipt_rows(statement_item)

		# Assert:
		self.assertEqual([
			(7, 3),
			(7, 3)
		], [
			(row['source_primary_id'], row['source_secondary_id'])
			for row in rows
		])
