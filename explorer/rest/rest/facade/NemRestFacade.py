from rest.db.NemDatabase import NemDatabase


class NemRestFacade:
	"""Nem Rest Facade."""

	def __init__(self, db_config, network):
		"""Creates a facade object."""

		self.nem_db = NemDatabase(db_config, network)

	def get_block(self, height):
		"""Gets block by height."""

		block = self.nem_db.get_block(height)

		return block.to_dict() if block else None

	def get_blocks(self, limit, offset, min_height, sort):
		"""Gets blocks pagination."""

		blocks = self.nem_db.get_blocks(limit, offset, min_height, sort)

		return [block.to_dict() for block in blocks]

	def get_namespace(self, name):
		"""Gets namespace by root namespace name."""

		namespace = self.nem_db.get_namespace(name)

		return namespace.to_dict() if namespace else None

	def get_namespaces(self, limit, offset, sort):
		"""Gets namespaces pagination."""

		namespaces = self.nem_db.get_namespaces(limit, offset, sort)

		return [namespace.to_dict() for namespace in namespaces]
