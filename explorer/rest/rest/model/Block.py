class BlockView:  # pylint: disable=too-many-instance-attributes
	def __init__(self, height, timestamp, total_fees, total_transactions, difficulty, block_hash, signer, signature, size):
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
		self.size = size

	def __eq__(self, other):
		return isinstance(other, BlockView) and all([
			self.height == other.height,
			self.timestamp == other.timestamp,
			self.total_fees == other.total_fees,
			self.total_transactions == other.total_transactions,
			self.difficulty == other.difficulty,
			self.block_hash == other.block_hash,
			self.signer == other.signer,
			self.signature == other.signature,
			self.size == other.size
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
			'signature': str(self.signature),
			'size': self.size
		}
