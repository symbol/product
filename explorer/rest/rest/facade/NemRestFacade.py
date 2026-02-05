from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address, Network
from symbolchain.Network import NetworkLocator

from rest.db.NemDatabase import NemDatabase


class NemRestFacade:
	"""Nem Rest Facade."""

	def __init__(self, db_config, network_name):
		"""Creates a facade object."""

		self.network = NetworkLocator.find_by_name(Network.NETWORKS, network_name)
		self.nem_db = NemDatabase(db_config, self.network)

	def get_block(self, height):
		"""Gets block by height."""

		block = self.nem_db.get_block(height)

		return block.to_dict() if block else None

	def get_blocks(self, limit, offset, min_height, sort):
		"""Gets blocks pagination."""

		blocks = self.nem_db.get_blocks(limit, offset, min_height, sort)

		return [block.to_dict() for block in blocks]

	def get_account_by_address(self, address):
		"""Gets account by address."""

		account = self.nem_db.get_account_by_address(Address(address))

		return account.to_dict() if account else None

	def get_account_by_public_key(self, public_key):
		"""Gets account by public key."""

		account = self.nem_db.get_account_by_public_key(PublicKey(public_key))

		return account.to_dict() if account else None
