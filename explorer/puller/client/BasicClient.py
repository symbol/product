from aiohttp import ClientSession, ClientError
from model.Exceptions import NodeRequestFailException

class BasicClient:
	"""Async client for connecting to a node."""

	def __init__(self, endpoint):
		"""Creates a client around an endpoint."""

		self.endpoint = endpoint

	async def get(self, url_path, property_name):
		"""Initiates a GET to the specified path and returns the desired property."""

		try:
			async with ClientSession() as session:
				async with session.get(f'{self.endpoint}/{url_path}') as response:
					response_json = await response.json()
					return response_json if property_name is None else response_json[property_name]
		except ClientError as ex:
			raise NodeRequestFailException from ex

	async def post(self, url_path, request):
		"""Initiates a POST to the specified path and returns the result."""

		try:
			async with ClientSession(headers={'Content-Type': 'application/json'}) as session:
				async with session.post(f'{self.endpoint}/{url_path}', json=request) as response:
					response_json = await response.json()
					return response_json
		except ClientError as ex:
			raise NodeRequestFailException from ex
