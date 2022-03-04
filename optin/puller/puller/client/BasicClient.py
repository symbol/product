from aiohttp import ClientSession


class BasicClient:
	"""Async client for connecting to a node."""

	def __init__(self, endpoint):
		"""Creates a client around an endpoint."""

		self.endpoint = endpoint
		self.network = None

	async def get(self, url_path, property_name):
		"""Initiates a GET to the specified path and returns the desired property."""

		async with ClientSession() as session:
			async with session.get(f'{self.endpoint}/{url_path}') as response:
				response_json = await response.json()
				return response_json if property_name is None else response_json[property_name]

	async def post(self, url_path, request):
		"""Initiates a POST to the specified path and returns the result."""

		async with ClientSession(headers={'Content-Type': 'application/json'}) as session:
			async with session.post(f'{self.endpoint}/{url_path}', json=request) as response:
				response_json = await response.json()
				return response_json
