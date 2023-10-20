class StatisticTransactionView:
	def __init__(self, total_transactions, transaction_last_24_hours, transaction_last_30_day):
		""""Create statistic view."""

		# pylint: disable=too-many-arguments

		self.total_transactions = total_transactions
		self.transaction_last_24_hours = transaction_last_24_hours
		self.transaction_last_30_day = transaction_last_30_day

	def __eq__(self, other):
		return isinstance(other, StatisticTransactionView) and all([
			self.total_transactions == other.total_transactions,
			self.transaction_last_24_hours == other.transaction_last_24_hours,
			self.transaction_last_30_day == other.transaction_last_30_day
		])

	def to_dict(self):
		return {
			'total': self.total_transactions,
			'last24Hours': self.transaction_last_24_hours,
			'last30Day': self.transaction_last_30_day
		}
