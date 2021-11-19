import csv
import json

from symbolchain.core.CryptoTypes import PublicKey
from symbolchain.core.nem.Network import Address as NemAddress
from symbolchain.core.nem.Network import Network as NemNetwork
from symbolchain.core.symbol.Network import Address as SymbolAddress
from symbolchain.core.symbol.Network import Network as SymbolNetwork
from zenlog import log


class NodeDescriptor:
    def __init__(self, main_address=None, name=None, endpoint=None, version=None, height=0, finalized_height=0, balance=0):
        # pylint: disable=too-many-arguments

        self.main_address = main_address
        self.name = name
        self.endpoint = endpoint
        self.version = version
        self.height = height
        self.finalized_height = finalized_height
        self.balance = balance


class HarvesterDescriptor:
    def __init__(self, harvester_dict, address_class):
        self.signer_address = address_class(harvester_dict['signer_address'])
        self.main_address = address_class(harvester_dict['main_address'])
        self.endpoint = harvester_dict['host']
        self.name = harvester_dict['name']
        self.height = int(harvester_dict['height'])
        self.finalized_height = int(harvester_dict['finalized_height'])
        self.version = harvester_dict['version']
        self.balance = float(harvester_dict['balance'])


class SymbolAccountDescriptor:
    # pylint: disable=too-many-instance-attributes

    def __init__(self, account_dict):
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
    def __init__(self, network_name):
        self.network_name = network_name

        self.node_descriptors = None
        self.harvester_descriptors = None
        self.voter_descriptors = None

    @property
    def is_nem(self):
        return 'nem' == self.network_name

    def estimate_height(self):
        heights = [descriptor.height for descriptor in self.node_descriptors]
        heights.sort()
        return heights[round(len(heights) / 2)]

    def load_node_descriptors(self, nodes_data_filepath):
        log.info('loading nodes from {}'.format(nodes_data_filepath))

        with open(nodes_data_filepath, 'rt') as infile:
            self.node_descriptors = [self._create_descriptor_from_json(json_node) for json_node in json.load(infile)]

        # sort by name
        self.node_descriptors.sort(key=lambda descriptor: descriptor.name)

    def _create_descriptor_from_json(self, json_node):
        # network crawler extracts as much extra data as possible, but it might not always be available for all nodes
        extra_data = (0, 0, 0)
        if 'extraData' in json_node:
            json_extra_data = json_node['extraData']
            extra_data = (json_extra_data.get('height', 0), json_extra_data.get('finalizedHeight', 0), json_extra_data.get('balance', 0))

        if self.is_nem:
            return NodeDescriptor(
                NemNetwork.MAINNET.public_key_to_address(PublicKey(json_node['identity']['public-key'])),
                json_node['identity']['name'],
                '{}://{}:{}'.format(json_node['endpoint']['protocol'], json_node['endpoint']['host'], json_node['endpoint']['port']),
                json_node['metaData']['version'],
                *extra_data)

        symbol_endpoint = ''
        if json_node['host']:
            symbol_endpoint = 'http://{}:{}'.format(json_node['host'], 3000 if json_node['roles'] & 2 else json_node['port'])
        return NodeDescriptor(
            SymbolNetwork.MAINNET.public_key_to_address(PublicKey(json_node['publicKey'])),
            json_node['friendlyName'],
            symbol_endpoint,
            self._format_symbol_version(json_node['version']),
            *extra_data)

    @staticmethod
    def _format_symbol_version(version):
        return '{}.{}.{}.{}'.format((version >> 24) & 0xFF, (version >> 16) & 0xFF, (version >> 8) & 0xFF, version & 0xFF)

    def load_harvester_descriptors(self, harvesters_data_filepath):
        log.info('loading harvesters from {}'.format(harvesters_data_filepath))

        address_class = NemAddress if self.is_nem else SymbolAddress
        with open(harvesters_data_filepath, 'rt') as infile:
            csv_reader = csv.DictReader(infile, [
                'signer_address', 'main_address', 'host', 'name', 'height', 'finalized_height', 'version', 'balance'
            ])
            next(csv_reader)  # skip header

            self.harvester_descriptors = [HarvesterDescriptor(row, address_class) for row in csv_reader]

        # sort by balance (highest to lowest)
        self.harvester_descriptors.sort(key=lambda descriptor: descriptor.balance, reverse=True)

    def load_voter_descriptors(self, accounts_data_filepath):
        log.info('loading voting accounts from {}'.format(accounts_data_filepath))

        with open(accounts_data_filepath, 'rt') as infile:
            csv_reader = csv.DictReader(infile, [
                'address', 'balance', 'is_voting', 'has_ever_voted', 'voting_end_epoch', 'current_epoch_votes',
                'host', 'name', 'height', 'finalized_height', 'version'
            ])
            next(csv_reader)  # skip header

            self.voter_descriptors = [SymbolAccountDescriptor(row) for row in csv_reader]

        # sort by balance (highest to lowest)
        self.voter_descriptors.sort(key=lambda descriptor: descriptor.balance, reverse=True)
