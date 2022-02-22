import asyncio
import sqlite3

from puller.client.NemClient import NemClient, get_incoming_transactions_from
from puller.db.InProgressOptinDatabase import InProgressOptinDatabase
from puller.processors.NemOptinProcessor import process_nem_optin_request

# example for downloading post optins.
# this is placeholder as successes will need to undergo more processing and be inserted into database.


async def main():
	client = NemClient('http://mercury.elxemental.cloud:7890')

	with sqlite3.connect(':memory:') as connection:
		database = InProgressOptinDatabase(connection)
		database.create_tables()

		count = 0
		error_count = 0
		async for transaction in get_incoming_transactions_from(client, 'NAQ7RCYM4PRUAKA7AMBLN4NPBJEJMRCHHJYAVA72', 3105500):
			transaction_height = transaction['meta']['height']
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
	print(f'==> {count} (errors {error_count})')


asyncio.run(main())
