from symbolchain.nem.Network import Address, Network

from .BasicClient import BasicClient


class NemClient(BasicClient):
	"""Async client for connecting to a NEM node."""

	async def height(self):
		"""Gets current blockchain height."""

		return await self.get('chain/height', 'height')

	async def finalized_height(self):
		"""Gets current blockchain finalized height."""

		return await self.height() - 360

	async def node_network(self):
		"""Gets node network."""

		node_metadata = await self.get('node/info', 'metaData')
		return Network.TESTNET if -104 == node_metadata['networkId'] else Network.MAINNET

	async def cosignatories(self, address):
		"""Gets cosignatories for the specified account."""

		url_path = f'account/get?address={address}'
		meta = await self.get(url_path, 'meta')
		return [Address(address) for address in meta['cosignatories']]

	async def historical_balance(self, address, height):
		"""Gets historical account state."""
		url_path = f'account/historical/get?address={address}&startHeight={height}&endHeight={height}&increment=1'
		state = await self.get(url_path, 'data')
		return (Address(state[0]['address']), state[0]['balance'])

	async def incoming_transactions(self, address, start_id=None):
		"""Gets transactions for the specified account."""

		return await self._transactions(address, 'incoming', start_id)

	async def _transactions(self, address, mode, start_id=None):
		url_path = f'account/transfers/{mode}?address={address}'
		if start_id:
			url_path += f'&id={start_id}'

		return await self.get(url_path, 'data')


async def get_incoming_transactions_from(client, address, start_height):
	"""Uses the specified client to retrieve all transactions sent an account at or after a specified block height."""

	start_id = None
	while True:
		transactions = await client.incoming_transactions(address, start_id)
		if not transactions:
			return

		for transaction in transactions:
			if transaction['meta']['height'] < start_height:
				return

			yield transaction

		start_id = transactions[-1]['meta']['id']
