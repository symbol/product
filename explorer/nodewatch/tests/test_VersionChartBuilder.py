import json
import unittest
from collections import namedtuple

from nodewatch.chart_utils import VersionCustomizations
from nodewatch.VersionChartBuilder import VersionChartBuilder


class VersionChartBuilderTest(unittest.TestCase):
	@staticmethod
	def _create_chart(measure, threshold=None, allnodes_host='allnodes.me'):
		version_builder = VersionChartBuilder(VersionCustomizations({
			'1.0.3.3': ('#008A00', 7),
			'1.0.3.1': ('#00B300', 6),
			'1.0.3.0': ('#00D600', 5)
		}))

		Descriptor = namedtuple('Descriptor', ['version', 'endpoint', 'balance'])
		voting_descriptors = [
			Descriptor('1.0.3.0', 'http://bob.nem.ninja:7890', 100),
			Descriptor('1.0.3.1', f'http://3.{allnodes_host}:7890', 100),
			Descriptor('1.0.3.3', 'http://alice.nem.ninja:7890', 200),
			Descriptor('1.0.3.0', f'http://5.{allnodes_host}:7890', 300)
		]
		harvesting_descriptors = [
			Descriptor('1.0.3.1', f'http://3.{allnodes_host}:7890', 200),
			Descriptor('1.0.3.3', 'http://alice.nem.ninja:7890', 300),
			Descriptor('1.0.3.0', f'http://5.{allnodes_host}:7890', 500),
			Descriptor('1.0.3.1', 'http://san.nem.ninja:7890', 800),
			Descriptor('1.0.3.3', f'http://7.{allnodes_host}:7890', 1300)
		]
		descriptors = [
			Descriptor('1.0.3.3', f'http://1.{allnodes_host}:7890', None),
			Descriptor('1.0.3.0', 'http://bob.nem.ninja:7890', None),
			Descriptor('1.0.3.1', f'http://3.{allnodes_host}:7890', None),
			Descriptor('1.0.3.3', 'http://alice.nem.ninja:7890', None),
			Descriptor('1.0.3.0', f'http://5.{allnodes_host}:7890', None),
			Descriptor('1.0.3.1', 'http://san.nem.ninja:7890', None),
			Descriptor('1.0.3.3', f'http://7.{allnodes_host}:7890', None)
		]

		version_builder.add(voting_descriptors, 'voting_power')
		version_builder.add(harvesting_descriptors, 'harvesting_power', 'harvesting_count')
		version_builder.add(descriptors, None, 'node_count')
		return json.loads(version_builder.create_chart(measure, threshold))

	def _assert_bar_segment(self, chart_data, segment_name, expected):
		chart_bar_segment = next(chart_bar_segment for chart_bar_segment in chart_data if segment_name == chart_bar_segment['name'])
		expected_color = {'1.0.3.3': '#008A00', '1.0.3.1': '#00B300', '1.0.3.0': '#00D600'}[segment_name]

		self.assertEqual({
			'color': expected_color,
			'pattern': {'shape': ''}
		}, chart_bar_segment['marker'])
		self.assertEqual('bar', chart_bar_segment['type'])
		self.assertEqual(expected['y'] if 'y' in expected else ['All', 'All Nodes', 'Ex All Nodes'], chart_bar_segment['y'])
		self.assertEqual(expected['x'], chart_bar_segment['x'])
		self.assertEqual(expected['text'], chart_bar_segment['text'])

	def _assert_threshold_line(self, annotation, expected_threshold):
		self.assertEqual('TARGET', annotation['text'])
		self.assertEqual(expected_threshold, annotation['x'])
		self.assertEqual(1, annotation['y'])

		self.assertEqual('left', annotation['xanchor'])
		self.assertEqual('top', annotation['yanchor'])

	def test_can_create_power_chart_with_threshold(self):
		# Act:
		chart_json = self._create_chart('voting_power', 67)

		# Assert:
		chart_data = chart_json['data']
		self.assertEqual(3, len(chart_data))
		self._assert_bar_segment(chart_data, '1.0.3.3', {
			'x': [200 * 100 / 700, 0, 200 * 100 / 300],
			'text': ['28.57%<br>(200)', '0.00%<br>(0)', '66.67%<br>(200)']
		})
		self._assert_bar_segment(chart_data, '1.0.3.1', {
			'x': [100 * 100 / 700, 100 * 100 / 400, 0],
			'text': ['14.29%<br>(100)', '25.00%<br>(100)', '0.00%<br>(0)']
		})
		self._assert_bar_segment(chart_data, '1.0.3.0', {
			'x': [400 * 100 / 700, 300 * 100 / 400, 100 * 100 / 300],
			'text': ['57.14%<br>(400)', '75.00%<br>(300)', '33.33%<br>(100)']
		})

		annotations = chart_json['layout']['annotations']
		self.assertEqual(1, len(annotations))
		self._assert_threshold_line(annotations[0], 67)

	def test_can_create_power_chart_without_threshold(self):
		# Act:
		chart_json = self._create_chart('harvesting_power')

		# Assert:
		chart_data = chart_json['data']
		self.assertEqual(3, len(chart_data))
		self._assert_bar_segment(chart_data, '1.0.3.3', {
			'x': [1600 * 100 / 3100, 1300 * 100 / 2000, 300 * 100 / 1100],
			'text': ['51.61%<br>(1,600)', '65.00%<br>(1,300)', '27.27%<br>(300)']
		})
		self._assert_bar_segment(chart_data, '1.0.3.1', {
			'x': [1000 * 100 / 3100, 200 * 100 / 2000, 800 * 100 / 1100],
			'text': ['32.26%<br>(1,000)', '10.00%<br>(200)', '72.73%<br>(800)']
		})
		self._assert_bar_segment(chart_data, '1.0.3.0', {
			'x': [500 * 100 / 3100, 500 * 100 / 2000, 0],
			'text': ['16.13%<br>(500)', '25.00%<br>(500)', '0.00%<br>(0)']
		})

		self.assertFalse(hasattr(chart_json['layout'], 'annotations'))

	def test_can_create_power_chart_without_allnodes(self):
		# Act:
		chart_json = self._create_chart('harvesting_power', allnodes_host='allnodes.dead')

		# Assert:
		chart_data = chart_json['data']
		self.assertEqual(3, len(chart_data))
		self._assert_bar_segment(chart_data, '1.0.3.3', {
			'y': ['All', 'Ex All Nodes'],
			'x': [1600 * 100 / 3100, 1600 * 100 / 3100],
			'text': ['51.61%<br>(1,600)', '51.61%<br>(1,600)']
		})
		self._assert_bar_segment(chart_data, '1.0.3.1', {
			'y': ['All', 'Ex All Nodes'],
			'x': [1000 * 100 / 3100, 1000 * 100 / 3100],
			'text': ['32.26%<br>(1,000)', '32.26%<br>(1,000)']
		})
		self._assert_bar_segment(chart_data, '1.0.3.0', {
			'y': ['All', 'Ex All Nodes'],
			'x': [500 * 100 / 3100, 500 * 100 / 3100],
			'text': ['16.13%<br>(500)', '16.13%<br>(500)']
		})

		self.assertFalse(hasattr(chart_json['layout'], 'annotations'))

	def test_can_create_count_chart_associated_with_power(self):
		# Act:
		chart_json = self._create_chart('harvesting_count')

		# Assert:
		chart_data = chart_json['data']
		self.assertEqual(3, len(chart_data))
		self._assert_bar_segment(chart_data, '1.0.3.3', {
			'x': [2 * 100 / 5, 1 * 100 / 3, 1 * 100 / 2],
			'text': ['40.00%<br>(2)', '33.33%<br>(1)', '50.00%<br>(1)']
		})
		self._assert_bar_segment(chart_data, '1.0.3.1', {
			'x': [2 * 100 / 5, 1 * 100 / 3, 1 * 100 / 2],
			'text': ['40.00%<br>(2)', '33.33%<br>(1)', '50.00%<br>(1)']
		})
		self._assert_bar_segment(chart_data, '1.0.3.0', {
			'x': [1 * 100 / 5, 1 * 100 / 3, 0],
			'text': ['20.00%<br>(1)', '33.33%<br>(1)', '0.00%<br>(0)']
		})

		self.assertFalse(hasattr(chart_json['layout'], 'annotations'))

	def test_can_create_count_chart_unassociated_with_power(self):
		# Act:
		chart_json = self._create_chart('node_count')

		# Assert:
		chart_data = chart_json['data']
		self.assertEqual(3, len(chart_data))
		self._assert_bar_segment(chart_data, '1.0.3.3', {
			'x': [3 * 100 / 7, 2 * 100 / 4, 1 * 100 / 3],
			'text': ['42.86%<br>(3)', '50.00%<br>(2)', '33.33%<br>(1)']
		})
		self._assert_bar_segment(chart_data, '1.0.3.1', {
			'x': [2 * 100 / 7, 1 * 100 / 4, 1 * 100 / 3],
			'text': ['28.57%<br>(2)', '25.00%<br>(1)', '33.33%<br>(1)']
		})
		self._assert_bar_segment(chart_data, '1.0.3.0', {
			'x': [2 * 100 / 7, 1 * 100 / 4, 1 * 100 / 3],
			'text': ['28.57%<br>(2)', '25.00%<br>(1)', '33.33%<br>(1)']
		})

		self.assertFalse(hasattr(chart_json['layout'], 'annotations'))
