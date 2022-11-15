import asyncio
import json

import pytest
from aiohttp import web

from puller.client.BasicClient import BasicClient, NodeException

# region server fixture


@pytest.fixture
def server(event_loop, aiohttp_client):
	class MockHttpServer:
		def __init__(self):
			self.urls = []
			self.simulate_long_operation = False
			self.simulate_content_error = False
			self.simulate_corrupt_json = False

		async def node_info(self, request):
			return await self._process(request, {'networkIdentifier': 152})

		async def _process(self, request, response_body):
			self.urls.append(str(request.url))

			if self.simulate_long_operation:
				await asyncio.sleep(0.25)

			if self.simulate_content_error:
				return web.Response(body='this is a plain text response', headers={'Content-Type': 'plain/text'})

			json_body = json.dumps(response_body)
			if self.simulate_corrupt_json:
				json_body = json_body[:-5]

			return web.Response(body=json_body, headers={'Content-Type': 'application/json'})

	# create a mock server
	mock_server = MockHttpServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/node/info', mock_server.node_info)
	server = event_loop.run_until_complete(aiohttp_client(app))  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server

# endregion

# pylint: disable=invalid-name


# region error handling

async def test_can_handle_timeout(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.simulate_long_operation = True

	client = BasicClient(server.make_url(''))
	client.timeout_seconds = 0.25

	# Act + Assert:
	with pytest.raises(NodeException):
		await client.get('node/info')


async def test_can_handle_content_type_error(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.simulate_content_error = True

	client = BasicClient(server.make_url(''))

	# Act + Assert:
	with pytest.raises(NodeException):
		await client.get('node/info')


async def test_can_handle_corrupt_json(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.simulate_corrupt_json = True

	client = BasicClient(server.make_url(''))

	# Act + Assert:
	with pytest.raises(NodeException):
		await client.get('node/info')


async def test_can_handle_stopped_node():  # pylint: disable=redefined-outer-name
	# Arrange:
	client = BasicClient('http://localhost:1234')

	# Act + Assert:
	with pytest.raises(NodeException):
		await client.get('node/info')

# endregion


# region success

async def test_can_issue_get(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = BasicClient(server.make_url(''))

	# Act:
	node_info = await client.get('node/info')

	# Assert:
	assert [f'{server.make_url("")}/node/info'] == server.mock.urls
	assert {'networkIdentifier': 152} == node_info


async def test_can_issue_get_with_named_property(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = BasicClient(server.make_url(''))

	# Act:
	network_identifier = await client.get('node/info', 'networkIdentifier')

	# Assert:
	assert [f'{server.make_url("")}/node/info'] == server.mock.urls
	assert 152 == network_identifier


# endregion
