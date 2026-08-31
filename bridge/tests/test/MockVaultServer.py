import json

from aiohttp import web


async def create_simple_vault_client(aiohttp_client):
	"""Creates a simple Vault client ."""

	class MockVaultServer:
		def __init__(self):
			self.urls = []
			self.access_tokens = []

			self.simulate_unavailable = False
			self.is_sealed = False
			self.token_ttl = 2764800
			self.token_expires = True

		async def health(self, request):
			if self.simulate_unavailable:
				return await self._process(request, {'errors': ['service unavailable']}, 503)

			# a sealed vault answers 503
			return await self._process(request, {
				'initialized': True,
				'sealed': self.is_sealed,
				'standby': False,
				'version': '1.20.4'
			}, 503 if self.is_sealed else 200)

		async def token_lookup_self(self, request):
			self.access_tokens.append(request.headers['X-Vault-Token'])

			return await self._process(request, {
				'data': {
					'display_name': 'token',
					'expire_time': '2026-10-02T16:22:58.184Z' if self.token_expires else None,
					'renewable': True,
					'ttl': self.token_ttl
				}
			})

		async def read_secret(self, request):
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
	mock_server = MockVaultServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/v1/sys/health', mock_server.health)
	app.router.add_get('/v1/auth/token/lookup-self', mock_server.token_lookup_self)
	app.router.add_get('/v1/kv/data/test_secret', mock_server.read_secret)
	server = await aiohttp_client(app)  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server
