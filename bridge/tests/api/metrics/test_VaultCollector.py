import pytest
from prometheus_client import CollectorRegistry

from bridge.api.metrics.VaultCollector import VaultCollector
from bridge.VaultConnector import VaultConnector

from ...test.MockVaultServer import create_simple_vault_client

# pylint: disable=invalid-name

ACCESS_TOKEN = '4643DDBAF'
UNREACHABLE_ENDPOINT = 'http://127.0.0.1:1'

TOKEN_TTL = 2764800


@pytest.fixture
async def vault_server(aiohttp_client):
	return await create_simple_vault_client(aiohttp_client)


# region test utils

class _Context:
	"""Stands in for BridgeContext, which only supplies the vault connector here."""

	def __init__(self, endpoint, is_vault_used=True):
		self.is_vault_used = is_vault_used
		self.create_vault_connector = lambda: VaultConnector(endpoint, ACCESS_TOKEN)


def _make_context(server=None, is_vault_used=True):
	endpoint = str(server.make_url('')) if server else UNREACHABLE_ENDPOINT
	return (_Context(endpoint, is_vault_used), endpoint)


async def _collect(context):
	registry = CollectorRegistry()
	await VaultCollector(context, 3).collect(registry)
	return registry


def _up(registry, endpoint):
	return registry.get_sample_value('bridge_vault_up', {'endpoint': endpoint})


def _token_ttl(registry, endpoint):
	return registry.get_sample_value('bridge_vault_token_ttl_seconds', {'endpoint': endpoint})

# endregion


async def test_healthy_vault_is_reported(vault_server):  # pylint: disable=redefined-outer-name
	# Arrange:
	(context, endpoint) = _make_context(vault_server)

	# Act:
	registry = await _collect(context)

	# Assert:
	assert 1 == _up(registry, endpoint)
	assert TOKEN_TTL == _token_ttl(registry, endpoint)


async def test_sealed_vault_is_reported_as_down(vault_server):  # pylint: disable=redefined-outer-name
	# Arrange: a sealed vault answers, but cannot serve the signing key, which is all the bridge needs it for
	vault_server.mock.is_sealed = True
	(context, endpoint) = _make_context(vault_server)

	# Act:
	registry = await _collect(context)

	# Assert:
	assert 0 == _up(registry, endpoint)
	assert _token_ttl(registry, endpoint) is None


async def test_unreachable_vault_is_reported_as_down():
	# Arrange:
	(context, endpoint) = _make_context()

	# Act:
	registry = await _collect(context)

	# Assert: nothing is claimed about a vault that could not be read
	assert 0 == _up(registry, endpoint)
	assert _token_ttl(registry, endpoint) is None


async def test_token_that_does_not_expire_reports_no_ttl(vault_server):  # pylint: disable=redefined-outer-name
	# Arrange: such a token reports a ttl of zero, which would read as expiring now
	vault_server.mock.token_expires = False
	vault_server.mock.token_ttl = 0
	(context, endpoint) = _make_context(vault_server)

	# Act:
	registry = await _collect(context)

	# Assert:
	assert 1 == _up(registry, endpoint)
	assert _token_ttl(registry, endpoint) is None


async def test_bridge_without_a_vault_key_reports_nothing(vault_server):  # pylint: disable=redefined-outer-name
	# Arrange: the vault section holds a placeholder when no signing key is stored in it
	(context, endpoint) = _make_context(vault_server, is_vault_used=False)

	# Act:
	registry = await _collect(context)

	# Assert: no sample at all, rather than an outage that is only a configuration the bridge supports
	assert _up(registry, endpoint) is None
	assert [] == vault_server.mock.urls
