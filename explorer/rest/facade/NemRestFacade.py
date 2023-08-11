from rest.db.NemDatabase import NemDatabase
from rest.model.Block import BlockView


class NemRestFacade:
	"""Nem Rest Facade."""

	def __init__(self, db_config):
		"""Creates a facade object."""

		self.nem_db = NemDatabase(db_config)

	def get_block(self, height):
		"""Gets block by height."""

		block = self.nem_db.get_block(height)

		return BlockView(**block).to_dict() if block else None

	def get_blocks(self, limit, offset):
		"""Gets blocks pagination."""

		blocks = self.nem_db.get_blocks(limit, offset)

		return [BlockView(**block).to_dict() for block in blocks]
