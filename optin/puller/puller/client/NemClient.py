from aiohttp import ClientSession
from symbolchain.nem.Network import Address


class NemClient:
	"""Async client for connecting to a NEM node."""

	def __init__(self, endpoint):
		"""Creates a client around an endpoint."""

		self.endpoint = endpoint

	async def height(self):
		"""Gets current blockchain height."""

		url = f'{self.endpoint}/chain/height'
		return await self._get(url, 'height')

	async def finalized_height(self):
		"""Gets current blockchain finalized height."""

		return await self.height() - 360

	async def cosignatories(self, address):
		"""Gets cosignatories for the specified account."""

		url = f'{self.endpoint}/account/get?address={address}'
		meta = await self._get(url, 'meta')
		return [Address(address) for address in meta['cosignatories']]

	async def incoming_transactions(self, address, start_id=None):
		"""Gets transactions for the specified account."""

		return await self._transactions(address, 'incoming', start_id)

	async def _transactions(self, address, mode, start_id=None):
		url = f'{self.endpoint}/account/transfers/{mode}?address={address}'
		if start_id:
			url += f'&id={start_id}'

		return await self._get(url, 'data')

	@staticmethod
	async def _get(url, property_name):
		async with ClientSession() as session:
			async with session.get(url) as response:
				response_json = await response.json()
				return response_json[property_name]


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
