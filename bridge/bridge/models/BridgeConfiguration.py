import configparser
from collections import namedtuple

MachineConfiguration = namedtuple('MachineConfiguration', ['database_directory', 'log_filename'])
NetworkConfiguration = namedtuple('NetworkConfiguration', ['blockchain', 'network', 'endpoint', 'bridge_address'])
BridgeConfiguration = namedtuple('BridgeConfiguration', ['machine', 'native_network', 'wrapped_network'])


def parse_machine_configuration(config):
	"""Parses machine configuration."""

	database_directory = config['databaseDirectory']
	log_filename = config['logFilename']
	return MachineConfiguration(database_directory, log_filename)


def parse_network_configuration(config):
	"""Parses network configuration."""

	blockchain = config['blockchain']
	network = config['network']
	endpoint = config['endpoint']
	bridge_address = config['bridgeAddress']
	return NetworkConfiguration(blockchain, network, endpoint, bridge_address)


def parse_bridge_configuration(filename):
	"""Parses a bridge configuration file."""

	parser = configparser.ConfigParser()
	parser.read(filename)

	return BridgeConfiguration(
		parse_machine_configuration(parser['machine']),
		parse_network_configuration(parser['native_network']),
		parse_network_configuration(parser['wrapped_network']))
