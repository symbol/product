import argparse
import asyncio

from puller.facade.SymbolPuller import SymbolPuller
from puller.workflows import refresh_symbol_accounts, sync_symbol_block

COMMANDS = (
	(
		'sync-block',
		'Synchronize Symbol block headers; do not overlap sync-block runs or run concurrently with refresh-accounts, including manual runs. '
		'External scheduler owns single-writer exclusion; the Puller provides no mechanical lock.',
		sync_symbol_block
	),
	(
		'refresh-accounts',
		'Refresh Symbol accounts; do not run concurrently with sync-block runs or overlap refresh-accounts runs, including manual runs. '
		'External scheduler owns single-writer exclusion; the Puller provides no mechanical lock.',
		refresh_symbol_accounts
	)
)


def _register_commands(subparsers):
	for name, help_text, module in COMMANDS:
		parser = subparsers.add_parser(name, help=help_text, description=help_text)
		module.add_arguments(parser)


def create_parser():
	"""Creates the Symbol workflow dispatcher parser."""

	parser = argparse.ArgumentParser(description='Run a Symbol puller workflow.')
	subparsers = parser.add_subparsers(dest='command', title='commands', metavar='<command>')
	_register_commands(subparsers)
	return parser


def parse_args(argv=None):
	"""Parses dispatcher arguments and rejects a missing command."""

	parser = create_parser()
	args = parser.parse_args(argv)
	if not hasattr(args, 'run_main'):
		parser.print_help()
		raise SystemExit(0)

	return args


async def main(argv=None, symbol_puller_factory=SymbolPuller, environment=None):
	"""Dispatches one Symbol workflow command."""

	args = parse_args(argv)
	await args.run_main(args, symbol_puller_factory, environment)


if __name__ == '__main__':  # pragma: no cover
	asyncio.run(main())  # pragma: no cover
