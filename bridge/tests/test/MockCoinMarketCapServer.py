import json

from aiohttp import web


async def create_simple_coinmarketcap_client(aiohttp_client):
	"""Creates a simple coinmarketcap client ."""

	class MockCoinMarketCapServer:
		def __init__(self):
			self.urls = []
			self.access_tokens = []

		async def price(self, request):
			self.access_tokens.append(request.headers['X-CMC_PRO_API_KEY'])

			ticker = request.url.query['id']

			price = {
				'8677': 0.0877,
				'873': 0.0199,
				'1027': 4500
			}[ticker]

			return await self._process(request, {
				'data': {
					ticker: {
						'quote': {
							'USD': {
								'price': price
							}
						}
					}

				}
			})

		async def _process(self, request, response_body, status_code=200):
			self.urls.append(str(request.url))
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'}, status=status_code)

	# create a mock server
	mock_server = MockCoinMarketCapServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/v2/cryptocurrency/quotes/latest', mock_server.price)
	server = await aiohttp_client(app)  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server
