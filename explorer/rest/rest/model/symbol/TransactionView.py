from collections import namedtuple
from copy import deepcopy

from common.symbol.NativeMosaic import normalize_mosaic_id
from common.symbol.Transaction import MESSAGE_TYPE_LABELS, parse_message
from symbolchain.CryptoTypes import PublicKey
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Address

from rest.model.format import format_timestamp
from rest.model.symbol.format import format_amount
from rest.model.symbol.validation import SymbolDataInvalid

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
AGGREGATE_TYPES = (TransactionType.AGGREGATE_COMPLETE, TransactionType.AGGREGATE_BONDED)

# Records carry display-ready addresses, hex strings, and relative fees.
# Payload and mosaics are prepared by the source-specific adapter.
TransactionViewRecord = namedtuple('TransactionViewRecord', [
	'transaction_hash',
	'aggregate_hash',
	'embedded_index',
	'transaction_type',
	'from_address',
	'to_address',
	'payload',
	'mosaics',
	'deadline',
	'signature',
	'size',
	'version',
	'fee',
	'height',
	'timestamp',
], defaults=(None, 0, None))


def create_unconfirmed_record(item_map, network):
	"""Parses one flat entry from a Symbol unconfirmed transaction search response."""

	try:
		meta_map = item_map['meta']
		transaction_map = item_map['transaction']
		transaction_type = TransactionType(transaction_map['type'])
		recipient = transaction_map.get('recipientAddress')
		payload, mosaics = create_transaction_payload(transaction_map, transaction_type)

		is_embedded = 'aggregateHash' in meta_map
		deadline = None if is_embedded else network.datetime_converter.to_datetime(int(transaction_map['deadline']))
		return TransactionViewRecord(
			transaction_hash=None if is_embedded else meta_map['hash'],
			aggregate_hash=meta_map['aggregateHash'] if is_embedded else None,
			embedded_index=int(meta_map['index']) if is_embedded else None,
			transaction_type=transaction_type,
			from_address=str(network.public_key_to_address(PublicKey(transaction_map['signerPublicKey']))),
			to_address=str(Address(bytes.fromhex(recipient))) if recipient is not None else None,
			payload=payload,
			mosaics=mosaics,
			deadline=deadline,
			signature=None if is_embedded else transaction_map['signature'],
			size=None if is_embedded else transaction_map['size'],
			version=transaction_map['version'])
	except (KeyError, TypeError, ValueError) as error:
		raise SymbolDataInvalid('unconfirmed_transaction', 'invalid node response') from error


def create_transaction_payload(transaction_map, transaction_type):
	"""Builds display payload and transfer mosaics from Symbol transaction fields.

	Address and message fields use the node's hex representation. Database
	adapters must supply those same field representations before calling.
	"""

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


class SymbolTransactionView:
	"""Formats normalized Symbol transaction records for the Explorer API."""

	def __init__(self, transaction, mosaic_divisibility_map, embedded_transactions=()):
		self.transaction = transaction
		self.mosaic_divisibility_map = mosaic_divisibility_map
		self.embedded_transactions = embedded_transactions

	def to_dict(self):
		transaction = self.transaction
		return {
			'transactionHash': transaction.transaction_hash,
			'transactionType': transaction.transaction_type.name,
			'fromAddress': transaction.from_address,
			'toAddress': transaction.to_address,
			'value': self._value(),
			'embeddedTransactions': [
				SymbolTransactionView(embedded_transaction, self.mosaic_divisibility_map).to_dict()
				for embedded_transaction in self.embedded_transactions
			] or None,
			'fee': transaction.fee,
			'height': transaction.height,
			'timestamp': format_timestamp(transaction.timestamp),
			'deadline': format_timestamp(transaction.deadline),
			'signature': transaction.signature,
			'size': transaction.size,
			'version': transaction.version
		}

	def _value(self):
		value = deepcopy(self.transaction.payload)

		for mosaic_id, amount in self.transaction.mosaics:
			resolved_id, divisibility = self.mosaic_divisibility_map.get(mosaic_id, (mosaic_id, None))
			value.append({
				'id': resolved_id,
				'name': resolved_id,
				'amount': amount if divisibility is None else format_amount(amount, divisibility)
			})
		return value
