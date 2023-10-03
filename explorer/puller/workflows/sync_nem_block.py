import argparse
import json
from asyncio import run

from zenlog import log

from facade.NemPuller import NemPuller


def parse_args():
	"""Parse command line arguments."""

	parser = argparse.ArgumentParser(description='sync blocks from network')
	parser.add_argument('--nem-node', help='NEM node(local) url', default='http://localhost:7890')
	parser.add_argument('--network', help='mainnet or testnet', choices=['mainnet', 'testnet'], default='mainnet')
	parser.add_argument('--db-config', help='database config file *.ini', default='config.ini')
	parser.add_argument('--account-remarks', help='account remarks info', default='./resources/account_remark.json')
	return parser.parse_args()


async def main():
	args = parse_args()

	facade = NemPuller(args.nem_node, args.db_config, args.network)

	log.info(f'Node URL: {args.nem_node}')
	log.info(f'Network: {args.network}')

	with facade.nem_db as databases:
		databases.create_tables()

		# pre insert account remarks
		with open(args.account_remarks, 'rt', encoding='utf8') as remark_file:
			data = json.load(remark_file)
			databases.insert_account_remarks_from_json(data)

		db_height = databases.get_current_height()
		log.info(f'current database height: {db_height}')
		chain_height = await facade.nem_connector.chain_height()

		# save Nemesis Block
		if db_height == 0:
			await facade.sync_nemesis_block()
			db_height = 1

		# sync network blocks in database
		await facade.sync_blocks(db_height, chain_height)

		log.info('Database is up to date')

if __name__ == '__main__':
	run(main())
