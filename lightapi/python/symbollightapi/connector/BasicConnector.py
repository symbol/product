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

	def _get_json_headers(self, headers):
		"""Returns headers with Content-Type set to application/json if not already present."""

		headers = headers or {}
		if 'Content-Type' not in headers:
			headers['Content-Type'] = 'application/json'
		return headers

	async def _dispatch(self, action, url_path, property_name, not_found_as_error, **kwargs):
		try:
			timeout = ClientTimeout(total=self.timeout_seconds)
			async with ClientSession(timeout=timeout) as session:
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

						raise NodeException(error_message)

					return response_json if property_name is None else response_json[property_name]
		except (asyncio.TimeoutError, client_exceptions.ClientConnectorError) as ex:
			raise NodeException from ex

	async def get(self, url_path, property_name=None, not_found_as_error=True, headers=None):
		"""
		Initiates a GET to the specified path and returns the desired property.
		Raises NodeException on connection or content failure.
		"""

		return await self._dispatch('get', url_path, property_name, not_found_as_error, headers = headers or {})

	async def post(self, url_path, request_payload, property_name=None, not_found_as_error=True, headers=None):
		"""
		Initiates a POST to the specified path and returns the desired property.
		Raises NodeException on connection or content failure.
		"""

		json_headers = self._get_json_headers(headers)
		return await self._dispatch('post', url_path, property_name, not_found_as_error, data=json.dumps(request_payload), headers=json_headers)

	async def put(self, url_path, request_payload, property_name=None, not_found_as_error=True, headers=None):
		"""
		Initiates a PUT to the specified path and returns the desired property.
		Raises NodeException on connection or content failure.
		"""

		json_headers = self._get_json_headers(headers)
		return await self._dispatch('put', url_path, property_name, not_found_as_error, data=json.dumps(request_payload), headers=json_headers)
