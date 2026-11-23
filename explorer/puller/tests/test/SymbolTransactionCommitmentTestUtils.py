"""Builds block roots and transaction metadata from deterministic Symbol REST fixtures."""

from collections import defaultdict
from hashlib import sha3_256

from symbolchain.CryptoTypes import Hash256
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.sc import TransactionType
from symbolchain.symbol.Merkle import MerkleHashBuilder
from symbolchain.symbol.Network import Network

from puller.model.symbol.TransactionCommitment import create_catbuffer_transaction


def _seal_aggregate(item, children, facade, cosigners):
	dto = item['transaction']
	embedded = [create_catbuffer_transaction(child['transaction'], is_embedded=True) for child in children]
	dto['transactionsHash'] = str(facade.hash_embedded_transactions(embedded))
	if cosigners:
		dto['cosignatures'] = []
		unsigned = create_catbuffer_transaction(dto, embedded_transactions=embedded)
		for key_pair in cosigners:
			cosignature = facade.cosign_transaction(key_pair, unsigned)
			dto['cosignatures'].append({
				'version': str(cosignature.version),
				'signerPublicKey': str(cosignature.signer_public_key),
				'signature': str(cosignature.signature)
			})

	return create_catbuffer_transaction(dto, embedded_transactions=embedded)


def _seal_transaction(item, children, facade, cosigners):
	dto = item['transaction']
	if dto['type'] in (TransactionType.AGGREGATE_COMPLETE.value, TransactionType.AGGREGATE_BONDED.value):
		transaction = _seal_aggregate(item, children, facade, cosigners)
	else:
		transaction = create_catbuffer_transaction(dto)

	entity_hash = facade.hash_transaction(transaction)
	component_hash = entity_hash
	if dto.get('cosignatures'):
		keys = b''.join(cosignature.signer_public_key.bytes for cosignature in transaction.cosignatures)
		component_hash = Hash256(sha3_256(entity_hash.bytes + keys).digest())

	dto['size'] = transaction.size
	item['meta'].update(hash=str(entity_hash), merkleComponentHash=str(component_hash))
	for child in children:
		child['meta']['aggregateHash'] = str(entity_hash)

	return component_hash


def seal_block_transactions(block, items, *, network=Network.TESTNET, cosigners=()):
	"""Updates DTO sizes, hashes, aggregate references, block counts and root in place."""

	facade = SymbolFacade(network)
	embedded_by_parent = defaultdict(list)
	top_level = []
	for item in items:
		meta = item['meta']
		if 'aggregateHash' in meta:
			embedded_by_parent[meta['aggregateHash']].append(item)
		else:
			top_level.append(item)

	builder = MerkleHashBuilder()
	for item in sorted(top_level, key=lambda row: row['meta']['index']):
		children = sorted(embedded_by_parent.pop(item['meta']['hash'], ()), key=lambda child: child['meta']['index'])
		builder.update(_seal_transaction(item, children, facade, cosigners))

	if embedded_by_parent:
		raise ValueError('Test fixture has embedded rows without matching aggregate')

	block['meta'].update(transactionsCount=len(top_level), totalTransactionsCount=len(items))
	block['block']['transactionsHash'] = str(builder.final())
