"""Verify the Catbuffer commitments of confirmed Symbol REST transactions."""

from collections import defaultdict, namedtuple
from enum import Enum
from hashlib import sha3_256

from symbolchain import sc
from symbolchain.ByteArray import ByteArray
from symbolchain.CryptoTypes import Hash256
from symbolchain.facade.SymbolFacade import AGGREGATE_HASHED_SIZE, PRE_V3_AGGREGATE_HASHED_SIZE, TRANSACTION_HEADER_SIZE
from symbolchain.symbol.KeyPair import Verifier
from symbolchain.symbol.Merkle import MerkleHashBuilder

from puller.model.symbol.format import (
	hash_bytes_from_hex,
	is_exact_integer,
	is_hex_text,
	parse_decimal_uint64_text,
	parse_hex_bytes,
	parse_json_array
)

AGGREGATE_TYPES = (sc.TransactionType.AGGREGATE_COMPLETE, sc.TransactionType.AGGREGATE_BONDED)
AGGREGATE_TYPE_VALUES = frozenset(kind.value for kind in AGGREGATE_TYPES)
METADATA_TYPES = (sc.TransactionType.ACCOUNT_METADATA, sc.TransactionType.MOSAIC_METADATA, sc.TransactionType.NAMESPACE_METADATA)
HEX_INTEGER_FIELDS = frozenset({
	'id', 'mosaic_id', 'namespace_id', 'parent_id', 'reference_mosaic_id', 'restriction_key', 'scoped_metadata_key',
	'target_mosaic_id', 'target_namespace_id'
})
DECIMAL_FIELDS = frozenset({'deadline', 'delta', 'duration', 'fee', 'new_restriction_value', 'previous_restriction_value'})
UNHINTED_FIELDS = {
	**{kind: ('scoped_metadata_key', 'value_size_delta') for kind in METADATA_TYPES},
	sc.TransactionType.MOSAIC_DEFINITION: ('divisibility',),
	sc.TransactionType.MULTISIG_ACCOUNT_MODIFICATION: ('min_removal_delta', 'min_approval_delta'),
	sc.TransactionType.MOSAIC_ADDRESS_RESTRICTION: ('restriction_key', 'previous_restriction_value', 'new_restriction_value'),
	sc.TransactionType.MOSAIC_GLOBAL_RESTRICTION: ('restriction_key', 'previous_restriction_value', 'new_restriction_value')
}


class UnboundAggregateReason(Enum):
	"""Why the aggregate's entity and component hashes do not establish its embedded bodies."""

	AMBIGUOUS_LEGACY_PAYLOAD_SIZE = 'ambiguous_legacy_payload_size'
	INVALID_MERKLE_BUILDER = 'invalid_merkle_builder'
	UNMATCHED_V1_ROOT = 'unmatched_v1_root'


TransactionCommitments = namedtuple('TransactionCommitments', ['component_hashes', 'unbound_aggregate_reasons'])


def _integer(value):
	if not is_exact_integer(value):
		raise ValueError('expected a JSON integer')

	return value


def _hex_uint64(value):
	if not isinstance(value, str) or not 1 <= len(value) <= 16 or not is_hex_text(value):
		raise ValueError('expected a base-16 uint64')

	return int(value, 16)


def _decimal_uint64(value):
	error_message = 'expected a base-10 uint64'
	if not is_exact_integer(value):
		return parse_decimal_uint64_text(value, error_message)

	if not 0 <= value < 1 << 64:
		raise ValueError(error_message)

	return value


def _create_mosaic(item):
	if not isinstance(item, dict) or set(item) != {'id', 'amount'}:
		raise ValueError('expected a Symbol mosaic id and amount')

	mosaic = sc.UnresolvedMosaic()
	mosaic.mosaic_id = sc.UnresolvedMosaicId(_hex_uint64(item['id']))
	mosaic.amount = sc.Amount(_decimal_uint64(item['amount']))
	return mosaic


