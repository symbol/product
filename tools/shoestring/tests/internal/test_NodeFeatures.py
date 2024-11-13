import unittest

from shoestring.internal.NodeFeatures import NodeFeatures


class NodeFeaturesTest(unittest.TestCase):
	# region to_formatted_string

	def test_can_format_zero_values(self):
		self.assertEqual('PEER', NodeFeatures(0).to_formatted_string())

	def test_can_format_single_value(self):
		for name in ('PEER', 'API', 'HARVESTER', 'VOTER'):
			self.assertEqual(name, NodeFeatures[name].to_formatted_string())

	def test_can_format_multiple_values(self):
		self.assertEqual('API|VOTER', NodeFeatures(NodeFeatures.API | NodeFeatures.VOTER).to_formatted_string())
		self.assertEqual('HARVESTER', NodeFeatures(NodeFeatures.PEER | NodeFeatures.HARVESTER).to_formatted_string())
		self.assertEqual(
			'API|HARVESTER|VOTER',
			NodeFeatures(NodeFeatures.API | NodeFeatures.VOTER | NodeFeatures.HARVESTER).to_formatted_string())

	# endregion

	# region parse

	def test_can_parse_zero_values(self):
		self.assertEqual(NodeFeatures.PEER, NodeFeatures.parse(''))

	def test_can_parse_single_value(self):
		for name in ('PEER', 'API', 'HARVESTER', 'VOTER'):
			self.assertEqual(NodeFeatures[name], NodeFeatures.parse(name))

	def test_can_parse_multiple_values(self):
		self.assertEqual(NodeFeatures.API | NodeFeatures.VOTER, NodeFeatures.parse('API|VOTER'))
		self.assertEqual(NodeFeatures.HARVESTER, NodeFeatures.parse('PEER|HARVESTER'))
		self.assertEqual(NodeFeatures.API | NodeFeatures.VOTER | NodeFeatures.HARVESTER, NodeFeatures.parse('API|VOTER|HARVESTER'))

	def test_can_parse_multiple_values_with_whitespace(self):
		self.assertEqual(NodeFeatures.API | NodeFeatures.VOTER, NodeFeatures.parse('API| VOTER'))
		self.assertEqual(NodeFeatures.HARVESTER, NodeFeatures.parse('  PEER  |  HARVESTER  '))
		self.assertEqual(NodeFeatures.API | NodeFeatures.VOTER | NodeFeatures.HARVESTER, NodeFeatures.parse(' API| VOTER|HARVESTER '))

	def test_cannot_parse_unknown_value(self):
		with self.assertRaises(ValueError):
			NodeFeatures.parse('API|OTHER|HARVESTER')

	# endregion
