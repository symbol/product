import pytest
from symbollightapi.model.Exceptions import NodeException

from bridge.VaultConnector import VaultConnector

from .test.MockVaultServer import create_simple_vault_client


@pytest.fixture
async def server(aiohttp_client):
	return await create_simple_vault_client(aiohttp_client)


# pylint: disable=invalid-name


async def test_can_read_health(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = VaultConnector(server.make_url(''), '4643DDBAF')

	# Act:
	health = await connector.read_health()

	# Assert:
	assert [f'{server.make_url("")}/v1/sys/health'] == server.mock.urls
	assert not health['sealed']

	# ... and no token was sent, since the vault health endpoint is unauthenticated
	assert [None] == server.mock.access_tokens


async def test_read_health_raises_when_the_vault_is_sealed(server):  # pylint: disable=redefined-outer-name
	# Arrange: a sealed vault answers 503, which is wanted here - it cannot serve the signing key
	server.mock.is_sealed = True
	connector = VaultConnector(server.make_url(''), '4643DDBAF')

	# Act + Assert:
	with pytest.raises(NodeException):
		await connector.read_health()


async def test_read_health_raises_when_the_vault_is_unavailable(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.simulate_unavailable = True
	connector = VaultConnector(server.make_url(''), '4643DDBAF')

	# Act + Assert:
	with pytest.raises(NodeException):
		await connector.read_health()


async def test_can_read_token_ttl(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = VaultConnector(server.make_url(''), '4643DDBAF')

	# Act:
	token_ttl = await connector.read_token_ttl()

	# Assert:
	assert [f'{server.make_url("")}/v1/auth/token/lookup-self'] == server.mock.urls
	assert ['4643DDBAF'] == server.mock.access_tokens
	assert 2764800 == token_ttl


async def test_read_token_ttl_is_none_for_a_token_that_does_not_expire(server):  # pylint: disable=redefined-outer-name
	# Arrange: such a token reports a ttl of zero, which would otherwise read as expiring now
	server.mock.token_expires = False
	server.mock.token_ttl = 0
	connector = VaultConnector(server.make_url(''), '4643DDBAF')

	# Act:
	token_ttl = await connector.read_token_ttl()

	# Assert:
	assert token_ttl is None


async def test_can_query_kv_secret_data(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = VaultConnector(server.make_url(''), '4643DDBAF')

	# Act:
	data = await connector.read_kv_secret_data('test_secret')

	# Assert:
	assert [f'{server.make_url("")}/v1/kv/data/test_secret'] == server.mock.urls
	assert ['4643DDBAF'] == server.mock.access_tokens
	assert {
		'signerPrivateKey': '2525B8B423FCD66D460ED1D53D3B2971DE858792FF70741C0C96922BA2C46C75',
		'name': 'foo'
	} == data
