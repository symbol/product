from aiohttp import ClientSession


class NemClient:
	"""Async client for connecting to a NEM node."""

	def __init__(self, endpoint):
		"""Creates a client around an endpoint."""
		self.endpoint = endpoint

	async def _transactions(self, address, mode, start_id=None):
		url = f'{self.endpoint}/account/transfers/{mode}?address={address}'
		if start_id:
			url += f'&id={start_id}'

		async with ClientSession() as session:
			async with session.get(url) as response:
				response_json = await response.json()
				return response_json['data']

	async def incoming_transactions(self, address, start_id=None):
		"""Gets transactions for the specified account."""
		return await self._transactions(address, 'incoming', start_id)
