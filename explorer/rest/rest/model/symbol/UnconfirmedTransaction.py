from collections import namedtuple
from copy import deepcopy

from common.symbol.NativeMosaic import normalize_mosaic_id
from common.symbol.Transaction import MESSAGE_TYPE_LABELS, parse_message
from symbolchain.CryptoTypes import PublicKey
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Address

from rest.model.symbol.format import format_amount, format_timestamp
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
AGGREGATE_TYPES = (TransactionType.AGGREGATE_COMPLETE, TransactionType.AGGREGATE_BONDED)
MESSAGE_TYPE_ID_MAP = {label: type_id for type_id, label in MESSAGE_TYPE_LABELS.items()}
UnconfirmedTransactionRecord = namedtuple('UnconfirmedTransactionRecord', [
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
])


def create_unconfirmed_record(item_map, network):
	"""Parses one flat entry from a Symbol unconfirmed transaction search response."""

	try:
		meta_map = item_map['meta']
		transaction_map = item_map['transaction']
		transaction_type = TransactionType(transaction_map['type'])
		recipient = transaction_map.get('recipientAddress')
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

		is_embedded = 'aggregateHash' in meta_map
		deadline = None if is_embedded else network.datetime_converter.to_datetime(int(transaction_map['deadline']))
		return UnconfirmedTransactionRecord(
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


class SymbolUnconfirmedTransactionView:
	"""Formats unconfirmed Symbol transactions for the Explorer API."""

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
				SymbolUnconfirmedTransactionView(embedded_transaction, self.mosaic_divisibility_map).to_dict()
				for embedded_transaction in self.embedded_transactions
			] or None,
			'fee': None,
			'height': 0,
			'timestamp': None,
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
