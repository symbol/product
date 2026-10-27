from decimal import Decimal
from unittest import TestCase

from rest.db.SymbolDatabase import AccountStatisticsRecord
from rest.model.symbol.Account import SymbolAccountStatisticsView
from rest.model.symbol.validation import SymbolDataInvalid


class SymbolAccountStatisticsViewTest(TestCase):
	def test_to_dict_formats_percentages_and_remainder_without_normalizing_observed_importance(self):
		# Arrange:
		statistics = AccountStatisticsRecord(
			3, 2, 2, 1, Decimal('0.9999'),
			((Decimal('0.210754'), 'TONE'), (Decimal('0.005770'), 'TTWO'), (Decimal('0.034318'), 'TTHREE')))

		# Act:
		result = SymbolAccountStatisticsView(statistics).to_dict()

		# Assert:
		self.assertEqual({
			'total': 3, 'harvesting': 2, 'eligibleForHarvesting': 2,
			'top10AccountsImportance': 25.0842, 'harvestingAccountsPercentage': 50.0,
			'importanceBreakdown': [
				[21.0754, 'TONE'], [0.577, 'TTWO'], [3.4318, 'TTHREE'], [74.9058, 'Rest']],
			'harvestingAccountsChart': [[50.0, 'Harvesting'], [50.0, 'Not harvesting']],
			'pendingVerification': []
		}, result)
		self.assertIsInstance(result['total'], int)
		self.assertIsInstance(result['top10AccountsImportance'], float)
		self.assertIsInstance(result['importanceBreakdown'][0][0], float)

	def test_to_dict_truncates_harvesting_ratio_towards_zero(self):
		# Arrange:
		statistics = AccountStatisticsRecord(4, 3, 3, 1, Decimal('1'), ())

		# Act:
		result = SymbolAccountStatisticsView(statistics).to_dict()

		# Assert:
		self.assertEqual(33.33, result['harvestingAccountsPercentage'])
		self.assertEqual([[33.33, 'Harvesting'], [66.67, 'Not harvesting']], result['harvestingAccountsChart'])

	def test_to_dict_returns_empty_charts_for_empty_eligible_population_and_empty_snapshot(self):
		# Arrange:
		statistics = AccountStatisticsRecord(0, 0, 0, 0, Decimal(0), ())

		# Act:
		result = SymbolAccountStatisticsView(statistics).to_dict()

		# Assert:
		self.assertEqual({
			'total': 0, 'harvesting': 0, 'eligibleForHarvesting': 0,
			'top10AccountsImportance': 0, 'harvestingAccountsPercentage': 0,
			'importanceBreakdown': [], 'harvestingAccountsChart': [], 'pendingVerification': []
		}, result)

	def test_to_dict_returns_empty_harvesting_chart_when_active_accounts_have_no_eligible_population(self):
		# Arrange:
		statistics = AccountStatisticsRecord(1, 1, 0, 0, Decimal('0.6'), ((Decimal('0.6'), 'TONE'),))

		# Act:
		result = SymbolAccountStatisticsView(statistics).to_dict()

		# Assert: active stays one; eligible denominator is zero
		self.assertEqual({
			'total': 1, 'harvesting': 1, 'eligibleForHarvesting': 0, 'top10AccountsImportance': 60.0,
			'harvestingAccountsPercentage': 0, 'importanceBreakdown': [[60.0, 'TONE']],
			'harvestingAccountsChart': [], 'pendingVerification': []}, result)

	def test_to_dict_keeps_zero_importance_accounts_without_a_zero_remainder(self):
		# Arrange:
		statistics = AccountStatisticsRecord(
			2, 0, 0, 0, Decimal('0'), ((Decimal('0'), 'TONE'), (Decimal('0'), 'TTWO')))

		# Act:
		result = SymbolAccountStatisticsView(statistics).to_dict()

		# Assert:
		self.assertEqual(0.0, result['top10AccountsImportance'])
		self.assertEqual(0, result['harvestingAccountsPercentage'])
		self.assertEqual([], result['harvestingAccountsChart'])
		self.assertEqual([[0.0, 'TONE'], [0.0, 'TTWO']], result['importanceBreakdown'])

	def test_to_dict_rejects_non_numeric_non_finite_and_out_of_range_importance(self):
		invalid_values = [
			(True, 'value is not a finite number'),
			('0.5', 'value is not a finite number'),
			(Decimal('NaN'), 'value is outside the allowed range'),
			(Decimal('-0.01'), 'value is outside the allowed range'),
			(Decimal('1.01'), 'value is outside the allowed range')
		]

		for value, reason in invalid_values:
			with self.subTest(value=value):
				# Arrange:
				statistics = AccountStatisticsRecord(1, 0, 0, 0, Decimal(0), ((value, 'TONE'),))

				# Act:
				with self.assertRaises(SymbolDataInvalid) as context:
					SymbolAccountStatisticsView(statistics).to_dict()

				# Assert:
				self.assertEqual(f'account statistics importance: {reason}', str(context.exception))
