from datetime import datetime, timedelta, timezone

from puller.model.symbol.Transaction import TRANSACTION_TYPE_LABELS
from symbolchain.CryptoTypes import PublicKey
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Network

SIGNER_PUBLIC_KEY = bytes.fromhex('01' * 32)
SIGNER_ADDRESS = Network.NETWORKS[0].public_key_to_address(PublicKey(SIGNER_PUBLIC_KEY)).bytes
RECIPIENT_ADDRESS = Network.NETWORKS[0].public_key_to_address(PublicKey(bytes.fromhex('02' * 32))).bytes


def create_symbol_transaction(height, transaction_number, is_embedded=False, **overrides):
	"""Creates one transaction entry accepted by PullerSymbolDatabase's real write boundary."""

	transaction = {
		'hash': None if is_embedded else transaction_number.to_bytes(32, 'big'),
		'aggregate_hash': bytes.fromhex('AA' * 32) if is_embedded else None,
		'embedded_index': transaction_number if is_embedded else None,
		'is_embedded': is_embedded,
		'height': height,
		'timestamp': datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=height),
		'type': TransactionType.TRANSFER.value,
		'type_name': TRANSACTION_TYPE_LABELS[TransactionType.TRANSFER.value],
		'signer_public_key': SIGNER_PUBLIC_KEY,
		'signer_address': SIGNER_ADDRESS,
		'recipient_address': RECIPIENT_ADDRESS,
		'target_address': None,
		'deadline': None if is_embedded else datetime(2026, 1, 1, tzinfo=timezone.utc),
		'network_deadline': None if is_embedded else 1000,
		'max_fee': None if is_embedded else 100,
		'effective_fee': None if is_embedded else 10,
		'size': None if is_embedded else 1,
		'message_type': None,
		'message_payload': None,
		'body': {'transactionNumber': transaction_number},
		'raw_payload': {'transactionNumber': transaction_number},
		'mosaic_rows': [],
		'address_rows': [
			{'address': SIGNER_ADDRESS, 'role': 'signer'},
			{'address': RECIPIENT_ADDRESS, 'role': 'recipient'}
		]
	}
	transaction.update(overrides)
	if 'type' in overrides and 'type_name' not in overrides:
		transaction['type_name'] = TRANSACTION_TYPE_LABELS[transaction['type']]

	return transaction


def create_symbol_mosaic_transfer(height, transaction_number, mosaic_id, amount):
	"""Creates a top-level transfer with one persisted Mosaic relation."""

	return create_symbol_transaction(
		height,
		transaction_number,
		mosaic_rows=[{'mosaic_id': mosaic_id, 'amount': amount, 'role': 'transfer', 'position': 0}])
