import asyncio
import json

from aiohttp import ClientSession, ClientTimeout, client_exceptions


class NodeException(Exception):
	"""Exception raised when there is an error communicating with a node."""


class BasicClient:
	"""Async client for connecting to a node."""

	def __init__(self, endpoint):
		"""Creates a client around an endpoint."""

		self.endpoint = endpoint
		self.timeout_seconds = None

	async def get(self, url_path, property_name=None):
		"""
		Initiates a GET to the specified path and returns the desired property.
		Raises NodeException on connection or content failure.
		"""

		try:
			timeout = ClientTimeout(total=self.timeout_seconds)
			async with ClientSession(timeout=timeout) as session:
				async with session.get(f'{self.endpoint}/{url_path}') as response:
					try:
						response_json = await response.json()
					except (client_exceptions.ContentTypeError, json.decoder.JSONDecodeError) as ex:
						raise NodeException from ex

					return response_json if property_name is None else response_json[property_name]
		except (asyncio.TimeoutError, client_exceptions.ClientConnectorError) as ex:
			raise NodeException from ex
