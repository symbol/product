# pylint: disable=invalid-name

import asyncio
import json
from dataclasses import dataclass

import pytest
from aiohttp import client_exceptions, web
from symbollightapi.model.Exceptions import HttpException, NodeException

from puller.facade.SymbolPullerConnector import SymbolPullerConnector, SymbolPullerConnectorStateError

from .puller_test_utils import RecordingCleanupLogger


class FakeResponse:
	def __init__(self, response_json=None, status=200, json_error=None):
		self.response_json = response_json
		self.status = status
		self.json_error = json_error

	async def __aenter__(self):
		return self

	async def __aexit__(self, *_):
		return None

	async def json(self):
		if self.json_error:
			raise self.json_error
		return self.response_json


class FakeSession:
	def __init__(self, outcomes, close_error=None, close_event=None):
		self.outcomes = list(outcomes)
		self.calls = []
		self.close_call_count = 0
		self.close_started = asyncio.Event()
		self.close_error = close_error
		self.allow_close = close_event

	def _request(self, method, url, **kwargs):
		self.calls.append((method, url, kwargs))
		outcome = self.outcomes.pop(0)
		if isinstance(outcome, BaseException):
			raise outcome
		return outcome

	def get(self, url, **kwargs):
		return self._request('GET', url, **kwargs)

	def post(self, url, **kwargs):
		return self._request('POST', url, **kwargs)

	async def close(self):
		self.close_call_count += 1
		self.close_started.set()
		if self.allow_close is not None:
			await self.allow_close.wait()
		if self.close_error is not None:
			raise self.close_error


class BlockingResponse(FakeResponse):
	def __init__(self):
		super().__init__({'ok': True})
		self.entered = asyncio.Event()
		self.allow_exit = asyncio.Event()

	async def __aenter__(self):
		self.entered.set()
		return self

	async def __aexit__(self, *_):
		await self.allow_exit.wait()


class RecordingTcpConnector:
	def __init__(self, limit, close_error=None):
		self.limit = limit
		self.close_call_count = 0
		self.close_error = close_error

	async def close(self):
		self.close_call_count += 1
		if self.close_error is not None:
			raise self.close_error


class RecordingFactory:
	def __init__(self, result):
		self.result = result
		self.calls = []

	def __call__(self, **kwargs):
		self.calls.append(kwargs)
		return self.result


@dataclass
class SymbolConnectorHttpServer:
	client: object
	transports: list


def _failing_session_factory(**_):
	raise RuntimeError('session factory failed')


def _failing_tcp_connector_factory(**_):
	raise RuntimeError('tcp connector factory failed')


async def _assert_http_exception(connector, url_path, expected_status, expected_message):
	# Act:
	with pytest.raises(HttpException) as exception_info:
		await connector.get(url_path)

	# Assert:
	assert expected_status == exception_info.value.http_status_code
	assert expected_message == str(exception_info.value)


def _create_connector(outcomes, timeout_seconds=13, connection_limit=100, endpoint='http://node'):
	session = FakeSession(outcomes)
	tcp_connector = RecordingTcpConnector(connection_limit)

	def tcp_factory(**_):
		return tcp_connector

	session_factory = RecordingFactory(session)
	connector = SymbolPullerConnector(
		endpoint,
		timeout_seconds,
		connection_limit,
		session_factory=session_factory,
		tcp_connector_factory=tcp_factory)
	return connector, session, tcp_connector, session_factory


def _create_connector_with_close_error(close_error, cleanup_logger):
	session = FakeSession([], close_error=close_error)
	connector = SymbolPullerConnector(
		'http://node',
		13,
		100,
		session_factory=RecordingFactory(session),
		tcp_connector_factory=lambda **_: RecordingTcpConnector(100),
		cleanup_logger=cleanup_logger)
	return connector, session


