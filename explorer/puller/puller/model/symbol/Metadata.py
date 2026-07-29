"""Normalization helpers for Symbol metadata current state."""

from symbolchain.sc import TransactionType

from puller.model.symbol.format import label_for_type

# Source: symbol/symbol catbuffer/schemas/symbol/metadata/{account,mosaic,namespace}_metadata.cats,
# dev commit 3a509647a1a7fb20be0bdb5435d923cb073b2773 (verified 2026-07-28); no symbolchain.sc equivalent.
METADATA_TYPE_LABELS = {0: 'account', 1: 'mosaic', 2: 'namespace'}
METADATA_TYPE_NUMBERS = {label: number for number, label in METADATA_TYPE_LABELS.items()}
METADATA_TRANSACTION_TYPE_LABELS = {
	TransactionType.ACCOUNT_METADATA.value: 'account',
	TransactionType.MOSAIC_METADATA.value: 'mosaic',
	TransactionType.NAMESPACE_METADATA.value: 'namespace'
}


def create_metadata_row(metadata_item, observed_height):
	"""Creates one persisted metadata row from a Symbol node metadata search item."""

	entry = metadata_item['metadataEntry']
	metadata_type = label_for_type(METADATA_TYPE_LABELS, entry['metadataType'], 'metadata')
	return {
		'composite_hash': bytes.fromhex(entry['compositeHash']),
		'metadata_type': metadata_type,
		'scoped_metadata_key': entry['scopedMetadataKey'],
		'source_address': bytes.fromhex(entry['sourceAddress']),
		'target_address': bytes.fromhex(entry['targetAddress']),
		'target_id': None if 'account' == metadata_type else entry['targetId'],
		'value_hex': entry['value'],
		'value_utf8': bytes.fromhex(entry['value']).decode('utf-8', errors='replace'),
		'raw_payload': metadata_item,
		'updated_at_height': observed_height
	}
