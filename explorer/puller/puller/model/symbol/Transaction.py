from symbolchain.sc import TransactionType

from puller.model.symbol.format import address_from_public_key, camel_case_enum_name, label_for_type, timestamp_from_network_value

TRANSACTION_TYPE_LABELS = {
	transaction_type.value: camel_case_enum_name(transaction_type.name)
	for transaction_type in TransactionType
}
MESSAGE_TYPE_LABELS = {
	0: 'plain',
	1: 'encrypted',
	254: 'persistentDelegationHarvesting'
}
BODY_EXCLUDED_FIELDS = frozenset({
	'signerPublicKey',
	'maxFee',
	'deadline',
	'size',
	'type',
	'message'
})


def _bytes_from_transaction_field(transaction, field_name):
	return bytes.fromhex(transaction[field_name])


def _address_rows_for_fields(transaction, role, field_names):
	return [
		{
			'address': bytes.fromhex(address),
			'role': role
		}
		for field_name in field_names
		for address in transaction.get(field_name, [])
	]


def _unique_address_rows(rows):
	seen = set()
	unique_rows = []
	for row in rows:
		key = (row['address'], row['role'])
		if key in seen:
			continue

		seen.add(key)
		unique_rows.append(row)

	return unique_rows


def create_transaction_mosaic_rows(transaction_type, transaction):
	"""Creates persisted Symbol transaction mosaic child rows from one transaction DTO."""

	if TransactionType.TRANSFER.value == transaction_type:
		return [
			{
				'mosaic_id': mosaic['id'],
				'amount': int(mosaic['amount']),
				'role': 'transfer',
				'position': position
			}
			for position, mosaic in enumerate(transaction.get('mosaics', []))
		]

	single_mosaic_mappings = {
		TransactionType.HASH_LOCK.value: ('hash_lock', 'mosaicId', 'amount'),
		TransactionType.SECRET_LOCK.value: ('secret_lock', 'mosaicId', 'amount'),
		TransactionType.MOSAIC_SUPPLY_REVOCATION.value: ('revocation', 'mosaicId', 'amount'),
		TransactionType.MOSAIC_ADDRESS_RESTRICTION.value: ('restriction', 'mosaicId', None),
		TransactionType.MOSAIC_DEFINITION.value: ('definition', 'id', None),
		TransactionType.MOSAIC_SUPPLY_CHANGE.value: ('definition', 'mosaicId', 'delta')
	}
	if transaction_type in single_mosaic_mappings:
		role, mosaic_id_field, amount_field = single_mosaic_mappings[transaction_type]
		return [{
			'mosaic_id': transaction[mosaic_id_field],
			'amount': int(transaction[amount_field]) if amount_field else 0,
			'role': role,
			'position': 0
		}]

	if TransactionType.MOSAIC_GLOBAL_RESTRICTION.value == transaction_type:
		rows = [{
			'mosaic_id': transaction['mosaicId'],
			'amount': 0,
			'role': 'restriction',
			'position': 0
		}]
		if '0000000000000000' != transaction['referenceMosaicId']:
			rows.append({
				'mosaic_id': transaction['referenceMosaicId'],
				'amount': 0,
				'role': 'restriction',
				'position': 1
			})

		return rows

	return []