async def test_reuses_one_session_for_serial_get_requests():
	# Arrange:
	connector, session, _, session_factory = _create_connector([
		FakeResponse({'value': 1}),
		FakeResponse({'value': 2})
	])

	async with connector as opened_connector:
		# Act:
		responses = [await connector.get('first'), await connector.get('second')]

	# Assert:
	assert [{'value': 1}, {'value': 2}] == responses
	assert connector is opened_connector
	assert 1 == len(session_factory.calls)
	assert 2 == len(session.calls)
	assert 1 == session.close_call_count


async def test_context_preserves_body_error_when_close_succeeds():
	# Arrange:
	body_error = ValueError('body failed')
	connector, session, _, _ = _create_connector([])

	# Act:
	with pytest.raises(ValueError) as exception_info:
		async with connector:
			raise body_error

	# Assert:
	assert body_error is exception_info.value
	assert 1 == session.close_call_count


async def test_context_preserves_body_error_and_logs_close_failure():
	# Arrange:
	body_error = ValueError('body failed')
	close_error = RuntimeError('close failed')
	cleanup_logger = RecordingCleanupLogger()
	connector, session = _create_connector_with_close_error(close_error, cleanup_logger)

	# Act:
	with pytest.raises(ValueError) as exception_info:
		async with connector:
			raise body_error

	# Assert:
	assert body_error is exception_info.value
	assert 1 == session.close_call_count
	assert ['Failed to close Symbol puller connector after context failure: close failed'] == cleanup_logger.messages
	with pytest.raises(SymbolPullerConnectorStateError, match='closed state'):
		await connector.open()
	with pytest.raises(SymbolPullerConnectorStateError, match='closed state'):
		await connector.get('after-close')


async def test_context_preserves_body_error_when_cleanup_logging_fails():
	# Arrange:
	body_error = ValueError('body failed')
	close_error = RuntimeError('close failed')
	logging_error = RuntimeError('logging failed')
	cleanup_logger = RecordingCleanupLogger(logging_error)
	connector, session = _create_connector_with_close_error(close_error, cleanup_logger)

	# Act:
	with pytest.raises(ValueError) as exception_info:
		async with connector:
			raise body_error

	# Assert:
	assert body_error is exception_info.value
	assert 1 == session.close_call_count
	assert ['Failed to close Symbol puller connector after context failure: close failed'] == cleanup_logger.messages


async def test_context_propagates_close_error_when_body_succeeds():
	# Arrange:
	close_error = RuntimeError('close failed')
	cleanup_logger = RecordingCleanupLogger()
	connector, session = _create_connector_with_close_error(close_error, cleanup_logger)

	# Act:
	with pytest.raises(RuntimeError) as exception_info:
		async with connector:
			pass

	# Assert:
	assert close_error is exception_info.value
	assert 1 == session.close_call_count


async def test_context_preserves_body_cancellation_when_close_fails():
	# Arrange:
	cancellation_error = asyncio.CancelledError()
	close_error = RuntimeError('close failed')
	cleanup_logger = RecordingCleanupLogger()
	connector, session = _create_connector_with_close_error(close_error, cleanup_logger)

	# Act:
	with pytest.raises(asyncio.CancelledError) as exception_info:
		async with connector:
			raise cancellation_error

	# Assert:
	assert cancellation_error is exception_info.value
	assert 1 == session.close_call_count
	assert ['Failed to close Symbol puller connector after context failure: close failed'] == cleanup_logger.messages


async def test_context_propagates_close_control_flow_after_body_error():
	# Arrange:
	body_error = RuntimeError('body failed')
	close_error = KeyboardInterrupt('close interrupted')
	connector, session = _create_connector_with_close_error(close_error, RecordingCleanupLogger())

	# Act:
	with pytest.raises(KeyboardInterrupt) as exception_info:
		async with connector:
			raise body_error

	# Assert:
	assert close_error is exception_info.value
	assert body_error is exception_info.value.__context__
	assert 1 == session.close_call_count


async def test_context_preserves_body_cancellation_over_close_control_flow():
	# Arrange:
	body_error = asyncio.CancelledError('body cancelled')
	close_error = KeyboardInterrupt('close interrupted')
	connector, session = _create_connector_with_close_error(close_error, RecordingCleanupLogger())

	# Act:
	with pytest.raises(asyncio.CancelledError) as exception_info:
		async with connector:
			raise body_error

	# Assert:
	assert body_error is exception_info.value
	assert 1 == session.close_call_count


