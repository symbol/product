class TransactionListView:
	def __init__(self, transaction_hash, transaction_type, from_address, to_address, value, fee, height, timestamp, deadline):
		"""Create transaction list view."""

		# pylint: disable=too-many-arguments

		self.transaction_hash = transaction_hash
		self.transaction_type = transaction_type
		self.from_address = from_address
		self.to_address = to_address
		self.value = value
		self.fee = fee
		self.height = height
		self.timestamp = timestamp
		self.deadline = deadline

	def __eq__(self, other):
		return isinstance(other, TransactionListView) and all([
			self.transaction_hash == other.transaction_hash,
			self.transaction_type == other.transaction_type,
			self.from_address == other.from_address,
			self.to_address == other.to_address,
			self.value == other.value,
			self.fee == other.fee,
			self.height == other.height,
			self.timestamp == other.timestamp,
			self.deadline == other.deadline
		])

	def to_dict(self):
		"""Formats the transaction list info as a dictionary."""

		return {
			'transactionHash': self.transaction_hash,
			'transactionType': self.transaction_type,
			'fromAddress': str(self.from_address),
			'toAddress': str(self.to_address),
			'value': self.value,
			'fee': self.fee,
			'height': self.height,
			'timestamp': str(self.timestamp),
			'deadline': str(self.deadline)
		}
