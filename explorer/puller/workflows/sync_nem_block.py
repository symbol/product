import argparse
from asyncio import run

from symbolchain.CryptoTypes import PublicKey
from symbolchain.facade.NemFacade import NemFacade
from zenlog import log

from facade.NemPullerFacade import NemPullerFacade
from model.Block import Block


def parse_args():
	"""Parse command line arguments."""

	parser = argparse.ArgumentParser(description='sync blocks from network')
	parser.add_argument('--nem-node', help='NEM node(local) url', default='http://localhost:7890')
	parser.add_argument('--db-config', help='database config file *.ini', default='config.ini')
	return parser.parse_args()


async def save_nemesis_block(nem_client, databases, nem_facade):
	"""Save the Nemesis block."""

	block = await nem_client.get_block(1)

	save_block = Block(
		block['height'],
		Block.convert_timestamp_to_datetime(nem_facade, block['timeStamp']),
		0,
		len(block['transactions']),
		0,
		'#',
		str(nem_facade.network.public_key_to_address(PublicKey(block['signer'])))
	)

	databases.insert_block(save_block.to_dict())


async def sync_blocks(nem_client, databases, db_height, chain_height, nem_facade):
	"""Sync network blocks in the database."""

	# sync network blocks in database
	while chain_height > db_height:

		blocks = await nem_client.get_blocks_after(db_height)

		for block in blocks['data']:
			save_block = Block.from_nem_block_data(block, nem_facade)
			databases.insert_block(save_block.to_dict())

		db_height = blocks['data'][-1]['block']['height']

		log.info(f'added block from height {blocks["data"][0]["block"]["height"]} - {blocks["data"][-1]["block"]["height"]}')


async def main():
	args = parse_args()

	facade = NemPullerFacade(args.nem_node, args.db_config)

	nem_client = facade.client()
	nem_databases = facade.database

	nem_network = await nem_client.node_network()
	nem_facade = NemFacade(nem_network.name)

	log.info(f'Node URL: {args.nem_node}')
	log.info(f'Syncing with network {nem_network}')

	with nem_databases() as databases:
		databases.create_tables()

		db_height = databases.get_current_height()
		log.info(f'current database height: {db_height}')
		chain_height = await nem_client.height()

		# save Nemenesis Block
		if db_height == 0:
			await save_nemesis_block(nem_client, databases, nem_facade)
			db_height = 1

		# sync network blocks in database
		await sync_blocks(nem_client, databases, db_height, chain_height, nem_facade)

		log.info('Database is up to date')

if __name__ == '__main__':
	run(main())
