# pylint: disable=duplicate-code
from unittest import TestCase

from symbolchain.sc import ReceiptType

from puller.model.symbol.Receipt import create_receipt_rows

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
			(12, 7, 3),
			(12, 7, 3)
		], [
			(row['height'], row['source_primary_id'], row['source_secondary_id'])
			for row in rows
		])
