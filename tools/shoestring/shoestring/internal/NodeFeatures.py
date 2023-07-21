from enum import Enum, IntFlag
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

	@staticmethod
	def _iter_bits_lsb(num):
		# num must be a positive integer
		original = num
		if isinstance(num, Enum):
			num = num.value

		if num < 0:
			raise ValueError(f'{original} is not a positive integer')

		while num:
			value = num & (~num + 1)
			yield value
			num ^= value

	def _get_flag_values(self, value):
		return list(self._iter_bits_lsb(value))

	def _get_flags(self, value):
		flag_values = self._get_flag_values(value)
		return [NodeFeatures(flag_value) for flag_value in flag_values]

	def __str__(self):
		if self.name is None:
			return f'{self.__class__.__name__}.{"|".join([str(m.name) for m in self._get_flags(self.value)])}'

		return f'{self.__class__.__name__}.{self.name}'
