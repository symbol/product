class BlockView:
	def __init__(self, height, timestamp, total_fees, total_transactions, difficulty, block_hash, signer, signature):
		"""Create Block view."""

		# pylint: disable=too-many-arguments

		self.height = height
		self.timestamp = timestamp
		self.total_fees = total_fees
		self.total_transactions = total_transactions
		self.difficulty = difficulty
		self.block_hash = block_hash
		self.signer = signer
		self.signature = signature

	def __eq__(self, other):
		return isinstance(other, BlockView) and all([
			self.height == other.height,
			self.timestamp == other.timestamp,
			self.total_fees == other.total_fees,
			self.total_transactions == other.total_transactions,
			self.difficulty == other.difficulty,
			self.block_hash == other.block_hash,
			self.signer == other.signer,
			self.signature == other.signature
		])

	def to_dict(self):
		"""Formats the block info as a dictionary."""

		return {
			'height': self.height,
			'timestamp': str(self.timestamp),
			'totalFees': self.total_fees,
			'totalTransactions': self.total_transactions,
			'difficulty': self.difficulty,
			'hash': str(self.block_hash),
			'signer': str(self.signer),
			'signature': str(self.signature)
		}
