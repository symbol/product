import json

from aiohttp import web


async def create_simple_coingecko_client(aiohttp_client):
	"""Creates a simple coingecko client ."""

	class MockCoinGeckoServer:
		def __init__(self):
			self.urls = []

		async def price(self, request):
			ticker = request.url.query['ids']

			price = {
				'symbol': 0.0877,
				'nem': 0.0199,
				'ethereum': 4500
			}[ticker]

			return await self._process(request, {ticker: {'usd': price}})

		async def _process(self, request, response_body, status_code=200):
			self.urls.append(str(request.url))
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'}, status=status_code)

	# create a mock server
	mock_server = MockCoinGeckoServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/api/v3/simple/price', mock_server.price)
	server = await aiohttp_client(app)  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server
