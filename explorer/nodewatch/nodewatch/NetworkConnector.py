import asyncio

import aiohttp
from zenlog import log


class NetworkConnector:
	"""Connects to NEM or Symbol networks."""

	def __init__(self, network_name, max_batch_size=100):
		"""Creates a connector."""

		self.network_name = network_name
		self.max_batch_size = max_batch_size
		self.url_pattern = '{}/chain/height' if self.is_nem else '{}/chain/info'

	@property
	def is_nem(self):
		"""True if the connector is initialized for NEM, False otherwise."""

		return 'nem' == self.network_name

	async def update_heights(self, descriptors):
		"""Updates heights in all specified descriptors."""

		# connector only supports connecting to nodes using the API but not the P2P interface
		descriptors = [descriptor for descriptor in descriptors if descriptor.has_api]

		log.info(f'updating heights from {len(descriptors)} nodes for {self.network_name} network')

		start_index = 0
		while start_index < len(descriptors):
			await self._update_heights_async(descriptors[start_index:start_index + self.max_batch_size])
			start_index += self.max_batch_size

		log.info(f'done updating heights from {len(descriptors)} nodes for {self.network_name} network')

	async def _update_heights_async(self, descriptors):
		endpoints = [descriptor.endpoint for descriptor in descriptors]

		log.debug(f'querying height from {len(endpoints)} endpoints for {self.network_name} network')

		async with aiohttp.ClientSession() as session:
			tasks = [
				asyncio.ensure_future(self._update_height(session, descriptor)) for descriptor in descriptors
			]
			results = await asyncio.gather(*tasks)

			num_failures = sum(1 for result in results if not result)
			if num_failures:
				log.warning(f'{num_failures}/{len(endpoints)} height queries failed for {self.network_name} network')

	async def _update_height(self, session, descriptor):
		if not descriptor.endpoint:
			print(f'skipping node "{descriptor.name}" with unknown endpoint')
			return False

		url = self.url_pattern.format(descriptor.endpoint)

		try:
			async with session.get(url, timeout=5) as response:
				response_json = await response.json()
				if 'height' in response_json:
					descriptor.height = int(response_json['height'])

				if 'finalized_height' in response_json:
					descriptor.finalized_height = int(response_json['finalized_height'])
		except (aiohttp.client_exceptions.ClientConnectorError, asyncio.TimeoutError) as ex:
			log.warning(f'failed retrieving height from endpoint "{descriptor.endpoint}"\n{ex}')
			return False

		return True
