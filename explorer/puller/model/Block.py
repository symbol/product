class Block:
	def __init__(self, height, timestamp, total_fees, total_transactions, difficulty, block_hash, signer, signature, size):
		"""Create Block model."""

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

	@staticmethod
	def convert_timestamp_to_datetime(facade, timestamp):
		return facade.network.datetime_converter.to_datetime(timestamp).strftime('%Y-%m-%d %H:%M:%S')

	def __eq__(self, other):
		return isinstance(other, Block) and all([
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
