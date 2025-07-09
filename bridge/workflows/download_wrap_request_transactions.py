import asyncio

from symbollightapi.connector.ConnectorExtensions import get_incoming_transactions_from

from .main_impl import main_bootstrapper


async def main_impl(databases, native_network, wrapped_network):
	finalized_chain_height = await native_network.connector.finalized_chain_height()
	end_height = finalized_chain_height + 1

	database_height = databases.wrap_request.max_processed_height()
	start_height = database_height + 1

	print(f'searching address {native_network.bridge_address} for deposits in range [{start_height}, {end_height})...')

	count = 0
	error_count = 0
	async for transaction in get_incoming_transactions_from(native_network.connector, native_network.bridge_address, start_height):
		results = native_network.facade.extract_wrap_request_from_transaction(wrapped_network.facade.is_valid_address_string, transaction)
		for result in results:
			if result.is_error:
				databases.wrap_request.add_error(result.error)
				error_count += 1
			else:
				databases.wrap_request.add_request(result.request)

			count += 1

	print('*** *** ***')
	print(f'==> last processed transaction height: {databases.wrap_request.max_processed_height()}')
	print(f'==>      total transactions processed: {count}')
	print(f'==>        total transactions errored: {error_count}')


if '__main__' == __name__:
	asyncio.run(main_bootstrapper('download wrap request transactions', main_impl))
