import asyncio
from decimal import Decimal

import pytest

from bridge.price_oracle.CoinGeckoConnector import CoinGeckoConnector
from bridge.price_oracle.PriceOracleThrottle import make_throttled_conversion_rate_lookup

from ..test.MockCoinGeckoServer import create_simple_coingecko_client


@pytest.fixture
async def server(aiohttp_client):
	return await create_simple_coingecko_client(aiohttp_client)


# pylint: disable=invalid-name


def _assert_server_calls(server, expected_count=1):  # pylint: disable=redefined-outer-name
	assert [
		f'{server.make_url("")}/api/v3/simple/price?vs_currencies=usd&ids=symbol',
		f'{server.make_url("")}/api/v3/simple/price?vs_currencies=usd&ids=nem',
	] * expected_count == server.mock.urls


async def test_make_throttled_conversion_rate_lookup_does_not_lookup_prices(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = CoinGeckoConnector(server.make_url(''))

	# Act:
	await make_throttled_conversion_rate_lookup(connector, 10, 'symbol', 'nem')

	# Assert:
	assert [] == server.mock.urls


async def test_make_throttled_conversion_rate_lookup_first_call_looks_up_prices(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = CoinGeckoConnector(server.make_url(''))
	lookup = await make_throttled_conversion_rate_lookup(connector, 10, 'symbol', 'nem')

	# Act:
	conversion_rate = await lookup()

	# Assert:
	_assert_server_calls(server)
	assert Decimal(0.0877) / Decimal(0.0199) == conversion_rate


async def test_make_throttled_conversion_rate_lookup_subsequent_calls_within_interval_do_not_lookup_prices(server):
	# pylint: disable=redefined-outer-name
	# Arrange:
	connector = CoinGeckoConnector(server.make_url(''))
	lookup = await make_throttled_conversion_rate_lookup(connector, 1, 'symbol', 'nem')

	# Act:
	conversion_rate1 = await lookup()
	await asyncio.sleep(0.1)
	conversion_rate2 = await lookup()
	await asyncio.sleep(0.3)
	conversion_rate3 = await lookup()  # should NOT trigger refresh (0.1 + 0.3 << 1.0)

	# Assert:
	_assert_server_calls(server)
	assert Decimal(0.0877) / Decimal(0.0199) == conversion_rate1
	assert Decimal(0.0877) / Decimal(0.0199) == conversion_rate2
	assert Decimal(0.0877) / Decimal(0.0199) == conversion_rate3


async def test_make_throttled_conversion_rate_lookup_subsequent_calls_outside_of_interval_lookup_prices(server):
	# pylint: disable=redefined-outer-name
	# Arrange:
	connector = CoinGeckoConnector(server.make_url(''))
	lookup = await make_throttled_conversion_rate_lookup(connector, 0.2, 'symbol', 'nem')

	# Act:
	conversion_rate1 = await lookup()
	await asyncio.sleep(0.1)
	conversion_rate2 = await lookup()
	await asyncio.sleep(0.3)
	conversion_rate3 = await lookup()  # should trigger refresh (0.1 + 0.3 >> 0.2)

	# Assert:
	_assert_server_calls(server, 2)
	assert Decimal(0.0877) / Decimal(0.0199) == conversion_rate1
	assert Decimal(0.0877) / Decimal(0.0199) == conversion_rate2
	assert Decimal(0.0877) / Decimal(0.0199) == conversion_rate3
