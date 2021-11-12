import asyncio
import json
import random

import aiohttp
from zenlog import log

NUM_HEIGHT_SAMPLES = 5


class NetworkConnector:
    def __init__(self, network_name):
        self.network_name = network_name

    def get_height(self, descriptors):
        if 'nem' == self.network_name:
            url_pattern = '{}/chain/height'
        else:
            url_pattern = '{}/chain/info'
            descriptors = [descriptor for descriptor in descriptors if descriptor.endpoint.endswith(':3000')]

        height_future = self._get_height_estimate(url_pattern, descriptors)
        height = asyncio.run(height_future)
        return json.dumps({'height': height})

    @staticmethod
    async def _get_height_estimate(url_pattern, descriptors):
        endpoints = [descriptor.endpoint for descriptor in random.choices(descriptors, k=NUM_HEIGHT_SAMPLES)]

        log.debug('querying height from endpoints {{{}}}'.format(', '.join(endpoints)))

        async with aiohttp.ClientSession() as session:
            tasks = [asyncio.ensure_future(NetworkConnector._get_height(session, url_pattern.format(endpoint))) for endpoint in endpoints]
            heights = await asyncio.gather(*tasks)

        # calculate median
        heights.sort()
        log.debug('retrieved heights {{{}}}'.format(', '.join(str(height) for height in heights)))

        return heights[len(heights) // 2]

    @staticmethod
    async def _get_height(session, url):
        async with session.get(url) as response:
            response_json = await response.json()
            return int(response_json['height'])
