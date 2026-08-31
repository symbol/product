import pytest
from prometheus_client import CollectorRegistry

from bridge.api.metrics.OracleCollector import OracleCollector
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
	# the connector is constructed directly, because the loader selects a provider by hostname and the mock is local
	endpoint = str(server.make_url(''))
	return (_Context(lambda: CoinMarketCapConnector(endpoint, ACCESS_TOKEN)), endpoint)


async def _collect(collector):
	registry = CollectorRegistry()
	await collector.collect(registry)
	return registry


def _up(registry, endpoint):
	return registry.get_sample_value('bridge_oracle_up', {'endpoint': endpoint})


def _credits_left(registry, endpoint):
	return registry.get_sample_value('bridge_oracle_credits_left', {'endpoint': endpoint})

# endregion


async def test_reachable_oracle_is_probed_without_asking_for_a_price(coingecko_server):
	# pylint: disable=redefined-outer-name
	# Arrange:
	(context, endpoint) = _coingecko_context(coingecko_server)

	# Act:
	registry = await _collect(OracleCollector(context, 3))

	# Assert: the quota this metric guards must not be spent measuring it
	assert 1 == _up(registry, endpoint)
	assert [f'{endpoint}/api/v3/ping'] == coingecko_server.mock.urls


async def test_provider_without_a_quota_reports_no_credits(coingecko_server):  # pylint: disable=redefined-outer-name
	# Arrange:
	(context, endpoint) = _coingecko_context(coingecko_server)

	# Act:
	registry = await _collect(OracleCollector(context, 3))

	# Assert: no sample at all, rather than a zero that would read as an exhausted plan
	assert _credits_left(registry, endpoint) is None


async def test_unreachable_oracle_is_reported_as_down():
	# Arrange:
	(context, endpoint) = _coingecko_context()

	# Act:
	registry = await _collect(OracleCollector(context, 3))

	# Assert:
	assert 0 == _up(registry, endpoint)
	assert _credits_left(registry, endpoint) is None


async def test_credits_left_are_reported_when_the_provider_reports_them(coinmarketcap_server):
	# pylint: disable=redefined-outer-name
	# Arrange:
	(context, endpoint) = _coinmarketcap_context(coinmarketcap_server)

	# Act:
	registry = await _collect(OracleCollector(context, 3))

	# Assert:
	assert 1 == _up(registry, endpoint)
	assert CREDITS_LEFT == _credits_left(registry, endpoint)

	# ... and the key is presented, because the quota belongs to the key rather than to the provider
	assert [ACCESS_TOKEN] == coinmarketcap_server.mock.access_tokens


async def test_rate_limited_oracle_is_reported_as_down_without_credits(coinmarketcap_server):
	# pylint: disable=redefined-outer-name
	# Arrange: being rate limited is the failure this metric exists to warn about
	coinmarketcap_server.mock.simulate_unavailable = True
	(context, endpoint) = _coinmarketcap_context(coinmarketcap_server)

	# Act:
	registry = await _collect(OracleCollector(context, 3))

	# Assert: a quota that could not be read is not published as a stale one
	assert 0 == _up(registry, endpoint)
	assert _credits_left(registry, endpoint) is None


async def test_repeated_scrapes_probe_the_oracle_once_per_refresh_period(coinmarketcap_server):
	# pylint: disable=redefined-outer-name
	# Arrange: scrape rate, worker count and prometheus replica count must not multiply provider traffic
	(context, endpoint) = _coinmarketcap_context(coinmarketcap_server)
	collector = OracleCollector(context, 3, 300)

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
	collector = OracleCollector(context, 3, 0)

	# Act:
	for _ in range(3):
		await _collect(collector)

	# Assert:
	assert 3 == len(coinmarketcap_server.mock.access_tokens)


async def test_a_failed_probe_is_cached_like_a_successful_one(coinmarketcap_server):
	# pylint: disable=redefined-outer-name
	# Arrange: an oracle that is rate limiting us must not be probed once per scrape
	coinmarketcap_server.mock.simulate_unavailable = True
	(context, endpoint) = _coinmarketcap_context(coinmarketcap_server)
	collector = OracleCollector(context, 3, 300)

	# Act:
	for _ in range(3):
		registry = await _collect(collector)

	# Assert:
	assert 0 == _up(registry, endpoint)
	assert 1 == len(coinmarketcap_server.mock.access_tokens)
