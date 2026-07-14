# pylint: disable=duplicate-code
import argparse
import asyncio
import os

from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from zenlog import log

from puller.facade.SymbolPuller import SymbolPuller


def parse_args(argv=None):
	"""Parses command line arguments for Symbol account refresh."""

	parser = argparse.ArgumentParser(description='Refresh Symbol account statistics population.')
	parser.add_argument('--symbol-node', required=True)
	parser.add_argument('--network', choices=['mainnet', 'testnet'], required=True)
	parser.add_argument('--db-config', required=True)
	return parser.parse_args(argv)


def create_node_config(symbol_node, environment=None):
	"""Creates the Symbol node configuration from CLI and environment values."""

	if environment is None:
		environment = os.environ
	return SymbolNodeConfiguration.from_app_config({
		'SYMBOL_NODE_URL': symbol_node,
		'SYMBOL_NODE_ALLOWED_HOSTS': environment.get('SYMBOL_NODE_ALLOWED_HOSTS'),
		'SYMBOL_NODE_ALLOW_PRIVATE': environment.get('SYMBOL_NODE_ALLOW_PRIVATE', 'false'),
		'SYMBOL_NODE_ALLOW_LOOPBACK': environment.get('SYMBOL_NODE_ALLOW_LOOPBACK', 'false'),
		'SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS': environment.get('SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS', 10)
	})


async def main(symbol_puller_factory=SymbolPuller, argv=None, environment=None):
	"""Refreshes Symbol account population using configured node and database settings."""

	args = parse_args(argv)
	node_config = create_node_config(args.symbol_node, environment)
	puller = symbol_puller_factory(args.symbol_node, args.db_config, args.network, node_config)

	with puller:
		puller.symbol_db.create_tables()
		await puller.refresh_accounts()

	log.info('Account refresh completed')


if __name__ == '__main__':
	asyncio.run(main())
