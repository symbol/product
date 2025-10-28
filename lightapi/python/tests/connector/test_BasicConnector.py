import asyncio
import json

import pytest
from aiohttp import web

from symbollightapi.connector.BasicConnector import BasicConnector, NodeException

# region server fixture


@pytest.fixture
async def server(aiohttp_client):
	class MockHttpServer:
		def __init__(self):
			self.urls = []
			self.simulate_long_operation = False
			self.simulate_content_error = False
			self.simulate_corrupt_json_response = False
			self.omit_error_description = False

		async def node_info(self, request):
			return await self._process(request, {'networkIdentifier': 152})

		async def echo_post(self, request):
			request_json = await request.json()
			return await self._process(request, {'message': request_json['message'], 'action': 'post'})

		async def echo_put(self, request):
			request_json = await request.json()
			return await self._process(request, {'message': request_json['message'], 'action': 'put'})

		async def status_code(self, request):
			status_code = int(request.match_info['status_code'])
			return await self._handle_status_code_request(request, status_code, 'get')

		async def status_code_post(self, request):
			request_json = await request.json()
			status_code = request_json['status_code']
			return await self._handle_status_code_request(request, status_code, 'post')

		async def status_code_put(self, request):
			request_json = await request.json()
			status_code = request_json['status_code']
			return await self._handle_status_code_request(request, status_code, 'put')

		async def _handle_status_code_request(self, request, status_code, action):
			response_json = {
				'code': 'SomeCode',
				'message': 'some message',
				'status': status_code,
				'action': action
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
	app.router.add_post('/echo/post', mock_server.echo_post)
	app.router.add_put('/echo/put', mock_server.echo_put)
	app.router.add_get(r'/status/{status_code}', mock_server.status_code)
	app.router.add_post(r'/status', mock_server.status_code_post)
	app.router.add_put(r'/status', mock_server.status_code_put)
	server = await aiohttp_client(app)  # pylint: disable=redefined-outer-name

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


async def test_can_issue_post(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = BasicConnector(server.make_url(''))

	# Act:
	response_json = await connector.post('echo/post', {'message': 'hello world'})

	# Assert:
	assert [f'{server.make_url("")}/echo/post'] == server.mock.urls
	assert {'message': 'hello world', 'action': 'post'} == response_json


async def test_can_issue_put(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = BasicConnector(server.make_url(''))

	# Act:
	response_json = await connector.put('echo/put', {'message': 'hello world'})

	# Assert:
	assert [f'{server.make_url("")}/echo/put'] == server.mock.urls
	assert {'message': 'hello world', 'action': 'put'} == response_json


async def test_can_issue_post_with_named_property(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = BasicConnector(server.make_url(''))

	# Act:
	response_message = await connector.post('echo/post', {'message': 'hello world'}, 'message')

	# Assert:
	assert [f'{server.make_url("")}/echo/post'] == server.mock.urls
	assert 'hello world' == response_message


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


async def test_can_handle_timeout_post(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_timeout(server, 'post', 'echo/post', request_payload={'message': 'hello world'})


async def test_can_handle_timeout_put(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_timeout(server, 'put', 'echo/put', request_payload={'message': 'hello world'})


async def test_can_handle_content_type_error_get(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_content_type_error(server, 'get', 'node/info')


async def test_can_handle_content_type_error_post(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_content_type_error(server, 'post', 'echo/post', request_payload={'message': 'hello world'})


async def test_can_handle_content_type_error_put(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_content_type_error(server, 'put', 'echo/put', request_payload={'message': 'hello world'})


async def test_can_handle_corrupt_json_response_get(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_corrupt_json_response(server, 'get', 'node/info')


async def test_can_handle_corrupt_json_response_post(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_corrupt_json_response(server, 'post', 'echo/post', request_payload={'message': 'hello world'})


async def test_can_handle_corrupt_json_response_put(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_corrupt_json_response(server, 'put', 'echo/put', request_payload={'message': 'hello world'})


async def test_can_handle_stopped_node_get():
	await _assert_can_handle_stopped_node('get', 'node/info')


async def test_can_handle_stopped_node_post():
	await _assert_can_handle_stopped_node('post', 'echo/post', request_payload={'message': 'hello world'})


async def test_can_handle_stopped_node_put():
	await _assert_can_handle_stopped_node('put', 'echo/put', request_payload={'message': 'hello world'})

# endregion


# region error handling - HTTP error code (general)

async def _assert_can_propagate_status_code_result(server, status_code):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = BasicConnector(server.make_url(''))

	# Act:
	response_json = await connector.get(f'status/{status_code}')

	# Assert:
	assert {'code': 'SomeCode', 'message': 'some message', 'status': status_code, 'action': 'get'} == response_json


async def _assert_can_propagate_status_code_failure_result(server, status_code):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.omit_error_description = True

	connector = BasicConnector(server.make_url(''))

	# Act + Assert:
	with pytest.raises(NodeException, match=f'HTTP request failed with code {status_code}'):
		await connector.get(f'status/{status_code}')


async def _assert_can_propagate_status_code_failure_result_with_message(server, status_code):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = BasicConnector(server.make_url(''))

	# Act + Assert:
	with pytest.raises(NodeException, match=f'HTTP request failed with code {status_code}\nSomeCode\nsome message'):
		await connector.get(f'status/{status_code}')


async def test_can_propagate_http_success_results(server):  # pylint: disable=redefined-outer-name
	for status_code in (200, 202, 300):
		await _assert_can_propagate_status_code_result(server, status_code)


async def test_can_propagate_http_failure_results(server):  # pylint: disable=redefined-outer-name
	for status_code in (400, 401, 404, 500, 501):
		await _assert_can_propagate_status_code_failure_result(server, status_code)


async def test_can_propagate_http_failure_results_with_message(server):  # pylint: disable=redefined-outer-name
	for status_code in (400, 401, 500, 501):
		await _assert_can_propagate_status_code_failure_result_with_message(server, status_code)

# endregion


# region error handling - HTTP error code (404)

async def _assert_can_handle_http_failure_404_as_error_by_default(server, action, url_path, **kwargs):
	# pylint: disable=redefined-outer-name
	# Arrange:
	connector = BasicConnector(server.make_url(''))

	# Act + Assert:
	with pytest.raises(NodeException, match='HTTP request failed with code 404\nSomeCode\nsome message'):
		await getattr(connector, action)(url_path, **kwargs)


async def _assert_can_handle_http_failure_404_as_explicit_error(server, action, url_path, **kwargs):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = BasicConnector(server.make_url(''))

	# Act + Assert:
	with pytest.raises(NodeException, match='HTTP request failed with code 404\nSomeCode\nsome message'):
		await getattr(connector, action)(url_path, not_found_as_error=True, **kwargs)


async def _assert_can_handle_http_failure_404_as_explicit_non_error(server, action, url_path, **kwargs):
	# pylint: disable=redefined-outer-name
	# Arrange:
	connector = BasicConnector(server.make_url(''))

	# Act:
	response_json = await getattr(connector, action)(url_path, not_found_as_error=False, **kwargs)

	# Assert:
	assert {'code': 'SomeCode', 'message': 'some message', 'status': 404, 'action': action} == response_json


async def test_can_handle_http_failure_404_as_error_by_default_get(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_http_failure_404_as_error_by_default(server, 'get', 'status/404')


async def test_can_handle_http_failure_404_as_error_by_default_post(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_http_failure_404_as_error_by_default(server, 'post', 'status', request_payload={'status_code': 404})


async def test_can_handle_http_failure_404_as_error_by_default_put(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_http_failure_404_as_error_by_default(server, 'put', 'status', request_payload={'status_code': 404})


async def test_can_handle_http_failure_404_as_explicit_error_get(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_http_failure_404_as_explicit_error(server, 'get', 'status/404')


async def test_can_handle_http_failure_404_as_explicit_error_post(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_http_failure_404_as_explicit_error(server, 'post', 'status', request_payload={'status_code': 404})


async def test_can_handle_http_failure_404_as_explicit_error_put(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_http_failure_404_as_explicit_error(server, 'put', 'status', request_payload={'status_code': 404})


async def test_can_handle_http_failure_404_as_explicit_non_error_get(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_http_failure_404_as_explicit_non_error(server, 'get', 'status/404')


async def test_can_handle_http_failure_404_as_explicit_non_error_post(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_http_failure_404_as_explicit_non_error(server, 'post', 'status', request_payload={'status_code': 404})


async def test_can_handle_http_failure_404_as_explicit_non_error_put(server):  # pylint: disable=redefined-outer-name
	await _assert_can_handle_http_failure_404_as_explicit_non_error(server, 'put', 'status', request_payload={'status_code': 404})

# endregion
