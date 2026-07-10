import argparse
import asyncio
import os

from common.symbol.NodeConfiguration import SymbolNodeConfiguration

from puller.facade.SymbolPuller import SymbolPuller


def _positive_int(value):
	parsed_value = int(value)
	if parsed_value < 1:
		raise argparse.ArgumentTypeError('must be greater than or equal to 1')

	return parsed_value


def parse_args():
	"""Parses command line arguments."""

	parser = argparse.ArgumentParser(description='Synchronize Symbol block headers.')
	parser.add_argument('--symbol-node', required=True)
	parser.add_argument('--network', choices=['mainnet', 'testnet'], required=True)
	parser.add_argument('--db-config', required=True)
	parser.add_argument('--max-height', type=_positive_int, help='maximum block height to sync for manual validation')
	parser.add_argument('--max-requests-per-second', type=_positive_int, help='maximum Symbol node requests per second')

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
	"""Synchronizes Symbol block headers."""

	args = parse_args()
	node_config = _create_node_config(args.symbol_node)
	puller_kwargs = {}
	if args.max_requests_per_second is not None:
		puller_kwargs['max_requests_per_second'] = args.max_requests_per_second

	puller = symbol_puller_factory(args.symbol_node, args.db_config, args.network, node_config, **puller_kwargs)

	with puller:
		puller.symbol_db.create_tables()
		await puller.sync_block_headers(args.max_height)


if '__main__' == __name__:  # pragma: no cover
	asyncio.run(main())  # pragma: no cover
