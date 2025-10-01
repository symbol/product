from decimal import Decimal

import pytest

from bridge.price_oracle.CoinGeckoConnector import CoinGeckoConnector

from ..test.MockCoinGeckoServer import create_simple_coingecko_client


@pytest.fixture
async def server(aiohttp_client):
	return await create_simple_coingecko_client(aiohttp_client)


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
