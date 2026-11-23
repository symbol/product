"""Verifies the Core entity hash of a Symbol node REST block header."""

from hashlib import sha3_256
from struct import pack

from symbolchain.sc import BlockType, NetworkType

from puller.model.symbol.format import hash_bytes_from_hex, is_exact_integer, parse_decimal_uint64_text, parse_hex_bytes

BLOCK_VERSION = 1
NORMAL_BLOCK_HEADER_SIZE = 376
IMPORTANCE_BLOCK_HEADER_SIZE = 424
BLOCK_TYPE_VALUES = frozenset(block_type.value for block_type in BlockType)
NETWORK_VALUES = frozenset(network.value for network in NetworkType)
BLOCK_HEADER_BYTE_FIELDS = (
	('proofGamma', 32),
	('proofVerificationHash', 16),
	('proofScalar', 32),
	('previousBlockHash', 32),
	('transactionsHash', 32),
	('receiptsHash', 32),
	('stateHash', 32),
	('beneficiaryAddress', 24)
)
BLOCK_HEADER_FIELDS = frozenset({
	'size', 'signature', 'signerPublicKey', 'version', 'network', 'type', 'height', 'timestamp', 'difficulty', 'feeMultiplier',
	*(field_name for field_name, _ in BLOCK_HEADER_BYTE_FIELDS)
})
IMPORTANCE_FOOTER_FIELDS = frozenset({
	'votingEligibleAccountsCount', 'harvestingEligibleAccountsCount', 'totalVotingBalance', 'previousImportanceBlockHash'
})


def _uint(block, field_name, bits):
	value = block[field_name]
	error_message = f'Invalid Symbol block header {field_name}'
	# Node REST formats uint64 fields as decimal strings and smaller fields as JSON numbers.
	if 64 == bits:
		value = parse_decimal_uint64_text(value, error_message)

	if not is_exact_integer(value) or not 0 <= value < 1 << bits:
		raise ValueError(error_message)

	return value


def _binary(block, field_name, size):
	return parse_hex_bytes(block[field_name], f'Invalid Symbol block header {field_name}', size=size)


def _calculate_block_hash(block):
	block_type = block.get('type')
	if not is_exact_integer(block_type) or block_type not in BLOCK_TYPE_VALUES:
		raise ValueError('Unsupported Symbol block header type')

	has_importance_footer = BlockType.NORMAL.value != block_type
	expected_fields = BLOCK_HEADER_FIELDS | IMPORTANCE_FOOTER_FIELDS if has_importance_footer else BLOCK_HEADER_FIELDS
	if block.keys() != expected_fields:
		raise ValueError('Malformed Symbol block header fields')

	version = _uint(block, 'version', 8)
	if BLOCK_VERSION != version:
		raise ValueError('Unsupported Symbol block header version')

	network = _uint(block, 'network', 8)
	if network not in NETWORK_VALUES:
		raise ValueError('Unsupported Symbol block header network')

	height = _uint(block, 'height', 64)
	if 0 == height or (1 == height) != (BlockType.NEMESIS.value == block_type):
		raise ValueError('Unexpected Symbol block type at header height')

	minimum_size = IMPORTANCE_BLOCK_HEADER_SIZE if has_importance_footer else NORMAL_BLOCK_HEADER_SIZE
	if _uint(block, 'size', 32) < minimum_size:
		raise ValueError('Symbol block size is smaller than its header')

	# Core EntityHasher hashes the full signature and signer, then the BlockHeader data from Version.
	# Block.cpp excludes the normal block's padding and includes the importance or nemesis footer.
	hasher = sha3_256(_binary(block, 'signature', 64) + _binary(block, 'signerPublicKey', 32))
	hasher.update(pack('<BBHQQQ', version, network, block_type, height, _uint(block, 'timestamp', 64), _uint(block, 'difficulty', 64)))
	for field_name, size in BLOCK_HEADER_BYTE_FIELDS:
		hasher.update(_binary(block, field_name, size))

	hasher.update(pack('<I', _uint(block, 'feeMultiplier', 32)))
	if has_importance_footer:
		hasher.update(pack(
			'<IQQ',
			_uint(block, 'votingEligibleAccountsCount', 32),
			_uint(block, 'harvestingEligibleAccountsCount', 64),
			_uint(block, 'totalVotingBalance', 64)
		))
		hasher.update(_binary(block, 'previousImportanceBlockHash', 32))

	return hasher.digest()


def validate_block_commitment(item):
	"""Returns the calculated hash of a matching REST block or raises ValueError."""
	if not isinstance(item, dict) or not isinstance(item.get('block'), dict):
		raise ValueError('Malformed Symbol block commitment')

	reported_hash = hash_bytes_from_hex(item.get('meta'), 'hash', 'Symbol block commitment')
	calculated_hash = _calculate_block_hash(item['block'])
	if calculated_hash != reported_hash:
		raise ValueError('Symbol block hash does not match reconstructed header')

	return calculated_hash
