class StatisticAccountView:  # pylint: disable=too-many-positional-arguments, too-many-arguments
	def __init__(self, total_accounts, accounts_with_balance, harvested_accounts, total_importance, eligible_harvest_accounts):
		"""Create account statistic view."""

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
		"""Formats the account statistic info as a dictionary."""

		return {
			'total': self.total_accounts,
			'withBalance': self.accounts_with_balance,
			'harvestedAccounts': self.harvested_accounts,
			'totalImportance': self.total_importance,
			'eligibleHarvestAccounts': self.eligible_harvest_accounts
		}


class StatisticTransactionView:
	def __init__(self, total_transactions, transaction_last_24_hours, transaction_last_30_days):
		"""Create statistic view."""

		self.total_transactions = total_transactions
		self.transaction_last_24_hours = transaction_last_24_hours
		self.transaction_last_30_days = transaction_last_30_days

	def __eq__(self, other):
		return isinstance(other, StatisticTransactionView) and all([
			self.total_transactions == other.total_transactions,
			self.transaction_last_24_hours == other.transaction_last_24_hours,
			self.transaction_last_30_days == other.transaction_last_30_days
		])

	def to_dict(self):
		"""Formats the transaction statistic info as a dictionary."""

		return {
			'total': self.total_transactions,
			'last24Hours': self.transaction_last_24_hours,
			'last30Days': self.transaction_last_30_days,
			'last30Day': self.transaction_last_30_days
		}


class StatisticTransactionDateRangeDataView:
	def __init__(self, period, total_transactions):
		"""Create transaction statistic date range data view."""

		self.period = period
		self.total_transactions = total_transactions

	def __eq__(self, other):
		return isinstance(other, StatisticTransactionDateRangeDataView) and all([
			self.period == other.period,
			self.total_transactions == other.total_transactions
		])

	def to_dict(self):
		"""Formats the transaction statistic date range data as a dictionary."""

		return {
			'period': self.period,
			'totalTransactions': self.total_transactions
		}


class StatisticTransactionDateRangeView:
	def __init__(self, period_type, data):
		"""Create transaction statistic date range view."""

		self.period_type = period_type
		self.data = data

	def __eq__(self, other):
		return isinstance(other, StatisticTransactionDateRangeView) and all([
			self.period_type == other.period_type,
			self.data == other.data
		])

	def to_dict(self):
		"""Formats the transaction statistic date range as a dictionary."""

		return {
			'periodType': self.period_type.lower(),
			'data': [item.to_dict() for item in self.data]
		}
