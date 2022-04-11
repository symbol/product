import argparse
import asyncio

from aiolimiter import AsyncLimiter

from puller.client.NemClient import NemClient
from puller.db.Databases import Databases


def parse_args():
	parser = argparse.ArgumentParser(description='download postoptin transactions')
	parser.add_argument('--nem-node', help='NEM node url', default='http://mercury.elxemental.cloud:7890')
	parser.add_argument('--database-directory', help='output database directory', default='_temp')
	return parser.parse_args()


async def main():
	args = parse_args()
	nem_client = NemClient(args.nem_node)

	with Databases(args.database_directory) as databases:
		databases.completed.create_tables()

		heights = databases.completed.transaction_heights()
		existing_block_heights = set(map(lambda tuple: tuple[0], databases.completed.block_timestamps()))

	height_timestamp_map = {}
	limiter = AsyncLimiter(20, 1.0)

	async def get_block_headers(height):
		async with limiter:
			headers = await nem_client.block_headers(height)
			height_timestamp_map[headers['height']] = headers['timeStamp']

	tasks = list(map(get_block_headers, filter(lambda height: height not in existing_block_heights, heights)))
	print(f'collecting {len(tasks)} blocks, this will take a bit')
	await asyncio.gather(*tasks)

	if not height_timestamp_map:
		return

	print('inserting timestamps')
	with Databases(args.database_directory) as databases:
		databases.completed.insert_block_timestamps(height_timestamp_map)


if '__main__' == __name__:
	asyncio.run(main())
