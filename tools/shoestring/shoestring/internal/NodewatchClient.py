from aiohttp import ClientSession


class NodewatchClient:
	"""Client for connecting to the nodewatch service."""

	def __init__(self, endpoint):
		"""Creates a nodewatch client."""

		self.endpoint = endpoint

	async def _get_height(self, blockchain):
		async with ClientSession() as session:
			async with session.get(f'{self.endpoint}/api/{blockchain}/height') as response:
				response_json = await response.json()
				return response_json

	async def symbol_finalized_height(self):
		"""Gets current Symbol finalized height."""

		response = await self._get_height('symbol')
		return response['finalizedHeight']
