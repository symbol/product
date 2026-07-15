# pylint: disable=duplicate-code
import argparse
import asyncio

from zenlog import log

from puller.facade.SymbolPuller import SymbolPuller
from puller.workflows.symbol_workflow_utils import add_common_arguments, run_symbol_workflow


def parse_args(argv=None):
	"""Parses command line arguments for Symbol account refresh."""

	parser = argparse.ArgumentParser(description='Refresh Symbol account statistics population.')
	add_common_arguments(parser)
	return parser.parse_args(argv)


async def main(symbol_puller_factory=SymbolPuller, argv=None, environment=None):
	"""Refreshes Symbol account population using configured node and database settings."""

	args = parse_args(argv)

	async def refresh_accounts(puller):
		await puller.refresh_accounts()

	await run_symbol_workflow(symbol_puller_factory, args, refresh_accounts, environment)

	log.info('Account refresh completed')


if __name__ == '__main__':
	asyncio.run(main())
