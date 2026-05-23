import argparse
from asyncio import run

from zenlog import log

from puller.facade.NemPuller import NemPuller


def parse_args():
	"""Parse command line arguments."""

	parser = argparse.ArgumentParser(description='refresh NEM account vested balance and importance')
	parser.add_argument('--nem-node', help='NEM node(local) url', default='http://localhost:7890')
	parser.add_argument('--network', help='mainnet or testnet', choices=['mainnet', 'testnet'], default='mainnet')
	parser.add_argument('--db-config', help='database config file *.ini', default='config.ini')
	parser.add_argument('--batch-size', help='number of accounts to refresh per database batch', type=int, default=500)

	args = parser.parse_args()
	if args.batch_size <= 0:
		parser.error('--batch-size must be greater than 0')

	return args


async def main():
	args = parse_args()

	facade = NemPuller(args.nem_node, args.db_config, args.network)

	log.info(f'Node URL: {args.nem_node}')
	log.info(f'Network: {args.network}')
	log.info(f'Batch size: {args.batch_size}')

	with facade.nem_db:
		total_refreshed = await facade.refresh_accounts(args.batch_size)

	log.info(f'Refreshed {total_refreshed} accounts')


if __name__ == '__main__':
	run(main())
