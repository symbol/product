import asyncio
import json
from enum import Enum

from aiohttp import ClientSession, ClientTimeout, TCPConnector, client_exceptions
from symbollightapi.model.Exceptions import HttpException, NodeException
from zenlog import log

from puller.facade.async_utils import log_cleanup_failure_safely, select_exception_by_priority


class SymbolPullerConnectorState(Enum):
	"""States in the lifetime of a Symbol puller HTTP connector."""

	NEW = 'new'
	OPEN = 'open'
	CLOSING = 'closing'
	CLOSED = 'closed'


class SymbolPullerConnectorStateError(RuntimeError):
	"""Raised when a connector operation is invalid for its current state."""


class SymbolPullerConnector:  # pylint: disable=too-many-instance-attributes
	"""One-shot HTTP connector that reuses one aiohttp session until it is closed."""

	def __init__(  # pylint: disable=too-many-arguments,too-many-positional-arguments
		self,
		endpoint,
		timeout_seconds,
		connection_limit,
		session_factory=ClientSession,
		tcp_connector_factory=TCPConnector,
		cleanup_logger=log
	):
		"""Creates an unopened connector and stores its HTTP factory configuration."""

		self.endpoint = endpoint
		self._timeout_seconds = timeout_seconds
		self.connection_limit = connection_limit
		self._session_factory = session_factory
		self._tcp_connector_factory = tcp_connector_factory
		self._cleanup_logger = cleanup_logger
		self._state = SymbolPullerConnectorState.NEW
		self._session = None
		self._tcp_connector = None
		self._state_lock = asyncio.Lock()
		self._close_task = None
		self._active_requests = 0
		self._idle_event = asyncio.Event()
		self._idle_event.set()

	async def __aenter__(self):
		"""Opens this connector and returns it for one async context lifecycle."""

		await self.open()
		return self

	async def __aexit__(self, exc_type, exc_value, traceback):
		"""Closes this connector without replacing a context body failure."""

		try:
			await self.close()
		except BaseException as cleanup_error:  # pylint: disable=broad-exception-caught
			selected_error = select_exception_by_priority(exc_value, cleanup_error)
			if selected_error is cleanup_error:
				raise cleanup_error
			if not isinstance(cleanup_error, (asyncio.CancelledError, KeyboardInterrupt, SystemExit)):
				log_cleanup_failure_safely(
					self._cleanup_logger,
					f'Failed to close Symbol puller connector after context failure: {cleanup_error}')
		return False

	async def open(self):
		"""Opens one session, or waits harmlessly when it is already open."""

		async with self._state_lock:
			if SymbolPullerConnectorState.OPEN == self._state:
				return
			if SymbolPullerConnectorState.NEW != self._state:
				raise SymbolPullerConnectorStateError(
					f'Cannot open SymbolPullerConnector in {self._state.value} state')

			tcp_connector = None
			try:
				tcp_connector = self._tcp_connector_factory(limit=self.connection_limit)
				session = self._session_factory(
					timeout=ClientTimeout(total=self._timeout_seconds),
					connector=tcp_connector)
			except BaseException as setup_error:  # pylint: disable=broad-exception-caught
				self._state = SymbolPullerConnectorState.CLOSED
				if tcp_connector is not None:
					try:
						await self._close_created_connector(tcp_connector)
					except BaseException as cleanup_error:  # pylint: disable=broad-exception-caught
						selected_error = select_exception_by_priority(setup_error, cleanup_error)
						if selected_error is cleanup_error:
							raise cleanup_error
						if isinstance(cleanup_error, (asyncio.CancelledError, KeyboardInterrupt, SystemExit)):
							raise setup_error from cleanup_error
				raise

			self._tcp_connector = tcp_connector
			self._session = session
			self._state = SymbolPullerConnectorState.OPEN

	async def close(self):
		"""Stops new requests and completes one idempotent session close operation."""

		async with self._state_lock:
			if SymbolPullerConnectorState.NEW == self._state:
				self._state = SymbolPullerConnectorState.CLOSED
				return
			if SymbolPullerConnectorState.CLOSED == self._state:
				return
			if SymbolPullerConnectorState.CLOSING == self._state:
				close_task = self._close_task
			else:
				self._state = SymbolPullerConnectorState.CLOSING
				close_task = asyncio.create_task(self._finish_close_task())
				self._close_task = close_task

		try:
			close_succeeded, close_error = await asyncio.shield(close_task)
		except asyncio.CancelledError:
			try:
				await asyncio.shield(close_task)
			except BaseException:  # pylint: disable=broad-exception-caught
				# The cancellation remains the caller-visible result; the close task is consumed.
				pass
			raise

		if not close_succeeded:
			raise close_error

	async def get(self, url_path, property_name=None, not_found_as_error=True):
		"""Initiates a GET request and returns its JSON response or selected property."""

		return await self._request('get', url_path, property_name, not_found_as_error)

	async def post(self, url_path, request_payload, property_name=None, not_found_as_error=True):
		"""Initiates a JSON POST request and returns its JSON response or selected property."""

		return await self._request(
			'post',
			url_path,
			property_name,
			not_found_as_error,
			json=request_payload)

	async def _request(self, action, url_path, property_name, not_found_as_error, **kwargs):
		session = await self._begin_request()
		try:
			try:
				request = getattr(session, action)(
					f'{self.endpoint}/{url_path}',
					**kwargs)
				async with request as response:
					try:
						response_json = await response.json()
					except (client_exceptions.ContentTypeError, json.decoder.JSONDecodeError) as ex:
						raise NodeException from ex

					if 400 <= response.status and (404 != response.status or not_found_as_error):
						error_message = f'HTTP request failed with code {response.status}'
						for key in ('code', 'message'):
							if key in response_json:
								error_message += f'\n{response_json[key]}'

						raise HttpException(error_message, response.status)

					return response_json if property_name is None else response_json[property_name]
			except (asyncio.TimeoutError, client_exceptions.ClientConnectionError) as ex:
				raise NodeException from ex
		finally:
			await self._finish_request()

	async def _begin_request(self):
		async with self._state_lock:
			if SymbolPullerConnectorState.OPEN != self._state:
				raise SymbolPullerConnectorStateError(
					f'Cannot request from SymbolPullerConnector in {self._state.value} state')

			self._active_requests += 1
			if 1 == self._active_requests:
				self._idle_event.clear()
			return self._session

	async def _finish_request(self):
		async with self._state_lock:
			self._active_requests -= 1
			if 0 == self._active_requests:
				self._idle_event.set()

	async def _finish_close(self):
		try:
			await self._idle_event.wait()
			try:
				await self._session.close()
			except BaseException as session_error:  # pylint: disable=broad-exception-caught
				try:
					await self._close_created_connector(self._tcp_connector)
				except BaseException as pool_error:  # pylint: disable=broad-exception-caught
					selected_error = select_exception_by_priority(session_error, pool_error)
					if selected_error is pool_error:
						raise pool_error
					if isinstance(session_error, (asyncio.CancelledError, KeyboardInterrupt, SystemExit)) \
						and isinstance(pool_error, (asyncio.CancelledError, KeyboardInterrupt, SystemExit)):
						raise session_error from pool_error
				raise
		finally:
			async with self._state_lock:
				self._session = None
				self._tcp_connector = None
				self._state = SymbolPullerConnectorState.CLOSED

	async def _finish_close_task(self):
		"""Collect control-flow cleanup errors before they cross the task boundary."""

		try:
			await self._finish_close()
		except (asyncio.CancelledError, KeyboardInterrupt, SystemExit) as close_error:
			return False, close_error
		return True, None

	@staticmethod
	async def _close_created_connector(connector):
		await connector.close()
