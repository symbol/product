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


def canonical_metadata_hex(value, field_name):
	"""Returns a Metadata uint64 field as an uppercase 16-character hexadecimal string."""

	is_hex_value = isinstance(value, str) and 16 == len(value) and all(
		character in '0123456789abcdefABCDEF'
		for character in value)
	if not is_hex_value:
		raise ValueError(f'Invalid Symbol Metadata {field_name} {value!r}')

	return value.upper()


def canonical_metadata_key(metadata_key):
	"""Validates and canonicalizes the hexadecimal fields in one Metadata natural key."""

	if not isinstance(metadata_key, dict):
		raise ValueError('Invalid Symbol Metadata natural key')
	metadata_type = metadata_key.get('metadata_type')
	if metadata_type not in METADATA_TYPE_NUMBERS:
		raise ValueError(f'Invalid Symbol Metadata type {metadata_type!r}')
	if not isinstance(metadata_key.get('source_address'), bytes):
		raise ValueError('Invalid Symbol Metadata source address')
	if not isinstance(metadata_key.get('target_address'), bytes):
		raise ValueError('Invalid Symbol Metadata target address')

	target_id = metadata_key.get('target_id')
	if 'account' == metadata_type:
		if target_id is not None:
			raise ValueError('Invalid Symbol account Metadata target id')
	elif target_id is None:
		raise ValueError(f'Invalid Symbol {metadata_type} Metadata target id')

	return {
		**metadata_key,
		'scoped_metadata_key': canonical_metadata_hex(
			metadata_key.get('scoped_metadata_key'),
			'scoped metadata key'),
		'target_id': canonical_metadata_hex(target_id, 'target id') if target_id is not None else None
	}


def metadata_target_from_relations(metadata_type, metadata_target_rows, error_location=''):
	"""Validates private Metadata target relations and returns the Mosaic target id when applicable."""

	error_suffix = f' {error_location}' if error_location else ''
	if 'mosaic' == metadata_type:
		if 1 != len(metadata_target_rows):
			raise ValueError(f'Invalid Symbol mosaic Metadata target relation count{error_suffix}')
		metadata_target_row = metadata_target_rows[0]
		if 0 != metadata_target_row.get('amount') or 0 != metadata_target_row.get('position'):
			raise ValueError(f'Invalid Symbol mosaic Metadata target relation{error_suffix}')

		return metadata_target_row.get('mosaic_id')

	if metadata_target_rows:
		raise ValueError(f'Invalid Symbol {metadata_type} Metadata target relation{error_suffix}')

	return None


def create_metadata_row(metadata_item, observed_height):
	"""Creates one persisted metadata row from a Symbol node metadata search item."""

	entry = metadata_item['metadataEntry']
	metadata_type = label_for_type(METADATA_TYPE_LABELS, entry['metadataType'], 'metadata')
	metadata_key = canonical_metadata_key({
		'metadata_type': metadata_type,
		'scoped_metadata_key': entry['scopedMetadataKey'],
		'source_address': bytes.fromhex(entry['sourceAddress']),
		'target_address': bytes.fromhex(entry['targetAddress']),
		'target_id': None if 'account' == metadata_type else entry['targetId']
	})
	return {
		'composite_hash': bytes.fromhex(entry['compositeHash']),
		**metadata_key,
		'value_hex': entry['value'],
		'value_utf8': bytes.fromhex(entry['value']).decode('utf-8', errors='replace'),
		'raw_payload': metadata_item,
		'updated_at_height': observed_height
	}
