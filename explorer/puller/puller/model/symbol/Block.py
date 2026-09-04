from psycopg2.extras import Json
from symbolchain.symbol.Network import Address

from puller.model.symbol.format import (
	address_from_public_key,
	bytes_from_hex_or_none,
	int_or_none,
	is_exact_integer,
	label_for_type,
	timestamp_from_network_value
)

# `symbol_blocks.transactions_count` and `symbol_blocks.total_transactions_count` are PostgreSQL int4 columns.
MAX_INT4 = 2 ** 31 - 1

BLOCK_TYPE_LABELS = {
	32835: 'nemesis',
	33347: 'importance',
	33091: 'normal'
}
BLOCK_TYPE_VALUES = tuple(BLOCK_TYPE_LABELS.values())


def create_block_row(node_block, epoch_adjustment_seconds, network):
	"""Creates a persisted Symbol block row from one node block DTO."""

	block = node_block['block']
	meta = node_block['meta']
	# Source: _symbol/openapi/spec/core/block/schemas/BlockMetaDTO.yml at 0f4c95e7098bbd84a8ceb9e2a101496bdfe662cf.
	# transactionsCount excludes embedded transactions; totalTransactionsCount includes them.
	if 'transactionsCount' not in meta:
		raise ValueError('Missing Symbol block transactionsCount')

	if 'totalTransactionsCount' not in meta:
		raise ValueError('Missing Symbol block totalTransactionsCount')

	transactions_count = meta['transactionsCount']
	total_transactions_count = meta['totalTransactionsCount']
	if not is_exact_integer(transactions_count) or transactions_count < 0 or transactions_count > MAX_INT4:
		raise ValueError('Invalid Symbol block transactionsCount')

	if not is_exact_integer(total_transactions_count) or total_transactions_count < 0 or total_transactions_count > MAX_INT4:
		raise ValueError('Invalid Symbol block totalTransactionsCount')

	if transactions_count > total_transactions_count:
		raise ValueError('Symbol block transactionsCount exceeds totalTransactionsCount')

	signer_public_key = bytes.fromhex(block['signerPublicKey'])
	network_timestamp = int(block['timestamp'])

	return {
		'height': int(block['height']),
		'hash': bytes.fromhex(meta['hash']),
		'previous_hash': bytes.fromhex(block['previousBlockHash']),
		'timestamp': timestamp_from_network_value(network_timestamp, epoch_adjustment_seconds),
		'network_timestamp': network_timestamp,
		'total_fee': int(meta['totalFee']),
		'transactions_count': transactions_count,
		'total_transactions_count': total_transactions_count,
		'statements_count': int(meta['statementsCount']),
		'difficulty': int(block['difficulty']),
		'fee_multiplier': block['feeMultiplier'],
		'block_type': label_for_type(BLOCK_TYPE_LABELS, block['type'], 'block'),
		'signer_public_key': signer_public_key,
		'signer_address': address_from_public_key(signer_public_key, network),
		'beneficiary_address': Address(bytes.fromhex(block['beneficiaryAddress'])).bytes,
		'signature': bytes.fromhex(block['signature']),
		'size': int(block['size']),
		'proof_gamma': bytes.fromhex(block['proofGamma']),
		'proof_verification_hash': bytes.fromhex(block['proofVerificationHash']),
		'proof_scalar': bytes.fromhex(block['proofScalar']),
		'state_hash': bytes.fromhex(block['stateHash']),
		'transactions_hash': bytes.fromhex(block['transactionsHash']),
		'receipts_hash': bytes.fromhex(block['receiptsHash']),
		'state_hash_sub_cache_roots': Json(meta['stateHashSubCacheMerkleRoots']),
		'voting_eligible_accounts_count': int_or_none(block.get('votingEligibleAccountsCount')),
		'harvesting_eligible_accounts_count': int_or_none(block.get('harvestingEligibleAccountsCount')),
		'total_voting_balance': int_or_none(block.get('totalVotingBalance')),
		'previous_importance_block_hash': bytes_from_hex_or_none(block.get('previousImportanceBlockHash')),
		'raw_payload': Json(node_block)
	}
