from common.symbol.NativeMosaic import normalize_mosaic_id
from common.symbol.Transaction import MESSAGE_TYPE_LABELS, parse_message
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Address

PAYLOAD_EXCLUDED_FIELDS = frozenset({
	'signerPublicKey',
	'signature',
	'version',
	'network',
	'type',
	'maxFee',
	'deadline',
	'size',
	'recipientAddress'
})
MESSAGE_TYPE_ID_MAP = {label: type_id for type_id, label in MESSAGE_TYPE_LABELS.items()}


def create_transaction_payload(transaction_map, transaction_type):
	"""Builds display payload and transfer mosaics from Symbol transaction fields."""

	payload_map = {
		key: value
		for key, value in transaction_map.items()
		if key not in PAYLOAD_EXCLUDED_FIELDS
	}
	_format_payload_addresses(payload_map, transaction_type)
	payload = []
	mosaics = ()
	if transaction_type == TransactionType.TRANSFER:
		message = payload_map.pop('message', None)
		if message:
			message_type, message_payload = parse_message(message.upper())
			payload.append({'message': {
				'type': MESSAGE_TYPE_ID_MAP.get(message_type),
				'payload': message_payload,
			}})
		mosaics = tuple(
			(normalize_mosaic_id(mosaic_map['id']), int(mosaic_map['amount']))
			for mosaic_map in payload_map.pop('mosaics', []))
	if payload_map:
		payload.append(payload_map)
	return payload, mosaics


def _format_payload_addresses(payload_map, transaction_type):
	"""Converts payload address fields to Base32."""

	for field_name in ('address', 'sourceAddress', 'targetAddress'):
		if field_name in payload_map:
			payload_map[field_name] = str(Address(bytes.fromhex(payload_map[field_name])))

	address_list_fields = ('addressAdditions', 'addressDeletions')
	if transaction_type == TransactionType.ACCOUNT_ADDRESS_RESTRICTION:
		address_list_fields += ('restrictionAdditions', 'restrictionDeletions')

	for field_name in address_list_fields:
		if field_name in payload_map:
			payload_map[field_name] = [str(Address(bytes.fromhex(address))) for address in payload_map[field_name]]
