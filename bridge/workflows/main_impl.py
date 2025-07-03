import argparse
import logging
from collections import namedtuple

from bridge.db.Databases import Databases
from bridge.models.BridgeConfiguration import parse_bridge_configuration
from bridge.NetworkFacadeLoader import load_network_facade

Network = namedtuple('Network', ['facade', 'connector', 'bridge_address'])


def parse_args(description):
	parser = argparse.ArgumentParser(description=description)
	parser.add_argument('--config', help='wrap configuration file', required=True)
	return parser.parse_args()


async def load_network(config):
	network_facade = await load_network_facade(config)
	connector = network_facade.create_connector()
	bridge_address = network_facade.make_address(config.bridge_address)
	return Network(network_facade, connector, bridge_address)


async def main_bootstrapper(program_description, main_impl):
	args = parse_args(program_description)
	config = parse_bridge_configuration(args.config)
	logging.basicConfig(filename=config.machine.log_filename, level=logging.DEBUG)

	native_network = await load_network(config.native_network)
	wrapped_network = await load_network(config.wrapped_network)

	with Databases(config.machine.database_directory, native_network.facade) as databases:
		databases.wrap_request.create_tables()

		await main_impl(databases, native_network, wrapped_network)
