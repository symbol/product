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

	def to_formatted_string(self):
		"""Constructs a string representation of these Node features."""

		if not self.value:
			return 'PEER'

		value_name_tuples = [
			(self.API, 'API'),
			(self.HARVESTER, 'HARVESTER'),
			(self.VOTER, 'VOTER')
		]

		str_values = []
		for (value, str_value) in value_name_tuples:
			if value in self:
				str_values.append(str_value)

		return '|'.join(str_values)

	@staticmethod
	def parse(node_features_str):
		"""Parses a string composed of Node features."""

		try:
			values = [NodeFeatures[name.strip()] for name in node_features_str.split('|') if name]
		except KeyError as ex:
			# rethrow KeyError as ValueError for consistency with other value parsing errors
			raise ValueError(ex) from ex

		return reduce(lambda rhs, lhs: rhs | lhs, values, NodeFeatures.PEER)
