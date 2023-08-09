from rest.db.NemDatabase import NemDatabase
from rest.model.Block import Block


class NemRestFacade:
	"""Nem Rest Facade."""

	def __init__(self, db_config):
		"""Creates a facade object."""

		self.nem_db = NemDatabase(db_config)

	def get_block(self, height):
		"""Gets block by height."""

		with self.nem_db as database:
			block = database.get_block(height)

		return Block(**block).to_dict() if block else None

	def get_blocks(self, limit, offset):
		"""Gets blocks pagination."""

		with self.nem_db as database:
			blocks = database.get_blocks(limit, offset)

		return [Block(**block).to_dict() for block in blocks]
