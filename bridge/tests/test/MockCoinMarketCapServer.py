import json

from aiohttp import web


async def create_simple_coinmarketcap_client(aiohttp_client):
	"""Creates a simple CoinMarketCap server ."""

	class MockCoinMarketCapServer:
		def __init__(self):
			self.urls = []
			self.custom_response = None  # allows tests to inject JSON

		async def price(self, request):
			ticker = request.url.query['symbol']

			if self.custom_response is not None:
				return await self._process(request, self.custom_response)

			price = {
				'XYM': 0.0877,
				'XEM': 0.0199,
				'ETH': 4500
			}[ticker]

			return await self._process(request, {
            	'data': {
            		ticker: [{
            		    'quote': {
            		        'USD': {
            		            'price': price
            		        }
            		    }
            		}]
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
