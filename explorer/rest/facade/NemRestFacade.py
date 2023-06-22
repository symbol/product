from zenlog import log

from rest.db.NemDatabase import NemDatabase
from rest.model.Block import Block


class NemRestFacade:
	"""Nem Rest Facade."""

	def __init__(self, db_config):
		"""Creates a facade object."""

		self.nem_db = NemDatabase(db_config)

	def get_block(self, height):
		"""Gets block by height."""

		with self.nem_db as db:
			block = db.get_block(height)

		return Block(**block).to_dict() if block else None

	def get_blocks(self, **kwargs):
		"""Gets blocks pagination."""

		limit = kwargs.get('limit')
		offset = kwargs.get('offset')

		with self.nem_db as db:
			blocks = db.get_blocks(limit, offset)

		return [Block(**block).to_dict() for block in blocks]
