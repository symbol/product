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

	def get_account(self, address=None, public_key=None):
		"""Gets account by address or public key."""

		address_obj = Address(address) if address else None
		public_key_obj = PublicKey(public_key) if public_key else None

		account = self.nem_db.get_account(address=address_obj, public_key=public_key_obj)

		return account.to_dict() if account else None
