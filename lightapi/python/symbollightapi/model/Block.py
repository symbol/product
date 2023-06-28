class Block:
	"""Block model."""

	def __init__(self, height, timestamp, transactions, difficulty, block_hash, signer, signature):
		"""Create a Block model."""

		# pylint: disable=too-many-arguments

		self.height = height
		self.timestamp = timestamp
		self.transactions = transactions
		self.difficulty = difficulty
		self.block_hash = block_hash
		self.signer = signer
		self.signature = signature

	def __eq__(self, other):
		return isinstance(other, Block) and all([
			self.height == other.height,
			self.timestamp == other.timestamp,
			self.transactions == other.transactions,
			self.difficulty == other.difficulty,
			self.block_hash == other.block_hash,
			self.signer == other.signer,
			self.signature == other.signature
		])
