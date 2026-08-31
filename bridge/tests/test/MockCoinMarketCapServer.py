import json

from aiohttp import web


async def create_simple_coinmarketcap_client(aiohttp_client):
	"""Creates a simple coinmarketcap client ."""

	class MockCoinMarketCapServer:
		def __init__(self):
			self.urls = []
			self.access_tokens = []
			self.simulate_unavailable = False
			self.credits_left = 7331

		async def key_info(self, request):
			self.access_tokens.append(request.headers['X-CMC_PRO_API_KEY'])

			if self.simulate_unavailable:
				return await self._process(request, {'status': {'error_message': 'service unavailable'}}, 503)

			credit_limit_monthly = 15000
			return await self._process(request, {
				'data': {
					'plan': {
						'credit_limit_monthly': credit_limit_monthly,
						'credit_limit_monthly_reset_timestamp': '2026-09-01T00:00:00.000Z',
						'rate_limit_minute': 50
					},
					'usage': {
						'current_minute': {'requests_made': 3, 'requests_left': 47},
						'current_day': {'credits_used': 111},
						'current_month': {
							'credits_used': credit_limit_monthly - self.credits_left,
							'credits_left': self.credits_left
						}
					}
				}
			})

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
	app.router.add_get('/v1/key/info', mock_server.key_info)
	app.router.add_get('/v2/cryptocurrency/quotes/latest', mock_server.price)
	server = await aiohttp_client(app)  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server
