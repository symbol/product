from rest.model.symbol.format import format_timestamp, format_xym_amount, str_or_none, to_hex, to_hex_or_none


class SymbolBlockView:  # pylint: disable=too-many-instance-attributes
	"""Symbol block view used by Explorer REST responses."""

	def __init__(self, **kwargs):
		self.height = kwargs['height']
		self.block_hash = kwargs['block_hash']
		self.previous_hash = kwargs['previous_hash']
		self.timestamp = kwargs['timestamp']
		self.network_timestamp = kwargs['network_timestamp']
		self.total_fee = kwargs['total_fee']
		self.transaction_count = kwargs['transaction_count']
		self.statement_count = kwargs['statement_count']
		self.difficulty = kwargs['difficulty']
		self.fee_multiplier = kwargs['fee_multiplier']
		self.block_type = kwargs['block_type']
		self.harvester = kwargs['harvester']
		self.beneficiary_address = kwargs['beneficiary_address']
		self.signature = kwargs['signature']
		self.size = kwargs['size']
		self.proof_gamma = kwargs['proof_gamma']
		self.proof_verification_hash = kwargs['proof_verification_hash']
		self.proof_scalar = kwargs['proof_scalar']
		self.state_hash = kwargs['state_hash']
		self.transactions_hash = kwargs['transactions_hash']
		self.receipts_hash = kwargs['receipts_hash']
		self.state_hash_sub_cache_roots = kwargs['state_hash_sub_cache_roots']
		self.voting_eligible_accounts_count = kwargs['voting_eligible_accounts_count']
		self.harvesting_eligible_accounts_count = kwargs['harvesting_eligible_accounts_count']
		self.total_voting_balance = kwargs['total_voting_balance']
		self.previous_importance_block_hash = kwargs['previous_importance_block_hash']
		self.is_finalized = kwargs['is_finalized']

	def to_dict(self):
		"""Formats the block info as a dictionary."""

		return {
			'height': self.height,
			'hash': to_hex(self.block_hash),
			'previousHash': to_hex(self.previous_hash),
			'timestamp': format_timestamp(self.timestamp),
			'networkTimestamp': self.network_timestamp,
			'harvester': self.harvester,
			'beneficiaryAddress': self.beneficiary_address,
			'totalFee': format_xym_amount(self.total_fee),
			'transactionCount': self.transaction_count,
			'statementCount': self.statement_count,
			# Receipts Core will populate block rewards when receipt data is available.
			'blockReward': None,
			'isFinalized': self.is_finalized,
			'difficulty': str(self.difficulty)
		}

	def to_detail_dict(self):
		"""Formats the block info as a block-detail dictionary."""

		return {
			**self.to_dict(),
			'signature': to_hex(self.signature),
			'size': self.size,
			'feeMultiplier': self.fee_multiplier,
			'proofGamma': to_hex(self.proof_gamma),
			'proofVerificationHash': to_hex(self.proof_verification_hash),
			'proofScalar': to_hex(self.proof_scalar),
			'stateHash': to_hex(self.state_hash),
			'stateHashSubCacheMerkleRoots': self.state_hash_sub_cache_roots,
			'receiptsHash': to_hex(self.receipts_hash),
			'transactionsHash': to_hex(self.transactions_hash),
			'votingEligibleAccountsCount': self.voting_eligible_accounts_count,
			'harvestingEligibleAccountsCount': str_or_none(self.harvesting_eligible_accounts_count),
			'totalVotingBalance': str_or_none(self.total_voting_balance),
			'previousImportanceBlockHash': to_hex_or_none(self.previous_importance_block_hash),
			'blockType': self.block_type
		}
