import configparser
import datetime
from collections import namedtuple

from symbolchain.CryptoTypes import Hash256
from symbolchain.symbol.Network import Network

from .NodeFeatures import NodeFeatures

ImagesConfiguration = namedtuple('ImagesConfiguration', ['client', 'rest', 'mongo'])
ServicesConfiguration = namedtuple('ServicesConfiguration', ['nodewatch'])
TransactionConfiguration = namedtuple('TransactionConfiguration', [
	'fee_multiplier', 'timeout_hours', 'min_cosignatures_count', 'hash_lock_duration', 'currency_mosaic_id', 'locked_funds_per_aggregate'
])
ImportsConfiguration = namedtuple('ImportsConfiguration', ['harvester', 'voter', 'node_key'])
NodeConfiguration = namedtuple('NodeConfiguration', [
	'features', 'user_id', 'group_id', 'ca_password', 'api_https', 'full_api', 'ca_common_name', 'node_common_name'
])
ShoestringConfiguration = namedtuple('ShoestringConfiguration', ['network', 'images', 'services', 'transaction', 'imports', 'node'])


def parse_network_configuration(config):
	"""Parses network configuration."""

	name = config['name']
	identifier = int(config['identifier'])
	epoch_adjustment = datetime.datetime.utcfromtimestamp(int(config['epochAdjustment']))
	generation_hash_seed = Hash256(config['generationHashSeed'])
	return Network(name, identifier, epoch_adjustment, generation_hash_seed)


def parse_images_configuration(config):
	"""Parses images configuration."""

	return ImagesConfiguration(config['client'], config['rest'], config['mongo'])


def parse_services_configuration(config):
	"""Parses services configuration."""

	return ServicesConfiguration(config['nodewatch'])


def parse_transaction_configuration(config):
	"""Parses transaction configuration."""

	fee_multiplier = int(config['feeMultiplier'])
	timeout_hours = int(config['timeoutHours'])
	min_cosignatures_count = int(config['minCosignaturesCount'])
	hash_lock_duration = int(config['hashLockDuration'])
	currency_mosaic_id = int(config['currencyMosaicId'], 16)
	locked_funds_per_aggregate = int(config['lockedFundsPerAggregate'])

	return TransactionConfiguration(
		fee_multiplier,
		timeout_hours,
		min_cosignatures_count,
		hash_lock_duration,
		currency_mosaic_id,
		locked_funds_per_aggregate)


def parse_imports_configuration(config):
	"""Parses imports configuration."""

	node_key = config['nodeKey']
	return ImportsConfiguration(config['harvester'], config['voter'], node_key)


def parse_node_configuration(config):
	"""Parses node configuration."""

	features = NodeFeatures.parse(config['features'])
	user_id = int(config['userId'])
	group_id = int(config['groupId'])
	ca_password = config['caPassword']
	api_https = config['apiHttps'].lower() == 'true'
	full_api = NodeFeatures.API in features and not config['lightApi'].lower() == 'true'
	ca_common_name = config['caCommonName']
	node_common_name = config['nodeCommonName']

	return NodeConfiguration(features, user_id, group_id, ca_password, api_https, full_api, ca_common_name, node_common_name)


def parse_shoestring_configuration(filename):
	"""Parses a shoestring configuration file."""

	parser = configparser.ConfigParser()
	parser.read(filename)

	return ShoestringConfiguration(
		parse_network_configuration(parser['network']),
		parse_images_configuration(parser['images']),
		parse_services_configuration(parser['services']),
		parse_transaction_configuration(parser['transaction']),
		parse_imports_configuration(parser['imports']),
		parse_node_configuration(parser['node']))