async def test_context_propagates_cancellation_received_during_failed_close():
	# Arrange:
	session = FakeSession([], close_error=RuntimeError('close failed'), close_event=asyncio.Event())
	tcp_connector = RecordingTcpConnector(100)
	connector = SymbolPullerConnector(
		'http://node',
		13,
		100,
		session_factory=RecordingFactory(session),
		tcp_connector_factory=lambda **_: tcp_connector)

	async def run_context():
		async with connector:
			raise ValueError('body failed')

	context_task = asyncio.create_task(run_context())
	await session.close_started.wait()

	# Act:
	try:
		context_task.cancel()
		session.allow_close.set()
		with pytest.raises(asyncio.CancelledError):
			await context_task
	finally:
		session.allow_close.set()
		if not context_task.done():
			context_task.cancel()
		try:
			await context_task
		except BaseException:  # pylint: disable=broad-exception-caught
			pass

	# Assert:
	assert context_task.cancelled()
	assert 1 == session.close_call_count
	assert 1 == tcp_connector.close_call_count
	with pytest.raises(SymbolPullerConnectorStateError, match='closed state'):
		await connector.open()


async def test_open_after_open_reuses_existing_session():
	# Arrange:
	connector, session, _, session_factory = _create_connector([])

	# Act:
	await asyncio.gather(connector.open(), connector.open())
	try:
		session_creation_count = len(session_factory.calls)
	finally:
		await connector.close()

	# Assert:
	assert 1 == session_creation_count
	assert 1 == session.close_call_count


async def test_posts_json_payload_through_session():
	# Arrange:
	connector, session, _, _ = _create_connector([FakeResponse({'accepted': True})])

	async with connector:
		# Act:
		response = await connector.post('transactions', {'id': 2})

	# Assert:
	assert {'accepted': True} == response
	assert [('POST', 'http://node/transactions')] == [(method, url) for method, url, _ in session.calls]
	assert {'id': 2} == session.calls[0][2]['json']


async def test_configures_timeout_and_pool_limit_at_session_creation():
	# Arrange:
	tcp_connector = RecordingTcpConnector(7)
	tcp_connector_factory = RecordingFactory(tcp_connector)
	session_factory = RecordingFactory(FakeSession([]))
	connector = SymbolPullerConnector(
		'http://node',
		13,
		100,
		session_factory=session_factory,
		tcp_connector_factory=tcp_connector_factory)

	# Act:
	try:
		await connector.open()
	finally:
		await connector.close()

	# Assert:
	assert 1 == len(tcp_connector_factory.calls)
	assert {'limit': 100} == tcp_connector_factory.calls[0]
	assert 1 == len(session_factory.calls)
	assert 13 == session_factory.calls[0]['timeout'].total
	assert tcp_connector is session_factory.calls[0]['connector']


async def test_close_from_new_does_not_create_or_close_session():
	# Arrange:
	connector, session, _, session_factory = _create_connector([])

	# Act:
	await connector.close()

	# Assert:
	assert 0 == session.close_call_count
	assert 0 == len(session_factory.calls)


async def test_close_after_open_is_idempotent():
	# Arrange:
	connector, session, _, _ = _create_connector([])
	await connector.open()

	# Act:
	await connector.close()
	await connector.close()

	# Assert:
	assert 1 == session.close_call_count


async def test_open_after_close_is_rejected():
	# Arrange:
	connector, _, _, _ = _create_connector([])
	await connector.close()

	# Act:
	with pytest.raises(SymbolPullerConnectorStateError) as exception_info:
		await connector.open()

	# Assert:
	assert 'Cannot open SymbolPullerConnector in closed state' == str(exception_info.value)


async def test_request_after_close_is_rejected():
	# Arrange:
	connector, _, _, _ = _create_connector([])
	await connector.close()

	# Act:
	with pytest.raises(SymbolPullerConnectorStateError) as exception_info:
		await connector.get('after-close')

	# Assert:
	assert 'Cannot request from SymbolPullerConnector in closed state' == str(exception_info.value)


