import configparser

from client.NemClient import NemClient
from db.NemDatabase import NemDatabase


class NemPullerFacade:
	"""Facade for pulling data from NEM network."""

	def __init__(self, node_url, config_file):
		"""Creates a facade object."""

		config = configparser.ConfigParser()
		config.read(config_file)

		db_config = config['nem_db']

		self.nem_db = NemDatabase(db_config)
		self._client = NemClient(node_url)

	def database(self):
		"""Gets database object."""

		return self.nem_db

	def client(self):
		"""Gets client object."""

		return self._client
