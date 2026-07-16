from zenlog import log

from puller.facade.SymbolPuller import SymbolPuller
from puller.workflows.symbol_workflow_utils import add_common_arguments, run_symbol_workflow


def add_arguments(parser):
	"""Adds the refresh-accounts command arguments to a parser."""

	add_common_arguments(parser)
	parser.set_defaults(run_main=run_main)


async def run_main(args, symbol_puller_factory=SymbolPuller, environment=None):
	"""Refreshes Symbol account population for parsed command arguments."""

	async def refresh_accounts(puller):
		await puller.refresh_accounts()

	await run_symbol_workflow(symbol_puller_factory, args, refresh_accounts, environment)

	log.info('Account refresh completed')
