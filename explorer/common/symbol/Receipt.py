from types import MappingProxyType

from symbolchain.sc import ReceiptType

BALANCE_CHANGE_RECEIPT_TYPES = (
	ReceiptType.HARVEST_FEE,
	ReceiptType.LOCK_HASH_CREATED,
	ReceiptType.LOCK_HASH_COMPLETED,
	ReceiptType.LOCK_HASH_EXPIRED,
	ReceiptType.LOCK_SECRET_CREATED,
	ReceiptType.LOCK_SECRET_COMPLETED,
	ReceiptType.LOCK_SECRET_EXPIRED
)
BALANCE_TRANSFER_RECEIPT_TYPES = (
	ReceiptType.MOSAIC_RENTAL_FEE,
	ReceiptType.NAMESPACE_RENTAL_FEE
)
ARTIFACT_EXPIRY_RECEIPT_TYPES = (
	ReceiptType.MOSAIC_EXPIRED,
	ReceiptType.NAMESPACE_EXPIRED,
	ReceiptType.NAMESPACE_DELETED
)

RECEIPT_TYPE_LABELS = MappingProxyType({
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
})
RECEIPT_TYPE_GROUPS = MappingProxyType({
	**{receipt_type.value: 'balanceChange' for receipt_type in BALANCE_CHANGE_RECEIPT_TYPES},
	**{receipt_type.value: 'balanceTransfer' for receipt_type in BALANCE_TRANSFER_RECEIPT_TYPES},
	**{receipt_type.value: 'artifactExpiry' for receipt_type in ARTIFACT_EXPIRY_RECEIPT_TYPES},
	ReceiptType.INFLATION.value: 'inflation'
})

assert set(RECEIPT_TYPE_LABELS) == set(RECEIPT_TYPE_GROUPS), \
	'RECEIPT_TYPE_LABELS and RECEIPT_TYPE_GROUPS must cover the same receipt types'

RECEIPT_TYPE_CODES = tuple(RECEIPT_TYPE_LABELS)
RECEIPT_TYPE_VALUES = tuple(RECEIPT_TYPE_LABELS.values())
RECEIPT_GROUP_VALUES = ('balanceChange', 'balanceTransfer', 'artifactExpiry', 'inflation')

INFLATION_RECEIPT_TYPE = RECEIPT_TYPE_LABELS[ReceiptType.INFLATION.value]
NAMESPACE_EXPIRED_RECEIPT_TYPE = RECEIPT_TYPE_LABELS[ReceiptType.NAMESPACE_EXPIRED.value]
NAMESPACE_DELETED_RECEIPT_TYPE = RECEIPT_TYPE_LABELS[ReceiptType.NAMESPACE_DELETED.value]
MOSAIC_EXPIRED_RECEIPT_TYPE = RECEIPT_TYPE_LABELS[ReceiptType.MOSAIC_EXPIRED.value]