async def test_request_from_new_is_rejected():
	# Arrange:
	connector, _, _, _ = _create_connector([])

	# Act:
	with pytest.raises(SymbolPullerConnectorStateError) as exception_info:
		await connector.get('before-open')

	# Assert:
	assert 'Cannot request from SymbolPullerConnector in new state' == str(exception_info.value)


async def test_request_during_closing_is_rejected():
	# Arrange:
	response = BlockingResponse()
	connector, _, _, _ = _create_connector([response])
	await connector.open()
	request_task = asyncio.create_task(connector.get('active'))
	await response.entered.wait()

	# Act:
	close_task = asyncio.create_task(connector.close())
	new_request_task = asyncio.create_task(connector.get('new'))
	try:
		with pytest.raises(SymbolPullerConnectorStateError) as exception_info:
			await new_request_task
		response.allow_exit.set()
		active_response = await request_task
		await close_task
	finally:
		response.allow_exit.set()
		await asyncio.gather(request_task, close_task, return_exceptions=True)

	# Assert:
	assert 'Cannot request from SymbolPullerConnector in closing state' == str(exception_info.value)
	assert {'ok': True} == active_response


async def test_open_during_closing_is_rejected_while_active_request_completes():
	# Arrange:
	response = BlockingResponse()
	connector, session, _, _ = _create_connector([response])
	await connector.open()
	request_task = asyncio.create_task(connector.get('active'))
	await response.entered.wait()

	# Act:
	close_task = asyncio.create_task(connector.close())
	open_task = asyncio.create_task(connector.open())
	try:
		with pytest.raises(SymbolPullerConnectorStateError) as exception_info:
			await open_task
		response.allow_exit.set()
		active_response = await request_task
		await close_task
	finally:
		response.allow_exit.set()
		await asyncio.gather(request_task, close_task, return_exceptions=True)

	# Assert:
	assert 'Cannot open SymbolPullerConnector in closing state' == str(exception_info.value)
	assert {'ok': True} == active_response
	assert 1 == session.close_call_count


async def test_close_waits_for_all_active_requests_before_closing_session():
	# Arrange:
	responses = [BlockingResponse(), BlockingResponse()]
	connector, session, _, _ = _create_connector(responses)
	await connector.open()
	request_tasks = [asyncio.create_task(connector.get(f'active-{index}')) for index in range(2)]
	await asyncio.gather(*(response.entered.wait() for response in responses))

	# Act:
	close_task = asyncio.create_task(connector.close())
	try:
		responses[0].allow_exit.set()
		first_response = await request_tasks[0]
		close_started_after_first_response = session.close_started.is_set()
		responses[1].allow_exit.set()
		second_response = await request_tasks[1]
		await close_task
	finally:
		for response in responses:
			response.allow_exit.set()
		await asyncio.gather(*request_tasks, close_task, return_exceptions=True)

	# Assert:
	assert {'ok': True} == first_response
	assert {'ok': True} == second_response
	assert close_started_after_first_response is False
	assert 1 == session.close_call_count


async def test_concurrent_close_calls_close_session_once():
	# Arrange:
	connector, session, _, _ = _create_connector([])
	await connector.open()

	# Act:
	await asyncio.gather(connector.close(), connector.close())

	# Assert:
	assert 1 == session.close_call_count


async def test_cancelled_close_completes_actual_close_and_re_raises_cancellation():
	# Arrange:
	session = FakeSession([], close_event=asyncio.Event())
	tcp_connector = RecordingTcpConnector(100)
	connector = SymbolPullerConnector(
		'http://node',
		13,
		100,
		session_factory=RecordingFactory(session),
		tcp_connector_factory=lambda **_: tcp_connector)
	await connector.open()
	close_task = asyncio.create_task(connector.close())
	await session.close_started.wait()

	# Act:
	close_task.cancel()
	session.allow_close.set()
	with pytest.raises(asyncio.CancelledError):
		await close_task

	# Assert:
	assert 1 == session.close_call_count


