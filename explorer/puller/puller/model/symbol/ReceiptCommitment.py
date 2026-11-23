from hashlib import sha3_256
from struct import pack

from common.symbol.ReceiptTypes import RECEIPT_TYPE_GROUPS
from symbolchain.CryptoTypes import Hash256
from symbolchain.sc import ReceiptType
from symbolchain.symbol.Merkle import MerkleHashBuilder

from puller.model.symbol.format import (
	decoded_address_bytes_from_hex,
	is_exact_integer,
	is_hex_text,
	parse_decimal_uint64_text,
	parse_json_array
)

RECEIPT_ADDRESS_FIELDS = {
	'balanceChange': ('targetAddress',),
	'balanceTransfer': ('senderAddress', 'recipientAddress'),
	'inflation': ()
}


def _field(node, field_name):
	return node.get(field_name) if isinstance(node, dict) else None


def _unsigned_integer(value, bits, field_name):
	if not is_exact_integer(value) or not 0 <= value < 1 << bits:
		raise ValueError(f'Invalid Symbol receipt commitment {field_name}')

	return value


def _hex_identifier(node, field_name):
	value = _field(node, field_name)
	if not isinstance(value, str) or len(value) != 16 or not is_hex_text(value):
		raise ValueError(f'Invalid Symbol receipt commitment {field_name}')

	return int(value, 16)


def _amount(receipt):
	return parse_decimal_uint64_text(_field(receipt, 'amount'), 'Invalid Symbol receipt commitment amount')


def _address(node, field_name):
	return decoded_address_bytes_from_hex(node, field_name, 'Symbol receipt commitment')


def _source(node):
	source = _field(node, 'source')
	return (
		_unsigned_integer(_field(source, 'primaryId'), 32, 'primaryId'),
		_unsigned_integer(_field(source, 'secondaryId'), 32, 'secondaryId')
	)


def _receipt_bytes(receipt):
	version = _unsigned_integer(_field(receipt, 'version'), 16, 'version')
	if version != 1:
		raise ValueError(f'Unsupported Symbol receipt version {version}')

	receipt_type = _unsigned_integer(_field(receipt, 'type'), 16, 'type')
	if receipt_type not in RECEIPT_TYPE_GROUPS:
		raise ValueError(f'Unsupported Symbol receipt type {receipt_type}')

	group = RECEIPT_TYPE_GROUPS[receipt_type]
	# TransactionStatement::hash omits the receipt's size prefix.
	header = pack('<HH', version, receipt_type)
	if 'artifactExpiry' == group:
		return header + pack('<Q', _hex_identifier(receipt, 'artifactId'))

	mosaic = pack('<QQ', _hex_identifier(receipt, 'mosaicId'), _amount(receipt))
	return header + mosaic + b''.join(_address(receipt, field_name) for field_name in RECEIPT_ADDRESS_FIELDS[group])


def _transaction_statement_hash(statement):
	source = _source(statement)
	hasher = sha3_256(pack('<HHII', 1, ReceiptType.TRANSACTION_GROUP.value, *source))
	# REST preserves the Core array order, including the order of equal receipt types.
	for receipt in parse_json_array(_field(statement, 'receipts'), 'Invalid Symbol receipt commitment receipts'):
		hasher.update(_receipt_bytes(receipt))

	return source, hasher.digest()


def _resolution_value(node, field_name, receipt_type):
	if ReceiptType.ADDRESS_ALIAS_RESOLUTION == receipt_type:
		address = _address(node, field_name)
		return address, address

	mosaic_id = _hex_identifier(node, field_name)
	return mosaic_id, pack('<Q', mosaic_id)


def _resolution_statement_hash(statement, receipt_type):
	key, unresolved = _resolution_value(statement, 'unresolved', receipt_type)
	hasher = sha3_256(pack('<HH', 1, receipt_type.value) + unresolved)
	for entry in parse_json_array(_field(statement, 'resolutionEntries'), 'Invalid Symbol receipt commitment resolutionEntries'):
		hasher.update(pack('<II', *_source(entry)))
		hasher.update(_resolution_value(entry, 'resolved', receipt_type)[1])

	return key, hasher.digest()


def _update_merkle_builder(builder, keyed_hashes):
	hashes = {}
	for key, statement_hash in keyed_hashes:
		if key in hashes:
			raise ValueError('Duplicate Symbol receipt commitment statement key')

		hashes[key] = statement_hash

	for key in sorted(hashes):
		builder.update(Hash256(hashes[key]))


def calculate_receipts_hash(transaction_statements, address_statements, mosaic_statements):
	"""Calculate the Core receiptsHash from unwrapped REST statement bodies for one block."""
	builder = MerkleHashBuilder()
	# BlockStatement visits the three ordered maps in this sequence.
	_update_merkle_builder(builder, (_transaction_statement_hash(statement) for statement in transaction_statements))
	for statements, receipt_type in (
		(address_statements, ReceiptType.ADDRESS_ALIAS_RESOLUTION),
		(mosaic_statements, ReceiptType.MOSAIC_ALIAS_RESOLUTION)
	):
		_update_merkle_builder(builder, (_resolution_statement_hash(statement, receipt_type) for statement in statements))

	return builder.final().bytes
