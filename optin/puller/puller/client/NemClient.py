from symbolchain.nem.Network import Address, Network

from .BasicClient import BasicClient


class NemClient(BasicClient):
	"""Async client for connecting to a NEM node."""

	async def is_known_address(self, address):
		"""Determines if specified address is known to the network."""

		# NEM API returns empty account for unknown accounts, so do balance check
		transactions = await self.incoming_transactions(address)
		return bool(transactions)

	async def height(self):
		"""Gets current blockchain height."""

		return await self.get('chain/height', 'height')

	async def finalized_height(self):
		"""Gets current blockchain finalized height."""

		return await self.height() - 360

	async def node_network(self):
		"""Gets node network."""

		if not self.network:
			node_metadata = await self.get('node/info', 'metaData')
			self.network = Network.TESTNET if -104 == node_metadata['networkId'] else Network.MAINNET

		return self.network

	async def account(self, address):
		"""Gets account information."""

		url_path = f'account/get?address={address}'
		return await self.get(url_path, None)

	async def historical_balance(self, address, height):
		"""Gets historical account state."""
		url_path = f'account/historical/get?address={address}&startHeight={height}&endHeight={height}&increment=1'
		state = await self.get(url_path, 'data')
		return (Address(state[0]['address']), state[0]['balance'])

	async def incoming_transactions(self, address, start_id=None):
		"""Gets transactions for the specified account."""

		return await self._transactions(address, 'incoming', start_id)

	async def block_headers(self, height):
		"""Gets block headers."""

		url_path = 'block/at/public'
		block = await self.post(url_path, {'height': height})
		if 'transactions' not in block:
			raise RuntimeError(f'node returned invalid data: {block}')

		del block['transactions']
		return block

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
