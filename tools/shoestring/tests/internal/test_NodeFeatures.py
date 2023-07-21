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

	def test_can_convert_single_value_to_string(self):
		# Arrange:
		node_features = NodeFeatures.API

		# Act:
		node_features_str = str(node_features)

		# Assert:
		self.assertEqual('NodeFeatures.API', node_features_str)

	def test_can_convert_multiple_values_to_string(self):
		# Arrange:
		node_features = NodeFeatures.API | NodeFeatures.VOTER

		# Act:
		node_features_str = str(node_features)

		# Assert:
		self.assertEqual('NodeFeatures.API|VOTER', node_features_str)

	def test_can_convert_single_zero_value_to_string(self):
		# Arrange:
		node_features = NodeFeatures.PEER

		# Act:
		node_features_str = str(node_features)

		# Assert:
		self.assertEqual('NodeFeatures.PEER', node_features_str)

	def test_can_convert_multiple_values_with_peer_to_string(self):
		# Arrange:
		node_features = NodeFeatures.API | NodeFeatures.PEER | NodeFeatures.VOTER

		# Act:
		node_features_str = str(node_features)

		# Assert:
		self.assertEqual('NodeFeatures.API|VOTER', node_features_str)

	def test_cannot_parse_negative_value(self):
		# Arrange:
		node_features_value = -1

		# Act + Assert:
		with self.assertRaises(ValueError):
			str(NodeFeatures(node_features_value))
