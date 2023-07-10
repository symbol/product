import asyncio
import json

import pytest
from aiohttp import web

from symbollightapi.connector.BasicConnector import BasicConnector, NodeException

# region server fixture


@pytest.fixture
def server(event_loop, aiohttp_client):
	class MockHttpServer:
		def __init__(self):
			self.urls = []
			self.simulate_long_operation = False
			self.simulate_content_error = False
			self.simulate_corrupt_json_response = False
			self.omit_error_description = False

		async def node_info(self, request):
			return await self._process(request, {'networkIdentifier': 152})

		async def echo_put(self, request):
			request_json = await request.json()
			return await self._process(request, {'message': request_json['message'], 'action': 'put'})

		async def status_code(self, request):
			status_code = int(request.match_info['status_code'])

			response_json = {
				'code': 'SomeCode',
				'message': 'some message',
				'status': status_code
			}

			if self.omit_error_description:
				del response_json['code']
				del response_json['message']

			return await self._process(request, response_json, status_code)

		async def _process(self, request, response_body, status_code=200):
			self.urls.append(str(request.url))

			if self.simulate_long_operation:
				await asyncio.sleep(0.25)

			if self.simulate_content_error:
				return web.Response(body='this is a plain text response', headers={'Content-Type': 'plain/text'})

			json_body = json.dumps(response_body)
			if self.simulate_corrupt_json_response:
				json_body = json_body[:-5]

			return web.Response(body=json_body, headers={'Content-Type': 'application/json'}, status=status_code)

	# create a mock server
	mock_server = MockHttpServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/node/info', mock_server.node_info)
	app.router.add_put('/echo/put', mock_server.echo_put)
	app.router.add_get(r'/status/{status_code}', mock_server.status_code)
	server = event_loop.run_until_complete(aiohttp_client(app))  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server

# endregion

# pylint: disable=invalid-name


# region success

async def test_can_issue_get(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = BasicConnector(server.make_url(''))

	# Act:
	response_json = await connector.get('node/info')

	# Assert:
	assert [f'{server.make_url("")}/node/info'] == server.mock.urls
	assert {'networkIdentifier': 152} == response_json


async def test_can_issue_get_with_named_property(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = BasicConnector(server.make_url(''))

	# Act:
	network_identifier = await connector.get('node/info', 'networkIdentifier')

	# Assert:
	assert [f'{server.make_url("")}/node/info'] == server.mock.urls
	assert 152 == network_identifier


async def test_can_issue_put(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = BasicConnector(server.make_url(''))

	# Act:
	response_json = await connector.put('echo/put', {'message': 'hello world'})

	# Assert:
	assert [f'{server.make_url("")}/echo/put'] == server.mock.urls
	assert {'message': 'hello world', 'action': 'put'} == response_json


async def test_can_issue_put_with_named_property(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = BasicConnector(server.make_url(''))

	# Act:
	response_message = await connector.put('echo/put', {'message': 'hello world'}, 'message')

	# Assert:
	assert [f'{server.make_url("")}/echo/put'] == server.mock.urls
	assert 'hello world' == response_message

# endregion


# region error handling - basic

async def _assert_can_handle_timeout(server, action, url_path, **kwargs):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.simulate_long_operation = True

	connector = BasicConnector(server.make_url(''))
	connector.timeout_seconds = 0.25

	# Act + Assert:
	with pytest.raises(NodeException):
		await getattr(connector, action)(url_path, **kwargs)


async def _assert_can_handle_content_type_error(server, action, url_path, **kwargs):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.simulate_content_error = True

	connector = BasicConnector(server.make_url(''))

	# Act + Assert:
	with pytest.raises(NodeException):
		await getattr(connector, action)(url_path, **kwargs)


async def _assert_can_handle_corrupt_json_response(server, action, url_path, **kwargs):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.simulate_corrupt_json_response = True

	connector = BasicConnector(server.make_url(''))

	# Act + Assert:
	with pytest.raises(NodeException):
		await getattr(connector, action)(url_path, **kwargs)


async def _assert_can_handle_stopped_node(action, url_path, **kwargs):
	# Arrange:
	connector = BasicConnector('http://localhost:1234')

	# Act + Assert:
	with pytest.raises(NodeException):
		await getattr(connector, action)(url_path, **kwargs)


async def test_can_handle_timeout_get(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_timeout(server, 'get', 'node/info')


async def test_can_handle_timeout_put(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_timeout(server, 'put', 'echo/put', request_payload={'message': 'hello world'})


async def test_can_handle_content_type_error_get(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_content_type_error(server, 'get', 'node/info')


async def test_can_handle_content_type_error_put(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_content_type_error(server, 'put', 'echo/put', request_payload={'message': 'hello world'})


async def test_can_handle_corrupt_json_response_get(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_corrupt_json_response(server, 'get', 'node/info')


async def test_can_handle_corrupt_json_response_put(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_corrupt_json_response(server, 'put', 'echo/put', request_payload={'message': 'hello world'})


async def test_can_handle_stopped_node_get():
	await _assert_can_handle_stopped_node('get', 'node/info')


async def test_can_handle_stopped_node_put():
	await _assert_can_handle_stopped_node('put', 'echo/put', request_payload={'message': 'hello world'})

# endregion


# region error handling - HTTP error code

async def _assert_can_propagate_status_code_result(server, status_code):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = BasicConnector(server.make_url(''))

	# Act:
	response_json = await connector.get(f'status/{status_code}')

	# Assert:
	assert {'code': 'SomeCode', 'message': 'some message', 'status': status_code} == response_json


async def test_can_propagate_200_result(server):  # pylint: disable=redefined-outer-name
	await _assert_can_propagate_status_code_result(server, 200)


async def test_can_propagate_404_result(server):  # pylint: disable=redefined-outer-name
	await _assert_can_propagate_status_code_result(server, 404)


async def test_fail_propagate_500_result_with_message(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = BasicConnector(server.make_url(''))

	# Act + Assert:
	with pytest.raises(NodeException, match=r'^HTTP request failed with code 500\nSomeCode\nsome message$'):
		await connector.get('status/500')


async def test_fail_propagate_500_result_without_message(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.omit_error_description = True

	connector = BasicConnector(server.make_url(''))

	# Act + Assert:
	with pytest.raises(NodeException, match=r'^HTTP request failed with code 500$'):
		await connector.get('status/500')

# endregion
