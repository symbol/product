import asyncio
import json

from aiohttp import ClientSession, ClientTimeout, client_exceptions

from ..model.Exceptions import NodeException


class BasicConnector:
	"""Async connector for interacting with a node."""

	def __init__(self, endpoint):
		"""Creates a connector around an endpoint."""

		self.endpoint = endpoint
		self.timeout_seconds = None

	async def _dispatch(self, action, url_path, property_name, **kwargs):
		try:
			timeout = ClientTimeout(total=self.timeout_seconds)
			async with ClientSession(timeout=timeout) as session:
				async with getattr(session, action)(f'{self.endpoint}/{url_path}', **kwargs) as response:
					try:
						response_json = await response.json()
					except (client_exceptions.ContentTypeError, json.decoder.JSONDecodeError) as ex:
						raise NodeException from ex

					return response_json if property_name is None else response_json[property_name]
		except (asyncio.TimeoutError, client_exceptions.ClientConnectorError) as ex:
			raise NodeException from ex

	async def get(self, url_path, property_name=None):
		"""
		Initiates a GET to the specified path and returns the desired property.
		Raises NodeException on connection or content failure.
		"""

		return await self._dispatch('get', url_path, property_name)

	async def put(self, url_path, request_payload, property_name=None):
		"""
		Initiates a PUT to the specified path and returns the desired property.
		Raises NodeException on connection or content failure.
		"""

		return await self._dispatch('put', url_path, property_name, data=json.dumps(request_payload), headers={
			'Content-Type': 'application/json'
		})
