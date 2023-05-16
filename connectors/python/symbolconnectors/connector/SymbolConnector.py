from collections import namedtuple

from symbolchain.CryptoTypes import Hash256, PublicKey

from ..model.Endpoint import Endpoint
from ..model.NodeInfo import NodeInfo
from .BasicConnector import BasicConnector

ChainStatistics = namedtuple('ChainStatistics', ['height', 'score_high', 'score_low'])
FinalizationStatistics = namedtuple('FinalizationStatistics', ['epoch', 'point', 'height', 'hash'])


class SymbolConnector(BasicConnector):
	"""Async connector for interacting with a Symbol node."""

	def __init__(self, endpoint):
		"""Creates a Symbol async connector."""

		super().__init__(endpoint)
		self._network_properties = None

	async def currency_mosaic_id(self):
		"""Gets the currency mosaic id from the network."""

		if not self._network_properties:
			self._network_properties = await self.get('network/properties')

		formatted_currency_mosaic_id = self._network_properties['chain']['currencyMosaicId']
		return int(formatted_currency_mosaic_id.replace('\'', ''), 16)

	async def chain_height(self):
		"""Gets chain height."""

		chain_statistics = await self.chain_statistics()
		return chain_statistics.height

	async def chain_statistics(self):
		"""Gets chain statistics."""

		chain_statistics = await self.get('chain/info')
		return ChainStatistics(*(int(chain_statistics[key]) for key in ('height', 'scoreHigh', 'scoreLow')))

	async def finalization_statistics(self):
		"""Gets finalization statistics."""

		finalization_statistics = await self.get('chain/info', 'latestFinalizedBlock')
		return FinalizationStatistics(
			*(int(finalization_statistics[key]) for key in ('finalizationEpoch', 'finalizationPoint', 'height')),
			Hash256(finalization_statistics['hash']))

	async def node_info(self):
		"""Gets node information."""

		node_dict = await self.get('node/info')
		return self._map_to_node_info(node_dict)

	async def peers(self):
		"""Gets peer nodes information."""

		nodes_dict = await self.get('node/peers')
		return [self._map_to_node_info(node_dict) for node_dict in nodes_dict]

	@staticmethod
	def _map_to_node_info(node_dict):
		# TODO_: need to detect HTTPS somehow

		node_port = 3000 if node_dict['roles'] & NodeInfo.API_ROLE_FLAG else node_dict['port']
		return NodeInfo(
			node_dict['networkIdentifier'],
			Hash256(node_dict['networkGenerationHashSeed']),
			PublicKey(node_dict['publicKey']),
			PublicKey(node_dict['nodePublicKey']) if 'nodePublicKey' in node_dict else None,
			Endpoint('http', node_dict['host'], node_port),
			node_dict['friendlyName'],
			SymbolConnector._format_symbol_version(node_dict['version']),
			node_dict['roles'])

	@staticmethod
	def _format_symbol_version(version):
		version_parts = [(version >> 24) & 0xFF, (version >> 16) & 0xFF, (version >> 8) & 0xFF, version & 0xFF]
		return '.'.join(str(version_part) for version_part in version_parts)