def _create_cosignature(item):
	if not isinstance(item, dict) or set(item) != {'version', 'signerPublicKey', 'signature'}:
		raise ValueError('expected a Symbol aggregate cosignature')

	cosignature = sc.Cosignature()
	cosignature.version = _decimal_uint64(item['version'])
	if 0 != cosignature.version:
		raise ValueError('invalid Symbol aggregate cosignature version')

	cosignature.signer_public_key = sc.PublicKey(parse_hex_bytes(item['signerPublicKey']))
	cosignature.signature = sc.Signature(parse_hex_bytes(item['signature']))
	return cosignature


def _parse_field(field, hint, value):
	if 'name' == field:
		if not isinstance(value, str) or not value.isascii():
			raise ValueError('expected an ASCII namespace name')

		return value.encode('ascii')

	if 'bytes_array' == hint:
		return parse_hex_bytes(value)

	if hint.startswith('array['):
		return [_parse_array_item(hint[6:-1], item) for item in parse_json_array(value)]

	field_type = getattr(sc, hint.split(':', 1)[1]) if hint else None
	if field_type and issubclass(field_type, ByteArray):
		return field_type(parse_hex_bytes(value))

	if field in HEX_INTEGER_FIELDS:
		number = _hex_uint64(value)
	elif field in DECIMAL_FIELDS:
		number = _decimal_uint64(value)
	else:
		number = _integer(value)

	return field_type(number) if field_type else number


def _parse_array_item(item_type, item):
	if 'UnresolvedMosaic' == item_type:
		return _create_mosaic(item)

	if 'Cosignature' == item_type:
		return _create_cosignature(item)

	return _parse_field('mosaic_id' if 'UnresolvedMosaicId' == item_type else '', f'pod:{item_type}', item)


def _dto_field_name(field):
	if 'fee' == field:
		return 'maxFee'

	prefix, *suffix = field.split('_')
	return prefix + ''.join(part.capitalize() for part in suffix)


def _assign_transaction_fields(transaction, dto, embedded_transactions):
	fields = {**transaction.TYPE_HINTS, **dict.fromkeys(UNHINTED_FIELDS.get(transaction.type_, ()), '')}
	fields.pop('type_')
	allowed_fields = {'type', 'version', 'size'}
	if transaction.type_ in AGGREGATE_TYPES:
		transaction.transactions = list(embedded_transactions)
		fields.pop('transactions')
		allowed_fields.add('transactions')

	if transaction.type_ is sc.TransactionType.NAMESPACE_REGISTRATION:
		is_root = sc.NamespaceRegistrationType.ROOT.value == _integer(dto['registrationType'])
		fields.pop('parent_id' if is_root else 'duration')

	if 'mosaic' in fields:
		transaction.mosaic = _create_mosaic({'id': dto['mosaicId'], 'amount': dto['amount']})
		fields.pop('mosaic')
		allowed_fields.update(('mosaicId', 'amount'))

	for field, hint in fields.items():
		dto_field = _dto_field_name(field)
		value = dto.get(dto_field, '') if field in ('message', 'value') else dto[dto_field]
		setattr(transaction, field, _parse_field(field, hint, value))
		allowed_fields.add(dto_field)

	if transaction.type_ in METADATA_TYPES:
		allowed_fields.add('valueSize')
		if len(transaction.value) != _integer(dto['valueSize']):
			raise ValueError('Symbol metadata valueSize differs from value bytes')

	unknown_fields = dto.keys() - allowed_fields
	if unknown_fields:
		raise ValueError(f'Unexpected Symbol transaction fields {sorted(unknown_fields)}')


def create_catbuffer_transaction(dto, *, is_embedded=False, embedded_transactions=()):
	"""Reconstructs a Symbol transaction from the Core REST transaction fields."""

	if not isinstance(dto, dict):
		raise ValueError('Malformed Symbol transaction body')

	try:
		version = _integer(dto['version'])
		kind = sc.TransactionType(_integer(dto['type']))
		factory = sc.EmbeddedTransactionFactory if is_embedded else sc.TransactionFactory
		transaction = factory.create_by_name(f'{kind.name.lower()}_transaction_v{version}')
		_assign_transaction_fields(transaction, dto, embedded_transactions)
		return transaction
	except (KeyError, TypeError, ValueError) as exc:
		raise ValueError(f'Cannot reconstruct Symbol transaction type {dto.get("type")} version {dto.get("version")}: {exc}') from exc


