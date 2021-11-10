import csv
import json
from collections import namedtuple

from symbolchain.core.symbol.Network import Address
from zenlog import log

from .VersionSummary import aggregate_descriptors

NodeDescriptor = namedtuple('NodeDescriptor', ['name', 'host', 'version'])


class AccountDescriptor:
    # pylint: disable=too-many-instance-attributes

    def __init__(self, account_dict):
        self.address = Address(account_dict['address'])
        self.balance = float(account_dict['balance'])
        self.is_voting = 'True' == account_dict['is_voting']
        self.has_ever_voted = 'True' == account_dict['has_ever_voted']
        self.voting_end_epoch = int(account_dict['voting_end_epoch'])
        self.host = account_dict['host']
        self.name = account_dict['name']
        self.version = account_dict['version']
        self.categories = []


class SymbolLoader:
    def __init__(self, nodes_data_filepath, account_data_filepath, category_addresses_filepath_map):
        self.nodes_data_filepath = nodes_data_filepath
        self.account_data_filepath = account_data_filepath
        self.category_addresses_filepath_map = category_addresses_filepath_map

        self.descriptors = []
        self.node_descriptors = []

    def load(self):
        self._load_harvester_descriptors()

        with open(self.nodes_data_filepath, 'rt') as infile:
            self.node_descriptors = [
                NodeDescriptor(json_node['friendlyName'], json_node['host'], self._format_version(json_node['version']))
                for json_node in json.load(infile)
            ]

    def _load_harvester_descriptors(self):
        category_addresses_map = {}
        for category, addresses_filepath in self.category_addresses_filepath_map.items():
            log.info('loading category addresses from {}'.format(addresses_filepath))

            with open(addresses_filepath, 'rt') as infile:
                category_addresses_map[category] = [Address(line.strip()) for line in infile.readlines()]

        log.info('loading input from {}'.format(self.account_data_filepath))

        # load rows
        with open(self.account_data_filepath, 'rt') as infile:
            csv_reader = csv.DictReader(infile, [
                'address', 'balance', 'is_voting', 'has_ever_voted', 'voting_end_epoch', 'host', 'name', 'version'
            ])
            next(csv_reader)  # skip header

            self.descriptors = [AccountDescriptor(row) for row in csv_reader]

        # sort by balance (highest to lowest)
        self.descriptors.sort(key=lambda descriptor: descriptor.balance, reverse=True)

        # add categories
        for category, addresses in category_addresses_map.items():
            for descriptor in self.descriptors:
                if any(address == descriptor.address for address in addresses):
                    descriptor.categories += [category]

    def aggregate(self, descriptor_filter=None, node_filter=None):
        return aggregate_descriptors(self.descriptors, descriptor_filter, self.node_descriptors, node_filter, self.version_to_tag)

    @staticmethod
    def version_to_tag(version):
        return 'for' if '1.0.3.0' == version else 'against'

    @staticmethod
    def _format_version(version):
        return '{}.{}.{}.{}'.format((version >> 24) & 0xFF, (version >> 16) & 0xFF, (version >> 8) & 0xFF, version & 0xFF)
