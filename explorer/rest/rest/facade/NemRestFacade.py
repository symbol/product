from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address, Network
from symbolchain.Network import NetworkLocator
from symbollightapi.connector.NemConnector import NemConnector
from symbollightapi.model.Exceptions import NodeException

from rest.db.NemDatabase import NemDatabase
from rest.model.common import Pagination


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

		latest_block = self.nem_db.get_blocks(
			pagination=Pagination(1, 0),
			min_height=1,
			sort='DESC'
		)[0]

		last_db_synced_at = latest_block.timestamp
		last_db_height = latest_block.height
		max_lag_blocks = 2  # Allow up to 2 blocks of lag between node height and database height

		# Check node connectivity and height
		try:
			node_height = await self.nem_connector.chain_height()
		except NodeException as error:
			return {
				'isHealthy': False,
				'nodeUp': False,
				'nodeHeight': None,
				'backendSynced': False,
				'lastDBSyncedAt': last_db_synced_at,
				'lastDBHeight': last_db_height,
				'errors': [{
					'type': 'synchronization',
					'message': str(error)
				}]
			}

		# Check synchronization lag
		sync_lag_blocks = max(0, node_height - last_db_height)
		backend_synced = sync_lag_blocks <= max_lag_blocks
		errors = []

		if not backend_synced:
			errors.append({
				'type': 'synchronization',
				'message': f'Database is {sync_lag_blocks} blocks behind node height'
			})

		return {
			'isHealthy': backend_synced,
			'nodeUp': True,
			'nodeHeight': node_height,
			'backendSynced': backend_synced,
			'lastDBSyncedAt': last_db_synced_at,
			'lastDBHeight': last_db_height,
			'errors': errors
		}
