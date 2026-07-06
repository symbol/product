from psycopg2.extras import Json
from symbolchain.symbol.Network import Address

from puller.model.symbol.format import (
	address_from_public_key,
	bytes_from_hex_or_none,
	int_or_none,
	label_for_type,
	timestamp_from_network_value
)

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
	signer_public_key = bytes.fromhex(block['signerPublicKey'])
	network_timestamp = int(block['timestamp'])

	return {
		'height': int(block['height']),
		'hash': bytes.fromhex(meta['hash']),
		'previous_hash': bytes.fromhex(block['previousBlockHash']),
		'timestamp': timestamp_from_network_value(network_timestamp, epoch_adjustment_seconds),
		'network_timestamp': network_timestamp,
		'total_fee': int(meta['totalFee']),
		'transactions_count': int(meta['transactionsCount']),
		'total_transactions_count': int(meta['totalTransactionsCount']),
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
