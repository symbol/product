import argparse
import asyncio

from aiolimiter import AsyncLimiter

from puller.client.SymbolClient import SymbolClient
from puller.db.Databases import Databases


async def download_symbol_timestamps_into(database_directory, database_name, symbol_client):
	network = await symbol_client.node_network()

	with Databases(database_directory, network.name) as databases:
		database = getattr(databases, database_name)
		database.create_tables()

		transaction_hashes = database.unconfirmed_payout_transaction_hashes()

	transaction_metadata_map = {}
	limiter = AsyncLimiter(20, 1.0)

	async def get_transaction_metadata(transaction_hash):
		async with limiter:
			transaction_metadata_pair = await symbol_client.transaction_confirmed(transaction_hash)
			if 'meta' not in transaction_metadata_pair:
				return  # likely not yet confirmed, so retry later

			transaction_metadata = transaction_metadata_pair['meta']
			transaction_metadata_map[transaction_hash] = {
				'height': int(transaction_metadata['height']),
				'timestamp': int(transaction_metadata['timestamp'])
			}

			print('.', end='', flush=True)

	tasks = list(map(get_transaction_metadata, transaction_hashes))
	print(f'collecting {len(tasks)} transactions, this will take a bit')
	await asyncio.gather(*tasks)

	print('inserting timestamps')
	with Databases(database_directory, network.name) as databases:
		database = getattr(databases, database_name)

		for transction_hash, transaction_metadata in transaction_metadata_map.items():
			database.set_payout_transaction_metadata(
				transction_hash,
				transaction_metadata['height'],
				transaction_metadata['timestamp'])


async def main():
	parser = argparse.ArgumentParser(description='download Symbol timestamps')
	parser.add_argument('--symbol-node', help='Symbol node url', default='http://wolf.importance.jp:3000')
	parser.add_argument('--database-directory', help='output database directory', default='_temp')
	args = parser.parse_args()

	symbol_client = SymbolClient(args.symbol_node)

	print('processing inprogress')
	await download_symbol_timestamps_into(args.database_directory, 'inprogress', symbol_client)


if '__main__' == __name__:
	asyncio.run(main())