async def test_cancelled_close_consumes_close_failure_and_re_raises_cancellation():
	# Arrange:
	session = FakeSession([], close_error=RuntimeError('close failed'), close_event=asyncio.Event())
	tcp_connector = RecordingTcpConnector(100)
	connector = SymbolPullerConnector(
		'http://node',
		13,
		100,
		session_factory=RecordingFactory(session),
		tcp_connector_factory=lambda **_: tcp_connector)
	await connector.open()
	close_task = asyncio.create_task(connector.close())
	await session.close_started.wait()

	# Act:
	close_task.cancel()
	session.allow_close.set()
	with pytest.raises(asyncio.CancelledError):
		await close_task

	# Assert:
	assert 1 == session.close_call_count


async def test_maps_timeout_error_to_node_exception():
	# Arrange:
	connector, _, _, _ = _create_connector([asyncio.TimeoutError()])

	async with connector:
		# Act:
		with pytest.raises(NodeException) as exception_info:
			await connector.get('timeout')

	# Assert:
	assert isinstance(exception_info.value.__cause__, asyncio.TimeoutError)


@pytest.mark.parametrize('connection_error', [
	client_exceptions.ClientConnectorError(None, OSError('connection failed')),
	client_exceptions.ServerDisconnectedError(),
	client_exceptions.ClientOSError(1, 'connection failed'),
	client_exceptions.ClientConnectionResetError('connection reset')
])
async def test_maps_connection_error_to_node_exception(connection_error):
	# Arrange:
	connector, _, _, _ = _create_connector([connection_error])

	async with connector:
		# Act:
		with pytest.raises(NodeException) as exception_info:
			await connector.get('connection-error')

	# Assert:
	assert connection_error is exception_info.value.__cause__


async def test_does_not_map_payload_error_to_node_exception():
	# Arrange:
	payload_error = client_exceptions.ClientPayloadError('invalid payload')
	connector, _, _, _ = _create_connector([FakeResponse(json_error=payload_error)])

	async with connector:
		# Act:
		with pytest.raises(client_exceptions.ClientPayloadError) as exception_info:
			await connector.get('invalid-payload')

	# Assert:
	assert payload_error is exception_info.value


async def test_maps_json_decode_error_to_node_exception():
	# Arrange:
	json_error = json.JSONDecodeError('invalid', '', 0)
	connector, _, _, _ = _create_connector([FakeResponse(json_error=json_error)])

	async with connector:
		# Act:
		with pytest.raises(NodeException) as exception_info:
			await connector.get('invalid-json')

	# Assert:
	assert json_error is exception_info.value.__cause__


async def test_maps_http_500_to_http_exception_with_full_error():
	# Arrange:
	connector, _, _, _ = _create_connector([FakeResponse({'code': 'Failure', 'message': 'failed'}, status=500)])

	async with connector:
		# Act:
		await _assert_http_exception(
			connector,
			'failure',
			500,
			'HTTP request failed with code 500\nFailure\nfailed')


async def test_maps_404_to_http_exception_by_default():
	# Arrange:
	connector, _, _, _ = _create_connector([FakeResponse({'code': 'ResourceNotFound', 'message': 'missing'}, status=404)])

	async with connector:
		# Act:
		await _assert_http_exception(
			connector,
			'missing',
			404,
			'HTTP request failed with code 404\nResourceNotFound\nmissing')


async def test_returns_resource_not_found_json_when_not_found_is_allowed():
	# Arrange:
	response_json = {'code': 'ResourceNotFound', 'message': 'missing'}
	connector, _, _, _ = _create_connector([FakeResponse(response_json, status=404)])

	async with connector:
		# Act:
		response = await connector.get('missing', not_found_as_error=False)

	# Assert:
	assert response_json == response


async def test_maps_http_error_without_optional_keys():
	# Arrange:
	connector, _, _, _ = _create_connector([FakeResponse({'status': 'failed'}, status=401)])

	async with connector:
		# Act:
		await _assert_http_exception(connector, 'unauthorized', 401, 'HTTP request failed with code 401')


