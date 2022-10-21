import unittest

from shoestring.internal.NodeFeatures import NodeFeatures


class NodeFeaturesTest(unittest.TestCase):
	def test_can_parse_zero_values(self):
		self.assertEqual(NodeFeatures.PEER, NodeFeatures.parse(''))

	def test_can_parse_single_value(self):
		for name in ('PEER', 'API', 'HARVESTER', 'VOTER'):
			self.assertEqual(NodeFeatures[name], NodeFeatures.parse(name))

	def test_can_parse_multiple_values(self):
		self.assertEqual(NodeFeatures.API | NodeFeatures.VOTER, NodeFeatures.parse('API,VOTER'))
		self.assertEqual(NodeFeatures.HARVESTER, NodeFeatures.parse('PEER,HARVESTER'))
		self.assertEqual(NodeFeatures.API | NodeFeatures.VOTER | NodeFeatures.HARVESTER, NodeFeatures.parse('API,VOTER,HARVESTER'))

	def test_can_parse_multiple_values_with_whitespace(self):
		self.assertEqual(NodeFeatures.API | NodeFeatures.VOTER, NodeFeatures.parse('API, VOTER'))
		self.assertEqual(NodeFeatures.HARVESTER, NodeFeatures.parse('  PEER  ,  HARVESTER  '))
		self.assertEqual(NodeFeatures.API | NodeFeatures.VOTER | NodeFeatures.HARVESTER, NodeFeatures.parse(' API, VOTER,HARVESTER '))
