from symbolchain.nem.Network import Network

from client.BasicClient import BasicClient


class NemClient(BasicClient):
	"""Async client for connecting to a NEM node."""

	async def height(self):
		"""Gets current blockchain height."""

		return await self.get('chain/height', 'height')

	async def node_network(self):
		"""Gets node network."""

		node_metadata = await self.get('node/info', 'metaData')
		network = Network.TESTNET if -104 == node_metadata['networkId'] else Network.MAINNET

		return network

	async def finalized_height(self):
		"""Gets current blockchain finalized height."""

		return await self.height() - 360

	async def account(self, address):
		"""Gets account information."""

		url_path = f'account/get?address={address}'
		return await self.get(url_path, None)

	async def get_blocks_after(self, height):
		""""Gets Blocks data"""

		url_path = 'local/chain/blocks-after'
		blocks = await self.post(url_path, {'height': height})

		return blocks

	async def get_block(self, height):
		""""Gets Block data"""

		url_path = 'block/at/public'
		block = await self.post(url_path, {'height': height})

		return block
