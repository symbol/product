import json

import pytest
from aiohttp import web
from symbolchain.nem.Network import Network
from test_data import CHAIN_BLOCK_1, CHAIN_BLOCK_2

from client.NemClient import NemClient

# region server fixture


@pytest.fixture
def server(event_loop, aiohttp_client):
	class MockNemServer:
		def __init__(self):
			self.urls = []

		async def chain_height(self, request):
			return await self._process(request, {'height': 1})

		async def node_info(self, request):
			return await self._process(request, {'metaData': {'networkId': 104}})

		async def local_chain_blocks_after(self, request):
			return await self._process(request, {'data': [CHAIN_BLOCK_1, CHAIN_BLOCK_2]})

		async def local_block_at(self, request):
			return await self._process(request, CHAIN_BLOCK_1)

		async def _process(self, request, response_body):
			self.urls.append(str(request.url))
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'})

	# create a mock server
	mock_server = MockNemServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/chain/height', mock_server.chain_height)
	app.router.add_get('/node/info', mock_server.node_info)
	app.router.add_post('/local/chain/blocks-after', mock_server.local_chain_blocks_after)
	app.router.add_post('/local/block/at', mock_server.local_block_at)

	server = event_loop.run_until_complete(aiohttp_client(app))  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server


# endregion


# region chain height

async def test_can_query_chain_height(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = NemClient(server.make_url(''))

	# Act:
	height = await client.height()

	# Assert:
	assert [f'{server.make_url("")}/chain/height'] == server.mock.urls
	assert 1 == height

# endregion


# region node network

async def test_can_query_network(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = NemClient(server.make_url(''))

	# Act:
	network = await client.node_network()

	# Assert:
	assert [f'{server.make_url("")}/node/info'] == server.mock.urls
	assert Network.MAINNET == network

# endregion


# region chain blocks after

async def test_can_query_blocks_after(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = NemClient(server.make_url(''))

	# Act:
	blocks = await client.get_blocks_after(3)

	# Assert:
	assert [f'{server.make_url("")}/local/chain/blocks-after'] == server.mock.urls
	assert 2 == len(blocks['data'])
	assert blocks == {
		'data': [CHAIN_BLOCK_1, CHAIN_BLOCK_2]
	}

# endregion


# region block at public

async def test_can_query_block_at(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = NemClient(server.make_url(''))

	# Act:
	block = await client.get_block(1)

	# Assert:
	assert [f'{server.make_url("")}/local/block/at'] == server.mock.urls
	assert block == CHAIN_BLOCK_1

# endregion
