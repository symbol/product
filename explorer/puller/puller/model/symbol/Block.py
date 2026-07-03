from datetime import datetime, timezone

from psycopg2.extras import Json
from symbolchain.CryptoTypes import PublicKey
from symbolchain.symbol.Network import Address

BLOCK_TYPE_LABELS = {
	32835: 'nemesis',
	33347: 'importance',
	33091: 'normal'
}
BLOCK_TYPE_VALUES = tuple(BLOCK_TYPE_LABELS.values())


def _block_type_label(block_type):
	try:
		return BLOCK_TYPE_LABELS[int(block_type)]
	except (KeyError, TypeError, ValueError) as exception:
		raise ValueError(f'Unsupported Symbol block type {block_type}') from exception


def _int_or_none(value):
	return int(value) if value is not None else None


def _bytes_from_hex_or_none(value):
	return bytes.fromhex(value) if value else None


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
		'timestamp': datetime.fromtimestamp(epoch_adjustment_seconds + network_timestamp / 1000, timezone.utc),
		'network_timestamp': network_timestamp,
		'total_fee': int(meta['totalFee']),
		'transactions_count': int(meta['transactionsCount']),
		'total_transactions_count': int(meta['totalTransactionsCount']),
		'statements_count': int(meta['statementsCount']),
		'difficulty': int(block['difficulty']),
		'fee_multiplier': block['feeMultiplier'],
		'block_type': _block_type_label(block['type']),
		'signer_public_key': signer_public_key,
		'signer_address': network.public_key_to_address(PublicKey(signer_public_key)).bytes,
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
		'voting_eligible_accounts_count': _int_or_none(block.get('votingEligibleAccountsCount')),
		'harvesting_eligible_accounts_count': _int_or_none(block.get('harvestingEligibleAccountsCount')),
		'total_voting_balance': _int_or_none(block.get('totalVotingBalance')),
		'previous_importance_block_hash': _bytes_from_hex_or_none(block.get('previousImportanceBlockHash')),
		'raw_payload': Json(node_block)
	}
