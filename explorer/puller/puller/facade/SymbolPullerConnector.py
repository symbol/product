import asyncio
import inspect
import json
from enum import Enum

from aiohttp import ClientSession, ClientTimeout, TCPConnector, client_exceptions
from symbollightapi.model.Exceptions import HttpException, NodeException


class SymbolPullerConnectorState(Enum):
	"""States in the lifetime of a Symbol puller HTTP connector."""

	NEW = 'new'
	OPEN = 'open'
	CLOSING = 'closing'
	CLOSED = 'closed'


class SymbolPullerConnectorStateError(RuntimeError):
	"""Raised when a connector operation is invalid for its current state."""


class SymbolPullerConnector:  # pylint: disable=too-many-instance-attributes
	"""Small, Puller-owned HTTP connector with one reusable aiohttp session."""

	def __init__(
		self,
		endpoint,
		timeout_seconds,
		connection_limit,
		session_factory=ClientSession,
		tcp_connector_factory=TCPConnector
	):
		"""Creates an unopened connector and stores its HTTP factory configuration."""

		self.endpoint = endpoint
		self.timeout_seconds = timeout_seconds
		self.connection_limit = connection_limit
		self._session_factory = session_factory
		self._tcp_connector_factory = tcp_connector_factory
		self._state = SymbolPullerConnectorState.NEW
		self._session = None
		self._state_lock = asyncio.Lock()
		self._close_task = None
		self._active_requests = 0
		self._idle_event = asyncio.Event()
		self._idle_event.set()

	@property
	def state(self):
		"""Returns the current lifecycle state."""

		return self._state

	async def open(self):
		"""Opens one session, or waits harmlessly when it is already open."""

		async with self._state_lock:
			if SymbolPullerConnectorState.OPEN == self._state:
				return
			if SymbolPullerConnectorState.NEW != self._state:
				raise SymbolPullerConnectorStateError(
					f'Cannot open SymbolPullerConnector in {self._state.value} state')

			try:
				tcp_connector = self._tcp_connector_factory(limit=self.connection_limit)
				self._session = self._session_factory(
					timeout=ClientTimeout(total=self.timeout_seconds),
					connector=tcp_connector)
			except BaseException:  # pylint: disable=broad-exception-caught
				self._state = SymbolPullerConnectorState.CLOSED
				if 'tcp_connector' in locals():
					try:
						await self._close_created_connector(tcp_connector)
					except BaseException:  # pylint: disable=broad-exception-caught
						# Preserve the session factory failure as the setup result.
						pass
				raise

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
				close_task = asyncio.create_task(self._finish_close())
				self._close_task = close_task

		try:
			await asyncio.shield(close_task)
		except asyncio.CancelledError:
			try:
				await asyncio.shield(close_task)
			except BaseException:  # pylint: disable=broad-exception-caught
				# The cancellation remains the caller-visible result; the close task is consumed.
				pass
			raise

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
					f'{str(self.endpoint).rstrip("/")}/{url_path.lstrip("/")}',
					timeout=ClientTimeout(total=self.timeout_seconds),
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
			await self._session.close()
		finally:
			async with self._state_lock:
				self._session = None
				self._state = SymbolPullerConnectorState.CLOSED

	@staticmethod
	async def _close_created_connector(connector):
		close = getattr(connector, 'close', None)
		if close is None:
			return

		close_result = close()
		if inspect.isawaitable(close_result):
			await close_result
