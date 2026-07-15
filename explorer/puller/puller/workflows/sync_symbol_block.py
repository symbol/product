import argparse
import asyncio

from puller.facade.SymbolPuller import SymbolPuller
from puller.workflows.symbol_workflow_utils import add_common_arguments, run_symbol_workflow


def _positive_int(value):
	parsed_value = int(value)
	if parsed_value < 1:
		raise argparse.ArgumentTypeError('must be greater than or equal to 1')

	return parsed_value


def parse_args(argv=None):
	"""Parses command line arguments."""

	parser = argparse.ArgumentParser(description='Synchronize Symbol block headers.')
	add_common_arguments(parser)
	parser.add_argument('--max-height', type=_positive_int, help='maximum block height to sync for manual validation')
	parser.add_argument('--max-requests-per-second', type=_positive_int, help='maximum Symbol node requests per second')

	return parser.parse_args(argv)


async def main(symbol_puller_factory=SymbolPuller, argv=None, environment=None):
	"""Synchronizes Symbol block headers."""

	args = parse_args(argv)
	puller_kwargs = {}
	if args.max_requests_per_second is not None:
		puller_kwargs['max_requests_per_second'] = args.max_requests_per_second

	async def sync_block_headers(puller):
		await puller.sync_block_headers(args.max_height)

	await run_symbol_workflow(symbol_puller_factory, args, sync_block_headers, environment, puller_kwargs)


if '__main__' == __name__:  # pragma: no cover
	asyncio.run(main())  # pragma: no cover
