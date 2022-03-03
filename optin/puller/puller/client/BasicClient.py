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

	async def _issue_json(self, method_retriever, url_path, request):
		async with ClientSession(headers={'Content-Type': 'application/json'}) as session:
			async with method_retriever(session)(f'{self.endpoint}/{url_path}', json=request) as response:
				response_json = await response.json()
				return response_json

	async def post(self, url_path, request):
		"""Initiates a POST to the specified path and returns the result."""

		return await self._issue_json(lambda session: session.post, url_path, request)

	async def put(self, url_path, request):
		"""Initiates a PUT to the specified path and returns the result."""

		return await self._issue_json(lambda session: session.put, url_path, request)
