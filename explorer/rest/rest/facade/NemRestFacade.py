from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address, Network
from symbolchain.Network import NetworkLocator
from symbollightapi.connector.NemConnector import NemConnector
from symbollightapi.model.Exceptions import NodeException

from rest.db.NemDatabase import NemDatabase


class NemRestFacade:
	"""Nem Rest Facade."""

	def __init__(self, node_url, db_config, network_name):
		"""Creates a facade object."""

		self.network = NetworkLocator.find_by_name(Network.NETWORKS, network_name)
		self.nem_db = NemDatabase(db_config, self.network)
		self.nem_connector = NemConnector(node_url, self.network)

	def get_block(self, height):
		"""Gets block by height."""

		block = self.nem_db.get_block(height)

		return block.to_dict() if block else None

	def get_blocks(self, pagination, min_height, sort):
		"""Gets blocks pagination."""

		blocks = self.nem_db.get_blocks(pagination, min_height, sort)

		return [block.to_dict() for block in blocks]

	def get_account_by_address(self, address):
		"""Gets account by address."""

		account = self.nem_db.get_account_by_address(Address(address))

		return account.to_dict() if account else None

	def get_account_by_public_key(self, public_key):
		"""Gets account by public key."""

		account = self.nem_db.get_account_by_public_key(PublicKey(public_key))

		return account.to_dict() if account else None

	def get_accounts(self, pagination, sorting, is_harvesting):
		"""Gets accounts pagination."""

		accounts = self.nem_db.get_accounts(pagination, sorting, is_harvesting)

		return [account.to_dict() for account in accounts]

	async def get_health(self):
		"""Gets health of the node."""

		latest_block = self.nem_db.get_blocks(limit=1, offset=0, min_height=1, sort='DESC')[0]

		last_synced_at = latest_block.timestamp
		last_block_height = latest_block.height
		is_healthy = True
		errors = []

		try:
			await self.nem_connector.node_info()
		except Exception:
			is_healthy = False
			errors.append({
				"type": "synchronization",
				"message": "Node is not responding"
			})

		return {
				"isHealthy": is_healthy,
				"lastSyncedAt": last_synced_at,
				"lastBlockHeight": last_block_height,
				"errors": errors
			}
