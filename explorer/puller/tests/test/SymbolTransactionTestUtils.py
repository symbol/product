import datetime

from symbolchain.sc import TransactionType

from puller.model.symbol.Transaction import TRANSACTION_TYPE_LABELS


def create_transaction_entry(height, key=None, is_embedded=False, **overrides):
	key = key or f'transaction-key-{height}'
	transaction = {
		'hash': None if is_embedded else f'hash-{key}'.encode('utf8'),
		'aggregate_hash': f'aggregate-hash-{key}'.encode('utf8') if is_embedded else None,
		'embedded_index': 0 if is_embedded else None,
		'is_embedded': is_embedded,
		'height': height,
		'timestamp': datetime.datetime(2026, 1, 1, 0, height, tzinfo=datetime.timezone.utc),
		'type': TransactionType.TRANSFER.value,
		'type_name': TRANSACTION_TYPE_LABELS[TransactionType.TRANSFER.value],
		'signer_public_key': f'signer public key {height}'.encode('utf8'),
		'signer_address': f'signer address {height}'.encode('utf8'),
		'recipient_address': f'recipient address {height}'.encode('utf8'),
		'target_address': None,
		'deadline': None if is_embedded else datetime.datetime(2026, 1, 1, 1, height, tzinfo=datetime.timezone.utc),
		'network_deadline': None if is_embedded else 1000 + height,
		'max_fee': None if is_embedded else 100,
		'size': None if is_embedded else 3,
		'message_type': None,
		'message_payload': None,
		'body': {'height': height, 'key': key},
		'raw_payload': {'id': key},
		'mosaic_rows': [],
		'address_rows': []
	}
	transaction.update(overrides)

	return transaction
