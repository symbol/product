import json
from decimal import Decimal

import pytest
from aiohttp import web

from bridge.CoinGeckoConnector import CoinGeckoConnector


@pytest.fixture
async def server(aiohttp_client):
	class MockCoinGeckoServer:
		def __init__(self):
			self.urls = []

		async def price(self, request):
			ticker = request.url.query['ids']

			price = {
				'symbol': 0.0877,
				'nem': 0.0199
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


# pylint: disable=invalid-name


async def test_can_query_price(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = CoinGeckoConnector(server.make_url(''))

	# Act:
	price = await connector.price('symbol')

	# Assert:
	assert [f'{server.make_url("")}/api/v3/simple/price?vs_currencies=usd&ids=symbol'] == server.mock.urls
	assert Decimal(0.0877) == price


async def test_can_query_conversion_rate(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = CoinGeckoConnector(server.make_url(''))

	# Act:
	conversion_rate = await connector.conversion_rate('symbol', 'nem')

	# Assert:
	assert [
		f'{server.make_url("")}/api/v3/simple/price?vs_currencies=usd&ids=symbol',
		f'{server.make_url("")}/api/v3/simple/price?vs_currencies=usd&ids=nem',
	] == server.mock.urls
	assert Decimal(0.0877) / Decimal(0.0199) == conversion_rate
