import argparse
from asyncio import run

from zenlog import log

from puller.workflows.nem_workflow_utils import add_common_arguments, bootstrap_nem_workflow


def parse_args():
	"""Parse command line arguments."""

	parser = argparse.ArgumentParser(description='sync blocks from network')
	add_common_arguments(parser)
	parser.add_argument('--account-remark', help='optional account remark seed JSON file')
	return parser.parse_args()


async def main():
	args = parse_args()
	facade = bootstrap_nem_workflow(args)

	with facade.nem_db as databases:
		databases.create_tables()

		if args.account_remark:
			databases.seed_account_remark(args.account_remark)

		db_height = databases.get_current_height()
		chain_height = await facade.nem_connector.chain_height()

		log.info(f'current database height: {db_height}')

		# save Nemesis Block
		if db_height == 0:
			await facade.sync_nemesis_block()
			db_height = 1

		fork_height = await facade.detect_rollback(db_height, chain_height)
		if fork_height is not None:
			log.warning(f'Rollback detected at height: {fork_height}')
			rollback_impact = facade.capture_rollback_impact(fork_height)
			account_state = await facade.prefetch_rollback_account_state(rollback_impact)
			facade.repair_rollback(rollback_impact, account_state)
			db_height = fork_height

		# sync network blocks in database
		await facade.sync_blocks(db_height, chain_height)

	log.info('Database is up to date')

if __name__ == '__main__':
	run(main())
