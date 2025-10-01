import configparser
from collections import namedtuple

MachineConfiguration = namedtuple('MachineConfiguration', ['database_directory', 'log_filename', 'log_backup_count', 'max_log_size'])
PriceOracleConfiguration = namedtuple('PriceOracle', ['url', 'access_token'])
StrategyConfiguration = namedtuple('StrategyConfiguration', ['mode'])
NetworkConfiguration = namedtuple('NetworkConfiguration', [
	'blockchain', 'network', 'endpoint', 'bridge_address', 'mosaic_id', 'extensions'
])
BridgeConfiguration = namedtuple('BridgeConfiguration', ['machine', 'price_oracle', 'strategy', 'native_network', 'wrapped_network'])


def _camel_case_to_snake_case(value):
	result = ''
	for char in value:
		if char.isupper():
			result += f'_{char.lower()}'
		else:
			result += char

	return result


def parse_machine_configuration(config):
	"""Parses machine configuration."""

	return MachineConfiguration(
		config['databaseDirectory'],
		config['logFilename'],
		int(config['logBackupCount']),
		int(config['maxLogSize']))


def parse_price_oracle_configuration(config):
	"""Parses price oracle configuration."""

	return PriceOracleConfiguration(config['url'], config['accessToken'])


def parse_strategy_configuration(config):
	"""Parses strategy configuration."""

	mode = config['mode']
	if mode not in ('staked', 'wrapped', 'native'):
		raise ValueError(f'mode "{mode}" is not supported')

	return StrategyConfiguration(mode)


def parse_network_configuration(config):
	"""Parses network configuration."""

	required_config_properties = ['blockchain', 'network', 'endpoint', 'bridgeAddress', 'mosaicId']
	extensions = {}

	for (key, value) in config.items():
		if key in required_config_properties:
			continue

		extensions[_camel_case_to_snake_case(key)] = value

	return NetworkConfiguration(*(config[property_name] for property_name in required_config_properties), extensions)


def parse_bridge_configuration(filename):
	"""Parses a bridge configuration file."""

	parser = configparser.ConfigParser()
	parser.optionxform = str
	parser.read(filename)

	return BridgeConfiguration(
		parse_machine_configuration(parser['machine']),
		parse_price_oracle_configuration(parser['price_oracle']),
		parse_strategy_configuration(parser['strategy']),
		parse_network_configuration(parser['native_network']),
		parse_network_configuration(parser['wrapped_network']))
