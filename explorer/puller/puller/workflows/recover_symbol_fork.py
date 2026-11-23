from zenlog import log

from puller.facade.SymbolPuller import SymbolPuller
from puller.workflows.symbol_workflow_utils import add_common_arguments, run_symbol_workflow


def add_arguments(parser):
	"""Adds the retained height and hash required to revalidate a terminal stop."""

	add_common_arguments(parser)
	parser.add_argument('--candidate-height', required=True, type=int, help='retained height at or below node finality, or zero for genesis')
	parser.add_argument('--candidate-hash', required=True, help='64 hexadecimal digits for the retained block hash')
	parser.set_defaults(run_main=run_main)


async def run_main(args, symbol_puller_factory=SymbolPuller, environment=None):
	"""Revalidates additional fork evidence under the Symbol workflow lock."""

	async def recover_fork(puller):
		await puller.recover_fork(args.candidate_height, args.candidate_hash)

	await run_symbol_workflow(symbol_puller_factory, args, recover_fork, environment)
	log.info('Symbol fork reconciliation reopened after evidence verification')
