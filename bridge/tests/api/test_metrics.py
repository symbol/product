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

		for metric_name in ('bridge_node_up', 'bridge_balance', 'bridge_gas_balance'):
			assert f'# TYPE {metric_name} gauge' in body, metric_name

	await asyncio.get_running_loop().run_in_executor(None, test_impl)


async def test_metrics_route_reports_collected_samples(client):  # pylint: disable=redefined-outer-name
	def test_impl():
		# Act:
		body = client.get('/metrics').get_data(as_text=True)

		# Assert: the collectors ran, so the exposition carries samples and not just declarations
		assert 'bridge_node_up{network="native"} 1.0' in body
		assert 'bridge_node_up{network="wrapped"} 1.0' in body

	await asyncio.get_running_loop().run_in_executor(None, test_impl)
