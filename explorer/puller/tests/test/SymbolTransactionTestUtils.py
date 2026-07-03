import datetime

from symbolchain.sc import TransactionType

from puller.model.symbol.Transaction import TRANSACTION_TYPE_LABELS


def create_transaction_entry(height, transaction_key=None, is_embedded=False, **overrides):
	transaction_key = transaction_key or f'transaction-key-{height}'
	transaction = {
		'node_id': f'node-{transaction_key}',
		'transaction_key': transaction_key,
		'hash': None if is_embedded else f'hash-{transaction_key}'.encode('utf8'),
		'aggregate_hash': b'aggregate-hash' if is_embedded else None,
		'embedded_index': 0 if is_embedded else None,
		'is_embedded': is_embedded,
		'group': 'confirmed',
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
		'body': {'height': height, 'transaction_key': transaction_key},
		'raw_payload': {'id': transaction_key},
		'mosaic_rows': [],
		'address_rows': []
	}
	transaction.update(overrides)

	return transaction
