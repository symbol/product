import asyncio
import tempfile

import pytest

from bridge.api import create_app

from ..test.MockCoinGeckoServer import create_simple_coingecko_client
from ..test.MockNemServer import create_simple_nem_client
from ..test.MockSymbolServer import create_simple_symbol_client
from .test_app import _configure_app_directory

# pylint: disable=invalid-name

# region fixtures


@pytest.fixture
async def nem_server(aiohttp_client):
	return await create_simple_nem_client(aiohttp_client)


@pytest.fixture
async def symbol_server(aiohttp_client):
	return await create_simple_symbol_client(aiohttp_client, '0x72C0\'212E\'67A0\'8BCE')


@pytest.fixture
async def coingecko_server(aiohttp_client):
	return await create_simple_coingecko_client(aiohttp_client)


@pytest.fixture
def client(nem_server, symbol_server, coingecko_server):  # pylint: disable=redefined-outer-name
	def update_network_configs(_native_network_config, wrapped_network_config):
		wrapped_network_config['transactionFeeMultiplier'] = '50'

	with tempfile.TemporaryDirectory() as temp_directory:
		_configure_app_directory(temp_directory, nem_server, symbol_server, coingecko_server, update_network_configs)
		yield create_app().test_client()

# endregion


async def test_metrics_route_serves_the_prometheus_exposition_format(client):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Act:
		response = client.get('/metrics')
		body = response.get_data(as_text=True)

		# Assert:
		assert 200 == response.status_code
		assert response.headers['Content-Type'].startswith('text/plain')

		metric_names = (
			'bridge_node_up', 'bridge_balance', 'bridge_chain_height', 'bridge_finalized_height',
			'bridge_price_oracle_up', 'bridge_price_oracle_credits_left',
			'bridge_vault_up', 'bridge_vault_token_ttl_seconds',
			'bridge_requests_failed_permanent', 'bridge_request_retries', 'bridge_requests_rejected',
			'bridge_daily_transfer_remaining', 'bridge_oldest_unprocessed_age_seconds', 'bridge_oldest_sent_age_seconds'
		)
		for metric_name in metric_names:
			assert f'# TYPE {metric_name} gauge' in body, metric_name

	await asyncio.get_running_loop().run_in_executor(None, test_impl)


async def test_metrics_route_reports_collected_samples(client):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Act:
		body = client.get('/metrics').get_data(as_text=True)

		# Assert: the collectors ran and reached both nodes; label sets are asserted in tests/api/metrics
		samples = [line for line in body.splitlines() if line.startswith('bridge_node_up{')]
		assert 2 == len(samples), body
		assert all(line.endswith(' 1.0') for line in samples), body

	await asyncio.get_running_loop().run_in_executor(None, test_impl)
