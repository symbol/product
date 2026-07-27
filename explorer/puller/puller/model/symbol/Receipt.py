from symbolchain.sc import ReceiptType

from puller.model.symbol.format import bytes_from_hex_or_none, str_or_none

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
RECEIPT_TYPE_LABELS = {
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
}
RECEIPT_TYPE_GROUPS = {
	**{receipt_type.value: 'balanceChange' for receipt_type in BALANCE_CHANGE_RECEIPT_TYPES},
	**{receipt_type.value: 'balanceTransfer' for receipt_type in BALANCE_TRANSFER_RECEIPT_TYPES},
	**{receipt_type.value: 'artifactExpiry' for receipt_type in ARTIFACT_EXPIRY_RECEIPT_TYPES},
	ReceiptType.INFLATION.value: 'inflation'
}
assert set(RECEIPT_TYPE_LABELS) == set(RECEIPT_TYPE_GROUPS), 'RECEIPT_TYPE_LABELS and RECEIPT_TYPE_GROUPS must cover the same receipt types'
INFLATION_RECEIPT_TYPE = RECEIPT_TYPE_LABELS[ReceiptType.INFLATION.value]
NAMESPACE_EXPIRED_RECEIPT_TYPE = RECEIPT_TYPE_LABELS[ReceiptType.NAMESPACE_EXPIRED.value]
NAMESPACE_DELETED_RECEIPT_TYPE = RECEIPT_TYPE_LABELS[ReceiptType.NAMESPACE_DELETED.value]


def _create_base_receipt_row(statement, source, receipt):
	receipt_type = int(receipt['type'])

	return {
		'height': int(statement['height']),
		'receipt_type': RECEIPT_TYPE_LABELS[receipt_type],
		'receipt_group': RECEIPT_TYPE_GROUPS[receipt_type],
		'version': int(receipt['version']),
		'source_primary_id': int(source['primaryId']),
		'source_secondary_id': int(source['secondaryId']),
		'sender_address': None,
		'recipient_address': None,
		'target_address': None,
		'mosaic_id': None,
		'amount': int(receipt.get('amount', 0)),
		'artifact_id': None,
		'raw_payload': receipt
	}


def _add_mosaic_fields(row, receipt):
	row['mosaic_id'] = str_or_none(receipt.get('mosaicId'))
	row['amount'] = int(receipt.get('amount', 0))


def create_receipt_rows(statement_item):
	"""Creates persisted Symbol receipt rows from one transaction statement item."""

	statement = statement_item['statement']
	source = statement['source']
	rows = []
	for receipt in statement['receipts']:
		receipt_type = int(receipt['type'])
		if receipt_type not in RECEIPT_TYPE_GROUPS:
			continue

		row = _create_base_receipt_row(statement, source, receipt)
		if 'balanceChange' == row['receipt_group']:
			_add_mosaic_fields(row, receipt)
			row['target_address'] = bytes_from_hex_or_none(receipt.get('targetAddress'))
		elif 'balanceTransfer' == row['receipt_group']:
			_add_mosaic_fields(row, receipt)
			row['sender_address'] = bytes_from_hex_or_none(receipt.get('senderAddress'))
			row['recipient_address'] = bytes_from_hex_or_none(receipt.get('recipientAddress'))
		elif 'inflation' == row['receipt_group']:
			_add_mosaic_fields(row, receipt)
		elif 'artifactExpiry' == row['receipt_group']:
			row['artifact_id'] = str_or_none(receipt.get('artifactId'))

		rows.append(row)

	return rows
