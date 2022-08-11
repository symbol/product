import json
import unittest
from collections import namedtuple

from nodewatch.chart_utils import VersionCustomizations
from nodewatch.HeightChartBuilder import HeightChartBuilder


class HeightChartBuilderTest(unittest.TestCase):
	@staticmethod
	def _create_chart(min_cluster_size):
		height_builder = HeightChartBuilder(VersionCustomizations({
			'1.0.3.3': ('#008A00', 7),
			'1.0.3.1': ('#00B300', 6),
			'1.0.2.0': ('#FF1F1F', 3)
		}), min_cluster_size)

		HeightDescriptor = namedtuple('HeightDescriptor', ['version', 'height', 'balance'])
		FinalizedHeightDescriptor = namedtuple('FinalizedHeightDescriptor', ['version', 'finalized_height', 'balance'])

		# note: last tuple value is used to check rounding to M in the text descriptions
		height_builder.add_heights([
			HeightDescriptor(tuple[0], tuple[1], tuple[2] * 1000000 + tuple[3]) for tuple in [
				('1.0.2.0', 12345, 100, 1),
				('1.0.3.1', 12350, 100, 2),
				('1.0.3.3', 12345, 200, -1),
				('1.0.3.3', 12345, 300, -2),
				('1.0.3.1', 12345, 500, 1),
				('1.0.3.3', 12355, 800, 2),
				('1.0.3.1', 12345, 1300, -3),
				('1.0.3.1', 0, 2100, 0)  # simulate a node with an unknown height (should be ignored)
			]
		])
		height_builder.add_finalized_heights([
			FinalizedHeightDescriptor(tuple[0], tuple[1], tuple[2] * 1000000 + tuple[3]) for tuple in [
				('1.0.2.0', 12345, 200, -1),
				('1.0.3.1', 12350, 200, -2),
				('1.0.3.3', 12345, 400, 3),
				('1.0.3.3', 12345, 800, 1),
				('1.0.3.1', 12345, 1600, -1),
				('1.0.3.1', 0, 3200, 0)  # simulate a node with an unknown height (should be ignored)
			]
		])
		return json.loads(height_builder.create_chart())

	def _assert_scatterpoint(self, chart_data, scatterpoint_name, expected):
		chart_scatterpoint = next(
			chart_scatterpoint for chart_scatterpoint in chart_data if scatterpoint_name == chart_scatterpoint['name']
		)
		name_parts = scatterpoint_name.split(',')
		expected_color = {'1.0.3.3': '#008A00', '1.0.3.1': '#00B300', '1.0.2.0': '#FF1F1F'}[name_parts[0]]
		expected_shape = {'height': 'circle', 'finalized height': 'diamond'}[name_parts[1].strip()]

		self.assertEqual({
			'color': expected_color,
			'sizeref': 319999.99964444444,
			'size': expected['size'],
			'sizemode': 'area',
			'symbol': expected_shape
		}, chart_scatterpoint['marker'])
		self.assertEqual('scatter', chart_scatterpoint['type'])
		self.assertEqual(expected['y'], chart_scatterpoint['y'])
		self.assertEqual(expected['x'], chart_scatterpoint['x'])
		self.assertEqual(expected['text'], chart_scatterpoint['text'])

	def test_can_create_power_chart_without_min_cluster_size(self):
		# Act:
		chart_json = self._create_chart(1)

		# Assert:
		chart_data = chart_json['data']
		self.assertEqual(6, len(chart_data))
		self._assert_scatterpoint(chart_data, '1.0.3.3, height', {
			'size': [500000000 - 3, 800000000 + 2],
			'x': [12345, 12355],
			'y': [2, 1],
			'text': ['500M', '800M']
		})
		self._assert_scatterpoint(chart_data, '1.0.3.1, height', {
			'size': [100000000 + 2, 1800000000 - 2],
			'x': [12350, 12345],
			'y': [1, 2],
			'text': ['100M', '1800M']
		})
		self._assert_scatterpoint(chart_data, '1.0.2.0, height', {
			'size': [100000000 + 1],
			'x': [12345],
			'y': [1],
			'text': ['100M']
		})
		self._assert_scatterpoint(chart_data, '1.0.3.3, finalized height', {
			'size': [1200000000 + 4],
			'x': [12345],
			'y': [2],
			'text': ['1200M']
		})
		self._assert_scatterpoint(chart_data, '1.0.3.1, finalized height', {
			'size': [200000000 - 2, 1600000000 - 1],
			'x': [12350, 12345],
			'y': [1, 1],
			'text': ['200M', '1600M']
		})
		self._assert_scatterpoint(chart_data, '1.0.2.0, finalized height', {
			'size': [200000000 - 1],
			'x': [12345],
			'y': [1],
			'text': ['200M']
		})

	def test_can_create_power_chart_with_min_cluster_size(self):
		# Act:
		chart_json = self._create_chart(2)

		# Assert: only scatterpoints with at least two datapoints are preserved
		chart_data = chart_json['data']
		self.assertEqual(3, len(chart_data))
		self._assert_scatterpoint(chart_data, '1.0.3.3, height', {
			'size': [500000000 - 3],
			'x': [12345],
			'y': [2],
			'text': ['500M']
		})
		self._assert_scatterpoint(chart_data, '1.0.3.1, height', {
			'size': [1800000000 - 2],
			'x': [12345],
			'y': [2],
			'text': ['1800M']
		})
		self._assert_scatterpoint(chart_data, '1.0.3.3, finalized height', {
			'size': [1200000000 + 4],
			'x': [12345],
			'y': [2],
			'text': ['1200M']
		})
