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


class StatisticTransactionDailyView:
	def __init__(self, date, total_transactions):
		""""Create daily statistic view."""

		self.date = date
		self.total_transactions = total_transactions

	def __eq__(self, other):
		return isinstance(other, StatisticTransactionDailyView) and all([
			self.date == other.date,
			self.total_transactions == other.total_transactions
		])

	def to_dict(self):
		return {
			'date': self.date,
			'totalTransactions': self.total_transactions
		}


class StatisticTransactionMonthlyView:
	def __init__(self, month, total_transactions):
		""""Create monthly statistic view."""

		self.month = month
		self.total_transactions = total_transactions

	def __eq__(self, other):
		return isinstance(other, StatisticTransactionMonthlyView) and all([
			self.month == other.month,
			self.total_transactions == other.total_transactions
		])

	def to_dict(self):
		return {
			'month': self.month,
			'totalTransactions': self.total_transactions
		}


class StatisticAccountView:
	def __init__(self, total_accounts, accounts_with_balance, harvested_accounts, total_importance, eligible_harvest_accounts):
		""""Create account statistic view."""

		# pylint: disable=too-many-arguments

		self.total_accounts = total_accounts
		self.accounts_with_balance = accounts_with_balance
		self.harvested_accounts = harvested_accounts
		self.total_importance = total_importance
		self.eligible_harvest_accounts = eligible_harvest_accounts

	def __eq__(self, other):
		return isinstance(other, StatisticAccountView) and all([
			self.total_accounts == other.total_accounts,
			self.accounts_with_balance == other.accounts_with_balance,
			self.harvested_accounts == other.harvested_accounts,
			self.total_importance == other.total_importance,
			self.eligible_harvest_accounts == other.eligible_harvest_accounts
		])

	def to_dict(self):
		return {
			'total': self.total_accounts,
			'withBalance': self.accounts_with_balance,
			'harvestedAccounts': self.harvested_accounts,
			'totalImportance': self.total_importance,
			'eligibleHarvestAccounts': self.eligible_harvest_accounts
		}
