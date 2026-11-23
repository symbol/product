import configparser
import os
from io import StringIO

from common.symbol.NodeConfiguration import SymbolNodeConfiguration

REQUIRED_DATABASE_KEYS = ('database', 'user', 'password', 'host', 'port')


def read_migration_database_config(config_path):
	"""Reads one config and requires explicit Symbol migration connection settings."""

	config = configparser.ConfigParser()
	config.read(config_path)
	database_config = config['symbol_db']
	# Preserve normal defaults for optional parameters, while checking mandatory
	# credentials against the values written in [symbol_db] in the same snapshot.
	config_snapshot = StringIO()
	config.write(config_snapshot)
	explicit_config = configparser.ConfigParser(interpolation=None, default_section='symbol_db')
	explicit_config.read_string(config_snapshot.getvalue())
	missing_keys = [key for key in REQUIRED_DATABASE_KEYS if key not in explicit_config.defaults()]
	if missing_keys:
		raise ValueError(f'Missing required [symbol_db] connection settings: {", ".join(missing_keys)}')

	return database_config


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
	"""Constructs a Symbol puller and runs its schema-owning, locked operation."""

	node_config = create_node_config(args.symbol_node, environment)
	puller = symbol_puller_factory(
		args.symbol_node,
		args.db_config,
		args.network,
		node_config,
		**(puller_kwargs or {}))

	async with puller:
		return await operation(puller)
