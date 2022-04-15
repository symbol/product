import argparse
import asyncio

from aiolimiter import AsyncLimiter

from puller.client.NemClient import NemClient
from puller.db.Databases import Databases


async def download_nem_timestamps_into(database_directory, database_name, nem_client):
	network = await nem_client.node_network()

	with Databases(database_directory, network.name) as databases:
		database = getattr(databases, database_name)
		database.create_tables()

		heights = database.optin_transaction_heights()
		existing_block_heights = set(map(lambda tuple: tuple[0], database.nem_block_timestamps()))

	height_timestamp_map = {}
	limiter = AsyncLimiter(20, 1.0)

	async def get_block_headers(height):
		async with limiter:
			headers = await nem_client.block_headers(height)
			height_timestamp_map[headers['height']] = headers['timeStamp']

			print('.', end='', flush=True)

	tasks = list(map(get_block_headers, filter(lambda height: height not in existing_block_heights, heights)))
	print(f'collecting {len(tasks)} blocks, this will take a bit')
	await asyncio.gather(*tasks)

	if not height_timestamp_map:
		return

	print('inserting timestamps')
	with Databases(database_directory, network.name) as databases:
		database = getattr(databases, database_name)
		database.insert_nem_block_timestamps(height_timestamp_map)


async def main():
	parser = argparse.ArgumentParser(description='download NEM timestamps')
	parser.add_argument('--nem-node', help='NEM node url', default='http://mercury.elxemental.cloud:7890')
	parser.add_argument('--database-directory', help='output database directory', default='_temp')
	args = parser.parse_args()

	nem_client = NemClient(args.nem_node)

	for name in ('completed', 'inprogress'):
		print(f'processing {name}')
		await download_nem_timestamps_into(args.database_directory, name, nem_client)
		print()


if '__main__' == __name__:
	asyncio.run(main())