def _serialize_transaction(transaction, dto):
	try:
		payload = transaction.serialize()
	except (OverflowError, ValueError) as exc:
		raise ValueError(f'Cannot serialize Symbol {transaction.type_.name} transaction: {exc}') from exc

	if 'size' in dto or isinstance(transaction, sc.Transaction):
		size = dto.get('size')
		if not is_exact_integer(size) or len(payload) != size:
			raise ValueError('Symbol transaction size does not match reconstructed payload')

	return payload


def _embedded_hashes(payloads, *, should_pad=False):
	return [sha3_256(payload + bytes(-len(payload) % 8) if should_pad else payload).digest() for payload in payloads]


def _embedded_root(hashes):
	builder = MerkleHashBuilder()
	for leaf_hash in hashes:
		builder.update(Hash256(leaf_hash))

	return builder.final().bytes


def _invalid_embedded_root(hashes):
	# Core's InvalidMerkleHashBuilder inserts each parent by shifting the remaining entries one slot to the right.
	# The next pair consequently overlaps the previous one in the original level, and its tail is discarded.
	while len(hashes) > 1:
		pair_count, has_unpaired_hash = divmod(len(hashes), 2)
		parents = [sha3_256(hashes[index] + hashes[index + 1]).digest() for index in range(pair_count)]
		if has_unpaired_hash:
			parents.append(sha3_256(hashes[pair_count] * 2).digest())

		hashes = parents

	return hashes[0]


def _read_embedded_transactions(parent_dto, children):
	if not children or sorted(children) != list(range(len(children))):
		raise ValueError('Missing or non-contiguous Symbol aggregate embedded transaction sources')

	child_dtos = [children[index] for index in range(len(children))]
	transactions = [create_catbuffer_transaction(dto, is_embedded=True) for dto in child_dtos]
	payloads = [_serialize_transaction(transaction, dto) for transaction, dto in zip(transactions, child_dtos)]

	# Confirmed REST pages carry separate rows. The transaction detail shape can additionally include inline wrappers.
	if 'transactions' in parent_dto:
		inline = []
		for item in parse_json_array(parent_dto['transactions']):
			if not isinstance(item, dict) or 'transaction' not in item:
				raise ValueError('Malformed inline Symbol aggregate transaction')

			dto = item['transaction']
			inline.append(_serialize_transaction(create_catbuffer_transaction(dto, is_embedded=True), dto))

		if inline != payloads:
			raise ValueError('Inline Symbol aggregate transactions do not match separate rows')

	return transactions, payloads


def _transaction_hash(transaction, payload, seed):
	data_end = len(payload)
	if transaction.type_ in AGGREGATE_TYPES:
		hashed_size = AGGREGATE_HASHED_SIZE if transaction.version >= 3 else PRE_V3_AGGREGATE_HASHED_SIZE
		data_end = TRANSACTION_HEADER_SIZE + hashed_size

	# Core EntityHasher includes the full signature, signer, generation seed and plugin data buffer.
	hasher = sha3_256(transaction.signature.bytes + transaction.signer_public_key.bytes + seed)
	hasher.update(payload[TRANSACTION_HEADER_SIZE:data_end])
	return hasher.digest()


def _aggregate_component_hash(transaction, transaction_hash):
	if not transaction.cosignatures:
		return transaction_hash

	hasher = sha3_256(transaction_hash)
	signers = {transaction.signer_public_key.bytes}
	for cosignature in transaction.cosignatures:
		key = cosignature.signer_public_key.bytes
		if key in signers or not any(key) or not Verifier(cosignature.signer_public_key).verify(transaction_hash, cosignature.signature):
			raise ValueError('Invalid Symbol aggregate cosignature')

		signers.add(key)
		hasher.update(key)

	return hasher.digest()