def create_transaction_address_rows(transaction_type, transaction, signer_address, network):
	"""Creates persisted Symbol transaction address child rows from one transaction DTO."""

	rows = [{
		'address': signer_address,
		'role': 'signer'
	}]

	if transaction_type in (TransactionType.TRANSFER.value, TransactionType.SECRET_LOCK.value, TransactionType.SECRET_PROOF.value):
		rows.append({
			'address': _bytes_from_transaction_field(transaction, 'recipientAddress'),
			'role': 'recipient'
		})

	if transaction_type in (
		TransactionType.ACCOUNT_METADATA.value,
		TransactionType.MOSAIC_METADATA.value,
		TransactionType.NAMESPACE_METADATA.value,
		TransactionType.MOSAIC_ADDRESS_RESTRICTION.value
	):
		rows.append({
			'address': _bytes_from_transaction_field(transaction, 'targetAddress'),
			'role': 'target'
		})

	if TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value == transaction_type:
		rows.extend(_address_rows_for_fields(transaction, 'target', ('restrictionAdditions', 'restrictionDeletions')))

	if TransactionType.ADDRESS_ALIAS.value == transaction_type:
		rows.append({
			'address': _bytes_from_transaction_field(transaction, 'address'),
			'role': 'target'
		})

	if TransactionType.MOSAIC_SUPPLY_REVOCATION.value == transaction_type:
		rows.append({
			'address': _bytes_from_transaction_field(transaction, 'sourceAddress'),
			'role': 'sender'
		})

	if transaction_type in (TransactionType.AGGREGATE_COMPLETE.value, TransactionType.AGGREGATE_BONDED.value):
		rows.extend({
			'address': address_from_public_key(bytes.fromhex(cosignature['signerPublicKey']), network),
			'role': 'cosignatory'
		} for cosignature in transaction.get('cosignatures', []))

	if TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value == transaction_type:
		rows.extend(_address_rows_for_fields(transaction, 'cosignatory', ('addressAdditions', 'addressDeletions')))

	if TransactionType.MOSAIC_DEFINITION.value == transaction_type:
		rows.append({
			'address': signer_address,
			'role': 'mosaic_owner'
		})

	return _unique_address_rows(rows)


def _parse_message(transaction):
	message = transaction.get('message')
	if not message:
		return None, None

	message_type = MESSAGE_TYPE_LABELS.get(int(message[:2], 16))
	return message_type, message[2:]


def _target_address(transaction_type, transaction):
	if transaction_type in (
		TransactionType.ACCOUNT_METADATA.value,
		TransactionType.MOSAIC_METADATA.value,
		TransactionType.NAMESPACE_METADATA.value,
		TransactionType.MOSAIC_ADDRESS_RESTRICTION.value
	):
		return bytes.fromhex(transaction['targetAddress'])

	return None


def _top_level_or_embedded_fields(meta, transaction, is_embedded, epoch_adjustment_seconds):
	if is_embedded:
		embedded_index = int(meta['index'])
		return {
			'hash': None,
			'aggregate_hash': bytes.fromhex(meta['aggregateHash']),
			'embedded_index': embedded_index,
			'deadline': None,
			'network_deadline': None,
			'max_fee': None,
			'size': None
		}

	network_deadline = int(transaction['deadline'])
	return {
		'hash': bytes.fromhex(meta['hash']),
		'aggregate_hash': None,
		'embedded_index': None,
		'deadline': timestamp_from_network_value(network_deadline, epoch_adjustment_seconds),
		'network_deadline': network_deadline,
		'max_fee': int(transaction['maxFee']),
		'size': int(transaction['size'])
	}


def create_transaction_row(item, network, epoch_adjustment_seconds):
	"""Creates a persisted Symbol transaction row from one confirmed transaction DTO."""

	meta = item['meta']
	transaction = item['transaction']
	is_embedded = 'aggregateHash' in meta
	transaction_type = int(transaction['type'])
	signer_public_key = bytes.fromhex(transaction['signerPublicKey'])
	signer_address = address_from_public_key(signer_public_key, network)
	message_type, message_payload = _parse_message(transaction)
	variable_fields = _top_level_or_embedded_fields(meta, transaction, is_embedded, epoch_adjustment_seconds)

	return {
		'is_embedded': is_embedded,
		'height': int(meta['height']),
		'timestamp': timestamp_from_network_value(meta['timestamp'], epoch_adjustment_seconds),
		'type': transaction_type,
		'type_name': label_for_type(TRANSACTION_TYPE_LABELS, transaction_type, 'transaction'),
		'signer_public_key': signer_public_key,
		'signer_address': signer_address,
		'recipient_address': bytes.fromhex(transaction['recipientAddress']) if 'recipientAddress' in transaction else None,
		'target_address': _target_address(transaction_type, transaction),
		'message_type': message_type,
		'message_payload': message_payload,
		'body': {
			key: value
			for key, value in transaction.items()
			if key not in BODY_EXCLUDED_FIELDS
		},
		'raw_payload': item,
		'mosaic_rows': create_transaction_mosaic_rows(transaction_type, transaction),
		'address_rows': create_transaction_address_rows(transaction_type, transaction, signer_address, network),
		**variable_fields
	}
