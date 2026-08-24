import argparse
from asyncio import run

from zenlog import log

from puller.workflows.nem_workflow_utils import add_common_arguments, bootstrap_nem_workflow


def parse_args():
	"""Parse command line arguments."""

	parser = argparse.ArgumentParser(description='refresh NEM account vested balance and importance')
	add_common_arguments(parser)
	parser.add_argument('--batch-size', help='number of accounts to refresh per database batch', type=int, default=500)

	args = parser.parse_args()
	if args.batch_size <= 0:
		parser.error('--batch-size must be greater than 0')

	return args


async def main():
	args = parse_args()
	facade = bootstrap_nem_workflow(args)

	log.info(f'Batch size: {args.batch_size}')

	with facade.nem_db:
		total_refreshed = await facade.refresh_accounts(args.batch_size)

	log.info(f'Refreshed {total_refreshed} accounts')


if __name__ == '__main__':
	run(main())