def _legacy_payload_size_limitation(transaction, payloads):
	# Before V3 the entity hash omits payload size. An odd Merkle level and its explicitly duplicated tail produce the same root.
	count = len(payloads)
	if transaction.version >= 3 or count <= 2:
		return None

	if count & (count - 1):
		return UnboundAggregateReason.AMBIGUOUS_LEGACY_PAYLOAD_SIZE

	subtree_width = 1
	while subtree_width < count // 2:
		if payloads[-subtree_width:] == payloads[-2 * subtree_width:-subtree_width]:
			return UnboundAggregateReason.AMBIGUOUS_LEGACY_PAYLOAD_SIZE

		subtree_width *= 2

	return None


def _verify_aggregate_root(transaction, payloads):
	root = transaction.transactions_hash.bytes
	hashes = _embedded_hashes(payloads)
	if root == _embedded_root(hashes):
		return _legacy_payload_size_limitation(transaction, payloads)

	if 1 != transaction.version:
		raise ValueError('Symbol aggregate transaction Merkle root does not match embedded bodies')

	# Check the remaining modes in Core's AggregateTransactionsHashValidator before its configured corruption exception.
	padded_hashes = _embedded_hashes(payloads, should_pad=True)
	if root == _embedded_root(padded_hashes):
		return _legacy_payload_size_limitation(transaction, payloads)

	if root == _invalid_embedded_root(hashes) or root == _invalid_embedded_root(padded_hashes):
		return UnboundAggregateReason.INVALID_MERKLE_BUILDER

	# The puller has no trusted known-corrupt map. The parent still has to pass all top-level commitments.
	return UnboundAggregateReason.UNMATCHED_V1_ROOT


def _verify_top_level_commitment(row, children, seed):
	dto = row['raw_payload']['transaction']
	unbound_reason = None
	if row['type'] in AGGREGATE_TYPE_VALUES:
		embedded_transactions, payloads = _read_embedded_transactions(dto, children)
		transaction = create_catbuffer_transaction(dto, embedded_transactions=embedded_transactions)
		unbound_reason = _verify_aggregate_root(transaction, payloads)
	else:
		if children:
			raise ValueError('Embedded Symbol transaction has a non-aggregate parent')

		transaction = create_catbuffer_transaction(dto)

	transaction_hash = _transaction_hash(transaction, _serialize_transaction(transaction, dto), seed)
	if row['hash'] != transaction_hash:
		raise ValueError('Symbol transaction hash does not match reconstructed body')

	component_hash = _aggregate_component_hash(transaction, transaction_hash) if transaction.type_ in AGGREGATE_TYPES else transaction_hash
	if component_hash != hash_bytes_from_hex(row['raw_payload']['meta'], 'merkleComponentHash', 'Symbol transaction'):
		raise ValueError('Symbol transaction Merkle component hash does not match reconstructed body')

	return component_hash, unbound_reason


def validate_transaction_commitments(rows, generation_hash_seed):
	"""Verifies one block's normalized rows and reports component hashes and unbound aggregate parents."""

	seed = generation_hash_seed.bytes if isinstance(generation_hash_seed, Hash256) else Hash256(generation_hash_seed).bytes
	top_level = {}
	children = defaultdict(dict)
	for row in rows:
		if not row['is_embedded']:
			if row['hash'] in top_level:
				raise ValueError('Duplicate top-level Symbol transaction commitment')

			top_level[row['hash']] = row
			continue

		raw_payload = row['raw_payload']
		index = _integer(raw_payload['meta']['index'])
		by_index = children[row['aggregate_hash']]
		if index in by_index:
			raise ValueError('Duplicate Symbol aggregate embedded transaction source')

		by_index[index] = raw_payload['transaction']

	if children.keys() - top_level.keys():
		raise ValueError('Missing Symbol aggregate parent for embedded transaction commitment')

	component_hashes = {}
	unbound_aggregate_reasons = {}
	for transaction_hash, row in top_level.items():
		component_hash, unbound_reason = _verify_top_level_commitment(row, children.get(transaction_hash), seed)
		component_hashes[transaction_hash] = component_hash
		if unbound_reason is not None:
			unbound_aggregate_reasons[transaction_hash] = unbound_reason

	return TransactionCommitments(component_hashes, unbound_aggregate_reasons)
