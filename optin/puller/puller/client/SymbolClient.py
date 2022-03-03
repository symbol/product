from symbolchain.CryptoTypes import Hash256
from symbolchain.symbol.Network import Network

from .BasicClient import BasicClient


class SymbolClient(BasicClient):
	"""Async client for connecting to a NEM node."""

	async def is_known_address(self, address):
		"""Determines if specified address is known to the network."""

		url_path = f'accounts/{address}'
		account = await self.get(url_path, None)
		return 'account' in account

	async def height(self):
		"""Gets current blockchain height."""

		return await self.get('chain/info', 'height')

	async def finalized_height(self):
		"""Gets current blockchain finalized height."""

		return (await self.get('chain/info', 'latestFinalizedBlock'))['height']

	async def node_network(self):
		"""Gets node network."""

		network_identifier = await self.get('node/info', 'networkIdentifier')
		return Network.TESTNET if 152 == network_identifier else Network.MAINNET

	async def transaction_statuses(self, transaction_hashes):
		"""Gets the statuses of the specified transactions."""

		request = {'hashes': [str(transaction_hash) for transaction_hash in transaction_hashes]}
		return await self.post('transactionStatus', request)


async def filter_finalized_transactions(client, transaction_hashes):
	"""Filters transaction hashes and returns only finalized ones."""

	finalized_height = await client.finalized_height()
	transaction_statuses = await client.transaction_statuses(transaction_hashes)

	finalized_transaction_hashes = []
	for transaction_status in transaction_statuses:
		if 'confirmed' == transaction_status['group'] and int(transaction_status['height']) <= finalized_height:
			finalized_transaction_hashes.append(Hash256(transaction_status['hash']))

	return finalized_transaction_hashes
