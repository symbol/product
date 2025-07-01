import argparse
import logging

from bridge.db.Databases import Databases
from bridge.models.BridgeConfiguration import parse_bridge_configuration
from bridge.NetworkFacadeLoader import load_network_facade


def parse_args(description):
	parser = argparse.ArgumentParser(description=description)
	parser.add_argument('--config', help='wrap configuration file', required=True)
	return parser.parse_args()


async def main_bootstrapper(program_description, main_impl):
	args = parse_args(program_description)
	config = parse_bridge_configuration(args.config)
	logging.basicConfig(filename=config.machine.log_filename, level=logging.DEBUG)

	network_facade = await load_network_facade(config.native_network)
	connector = network_facade.create_connector()

	bridge_address = network_facade.make_address(config.native_network.bridge_address)
	with Databases(config.machine.database_directory, network_facade) as databases:
		databases.wrap_request.create_tables()

		await main_impl(databases, network_facade, connector, bridge_address)
