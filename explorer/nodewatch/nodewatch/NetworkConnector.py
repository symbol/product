import asyncio

import aiohttp
from zenlog import log

MAX_BATCH_SIZE = 100


class NetworkConnector:
    def __init__(self, network_name):
        self.network_name = network_name
        self.url_pattern = '{}/chain/height' if self.is_nem else '{}/chain/info'

    @property
    def is_nem(self):
        return 'nem' == self.network_name

    def update_heights(self, descriptors):
        if not self.is_nem:
            descriptors = [descriptor for descriptor in descriptors if descriptor.endpoint.endswith(':3000')]

        log.info(f'updating heights from {len(descriptors)} nodes for {self.network_name} network')

        start_index = 0
        while start_index < len(descriptors):
            asyncio.run(self._update_heights_async(descriptors[start_index:start_index+MAX_BATCH_SIZE]))
            start_index += MAX_BATCH_SIZE

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