async def test_extracts_named_property_from_successful_response():
	# Arrange:
	connector, _, _, _ = _create_connector([FakeResponse({'value': 3, 'other': 4})])

	async with connector:
		# Act:
		response = await connector.get('value', property_name='value')

	# Assert:
	assert 3 == response


async def test_reuses_same_session_after_server_disconnected_error():
	# Arrange:
	disconnect_error = client_exceptions.ServerDisconnectedError()
	connector, session, _, session_factory = _create_connector([
		disconnect_error,
		FakeResponse({'ok': True})
	])

	async with connector:
		# Act:
		with pytest.raises(NodeException) as exception_info:
			await connector.get('first')
		second_response = await connector.get('second')

	# Assert:
	assert disconnect_error is exception_info.value.__cause__
	assert {'ok': True} == second_response
	assert 1 == len(session_factory.calls)
	assert 2 == len(session.calls)


async def test_close_failure_leaves_connector_closed():
	# Arrange:
	session = FakeSession([], close_error=RuntimeError('close failed'))
	tcp_connector = RecordingTcpConnector(100)
	connector = SymbolPullerConnector(
		'http://node',
		13,
		100,
		session_factory=RecordingFactory(session),
		tcp_connector_factory=lambda **_: tcp_connector)
	await connector.open()

	# Act:
	with pytest.raises(RuntimeError, match='close failed'):
		await connector.close()

	# Assert:
	assert 1 == session.close_call_count
	assert 1 == tcp_connector.close_call_count
	with pytest.raises(SymbolPullerConnectorStateError, match='closed state'):
		await connector.open()


async def test_close_failure_preserves_session_error_when_pool_close_fails():
	# Arrange:
	session = FakeSession([], close_error=RuntimeError('session close failed'))
	tcp_connector = RecordingTcpConnector(100, close_error=RuntimeError('pool close failed'))
	connector = SymbolPullerConnector(
		'http://node',
		13,
		100,
		session_factory=RecordingFactory(session),
		tcp_connector_factory=lambda **_: tcp_connector)
	await connector.open()

	# Act:
	with pytest.raises(RuntimeError) as exception_info:
		await connector.close()

	# Assert:
	assert 'session close failed' == str(exception_info.value)
	assert 1 == session.close_call_count
	assert 1 == tcp_connector.close_call_count


async def test_close_failure_does_not_replace_pool_cleanup_cancellation():
	# Arrange:
	session = FakeSession([], close_error=RuntimeError('session close failed'))
	tcp_connector = RecordingTcpConnector(100, close_error=asyncio.CancelledError())
	connector = SymbolPullerConnector(
		'http://node',
		13,
		100,
		session_factory=RecordingFactory(session),
		tcp_connector_factory=lambda **_: tcp_connector)
	await connector.open()

	# Act:
	with pytest.raises(asyncio.CancelledError):
		await connector.close()

	# Assert:
	assert 1 == session.close_call_count
	assert 1 == tcp_connector.close_call_count


async def test_session_factory_failure_closes_created_pool_and_connector():
	# Arrange:
	tcp_connector = RecordingTcpConnector(100)

	connector = SymbolPullerConnector(
		'http://node',
		13,
		100,
		session_factory=_failing_session_factory,
		tcp_connector_factory=lambda **_: tcp_connector)

	# Act:
	with pytest.raises(RuntimeError) as exception_info:
		await connector.open()
	with pytest.raises(SymbolPullerConnectorStateError) as state_exception_info:
		await connector.open()

	# Assert:
	assert 'session factory failed' == str(exception_info.value)
	assert 1 == tcp_connector.close_call_count
	assert 'Cannot open SymbolPullerConnector in closed state' == str(state_exception_info.value)


