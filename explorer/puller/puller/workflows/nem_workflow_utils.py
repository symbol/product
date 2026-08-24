from zenlog import log

from puller.facade.NemPuller import NemPuller
from puller.workflows.log_utils import configure_logging


def add_common_arguments(parser):
	"""Adds the common NEM workflow command-line arguments."""

	parser.add_argument('--nem-node', help='NEM node(local) url', default='http://localhost:7890')
	parser.add_argument('--network', help='mainnet or testnet', choices=['mainnet', 'testnet'], default='mainnet')
	parser.add_argument('--db-config', help='database config file *.ini', default='config.ini')


def bootstrap_nem_workflow(args):
	"""Configures workflow logging and creates a NEM puller for parsed command arguments."""

	configure_logging()

	facade = NemPuller(args.nem_node, args.db_config, args.network)

	log.info(f'Node URL: {args.nem_node}')
	log.info(f'Network: {args.network}')

	return facade
