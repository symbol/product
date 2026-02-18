import json

from aiohttp import web


async def create_simple_vault_client(aiohttp_client):
	"""Creates a simple Vault client ."""

	class MockCoinMarketCapServer:
		def __init__(self):
			self.urls = []
			self.access_tokens = []

		async def price(self, request):
			self.access_tokens.append(request.headers['X-Vault-Token'])

			return await self._process(request, {
				'data': {
					'data': {
						'signerPrivateKey': '2525B8B423FCD66D460ED1D53D3B2971DE858792FF70741C0C96922BA2C46C75',
						'name': 'foo'
					},
					'metadata': {
						'version': 3
					}
				},
				'mount_type': 'kv'
			})

		async def _process(self, request, response_body, status_code=200):
			self.urls.append(str(request.url))
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'}, status=status_code)

	# create a mock server
	mock_server = MockCoinMarketCapServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/v1/kv/data/test_secret', mock_server.price)
	server = await aiohttp_client(app)  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server
