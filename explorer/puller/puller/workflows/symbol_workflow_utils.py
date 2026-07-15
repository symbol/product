import os

from common.symbol.NodeConfiguration import SymbolNodeConfiguration


def add_common_arguments(parser):
	"""Adds the common Symbol workflow command-line arguments."""

	parser.add_argument('--symbol-node', required=True)
	parser.add_argument('--network', choices=['mainnet', 'testnet'], required=True)
	parser.add_argument('--db-config', required=True)


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


async def run_symbol_workflow(symbol_puller_factory, args, operation, environment=None, puller_kwargs=None):
	"""Constructs a Symbol puller, initializes its tables, and runs one operation."""

	node_config = create_node_config(args.symbol_node, environment)
	puller = symbol_puller_factory(
		args.symbol_node,
		args.db_config,
		args.network,
		node_config,
		**(puller_kwargs or {}))

	with puller:
		puller.symbol_db.create_tables()
		await operation(puller)
