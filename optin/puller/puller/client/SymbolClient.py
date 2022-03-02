from symbolchain.CryptoTypes import Hash256

from .BasicClient import BasicClient


class SymbolClient(BasicClient):
	"""Async client for connecting to a NEM node."""

	async def height(self):
		"""Gets current blockchain height."""

		return await self.get('chain/info', 'height')

	async def finalized_height(self):
		"""Gets current blockchain finalized height."""

		return (await self.get('chain/info', 'latestFinalizedBlock'))['height']

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
