import asyncio

from puller.client.NemClient import NemClient, get_incoming_transactions_from
from puller.processors.NemOptinProcessor import process_nem_optin_request

# example for downloading post optins.
# this is placeholder as successes will need to undergo more processing and be inserted into database.


async def main():
	client = NemClient('http://mercury.elxemental.cloud:7890')

	count = 0
	error_count = 0
	async for transaction in get_incoming_transactions_from(client, 'NAQ7RCYM4PRUAKA7AMBLN4NPBJEJMRCHHJYAVA72', 3105500):
		transaction_height = transaction['meta']['height']
		if process_nem_optin_request(transaction).is_error:
			print(f'{transaction_height} ERROR')
			error_count += 1
		else:
			print(f'{transaction_height} SUCCESS')

		count += 1

	print('*** *** ***')
	print(f'==> {count} (errors {error_count})')


asyncio.run(main())
