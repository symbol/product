from decimal import ROUND_HALF_UP, Decimal

from rest.model.format import format_timestamp
from rest.model.symbol.format import format_amount, str_or_none, to_hex, to_hex_or_none

BLOCK_STATISTICS_WINDOW = 240


class SymbolBlockStatisticsView:
	"""Format a non-empty sequence of blocks in ascending height order.

	The input contains up to the latest 240 blocks and, if present, their predecessor.
	Block times use all adjacent pairs; fees and difficulties use up to the latest 240 blocks.
	At least one block is assumed because the database read rejects an empty result.
	"""

	def __init__(self, blocks):
		self.blocks = blocks

	@staticmethod
	def _timestamp_difference(newer_timestamp, older_timestamp):
		delta = newer_timestamp - older_timestamp
		seconds = Decimal(delta.days * 86400 + delta.seconds) + Decimal(delta.microseconds) / Decimal(1_000_000)
		return float(seconds)

	@staticmethod
	def _format_difficulty(difficulty):
		# Match the frontend's binary64 calculation before applying its toFixed(2) rounding.
		percentage = float(difficulty) / float(10 ** 14) * 100.0
		rounded_percentage = Decimal.from_float(percentage).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
		return format(rounded_percentage, '.2f')

	def to_dict(self, native_mosaic_info):
		"""Formats the block statistics response with explicit native divisibility."""

		fee_blocks = self.blocks[-BLOCK_STATISTICS_WINDOW:]
		block_time_chart = [
			[block.height, self._timestamp_difference(block.timestamp, previous_block.timestamp)]
			for previous_block, block in zip(self.blocks, self.blocks[1:])
		]
		block_fee_chart = [
			[block.height, format_amount(block.total_fee, native_mosaic_info.divisibility)] for block in fee_blocks
		]
		block_difficulty_chart = [
			[block.height, self._format_difficulty(block.difficulty)] for block in fee_blocks
		]

		block_time = None
		if block_time_chart:
			average_time = sum(Decimal(str(item[1])) for item in block_time_chart) / len(block_time_chart)
			block_time = int(average_time.quantize(Decimal('1'), rounding=ROUND_HALF_UP))

		block_fee = format_amount(
			sum((Decimal(block.total_fee) for block in fee_blocks), Decimal(0)) / len(fee_blocks),
			native_mosaic_info.divisibility)
		block_difficulty = self._format_difficulty(fee_blocks[-1].difficulty)

		return {
			'blockTimeChart': block_time_chart,
			'blockFeeChart': block_fee_chart,
			'blockDifficultyChart': block_difficulty_chart,
			'blockTime': block_time,
			'blockFee': block_fee,
			'blockDifficulty': block_difficulty
		}


class SymbolBlockView:  # pylint: disable=too-many-instance-attributes
	"""Symbol block view used by Explorer REST responses."""

	def __init__(self, **kwargs):
		self.height = kwargs['height']
		self.block_hash = kwargs['block_hash']
		self.previous_hash = kwargs['previous_hash']
		self.timestamp = kwargs['timestamp']
		self.network_timestamp = kwargs['network_timestamp']
		self.total_fee = kwargs['total_fee']
		self.block_reward = kwargs['block_reward']
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

	def to_dict(self, native_mosaic_info):
		"""Formats the block info as a dictionary."""

		block_reward = None if self.block_reward is None else format_amount(self.block_reward, native_mosaic_info.divisibility)
		return {
			'height': self.height,
			'hash': to_hex(self.block_hash),
			'previousHash': to_hex(self.previous_hash),
			'timestamp': format_timestamp(self.timestamp),
			'networkTimestamp': self.network_timestamp,
			'harvester': self.harvester,
			'beneficiaryAddress': self.beneficiary_address,
			'totalFee': format_amount(self.total_fee, native_mosaic_info.divisibility),
			'transactionCount': self.transaction_count,
			'statementCount': self.statement_count,
			'blockReward': block_reward,
			'isFinalized': self.is_finalized,
			'difficulty': str(self.difficulty)
		}

	def to_detail_dict(self, native_mosaic_info):
		"""Formats the block info as a block-detail dictionary."""

		total_voting_balance = None if self.total_voting_balance is None else format_amount(
			self.total_voting_balance, native_mosaic_info.divisibility)
		return {
			**self.to_dict(native_mosaic_info),
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
			'totalVotingBalance': total_voting_balance,
			'previousImportanceBlockHash': to_hex_or_none(self.previous_importance_block_hash),
			'blockType': self.block_type
		}
