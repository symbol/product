import unittest
from collections import namedtuple

from shoestring.internal.HeightGrouping import calculate_finalization_epoch_for_height, calculate_grouped_height

GroupingTestTraits = namedtuple('GroupingTestTraits', ['grouping', 'test_cases'])


class HeightGroupingTest(unittest.TestCase):
	# region calculate_grouped_height

	SINGLE_GROUPING_TRAITS = GroupingTestTraits(1, [
		(1, 1),
		(2, 1),
		(358, 357),
		(359, 358),
		(360, 359),
		(361, 360),
		(1074, 1073),
		(1095, 1094)
	])

	DUAL_GROUPING_TRAITS = GroupingTestTraits(2, [
		(1, 1),
		(2, 1),
		(3, 2),
		(4, 2),
		(5, 4),
		(358, 356),
		(359, 358),
		(360, 358),
		(361, 360),
		(1074, 1072),
		(1095, 1094)
	])

	DEFAULT_GROUPING_TRAITS = GroupingTestTraits(359, [
		(1, 1),
		(2, 1),
		(358, 1),
		(359, 1),
		(360, 359),
		(361, 359),
		(1074, 718),
		(1095, 1077)
	])

	CUSTOM_GROUPING_TRAITS = GroupingTestTraits(123, [
		(1, 1),
		(2, 1),
		(122, 1),
		(123, 1),
		(124, 123),
		(125, 123),
		(365, 246),
		(400, 369)
	])

	def test_cannot_convert_height_to_grouped_height_zero(self):
		# Arrange:
		for pair in self.SINGLE_GROUPING_TRAITS.test_cases:
			# Act + Assert:
			with self.assertRaises(RuntimeError):
				calculate_grouped_height(pair[0], 0)

	def _can_convert_height_to_grouped_height(self, traits):
		# Arrange:
		for pair in traits.test_cases:
			# Act:
			result = calculate_grouped_height(pair[0], traits.grouping)

			# Assert:
			self.assertEqual(pair[1], result)

	def test_can_convert_height_to_grouped_height_one(self):
		self._can_convert_height_to_grouped_height(self.SINGLE_GROUPING_TRAITS)

	def test_can_convert_height_to_grouped_height_dual(self):
		self._can_convert_height_to_grouped_height(self.DUAL_GROUPING_TRAITS)

	def test_can_convert_height_to_grouped_height_default(self):
		self._can_convert_height_to_grouped_height(self.DEFAULT_GROUPING_TRAITS)

	def test_can_convert_height_to_grouped_height_custom(self):
		self._can_convert_height_to_grouped_height(self.CUSTOM_GROUPING_TRAITS)

	# endregion

	# region calculate_finalization_epoch_for_height

	def test_calculate_finalization_epoch_for_height_does_not_support_zero_grouping(self):
		with self.assertRaises(RuntimeError):
			calculate_finalization_epoch_for_height(1, 0)

	def test_calculate_finalization_epoch_for_height_does_not_support_zero_height(self):
		for grouping in (20, 50):
			with self.assertRaises(RuntimeError):
				calculate_finalization_epoch_for_height(0, grouping)

	def test_calculate_finalization_epoch_for_height_supports_height_one(self):
		for grouping in (20, 50):
			self.assertEqual(1, calculate_finalization_epoch_for_height(1, grouping))

	def test_calculate_finalization_epoch_for_height_supports_epochs_greater_than_one(self):
		self.assertEqual(2, calculate_finalization_epoch_for_height(2, 20))
		self.assertEqual(2, calculate_finalization_epoch_for_height(17, 20))
		self.assertEqual(2, calculate_finalization_epoch_for_height(20, 20))
		self.assertEqual(3, calculate_finalization_epoch_for_height(21, 20))

		self.assertEqual(2, calculate_finalization_epoch_for_height(2, 50))
		self.assertEqual(2, calculate_finalization_epoch_for_height(17, 50))
		self.assertEqual(2, calculate_finalization_epoch_for_height(50, 50))
		self.assertEqual(3, calculate_finalization_epoch_for_height(51, 50))

	# endregion
