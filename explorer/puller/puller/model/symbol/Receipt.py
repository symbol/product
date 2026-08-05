import common.symbol.Receipt as receipt_contract

from puller.model.symbol.format import bytes_from_hex_or_none, str_or_none


def _create_base_receipt_row(statement, source, receipt):
	receipt_type = int(receipt['type'])

	return {
		'height': int(statement['height']),
		'receipt_type': receipt_contract.RECEIPT_TYPE_LABELS[receipt_type],
		'receipt_group': receipt_contract.RECEIPT_TYPE_GROUPS[receipt_type],
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
		if receipt_type not in receipt_contract.RECEIPT_TYPE_GROUPS:
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
