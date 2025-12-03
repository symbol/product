import argparse
import logging
import sys
from collections import namedtuple
from logging.handlers import RotatingFileHandler
from pathlib import Path
from traceback import format_exception

from filelock import FileLock, Timeout

from bridge.db.Databases import Databases
from bridge.models.BridgeConfiguration import parse_bridge_configuration
from bridge.models.Constants import ExecutionContext
from bridge.NetworkFacadeLoader import load_network_facade
from bridge.price_oracle.PriceOracleLoader import load_price_oracle
from bridge.VaultConnector import VaultConnector
from bridge.WorkflowUtils import validate_global_configuration

BridgeExternalServices = namedtuple('BridgeExternalServices', ['price_oracle', 'vault_connector'])


def parse_args(description):
	parser = argparse.ArgumentParser(description=description)
	parser.add_argument('--config', help='wrap configuration file', required=True)
	parser.add_argument('--unwrap', help='run command in unwrap mode', action='store_true')
	return parser.parse_args()


def print_banner(lines):
	logger = logging.getLogger(__name__)
	logger.info('\n'.join(['', '*** *** ***'] + lines + ['*** *** ***']))


def unhandled_exception_handler(exc_type, exc_value, exc_traceback):
	logger = logging.getLogger(__name__)
	logger.fatal(''.join(format_exception(exc_type, exc_value, exc_traceback)))
	sys.exit(1)


def configure_logging(config):
	logging.basicConfig(
		level=logging.DEBUG,
		format='%(asctime)s [%(levelname)s] %(module)s: %(message)s',
		handlers=[
			RotatingFileHandler(
				filename=config.machine.log_filename,
				backupCount=config.machine.log_backup_count,
				maxBytes=config.machine.max_log_size),
			logging.StreamHandler(sys.stdout)
		])

	# only log warnings or higher from filelock
	logger = logging.getLogger('filelock')
	logger.setLevel(logging.WARN)


async def main_bootstrapper(program_description, main_impl):
	args = parse_args(program_description)
	config = parse_bridge_configuration(args.config)

	configure_logging(config)
	logger = logging.getLogger(__name__)

	sys.excepthook = unhandled_exception_handler

	native_facade = await load_network_facade(config.native_network)
	wrapped_facade = await load_network_facade(config.wrapped_network)

	validate_global_configuration(config.global_, wrapped_facade)

	price_oracle = load_price_oracle(config.price_oracle)
	vault_connector = VaultConnector(config.vault.url, config.vault.access_token)
	external_services = BridgeExternalServices(price_oracle, vault_connector)

	lock_filepath = Path(config.machine.database_directory) / 'bridge.db.lock'
	try:
		with FileLock(lock_filepath, blocking=False):
			with Databases(config.machine.database_directory, native_facade, wrapped_facade) as databases:
				databases.create_tables()

				execution_context = ExecutionContext(args.unwrap, config.global_.mode)
				logger.info('         strategy mode: %s', execution_context.strategy_mode)
				logger.info('running in unwrap mode? %s', execution_context.is_unwrap_mode)
				await main_impl(execution_context, databases, native_facade, wrapped_facade, external_services)
	except Timeout:
		logger.fatal('could not acquire exclusive lock to %s', lock_filepath)
