import argparse
from asyncio import run

from zenlog import log

from facade.NemPullerFacade import NemPullerFacade


def parse_args():
	"""Parse command line arguments."""

	parser = argparse.ArgumentParser(description='sync blocks from network')
	parser.add_argument('--nem-node', help='NEM node(local) url', default='http://localhost:7890')
	parser.add_argument('--db-config', help='database config file *.ini', default='config.ini')
	return parser.parse_args()


async def main():
	args = parse_args()

	facade = NemPullerFacade(args.nem_node, args.db_config)

	await facade.setup_facade()

	log.info(f'Node URL: {args.nem_node}')

	with facade.database() as databases:
		databases.create_tables()

		db_height = databases.get_current_height()
		log.info(f'current database height: {db_height}')
		chain_height = await facade.client().height()

		# save Nemesis Block
		if db_height == 0:
			await facade.sync_nemesis_block()
			db_height = 1

		# sync network blocks in database
		await facade.sync_blocks(db_height, chain_height)

		log.info('Database is up to date')

if __name__ == '__main__':
	run(main())
