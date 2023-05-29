import random
import re

from aiohttp import ClientSession


class NodeDownloader:
	"""Downloads and selects initial beacon nodes."""

	def __init__(self, endpoint):
		"""Creates a node downloader around an endpoint."""

		self.endpoint = endpoint
		self.host_regex = re.compile(r'^https?://(.*):(\d+)$')

		self.nodes = []
		self.min_balance = 0
		self.max_output_nodes = 100

	async def download_peer_nodes(self):
		"""Downloads peer nodes."""

		self.nodes += await self._get('api/symbol/nodes/peer')

	async def download_api_nodes(self):
		"""Downloads peer nodes."""

		self.nodes += await self._get('api/symbol/nodes/api')

	def select_peer_nodes(self):
		"""Selects nodes and converts them to PEERS JSON format."""

		return self._select_nodes(0x01)

	def select_api_nodes(self):
		"""Selects api nodes and converts them to PEERS JSON format."""

		return self._select_nodes(0x02)

	def select_api_endpoints(self):
		"""Selects api node endpoints."""

		return self._select_nodes(0x02, lambda node: node['endpoint'])

	def _select_nodes(self, required_role, formatter=None):
		formatter = formatter or self._map_node_to_peers_format
		matching_nodes = [formatter(node) for node in self.nodes if self._is_node_eligible(node, required_role)]
		random.shuffle(matching_nodes)
		return matching_nodes[:self.max_output_nodes]

	def _is_node_eligible(self, node, required_role):
		return node['endpoint'] and node['balance'] >= self.min_balance and 0 != node['roles'] & required_role

	def _map_node_to_peers_format(self, node):
		host_match = self.host_regex.match(node['endpoint'])

		node_json = {
			'publicKey': node['mainPublicKey'],
			'endpoint': {
				'host': host_match.group(1),
				'port': 7900
			},
			'metadata': {
				'name': node['name'],
				'roles': self._stringify_roles(node['roles'])
			}
		}

		if 0 != node['roles'] & 0x02:
			node_json['endpoint']['api_port'] = int(host_match.group(2))

		return node_json

	@staticmethod
	def _stringify_roles(roles):
		role_parts = []
		for role in [(0x01, 'Peer'), (0x02, 'Api'), (0x04, 'Voting'), (0x40, 'IPv4'), (0x80, 'IPv6')]:
			if roles & role[0]:
				role_parts.append(role[1])

		return ','.join(role_parts)

	async def _get(self, url_path):
		"""Initiates a GET to the specified path and returns the desired property."""

		async with ClientSession() as session:
			async with session.get(f'{self.endpoint}/{url_path}') as response:
				response_json = await response.json()
				return response_json
