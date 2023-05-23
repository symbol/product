import configparser
import datetime
from collections import namedtuple

from symbolchain.CryptoTypes import Hash256
from symbolchain.symbol.Network import Network

from .NodeFeatures import NodeFeatures

Images = namedtuple('Images', ['client', 'rest'])
Services = namedtuple('Services', ['nodewatch'])
Node = namedtuple('Node', ['features', 'user_id', 'group_id'])
ShoestringConfiguration = namedtuple('ShoestringConfiguration', ['network', 'images', 'services', 'node'])


def parse_network(config):
	"""Parses network configuration."""

	name = config['name']
	identifier = int(config['identifier'])
	epoch_adjustment = datetime.datetime.utcfromtimestamp(int(config['epochAdjustment']))
	generation_hash_seed = Hash256(config['generationHashSeed'])
	return Network(name, identifier, epoch_adjustment, generation_hash_seed)


def parse_images(config):
	"""Parses images configuration."""

	return Images(config['client'], config['rest'])


def parse_services(config):
	"""Parses services configuration."""

	return Services(config['nodewatch'])


def parse_node(config):
	"""Parses node configuration."""

	features = NodeFeatures(0)
	for feature in config['features'].split('|'):
		try:
			features |= NodeFeatures[feature.strip()]
		except KeyError as ex:
			# rethrow KeyError as ValueError for consistency with other value parsing errors
			raise ValueError(ex) from ex

	user_id = int(config['userId'])
	group_id = int(config['groupId'])

	return Node(features, user_id, group_id)


def parse_shoestring_configuration(filename):
	"""Parses a shoestring configuration file."""

	parser = configparser.ConfigParser()
	parser.read(filename)

	return ShoestringConfiguration(
		parse_network(parser['network']),
		parse_images(parser['images']),
		parse_services(parser['services']),
		parse_node(parser['node']))
