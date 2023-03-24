# pylint: disable=invalid-name


import unittest
from collections import namedtuple

from nodewatch.chart_utils import VersionAggregator, VersionCustomizations, pods_to_dataframe


class ChartUtilsTest(unittest.TestCase):
	# region pods_to_dataframe

	def test_can_map_pods_to_dataframe(self):
		# Arrange:
		Pod = namedtuple('Pod', ['foo', 'bar', 'baz'])

		# Act:
		data_frame = pods_to_dataframe([
			Pod(1, 2, 3),
			Pod(9, 8, 7),
			Pod(5, 5, 5)
		])

		# Assert:
		self.assertEqual(3, len(data_frame))
		self.assertEqual((1, 9, 5), tuple(data_frame['foo'][i] for i in range(3)))
		self.assertEqual((2, 8, 5), tuple(data_frame['bar'][i] for i in range(3)))
		self.assertEqual((3, 7, 5), tuple(data_frame['baz'][i] for i in range(3)))

	# endregion

	# region VersionCustomizations

	@staticmethod
	def _create_version_customizations():
		return VersionCustomizations({
			'0.0.3.3': ('#008A00', 7),
			'0.0.3.1': ('#00B300', 6),
			'0.0.3.0': ('#00D600', 5)
		})

	def test_version_customizations_can_create_version_to_color_map(self):
		# Arrange:
		version_customizations = self._create_version_customizations()

		# Act:
		version_to_color_map = version_customizations.to_color_map()

		# Assert:
		self.assertEqual({
			'0.0.3.3': '#008A00',
			'0.0.3.1': '#00B300',
			'0.0.3.0': '#00D600'
		}, version_to_color_map)

	def test_version_customizations_can_get_weight_for_known_version(self):
		# Arrange:
		version_customizations = self._create_version_customizations()

		# Act:
		weight = version_customizations.get_weight('0.0.3.1')

		# Assert:
		self.assertEqual(6, weight)

	def test_version_customizations_can_get_zero_weight_for_unknown_version(self):
		# Arrange:
		version_customizations = self._create_version_customizations()

		# Act:
		weight = version_customizations.get_weight('0.0.4.1')

		# Assert:
		self.assertEqual(0, weight)

	# endregion

	# region VersionAggregator

	@staticmethod
	def _run_version_aggregator_test(secondary_key, balance_field, count_field):
		# Arrange:
		class DataPoint:
			def __init__(self):
				self.total_balance = 0
				self.descriptor_count = 0

			def as_tuple(self):
				return (self.total_balance, self.descriptor_count)

		Descriptor = namedtuple('Descriptor', ['version', 'secondary_version', 'balance'])

		# Act:
		aggregator = VersionAggregator(DataPoint, secondary_key)
		aggregator.add([
			Descriptor('0.0.0', 'A', 111),
			Descriptor('0.0.0', 'B', 222),
			Descriptor('2.0.0', 'A', 333),
			Descriptor('2.0.0', 'B', 444),
			Descriptor('2.0.0', 'A', 555),
			Descriptor('3.0.0', 'B', 777)
		], balance_field, count_field)
		return aggregator.map

	def test_version_aggregator_can_build_without_secondary_key(self):
		# Act:
		aggregate_map = self._run_version_aggregator_test(None, 'total_balance', 'descriptor_count')

		# Assert:
		self.assertEqual(3, len(aggregate_map))
		self.assertEqual((333, 2), aggregate_map['0.0.0'].as_tuple())
		self.assertEqual((1332, 3), aggregate_map['2.0.0'].as_tuple())
		self.assertEqual((777, 1), aggregate_map['3.0.0'].as_tuple())

	def test_version_aggregator_can_build_with_secondary_key(self):
		# Act:
		aggregate_map = self._run_version_aggregator_test('secondary_version', 'total_balance', 'descriptor_count')

		# Assert:
		self.assertEqual(5, len(aggregate_map))
		self.assertEqual((111, 1), aggregate_map['0.0.0@A'].as_tuple())
		self.assertEqual((222, 1), aggregate_map['0.0.0@B'].as_tuple())
		self.assertEqual((888, 2), aggregate_map['2.0.0@A'].as_tuple())
		self.assertEqual((444, 1), aggregate_map['2.0.0@B'].as_tuple())
		self.assertEqual((777, 1), aggregate_map['3.0.0@B'].as_tuple())

	def test_version_aggregator_can_build_while_only_aggregating_balance(self):
		# Act:
		aggregate_map = self._run_version_aggregator_test(None, 'total_balance', None)

		# Assert:
		self.assertEqual(3, len(aggregate_map))
		self.assertEqual((333, 0), aggregate_map['0.0.0'].as_tuple())
		self.assertEqual((1332, 0), aggregate_map['2.0.0'].as_tuple())
		self.assertEqual((777, 0), aggregate_map['3.0.0'].as_tuple())

	def test_version_aggregator_can_build_while_only_aggregating_count(self):
		# Act:
		aggregate_map = self._run_version_aggregator_test(None, None, 'descriptor_count')

		# Assert:
		self.assertEqual(3, len(aggregate_map))
		self.assertEqual((0, 2), aggregate_map['0.0.0'].as_tuple())
		self.assertEqual((0, 3), aggregate_map['2.0.0'].as_tuple())
		self.assertEqual((0, 1), aggregate_map['3.0.0'].as_tuple())

	# endregion
