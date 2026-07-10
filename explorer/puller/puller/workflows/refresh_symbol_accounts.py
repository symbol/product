# pylint: disable=duplicate-code
import argparse
import asyncio
import os

from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from zenlog import log

from puller.facade.SymbolPuller import SymbolPuller


def parse_args():
	"""Parses command line arguments for Symbol account refresh."""

	parser = argparse.ArgumentParser(description='Refresh Symbol account statistics population.')
	parser.add_argument('--symbol-node', required=True)
	parser.add_argument('--network', choices=['mainnet', 'testnet'], required=True)
	parser.add_argument('--db-config', required=True)
	return parser.parse_args()


def _create_node_config(symbol_node):
	return SymbolNodeConfiguration.from_app_config({
		'SYMBOL_NODE_URL': symbol_node,
		'SYMBOL_NODE_ALLOWED_HOSTS': os.environ.get('SYMBOL_NODE_ALLOWED_HOSTS'),
		'SYMBOL_NODE_ALLOW_PRIVATE': os.environ.get('SYMBOL_NODE_ALLOW_PRIVATE', 'false'),
		'SYMBOL_NODE_ALLOW_LOOPBACK': os.environ.get('SYMBOL_NODE_ALLOW_LOOPBACK', 'false'),
		'SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS': os.environ.get('SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS', 10)
	})


async def main(symbol_puller_factory=SymbolPuller):
	"""Refreshes Symbol account population using configured node and database settings."""

	args = parse_args()
	node_config = _create_node_config(args.symbol_node)
	puller = symbol_puller_factory(args.symbol_node, args.db_config, args.network, node_config)

	with puller:
		puller.symbol_db.create_tables()
		await puller.refresh_accounts()

	log.info('Account refresh completed')


if __name__ == '__main__':
	asyncio.run(main())
