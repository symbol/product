import csv
import json

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nem.Network import Address as NemAddress
from symbolchain.nem.Network import Network as NemNetwork
from symbolchain.symbol.Network import Address as SymbolAddress
from symbolchain.symbol.Network import Network as SymbolNetwork
from zenlog import log


class NodeDescriptor:
	"""Node descriptor."""

	def __init__(self, main_address=None, endpoint=None, name=None, version=None, height=0, finalized_height=0, balance=0, has_api=True):
		"""Creates a descriptor."""

		# pylint: disable=too-many-arguments

		self.main_address = main_address
		self.endpoint = endpoint
		self.name = name
		self.version = version
		self.height = height
		self.finalized_height = finalized_height
		self.balance = balance
		self.has_api = has_api


class HarvesterDescriptor:
	"""Harvester descriptor."""

	def __init__(self, harvester_dict, address_class):
		"""Creates a descriptor."""

		self.signer_address = address_class(harvester_dict['signer_address'])
		self.main_address = address_class(harvester_dict['main_address'])
		self.endpoint = harvester_dict['host']
		self.name = harvester_dict['name']
		self.height = int(harvester_dict['height'])
		self.finalized_height = int(harvester_dict['finalized_height'])
		self.version = harvester_dict['version']
		self.balance = float(harvester_dict['balance'])


class SymbolAccountDescriptor:
	"""Symbol account descriptor."""

	# pylint: disable=too-many-instance-attributes

	def __init__(self, account_dict):
		"""Creates a descriptor."""

		self.main_address = SymbolAddress(account_dict['address'])
		self.balance = float(account_dict['balance'])
		self.is_voting = 'True' == account_dict['is_voting']
		self.has_ever_voted = 'True' == account_dict['has_ever_voted']
		self.voting_end_epoch = int(account_dict['voting_end_epoch'])
		self.current_epoch_votes = account_dict['current_epoch_votes'].split('|')
		self.endpoint = account_dict['host']
		self.name = account_dict['name']
		self.height = int(account_dict['height'])
		self.finalized_height = int(account_dict['finalized_height'])
		self.version = account_dict['version']


class NetworkRepository:
	"""Network respository managing access to NEM or Symbol node information."""

	def __init__(self, network_name):
		"""Creates a network repository."""

		self.network_name = network_name

		self.node_descriptors = None
		self.harvester_descriptors = None
		self.voter_descriptors = None

	@property
	def is_nem(self):
		"""True if the repository is initialized for NEM, False otherwise."""

		return 'nem' == self.network_name

	def estimate_height(self):
		"""Estimates the network height by returning the median height of all nodes."""

		heights = [descriptor.height for descriptor in self.node_descriptors]
		heights.sort()
		return heights[round(len(heights) / 2)]

	def load_node_descriptors(self, nodes_data_filepath):
		"""Loads node descriptors."""

		log.info(f'loading nodes from {nodes_data_filepath}')

		with open(nodes_data_filepath, 'rt', encoding='utf8') as infile:
			self.node_descriptors = list(filter(None.__ne__, [
				self._create_descriptor_from_json(json_node) for json_node in json.load(infile)
			]))

		# sort by name
		self.node_descriptors.sort(key=lambda descriptor: descriptor.name)

	def _create_descriptor_from_json(self, json_node):
		# network crawler extracts as much extra data as possible, but it might not always be available for all nodes
		extra_data = (0, 0, 0)
		if 'extraData' in json_node:
			json_extra_data = json_node['extraData']
			extra_data = (json_extra_data.get('height', 0), json_extra_data.get('finalizedHeight', 0), json_extra_data.get('balance', 0))

		if self.is_nem:
			node_protocol = json_node['endpoint']['protocol']
			node_host = json_node['endpoint']['host']
			node_port = json_node['endpoint']['port']

			return NodeDescriptor(
				NemNetwork.MAINNET.public_key_to_address(PublicKey(json_node['identity']['public-key'])),
				f'{node_protocol}://{node_host}:{node_port}',
				json_node['identity']['name'],
				json_node['metaData']['version'],
				*extra_data)

		symbol_endpoint = ''
		has_api = bool(json_node['roles'] & 2)
		if json_node['host']:
			node_host = json_node['host']
			node_port = 3000 if has_api else json_node['port']
			symbol_endpoint = f'http://{node_host}:{node_port}'

		if SymbolNetwork.MAINNET.generation_hash_seed != Hash256(json_node['networkGenerationHashSeed']):
			return None

		return NodeDescriptor(
			SymbolNetwork.MAINNET.public_key_to_address(PublicKey(json_node['publicKey'])),
			symbol_endpoint,
			json_node['friendlyName'],
			self._format_symbol_version(json_node['version']),
			*extra_data,
			has_api)

	@staticmethod
	def _format_symbol_version(version):
		version_parts = [(version >> 24) & 0xFF, (version >> 16) & 0xFF, (version >> 8) & 0xFF, version & 0xFF]
		return '.'.join(str(version_part) for version_part in version_parts)

	def load_harvester_descriptors(self, harvesters_data_filepath):
		"""Loads harvester descriptors."""

		log.info(f'loading harvesters from {harvesters_data_filepath}')

		address_class = NemAddress if self.is_nem else SymbolAddress
		with open(harvesters_data_filepath, 'rt', encoding='utf8') as infile:
			csv_reader = csv.DictReader(infile, [
				'signer_address', 'main_address', 'host', 'name', 'height', 'finalized_height', 'version', 'balance'
			])
			next(csv_reader)  # skip header

			self.harvester_descriptors = [HarvesterDescriptor(row, address_class) for row in csv_reader]

		# sort by balance (highest to lowest)
		self.harvester_descriptors.sort(key=lambda descriptor: descriptor.balance, reverse=True)

	def load_voter_descriptors(self, accounts_data_filepath):
		"""Loads voter descriptors."""

		log.info(f'loading voting accounts from {accounts_data_filepath}')

		with open(accounts_data_filepath, 'rt', encoding='utf8') as infile:
			csv_reader = csv.DictReader(infile, [
				'address', 'balance', 'is_voting', 'has_ever_voted', 'voting_end_epoch', 'current_epoch_votes',
				'host', 'name', 'height', 'finalized_height', 'version'
			])
			next(csv_reader)  # skip header

			self.voter_descriptors = [SymbolAccountDescriptor(row) for row in csv_reader]

		# sort by balance (highest to lowest)
		self.voter_descriptors.sort(key=lambda descriptor: descriptor.balance, reverse=True)
