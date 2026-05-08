import unittest

from rest.model.Statistic import (
	StatisticAccountView,
	StatisticTransactionDateRangeDataView,
	StatisticTransactionDateRangeView,
	StatisticTransactionView
)


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


class StatisticTransactionViewTest(unittest.TestCase):
	@staticmethod
	def _create_default_statistic_transaction_view(override=None):
		statistic_transaction_view = StatisticTransactionView(
			total_transactions=100,
			transaction_last_24_hours=20,
			transaction_last_30_days=50
		)

		if override:
			setattr(statistic_transaction_view, override[0], override[1])

		return statistic_transaction_view

	def test_can_create_statistic_transaction_view(self):
		# Act:
		statistic_transaction_view = self._create_default_statistic_transaction_view()

		# Assert:
		self.assertEqual(100, statistic_transaction_view.total_transactions)
		self.assertEqual(20, statistic_transaction_view.transaction_last_24_hours)
		self.assertEqual(50, statistic_transaction_view.transaction_last_30_days)

	def test_can_convert_to_simple_dict(self):
		# Arrange:
		statistic_transaction_view = self._create_default_statistic_transaction_view()

		# Act:
		statistic_transaction_view_dict = statistic_transaction_view.to_dict()

		# Assert:
		self.assertEqual({
			'total': 100,
			'last24Hours': 20,
			'last30Days': 50
		}, statistic_transaction_view_dict)

	def test_eq_is_supported(self):
		# Arrange:
		statistic_transaction_view = self._create_default_statistic_transaction_view()

		# Assert:
		self.assertEqual(statistic_transaction_view, self._create_default_statistic_transaction_view())
		self.assertNotEqual(statistic_transaction_view, None)
		self.assertNotEqual(statistic_transaction_view, 'statistic_transaction_view')
		self.assertNotEqual(statistic_transaction_view, self._create_default_statistic_transaction_view(('total_transactions', 101)))
		self.assertNotEqual(statistic_transaction_view, self._create_default_statistic_transaction_view(('transaction_last_24_hours', 21)))
		self.assertNotEqual(statistic_transaction_view, self._create_default_statistic_transaction_view(('transaction_last_30_days', 51)))


class StatisticTransactionDateRangeDataViewTest(unittest.TestCase):
	@staticmethod
	def _create_default_statistic_transaction_date_range_data_view(override=None):
		transaction_range_data_view = StatisticTransactionDateRangeDataView(
			period='2015-03-29',
			total_transactions=20
		)

		if override:
			setattr(transaction_range_data_view, override[0], override[1])

		return transaction_range_data_view

	def test_can_create_statistic_transaction_date_range_data_view(self):
		# Act:
		transaction_range_data_view = self._create_default_statistic_transaction_date_range_data_view()

		# Assert:
		self.assertEqual('2015-03-29', transaction_range_data_view.period)
		self.assertEqual(20, transaction_range_data_view.total_transactions)

	def test_can_convert_statistic_transaction_date_range_data_to_simple_dict(self):
		# Arrange:
		transaction_range_data_view = self._create_default_statistic_transaction_date_range_data_view()

		# Act:
		transaction_range_data_view_dict = transaction_range_data_view.to_dict()

		# Assert:
		self.assertEqual({
			'period': '2015-03-29',
			'totalTransactions': 20
		}, transaction_range_data_view_dict)

	def test_eq_is_supported(self):
		# Arrange:
		transaction_range_data_view = self._create_default_statistic_transaction_date_range_data_view()

		# Assert:
		self.assertEqual(transaction_range_data_view, self._create_default_statistic_transaction_date_range_data_view())
		self.assertNotEqual(transaction_range_data_view, None)
		self.assertNotEqual(transaction_range_data_view, 'transaction_range_data_view')
		self.assertNotEqual(
			transaction_range_data_view,
			self._create_default_statistic_transaction_date_range_data_view(('period', '2015-03-30'))
		)
		self.assertNotEqual(
			transaction_range_data_view,
			self._create_default_statistic_transaction_date_range_data_view(('total_transactions', 21))
		)


class StatisticTransactionDateRangeViewTest(unittest.TestCase):
	@staticmethod
	def _create_default_statistic_transaction_date_range_view(override=None):
		statistic_transaction_range_view = StatisticTransactionDateRangeView(
			period_type='DAY',
			data=[StatisticTransactionDateRangeDataView(
				period='2015-03-29',
				total_transactions=20
			)]
		)

		if override:
			setattr(statistic_transaction_range_view, override[0], override[1])

		return statistic_transaction_range_view

	def test_can_create_statistic_transaction_date_range_view(self):
		# Act:
		statistic_transaction_range_view = self._create_default_statistic_transaction_date_range_view()

		# Assert:
		self.assertEqual('DAY', statistic_transaction_range_view.period_type)
		self.assertEqual([StatisticTransactionDateRangeDataView(
			period='2015-03-29',
			total_transactions=20
		)], statistic_transaction_range_view.data)

	def test_can_convert_statistic_transaction_date_range_view_to_simple_dict(self):
		# Arrange:
		statistic_transaction_range_view = self._create_default_statistic_transaction_date_range_view()

		# Act:
		transaction_range_view_dict = statistic_transaction_range_view.to_dict()

		# Assert:
		self.assertEqual({
			'periodType': 'day',
			'data': [{
				'period': '2015-03-29',
				'totalTransactions': 20
			}]
		}, transaction_range_view_dict)

	def test_eq_is_supported(self):
		# Arrange:
		statistic_transaction_range_view = self._create_default_statistic_transaction_date_range_view()

		# Assert:
		self.assertEqual(statistic_transaction_range_view, self._create_default_statistic_transaction_date_range_view())
		self.assertNotEqual(statistic_transaction_range_view, None)
		self.assertNotEqual(statistic_transaction_range_view, 'statistic_transaction_range_view')
		self.assertNotEqual(
			statistic_transaction_range_view,
			self._create_default_statistic_transaction_date_range_view(('period_type', 'MONTH'))
		)
		self.assertNotEqual(statistic_transaction_range_view, self._create_default_statistic_transaction_date_range_view(('data', [])))
