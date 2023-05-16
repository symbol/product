from collections import namedtuple

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.symbol.Network import NetworkTimestamp

from ..model.Endpoint import Endpoint
from ..model.NodeInfo import NodeInfo
from .BasicConnector import BasicConnector

ChainStatistics = namedtuple('ChainStatistics', ['height', 'score_high', 'score_low'])
FinalizationStatistics = namedtuple('FinalizationStatistics', ['epoch', 'point', 'height', 'hash'])
VotingPublicKey = namedtuple('VotingPublicKey', ['start_epoch', 'end_epoch', 'public_key'])


class LinkedPublicKeys:
	"""Collection of public keys linked to an account."""

	def __init__(self):
		self.linked_public_key = None
		self.vrf_public_key = None
		self.voting_public_keys = []


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

	async def network_time(self):
		"""Gets network time."""

		timestamps = await self.get('node/time')
		return NetworkTimestamp(int(timestamps['communicationTimestamps']['sendTimestamp']))

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

	async def account_links(self, account_id):
		"""Gets account links for a specified account."""

		json_response = await self.get(f'accounts/{account_id}')
		if 'code' in json_response:
			return LinkedPublicKeys()

		return self._parse_links(json_response['account']['supplementalPublicKeys'])

	@staticmethod
	def _parse_links(json_supplemental_public_keys):
		links = LinkedPublicKeys()
		if 'linked' in json_supplemental_public_keys:
			links.linked_public_key = PublicKey(json_supplemental_public_keys['linked']['publicKey'])

		if 'vrf' in json_supplemental_public_keys:
			links.vrf_public_key = PublicKey(json_supplemental_public_keys['vrf']['publicKey'])

		if 'voting' in json_supplemental_public_keys:
			links.voting_public_keys = [
				VotingPublicKey(
					json_voting_public_key['startEpoch'],
					json_voting_public_key['endEpoch'],
					PublicKey(json_voting_public_key['publicKey']))
				for json_voting_public_key in json_supplemental_public_keys['voting']['publicKeys']
			]

		return links
