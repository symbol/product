from decimal import Decimal

import pytest

from bridge.CoinMarketCapConnector import CoinMarketCapConnector

from .test.MockCoinMarketCapServer import create_simple_coinmarketcap_client


@pytest.fixture
async def server(aiohttp_client):
	return await create_simple_coinmarketcap_client(aiohttp_client)


# pylint: disable=invalid-name


async def test_can_query_price(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = CoinMarketCapConnector(server.make_url(''), 'api-key')

	# Act:
	price = await connector.price('XYM')

	# Assert:
	assert [f'{server.make_url("")}/v2/cryptocurrency/quotes/latest?convert=USD&symbol=XYM'] == server.mock.urls
	assert Decimal(0.0877) == price


async def test_price_raises_if_ticker_missing(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = CoinMarketCapConnector(server.make_url(''), 'api-key')
	server.mock.custom_response = {
		'data': {
			'UNEXPECTED_TICKER': [{
				'quote': {'USD': {'price': 123}}
			}]
		}
	}

	# Act + Assert:
	with pytest.raises(ValueError, match="Price not available for ticker XYM"):
		await connector.price("XYM")


async def test_price_raises_if_ticker_price_list_empty(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = CoinMarketCapConnector(server.make_url(''), 'api-key')
	server.mock.custom_response = {
		'data': {
			'XYM': []
		}
	}

	# Act + Assert:
	with pytest.raises(ValueError, match="Price not available for ticker XYM"):
		await connector.price("XYM")


async def test_price_raises_if_malformed_response(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = CoinMarketCapConnector(server.make_url(''), 'api-key')
	server.mock.custom_response = {
		'data': {
			'XYM': {}
		}
	}

	# Act + Assert:
	with pytest.raises(ValueError, match="Price not available for ticker XYM"):
		await connector.price("XYM")


async def test_can_query_conversion_rate(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = CoinMarketCapConnector(server.make_url(''), 'api-key')

	# Act:
	conversion_rate = await connector.conversion_rate('XYM', 'XEM')

	# Assert:
	assert [
		f'{server.make_url("")}/v2/cryptocurrency/quotes/latest?convert=USD&symbol=XYM',
		f'{server.make_url("")}/v2/cryptocurrency/quotes/latest?convert=USD&symbol=XEM',
	] == server.mock.urls
	assert Decimal(0.0877) / Decimal(0.0199) == conversion_rate
