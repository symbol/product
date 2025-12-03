import pytest

from bridge.VaultConnector import VaultConnector

from .test.MockVaultServer import create_simple_vault_client


@pytest.fixture
async def server(aiohttp_client):
	return await create_simple_vault_client(aiohttp_client)


# pylint: disable=invalid-name


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
