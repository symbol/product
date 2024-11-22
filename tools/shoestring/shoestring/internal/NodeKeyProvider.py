import shutil
from pathlib import Path


class NodeKeyProvider:
	"""Generators the Node private key."""

	def __init__(self, import_source=None):
		"""Creates a Node key generator."""

		self.is_imported = bool(import_source)
		if self.is_imported:
			self.import_source = Path(import_source).absolute()

	def create_key_file(self, factory):
		"""Create node private key file."""

		if self.is_imported:
			shutil.copy(self.import_source, '.')
			return

		if not factory:
			raise RuntimeError('unable to generate node private key')

		factory.generate_random_node_private_key()

