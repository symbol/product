import argparse
import asyncio
import sqlite3

from symbolchain.nem.Network import Address

from puller.client.NemClient import NemClient, get_incoming_transactions_from
from puller.db.InProgressOptinDatabase import InProgressOptinDatabase
from puller.processors.NemOptinProcessor import process_nem_optin_request

# example for downloading post optins.
# this is placeholder as successes will need to undergo more processing and be inserted into database.


OPTIN_ADDRESS = Address('NAQ7RCYM4PRUAKA7AMBLN4NPBJEJMRCHHJYAVA72')
SNAPSHOT_HEIGHT = 3105500


async def main():
	parser = argparse.ArgumentParser(description='download postoptin transactions')
	parser.add_argument('--node', help='NEM node url', default='http://mercury.elxemental.cloud:7890')
	parser.add_argument('--database', help='output database connection string', default='optin.db')
	args = parser.parse_args()

	client = NemClient(args.node)

	with sqlite3.connect(args.database) as connection:
		database = InProgressOptinDatabase(connection)
		database.create_tables()

		count = 0
		error_count = 0

		database_height = database.max_processed_height()
		start_height = max(SNAPSHOT_HEIGHT, database_height + 1)
		print(F'processing opt-in transactions from {start_height}')

		async for transaction in get_incoming_transactions_from(client, OPTIN_ADDRESS, SNAPSHOT_HEIGHT):
			transaction_height = transaction['meta']['height']
			if transaction_height <= database_height:
				break

			process_result = process_nem_optin_request(transaction)
			if process_result.is_error:
				print(f'{transaction_height} ERROR')
				database.add_error(process_result)
				error_count += 1
			else:
				print(f'{transaction_height} SUCCESS')
				database.add_request(process_result)

			count += 1

		print('*** *** ***')
		print(f'==> last processed transaction height: {database.max_processed_height()}')
		print(f'==>      total transactions processed: {count}')
		print(f'==>        total transactions errored: {error_count}')


if '__main__' == __name__:
	asyncio.run(main())
