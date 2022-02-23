import argparse
import asyncio
import sqlite3
from pathlib import Path

from aiolimiter import AsyncLimiter

from puller.client.NemClient import NemClient
from puller.db.BalancesDatabase import BalancesDatabase
from puller.db.InProgressOptinDatabase import InProgressOptinDatabase

SNAPSHOT_HEIGHT = 3105500


def get_addresses(filename):
	with sqlite3.connect(f'file:{filename}?mode=ro', uri=True) as connection:
		in_progress_database = InProgressOptinDatabase(connection)

		return [optin_request.address for optin_request in in_progress_database.requests]


async def main():
	parser = argparse.ArgumentParser(description='download post optin account states')
	parser.add_argument('--node', help='NEM node url', default='http://superalice.nemmain.net:7890')
	parser.add_argument('--database-directory', help='output database directory', default='_temp')
	args = parser.parse_args()

	client = NemClient(args.node)
	addresses = set(get_addresses(Path(args.database_directory) / 'in_progress.db'))

	with sqlite3.connect(Path(args.database_directory) / 'balances.db') as connection:
		database = BalancesDatabase(connection)
		database.create_tables()

		limiter = AsyncLimiter(20, 1.0)

		async def get_state(address):
			async with limiter:
				account_balance = await client.historical_balance(str(address), SNAPSHOT_HEIGHT)
				database.add_account_balance(account_balance[0].bytes, account_balance[1])

				print('.', end='', flush=True)

		tasks = list(map(get_state, addresses))
		await asyncio.gather(*tasks)

	print('*** *** ***')


asyncio.run(main())
