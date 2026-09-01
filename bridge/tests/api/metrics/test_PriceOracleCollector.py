import pytest
from prometheus_client import CollectorRegistry

from bridge.api.metrics.PriceOracleCollector import PriceOracleCollector
from bridge.price_oracle.CoinGeckoConnector import CoinGeckoConnector
from bridge.price_oracle.CoinMarketCapConnector import CoinMarketCapConnector

from ...test.MockCoinGeckoServer import create_simple_coingecko_client
from ...test.MockCoinMarketCapServer import create_simple_coinmarketcap_client

# pylint: disable=invalid-name

ACCESS_TOKEN = '4643DDBAF'
UNREACHABLE_ENDPOINT = 'http://127.0.0.1:1'

CREDITS_LEFT = 7331

# region fixtures


@pytest.fixture
async def coingecko_server(aiohttp_client):
	return await create_simple_coingecko_client(aiohttp_client)


@pytest.fixture
async def coinmarketcap_server(aiohttp_client):
	return await create_simple_coinmarketcap_client(aiohttp_client)

# endregion


# region test utils

class _Context:
	"""Stands in for BridgeContext, which only supplies the price oracle here."""

	def __init__(self, create_price_oracle):
		self.create_price_oracle = create_price_oracle


def _coingecko_context(server=None):
	endpoint = str(server.make_url('')) if server else UNREACHABLE_ENDPOINT
	return (_Context(lambda: CoinGeckoConnector(endpoint)), endpoint)


def _coinmarketcap_context(server):
	endpoint = str(server.make_url(''))
	return (_Context(lambda: CoinMarketCapConnector(endpoint, ACCESS_TOKEN)), endpoint)


async def _collect(collector):
	registry = CollectorRegistry()
	await collector.collect(registry)
	return registry


def _up(registry, endpoint):
	return registry.get_sample_value('bridge_price_oracle_up', {'endpoint': endpoint})


def _credits_left(registry, endpoint):
	return registry.get_sample_value('bridge_price_oracle_credits_left', {'endpoint': endpoint})

# endregion


async def test_reachable_oracle_is_probed_without_asking_for_a_price(coingecko_server):
	# pylint: disable=redefined-outer-name
	# Arrange:
	(context, endpoint) = _coingecko_context(coingecko_server)

	# Act:
	registry = await _collect(PriceOracleCollector(context, 3))

	# Assert:
	assert 1 == _up(registry, endpoint)
	assert [f'{endpoint}/api/v3/ping'] == coingecko_server.mock.urls


async def test_provider_without_a_quota_reports_no_credits(coingecko_server):  # pylint: disable=redefined-outer-name
	# Arrange:
	(context, endpoint) = _coingecko_context(coingecko_server)

	# Act:
	registry = await _collect(PriceOracleCollector(context, 3))

	# Assert
	assert _credits_left(registry, endpoint) is None


async def test_unreachable_oracle_is_reported_as_down():
	# Arrange:
	(context, endpoint) = _coingecko_context()

	# Act:
	registry = await _collect(PriceOracleCollector(context, 3))

	# Assert:
	assert 0 == _up(registry, endpoint)
	assert _credits_left(registry, endpoint) is None


async def test_credits_left_are_reported_when_the_provider_reports_them(coinmarketcap_server):
	# pylint: disable=redefined-outer-name
	# Arrange:
	(context, endpoint) = _coinmarketcap_context(coinmarketcap_server)

	# Act:
	registry = await _collect(PriceOracleCollector(context, 3))

	# Assert:
	assert 1 == _up(registry, endpoint)
	assert CREDITS_LEFT == _credits_left(registry, endpoint)
	assert [ACCESS_TOKEN] == coinmarketcap_server.mock.access_tokens


async def test_unavailable_oracle_is_reported_as_down_without_credits(coinmarketcap_server):
	# pylint: disable=redefined-outer-name
	# Arrange: an oracle that refuses the probe says nothing about how much quota is left
	coinmarketcap_server.mock.simulate_unavailable = True
	(context, endpoint) = _coinmarketcap_context(coinmarketcap_server)

	# Act:
	registry = await _collect(PriceOracleCollector(context, 3))

	# Assert:
	assert 0 == _up(registry, endpoint)
	assert _credits_left(registry, endpoint) is None


async def test_repeated_scrapes_probe_the_oracle_once_per_refresh_period(coinmarketcap_server):
	# pylint: disable=redefined-outer-name
	# Arrange:
	(context, endpoint) = _coinmarketcap_context(coinmarketcap_server)
	collector = PriceOracleCollector(context, 3, 300)

	# Act:
	for _ in range(3):
		registry = await _collect(collector)

	# Assert: every scrape republishes the one reading that was taken
	assert CREDITS_LEFT == _credits_left(registry, endpoint)
	assert 1 == len(coinmarketcap_server.mock.access_tokens)


async def test_oracle_is_probed_again_once_the_refresh_period_elapses(coinmarketcap_server):
	# pylint: disable=redefined-outer-name
	# Arrange: a refresh period of zero has always already elapsed
	(context, _) = _coinmarketcap_context(coinmarketcap_server)
	collector = PriceOracleCollector(context, 3, 0)

	# Act:
	for _ in range(3):
		await _collect(collector)

	# Assert:
	assert 3 == len(coinmarketcap_server.mock.access_tokens)


async def test_a_failed_probe_is_cached_like_a_successful_one(coinmarketcap_server):
	# pylint: disable=redefined-outer-name
	# Arrange: an oracle that is failing must not be probed once per scrape
	coinmarketcap_server.mock.simulate_unavailable = True
	(context, endpoint) = _coinmarketcap_context(coinmarketcap_server)
	collector = PriceOracleCollector(context, 3, 300)

	# Act:
	for _ in range(3):
		registry = await _collect(collector)

	# Assert:
	assert 0 == _up(registry, endpoint)
	assert 1 == len(coinmarketcap_server.mock.access_tokens)


async def test_exhausted_quota_is_reported_by_a_reachable_oracle(coinmarketcap_server):
	# pylint: disable=redefined-outer-name
	# Arrange: running out of credits does not stop the key from answering, so this is not an outage
	coinmarketcap_server.mock.credits_left = 0
	(context, endpoint) = _coinmarketcap_context(coinmarketcap_server)

	# Act:
	registry = await _collect(PriceOracleCollector(context, 3))

	# Assert: the whole point of the metric is to show zero here rather than a missing sample
	assert 1 == _up(registry, endpoint)
	assert 0 == _credits_left(registry, endpoint)
