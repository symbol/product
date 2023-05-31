from aiohttp import ClientSession
from zenlog import log

from .HeightGrouping import calculate_finalization_epoch_for_height


class NodewatchClient:
	"""Client for connecting to the nodewatch service."""

	def __init__(self, endpoint):
		"""Creates a nodewatch client."""

		self.endpoint = endpoint

	async def _get_height(self, blockchain):
		async with ClientSession() as session:
			async with session.get(f'{self.endpoint}/api/{blockchain}/height') as response:
				response_json = await response.json()
				return response_json

	async def symbol_finalized_height(self):
		"""Gets current Symbol finalized height."""

		response = await self._get_height('symbol')
		return response['finalizedHeight']


async def get_current_finalization_epoch(nodewatch_endpoint, config_manager):
	"""Calculates the current finalization epoch."""

	nodewatch_client = NodewatchClient(nodewatch_endpoint)
	last_finalized_height = await nodewatch_client.symbol_finalized_height()
	log.info(f'detected last finalized height as {last_finalized_height}')

	voting_set_grouping = int(config_manager.lookup('config-network.properties', [('chain', 'votingSetGrouping')])[0])
	current_finalization_epoch = calculate_finalization_epoch_for_height(last_finalized_height, voting_set_grouping)
	log.info(f'detected current finalization epoch as {current_finalization_epoch}')

	return current_finalization_epoch
