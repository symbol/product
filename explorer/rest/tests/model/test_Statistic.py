import unittest

from rest.model.Statistic import StatisticAccountView


class StatisticAccountViewTest(unittest.TestCase):
	@staticmethod
	def _create_default_statistic_account_view(override=None):
		statistic_account_view = StatisticAccountView(
			total_accounts=100,
			accounts_with_balance=80,
			harvested_accounts=25,
			total_importance=0.95,
			eligible_harvest_accounts=12
		)

		if override:
			setattr(statistic_account_view, override[0], override[1])

		return statistic_account_view

	def test_can_create_statistic_account_view(self):
		# Act:
		statistic_account_view = self._create_default_statistic_account_view()

		# Assert:
		self.assertEqual(100, statistic_account_view.total_accounts)
		self.assertEqual(80, statistic_account_view.accounts_with_balance)
		self.assertEqual(25, statistic_account_view.harvested_accounts)
		self.assertEqual(0.95, statistic_account_view.total_importance)
		self.assertEqual(12, statistic_account_view.eligible_harvest_accounts)

	def test_can_convert_to_simple_dict(self):
		# Arrange:
		statistic_account_view = self._create_default_statistic_account_view()

		# Act:
		statistic_account_view_dict = statistic_account_view.to_dict()

		# Assert:
		self.assertEqual({
			'total': 100,
			'withBalance': 80,
			'harvestedAccounts': 25,
			'totalImportance': 0.95,
			'eligibleHarvestAccounts': 12
		}, statistic_account_view_dict)

	def test_eq_is_supported(self):
		# Arrange:
		statistic_account_view = self._create_default_statistic_account_view()

		# Assert:
		self.assertEqual(statistic_account_view, self._create_default_statistic_account_view())
		self.assertNotEqual(statistic_account_view, None)
		self.assertNotEqual(statistic_account_view, 'statistic_account_view')
		self.assertNotEqual(statistic_account_view, self._create_default_statistic_account_view(('total_accounts', 101)))
		self.assertNotEqual(statistic_account_view, self._create_default_statistic_account_view(('accounts_with_balance', 81)))
		self.assertNotEqual(statistic_account_view, self._create_default_statistic_account_view(('harvested_accounts', 26)))
		self.assertNotEqual(statistic_account_view, self._create_default_statistic_account_view(('total_importance', 0.96)))
		self.assertNotEqual(statistic_account_view, self._create_default_statistic_account_view(('eligible_harvest_accounts', 13)))
