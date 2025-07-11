import argparse
import logging

from bridge.db.Databases import Databases
from bridge.models.BridgeConfiguration import parse_bridge_configuration
from bridge.NetworkFacadeLoader import load_network_facade


def parse_args(description):
	parser = argparse.ArgumentParser(description=description)
	parser.add_argument('--config', help='wrap configuration file', required=True)
	parser.add_argument('--unwrap', help='run command in unwrap mode', action='store_true')
	return parser.parse_args()


def print_banner(lines):
	print('\n*** *** ***')
	print('\n'.join(lines))
	print('*** *** ***\n')


async def main_bootstrapper(program_description, main_impl):
	args = parse_args(program_description)
	config = parse_bridge_configuration(args.config)
	logging.basicConfig(filename=config.machine.log_filename, level=logging.DEBUG)

	native_facade = await load_network_facade(config.native_network)
	wrapped_facade = await load_network_facade(config.wrapped_network)

	with Databases(config.machine.database_directory, native_facade, wrapped_facade) as databases:
		databases.create_tables()

		print(f'running in unwrap mode? {args.unwrap}')
		await main_impl(args.unwrap, databases, native_facade, wrapped_facade)
