class TransactionListView:
	def __init__(self, transaction_hash, transaction_type, from_address, to_address, value, fees, height, timestamp):
		"""Create transaction list view."""

		# pylint: disable=too-many-arguments

		self.transaction_hash = transaction_hash
		self.transaction_type = transaction_type
		self.from_address = from_address
		self.to_address = to_address
		self.value = value
		self.fees = fees
		self.height = height
		self.timestamp = timestamp

	def __eq__(self, other):
		return isinstance(other, TransactionListView) and all([
			self.transaction_hash == other.transaction_hash,
			self.transaction_type == other.transaction_type,
			self.from_address == other.from_address,
			self.to_address == other.to_address,
			self.value == other.value,
			self.fees == other.fees,
			self.height == other.height,
			self.timestamp == other.timestamp
		])

	def to_dict(self):
		"""Formats the transaction list info as a dictionary."""

		return {
			'transactionHash': self.transaction_hash,
			'transactionType': self.transaction_type,
			'fromAddress': str(self.from_address),
			'toAddress': str(self.to_address),
			'value': self.value,
			'fees': self.fees,
			'height': self.height,
			'timestamp': str(self.timestamp)
		}
