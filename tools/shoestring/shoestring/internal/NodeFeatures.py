from enum import IntFlag
from functools import reduce


class NodeFeatures(IntFlag):
	"""Optional node features."""

	# Basic peer node.
	PEER = 0

	# Api node that exposes a REST endpoint.
	API = 1

	# Node that is able to generate new blocks.
	HARVESTER = 2

	# Node that is able to participate in voting.
	VOTER = 4

	@staticmethod
	def parse(node_features_str):
		"""Parses a string composed of Node features."""

		values = [NodeFeatures[name.strip()] for name in node_features_str.split(',') if name]
		return reduce(lambda rhs, lhs: rhs | lhs, values, NodeFeatures.PEER)
