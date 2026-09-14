# pylint: disable=duplicate-code
from unittest import TestCase

from common.symbol.ReceiptTypes import RECEIPT_TYPE_GROUPS, RECEIPT_TYPE_LABELS
from symbolchain.sc import ReceiptType


class ReceiptTypesTest(TestCase):
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