async def test_tcp_connector_factory_failure_preserves_error_without_creating_session_and_closes_connector():
	# Arrange:
	session_factory = RecordingFactory(FakeSession([]))

	connector = SymbolPullerConnector(
		'http://node',
		13,
		100,
		session_factory=session_factory,
		tcp_connector_factory=_failing_tcp_connector_factory)

	# Act:
	with pytest.raises(RuntimeError) as exception_info:
		await connector.open()
	with pytest.raises(SymbolPullerConnectorStateError) as state_exception_info:
		await connector.open()

	# Assert:
	assert 'tcp connector factory failed' == str(exception_info.value)
	assert 0 == len(session_factory.calls)
	assert 'Cannot open SymbolPullerConnector in closed state' == str(state_exception_info.value)


async def test_session_factory_failure_preserves_error_when_pool_close_fails():
	# Arrange:
	tcp_connector = RecordingTcpConnector(100, close_error=RuntimeError('pool close failed'))
	connector = SymbolPullerConnector(
		'http://node',
		13,
		100,
		session_factory=_failing_session_factory,
		tcp_connector_factory=lambda **_: tcp_connector)

	# Act:
	with pytest.raises(RuntimeError) as exception_info:
		await connector.open()

	# Assert:
	assert 'session factory failed' == str(exception_info.value)
	assert 1 == tcp_connector.close_call_count


async def test_session_factory_failure_does_not_replace_pool_cleanup_cancellation():
	# Arrange:
	tcp_connector = RecordingTcpConnector(100, close_error=asyncio.CancelledError())
	connector = SymbolPullerConnector(
		'http://node',
		13,
		100,
		session_factory=_failing_session_factory,
		tcp_connector_factory=lambda **_: tcp_connector)

	# Act:
	with pytest.raises(asyncio.CancelledError):
		await connector.open()

	# Assert:
	assert 1 == tcp_connector.close_call_count


@pytest.fixture(name='symbol_connector_http_server')
async def fixture_symbol_connector_http_server(aiohttp_client):
	transports = []

	async def handler(request):
		transports.append(request.transport)
		return web.json_response({'request': len(transports)})

	async def close_once_handler(request):
		transports.append(request.transport)
		response = web.json_response({'request': len(transports)})
		if 1 == len(transports):
			response.force_close()
		return response

	async def non_json_handler(_):
		return web.Response(text='not-json', content_type='text/plain')

	app = web.Application()
	app.router.add_get('/value', handler)
	app.router.add_get('/close-once', close_once_handler)
	app.router.add_get('/not-json', non_json_handler)
	client = await aiohttp_client(app)
	return SymbolConnectorHttpServer(client, transports)


async def test_maps_non_json_response_to_node_exception(symbol_connector_http_server):
	# Arrange:
	connector = SymbolPullerConnector(symbol_connector_http_server.client.make_url(''), 13, 100)
	await connector.open()

	# Act:
	try:
		with pytest.raises(NodeException) as exception_info:
			await connector.get('not-json')
	finally:
		await connector.close()

	# Assert:
	assert isinstance(exception_info.value.__cause__, client_exceptions.ContentTypeError)


async def test_serial_requests_reuse_one_tcp_transport(symbol_connector_http_server):
	# Arrange:
	connector = SymbolPullerConnector(symbol_connector_http_server.client.make_url(''), 13, 100)
	await connector.open()

	# Act:
	try:
		responses = [await connector.get('value'), await connector.get('value')]
	finally:
		await connector.close()

	# Assert:
	assert [{'request': 1}, {'request': 2}] == responses
	assert 2 == len(symbol_connector_http_server.transports)
	assert symbol_connector_http_server.transports[0] is symbol_connector_http_server.transports[1]


async def test_reconnects_after_server_closes_first_transport(symbol_connector_http_server):
	# Arrange:
	connector = SymbolPullerConnector(
		symbol_connector_http_server.client.make_url(''),
		13,
		100)
	await connector.open()

	# Act:
	try:
		responses = [await connector.get('close-once'), await connector.get('close-once')]
	finally:
		await connector.close()

	# Assert:
	assert [{'request': 1}, {'request': 2}] == responses
	assert 2 == len(symbol_connector_http_server.transports)
	assert symbol_connector_http_server.transports[0] is not symbol_connector_http_server.transports[1]
