from collections import namedtuple

TransactionQuery = namedtuple('TransactionQuery', [
	'height',
	'transaction_types',
	'sender',
	'address',
	'sender_address',
	'recipient_address',
	'mosaic'
])


TransactionRecord = namedtuple('TransactionRecord', [
	'transaction_hash',
	'transaction_type',
	'from_address',
	'fee',
	'height',
	'timestamp',
	'deadline',
	'signature',
	'to_address',
	'payload',
	'amount',
	'mosaics'
])


class TransactionView:  # pylint: disable=too-many-instance-attributes, too-many-positional-arguments
	def __init__(
		self,
		transaction_hash,
		transaction_type,
		from_address,
		to_address,
		value,
		embedded_transactions,
		fee,
		height,
		timestamp,
		deadline,
		signature
	):
		"""Create transaction list view."""

		# pylint: disable=too-many-arguments

		self.transaction_hash = transaction_hash
		self.transaction_type = transaction_type
		self.from_address = from_address
		self.to_address = to_address
		self.value = value
		self.embedded_transactions = embedded_transactions
		self.fee = fee
		self.height = height
		self.timestamp = timestamp
		self.deadline = deadline
		self.signature = signature

	def __eq__(self, other):
		return isinstance(other, TransactionView) and all([
			self.transaction_hash == other.transaction_hash,
			self.transaction_type == other.transaction_type,
			self.from_address == other.from_address,
			self.to_address == other.to_address,
			self.value == other.value,
			self.embedded_transactions == other.embedded_transactions,
			self.fee == other.fee,
			self.height == other.height,
			self.timestamp == other.timestamp,
			self.deadline == other.deadline,
			self.signature == other.signature
		])

	def to_dict(self):
		"""Formats the transaction list info as a dictionary."""

		return {
			'transactionHash': self.transaction_hash,
			'transactionType': self.transaction_type,
			'fromAddress': self.from_address,
			'toAddress': self.to_address,
			'value': self.value,
			'embeddedTransactions': self.embedded_transactions,
			'fee': self.fee,
			'height': self.height,
			'timestamp': self.timestamp,
			'deadline': self.deadline,
			'signature': self.signature,
		}
