from decimal import Decimal

import pytest

from bridge.price_oracle.CoinMarketCapConnector import CoinMarketCapConnector

from ..test.MockCoinMarketCapServer import create_simple_coinmarketcap_client


@pytest.fixture
async def server(aiohttp_client):
	return await create_simple_coinmarketcap_client(aiohttp_client)


# pylint: disable=invalid-name


async def test_can_query_price_symbol(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = CoinMarketCapConnector(server.make_url(''), '4643DDBAF')

	# Act:
	price = await connector.price('symbol')

	# Assert:
	assert [f'{server.make_url("")}/v2/cryptocurrency/quotes/latest?convert=USD&id=8677'] == server.mock.urls
	assert ['4643DDBAF'] == server.mock.access_tokens
	assert Decimal(0.0877) == price


async def test_can_query_price_nem(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = CoinMarketCapConnector(server.make_url(''), '4643DDBAF')

	# Act:
	price = await connector.price('nem')

	# Assert:
	assert [f'{server.make_url("")}/v2/cryptocurrency/quotes/latest?convert=USD&id=873'] == server.mock.urls
	assert ['4643DDBAF'] == server.mock.access_tokens
	assert Decimal(0.0199) == price


async def test_can_query_price_ethereum(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = CoinMarketCapConnector(server.make_url(''), '4643DDBAF')

	# Act:
	price = await connector.price('ethereum')

	# Assert:
	assert [f'{server.make_url("")}/v2/cryptocurrency/quotes/latest?convert=USD&id=1027'] == server.mock.urls
	assert ['4643DDBAF'] == server.mock.access_tokens
	assert Decimal(4500) == price


async def test_cannot_query_price_for_unknown_ticker(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = CoinMarketCapConnector(server.make_url(''), '4643DDBAF')

	# Act + Assert:
	with pytest.raises(ValueError, match='price lookup for ticker "bitcoin" is not supported'):
		await connector.price('bitcoin')


async def test_can_query_conversion_rate(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = CoinMarketCapConnector(server.make_url(''), '4643DDBAF')

	# Act:
	conversion_rate = await connector.conversion_rate('symbol', 'nem')

	# Assert:
	assert [
		f'{server.make_url("")}/v2/cryptocurrency/quotes/latest?convert=USD&id=8677',
		f'{server.make_url("")}/v2/cryptocurrency/quotes/latest?convert=USD&id=873',
	] == server.mock.urls
	assert ['4643DDBAF', '4643DDBAF'] == server.mock.access_tokens
	assert Decimal(0.0877) / Decimal(0.0199) == conversion_rate
