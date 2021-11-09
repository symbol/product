import csv

from symbolchain.core.nem.Network import Address
from zenlog import log

from .VersionSummary import aggregate_descriptors


class HarvesterDescriptor:
    def __init__(self, harvester_dict):
        self.signer_address = Address(harvester_dict['signer_address'])
        self.main_address = Address(harvester_dict['main_address'])
        self.host = harvester_dict['host']
        self.name = harvester_dict['name']
        self.balance = float(harvester_dict['balance'])
        self.version = harvester_dict['version']


class NemLoader:
    def __init__(self, harvesters_data_filepath):
        self.harvesters_data_filepath = harvesters_data_filepath

        self.descriptors = []

    def load(self):
        log.info('loading input from {}'.format(self.harvesters_data_filepath))

        # load rows
        with open(self.harvesters_data_filepath, 'rt') as infile:
            csv_reader = csv.DictReader(infile, ['signer_address', 'main_address', 'host', 'name', 'balance',  'version'])
            next(csv_reader)  # skip header

            self.descriptors = [HarvesterDescriptor(row) for row in csv_reader]

        # sort by balance (highest to lowest)
        self.descriptors.sort(key=lambda descriptor: descriptor.balance, reverse=True)

    def aggregate(self, descriptor_filter=None):
        return aggregate_descriptors(self.descriptors, descriptor_filter, self.version_to_tag)

    @staticmethod
    def version_to_tag(version):
        tag = 'against'
        if not version:
            tag = 'delegating / updating'
        if '0.6.98' in version:
            tag = 'for'

        return tag
