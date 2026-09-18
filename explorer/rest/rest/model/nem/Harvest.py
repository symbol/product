HARVESTING_REWARD_TYPE = 'harvesting'


class HarvestView:
	"""Single reward an account earned for harvesting a block."""

	def __init__(self, height, timestamp, amount, reward_type=HARVESTING_REWARD_TYPE):
		"""Create harvest view."""

		self.height = height
		self.timestamp = timestamp
		self.amount = amount
		self.reward_type = reward_type

	def __eq__(self, other):
		return isinstance(other, HarvestView) and all([
			self.height == other.height,
			self.timestamp == other.timestamp,
			self.amount == other.amount,
			self.reward_type == other.reward_type
		])

	def to_dict(self):
		"""Formats the harvest as a dictionary."""

		return {
			'height': self.height,
			'timestamp': self.timestamp,
			'amount': self.amount,
			'type': self.reward_type
		}
