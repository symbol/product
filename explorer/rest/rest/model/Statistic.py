class StatisticAccountView:  # pylint: disable=too-many-positional-arguments, too-many-arguments
	def __init__(self, total_accounts, accounts_with_balance, harvested_accounts, total_importance, eligible_harvest_accounts):
		""""Create account statistic view."""

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
