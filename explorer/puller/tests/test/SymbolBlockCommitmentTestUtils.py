"""Builds honest block hashes for synthetic Symbol REST block headers."""

from collections import defaultdict
from hashlib import sha3_256

from symbolchain import sc
from symbolchain.ArrayHelpers import ArrayHelpers
from symbolchain.symbol.Network import Network

from puller.model.symbol.ReceiptCommitment import calculate_receipts_hash
from tests.test.SymbolTransactionCommitmentTestUtils import seal_block_transactions


def commit_node_block(node_block):
	"""Updates the REST block hash in place using a Python SDK Catbuffer header."""
	body = node_block['block']
	block_type = sc.BlockType(body['type'])
	block = sc.BlockFactory.create_by_name(f'{block_type.name.lower()}_block_v{body["version"]}')
	block.signature = sc.Signature(body['signature'])
	block.signer_public_key = sc.PublicKey(body['signerPublicKey'])
	block.network = sc.NetworkType(body['network'])
	block.height = sc.Height(int(body['height']))
	block.timestamp = sc.Timestamp(int(body['timestamp']))
	block.difficulty = sc.Difficulty(int(body['difficulty']))
	block.generation_hash_proof.gamma = sc.ProofGamma(body['proofGamma'])
	block.generation_hash_proof.verification_hash = sc.ProofVerificationHash(body['proofVerificationHash'])
	block.generation_hash_proof.scalar = sc.ProofScalar(body['proofScalar'])
	block.previous_block_hash = sc.Hash256(body['previousBlockHash'])
	block.transactions_hash = sc.Hash256(body['transactionsHash'])
	block.receipts_hash = sc.Hash256(body['receiptsHash'])
	block.state_hash = sc.Hash256(body['stateHash'])
	block.beneficiary_address = sc.Address(body['beneficiaryAddress'])
	block.fee_multiplier = sc.BlockFeeMultiplier(body['feeMultiplier'])

	if sc.BlockType.NORMAL != block_type:
		block.voting_eligible_accounts_count = body['votingEligibleAccountsCount']
		block.harvesting_eligible_accounts_count = int(body['harvestingEligibleAccountsCount'])
		block.total_voting_balance = sc.Amount(int(body['totalVotingBalance']))
		block.previous_importance_block_hash = sc.Hash256(body['previousImportanceBlockHash'])

	# Core reads the full signature and signer, then the catbuffer from Version to the end of the hashed header.
	# The SDK block carries no transactions, and Core excludes the normal block's final four padding bytes.
	payload = block.serialize()
	header_end = block.size - 4 if sc.BlockType.NORMAL == block_type else block.size
	node_block['meta']['hash'] = sha3_256(block.signature.bytes + block.signer_public_key.bytes + payload[108:header_end]).hexdigest().upper()
	return node_block


def _serialized_transactions_size(transactions):
	top_level = sorted((item for item in transactions if 'aggregateHash' not in item['meta']), key=lambda item: item['meta']['index'])
	sizes = [item['transaction']['size'] for item in top_level]
	return sum(ArrayHelpers.align_up(size, 8) for size in sizes[:-1]) + sum(sizes[-1:])


def seal_replacement_blocks(  # pylint: disable=too-many-arguments,too-many-locals
	blocks, *, transactions=(), statements=(), addresses_by_height=None, mosaics_by_height=None, network=Network.TESTNET
):
	"""Seals contiguous replacement DTOs in place, retaining the first block's parent hash."""
	transactions_by_height = defaultdict(list)
	for item in transactions:
		transactions_by_height[int(item['meta']['height'])].append(item)

	statements_by_height = defaultdict(list)
	for item in statements:
		statements_by_height[int(item['statement']['height'])].append(item['statement'])

	addresses_by_height = addresses_by_height or {}
	mosaics_by_height = mosaics_by_height or {}
	previous_hash = blocks[0]['block']['previousBlockHash']
	for block in blocks:
		fields = block['block']
		height = int(fields['height'])
		at_height = transactions_by_height[height]
		seal_block_transactions(block, at_height, network=network)
		address_statements = [item['statement'] for item in addresses_by_height.get(height, ())]
		mosaic_statements = [item['statement'] for item in mosaics_by_height.get(height, ())]
		receipt_statements = statements_by_height[height]
		fields['receiptsHash'] = calculate_receipts_hash(receipt_statements, address_statements, mosaic_statements).hex().upper()
		block['meta']['statementsCount'] = len(receipt_statements) + len(address_statements) + len(mosaic_statements)
		fields.update(previousBlockHash=previous_hash, network=network.identifier)
		if 1 == height:
			fields.update(
				type=sc.BlockType.NEMESIS.value, size=sc.NemesisBlockV1().size,
				votingEligibleAccountsCount=0, harvestingEligibleAccountsCount='0',
				totalVotingBalance='0', previousImportanceBlockHash='0' * 64)
		else:
			fields.update(type=sc.BlockType.NORMAL.value, size=sc.NormalBlockV1().size)

		fields['size'] += _serialized_transactions_size(at_height)
		commit_node_block(block)
		previous_hash = block['meta']['hash']

	return blocks
