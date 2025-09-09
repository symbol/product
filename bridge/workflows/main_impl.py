import argparse
import logging
import sys
from logging.handlers import TimedRotatingFileHandler

from bridge.CoinGeckoConnector import CoinGeckoConnector
from bridge.db.Databases import Databases
from bridge.models.BridgeConfiguration import parse_bridge_configuration
from bridge.NetworkFacadeLoader import load_network_facade


def parse_args(description):
	parser = argparse.ArgumentParser(description=description)
	parser.add_argument('--config', help='wrap configuration file', required=True)
	parser.add_argument('--unwrap', help='run command in unwrap mode', action='store_true')
	return parser.parse_args()


def print_banner(lines):
	logger = logging.getLogger(__name__)
	logger.info('\n'.join(['', '*** *** ***'] + lines + ['*** *** ***']))


async def main_bootstrapper(program_description, main_impl):
	args = parse_args(program_description)
	config = parse_bridge_configuration(args.config)

	logging.basicConfig(
		level=logging.DEBUG,
		format='%(asctime)s [%(levelname)s] %(module)s: %(message)s',
		handlers=[
			TimedRotatingFileHandler(filename=config.machine.log_filename, when='D'),
			logging.StreamHandler(sys.stdout)
		])
	logger = logging.getLogger(__name__)

	native_facade = await load_network_facade(config.native_network)
	wrapped_facade = await load_network_facade(config.wrapped_network)

	price_oracle = CoinGeckoConnector(config.price_oracle.url)

	with Databases(config.machine.database_directory, native_facade, wrapped_facade) as databases:
		databases.create_tables()

		logger.info('running in unwrap mode? %s', args.unwrap)
		await main_impl(args.unwrap, databases, native_facade, wrapped_facade, price_oracle)
