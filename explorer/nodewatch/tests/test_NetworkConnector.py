import json

import pytest
from aiohttp import web

from nodewatch.NetworkConnector import NetworkConnector


class NodeDescriptor:
	def __init__(self, endpoint, has_api=True):
		self.endpoint = endpoint
		self.has_api = has_api
		self.height = 0
		self.finalized_height = 0


def _assert_node_descriptor(descriptor, height, finalized_height=0):
	assert height == descriptor.height
	assert finalized_height == descriptor.finalized_height


# region server fixture

@pytest.fixture
def server(event_loop, aiohttp_client):
	class MockNemServer:
		def __init__(self):
			self.urls = []
			self.features = 0

		async def nem_height(self, request):
			height = request.match_info['height']
			return await self._process(request, {'height': height})

		async def symbol_height(self, request):
			height = request.match_info['height']
			finalized_height = request.match_info['finalized_height']
			response_json = {'height': height}
			if finalized_height:
				response_json = {**response_json, 'finalized_height': finalized_height}

			return await self._process(request, response_json)

		async def _process(self, request, response_body):
			self.urls.append(str(request.url))
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'})

	# create a mock server
	mock_server = MockNemServer()

	# create an app using the server (cheat by encoding returned values in urls)
	app = web.Application()
	app.router.add_get(r'/{height}/chain/height', mock_server.nem_height)
	app.router.add_get(r'/{height}/{finalized_height}/chain/info', mock_server.symbol_height)
	server = event_loop.run_until_complete(aiohttp_client(app))  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server

# endregion


# pylint: disable=invalid-name

# region update_heights : nem

async def _assert_can_update_nem_heights(server, max_batch_size):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NetworkConnector('nem', max_batch_size)
	node_descriptors = [NodeDescriptor(f'{server.make_url("")}/{height}') for height in [1234, 1237, 1236, 1235, 1239]]

	# Act:
	await connector.update_heights(node_descriptors)

	# Assert:
	assert 5 == len(server.mock.urls)
	for i, height in enumerate([1234, 1237, 1236, 1235, 1239]):
		assert f'{server.make_url("")}/{height}/chain/height' in server.mock.urls
		_assert_node_descriptor(node_descriptors[i], height)


async def test_can_update_nem_heights_single_batch(server):  # pylint: disable=redefined-outer-name
	await _assert_can_update_nem_heights(server, 10)


async def test_can_update_nem_heights_multiple_batch(server):  # pylint: disable=redefined-outer-name
	await _assert_can_update_nem_heights(server, 2)


async def test_can_update_nem_heights_with_some_errors(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NetworkConnector('nem', 10)
	node_descriptors = [
		NodeDescriptor(f'{server.make_url("")}/1234'),
		NodeDescriptor('http://127.0.0.1:1234/1237'),  # failed connection
		NodeDescriptor(f'{server.make_url("")}/1236')
	]

	# Act:
	await connector.update_heights(node_descriptors)

	# Assert:
	assert 2 == len(server.mock.urls)
	for height in [1234, 1236]:
		assert f'{server.make_url("")}/{height}/chain/height' in server.mock.urls

	_assert_node_descriptor(node_descriptors[0], 1234)
	_assert_node_descriptor(node_descriptors[1], 0)  # not updated on failure
	_assert_node_descriptor(node_descriptors[2], 1236)

# endregion


# region update_heights : symbol

async def _assert_can_update_symbol_heights(server, max_batch_size):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NetworkConnector('symbol', max_batch_size)
	node_descriptors = [
		NodeDescriptor(f'{server.make_url("")}/{height}/{finalized_height}') for height, finalized_height in [
			(1234, 1000), (1237, 1010), (1236, 1005), (1235, 0), (1239, 1015)
		]
	]

	# Act:
	await connector.update_heights(node_descriptors)

	# Assert:
	assert 5 == len(server.mock.urls)
	for i, (height, finalized_height) in enumerate([(1234, 1000), (1237, 1010), (1236, 1005), (1235, 0), (1239, 1015)]):
		assert f'{server.make_url("")}/{height}/{finalized_height}/chain/info' in server.mock.urls
		_assert_node_descriptor(node_descriptors[i], height, finalized_height)


async def test_can_update_symbol_heights_single_batch(server):  # pylint: disable=redefined-outer-name
	await _assert_can_update_symbol_heights(server, 10)


async def test_can_update_symbol_heights_multiple_batch(server):  # pylint: disable=redefined-outer-name
	await _assert_can_update_symbol_heights(server, 2)


async def test_can_update_symbol_heights_only_via_api(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NetworkConnector('symbol', 10)
	node_descriptors = [
		NodeDescriptor(f'{server.make_url("")}/{height}/{finalized_height}') for height, finalized_height in [
			(1234, 1000), (1237, 1010), (1236, 1005), (1235, 0), (1239, 1015)
		]
	]
	node_descriptors[1].has_api = False
	node_descriptors[3].has_api = False

	# Act:
	await connector.update_heights(node_descriptors)

	# Assert: non-api nodes were filtered out
	assert 3 == len(server.mock.urls)
	for i, (height, finalized_height) in enumerate([(1234, 1000), (1236, 1005), (1239, 1015)]):
		assert f'{server.make_url("")}/{height}/{finalized_height}/chain/info' in server.mock.urls
		_assert_node_descriptor(node_descriptors[i * 2], height, finalized_height)


async def test_can_update_symbol_heights_with_some_errors(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NetworkConnector('symbol', 10)
	node_descriptors = [
		NodeDescriptor(f'{server.make_url("")}/1234/1000'),
		NodeDescriptor('http://127.0.0.1:1234/1237/1010'),  # failed connection
		NodeDescriptor(f'{server.make_url("")}/1236/1005')
	]

	# Act:
	await connector.update_heights(node_descriptors)

	# Assert:
	assert 2 == len(server.mock.urls)
	for height, finalized_height in [(1234, 1000), (1236, 1005)]:
		assert f'{server.make_url("")}/{height}/{finalized_height}/chain/info' in server.mock.urls

	_assert_node_descriptor(node_descriptors[0], 1234, 1000)
	_assert_node_descriptor(node_descriptors[1], 0)  # not updated on failure
	_assert_node_descriptor(node_descriptors[2], 1236, 1005)

# endregion
