import asyncio
import json

from aiohttp import ClientSession, ClientTimeout, TCPConnector, client_exceptions
from symbollightapi.connector.NemConnector import NemConnector
from symbollightapi.model.Exceptions import HttpException, NodeException

DEFAULT_CONNECTION_LIMIT = 64


class PooledNemConnector(NemConnector):
	"""
	NEM connector that reuses a keep-alive session per event loop.

	The base connector opens (and tears down) a ClientSession, and with it a TCP connection, for every
	single request. During a sync that is hundreds of thousands of connection handshakes.
	"""

	def __init__(self, endpoint, network=None, connection_limit=DEFAULT_CONNECTION_LIMIT):
		"""Creates a connector around an endpoint."""

		super().__init__(endpoint, network)

		self.connection_limit = connection_limit
		self._sessions = {}

	def _session(self):
		"""Gets, creating it if needed, the keep-alive session bound to the running event loop."""

		loop = asyncio.get_running_loop()
		session = self._sessions.get(loop)
		if session is None or session.closed:
			session = ClientSession(
				timeout=ClientTimeout(total=self.timeout_seconds),
				connector=TCPConnector(limit=self.connection_limit))
			self._sessions[loop] = session

		return session

	async def close(self):
		"""Closes the session belonging to the running event loop."""

		session = self._sessions.pop(asyncio.get_running_loop(), None)
		if session is not None and not session.closed:
			await session.close()

	async def _dispatch(self, action, url_path, property_name, not_found_as_error, **kwargs):
		session = self._session()

		try:
			async with getattr(session, action)(f'{self.endpoint}/{url_path}', **kwargs) as response:
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
		except (asyncio.TimeoutError, client_exceptions.ClientConnectorError) as ex:
			raise NodeException from ex
