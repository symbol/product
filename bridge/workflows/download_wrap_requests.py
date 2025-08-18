import asyncio

from symbollightapi.connector.ConnectorExtensions import get_incoming_transactions_from, query_block_timestamps

from bridge.models.WrapRequest import coerce_zero_balance_wrap_request_to_error
from bridge.WorkflowUtils import calculate_search_range

from .main_impl import main_bootstrapper, print_banner


async def _download_requests(database, connector, network, is_valid_address):
	(start_height, end_height) = await calculate_search_range(connector, database, network.config.extensions)
	mosaic_id = network.extract_mosaic_id()

	print('\n'.join([
		f'searching address {network.transaction_search_address}',
		f'  for {mosaic_id.formatted} deposits',
		f'  in range [{start_height}, {end_height})...'
	]))

	database.reset()

	count = 0
	error_count = 0
	heights = set()
	async for transaction in get_incoming_transactions_from(connector, network.transaction_search_address, start_height, end_height):
		results = network.extract_wrap_request_from_transaction(is_valid_address, transaction, mosaic_id.id)
		for result in results:
			result = coerce_zero_balance_wrap_request_to_error(result)
			if result.is_error:
				database.add_error(result.error)
				heights.add(result.error.transaction_height)
				error_count += 1
			else:
				database.add_request(result.request)
				heights.add(result.request.transaction_height)
				count += 1

	# add marker in database to indicate last height processed
	database.set_max_processed_height(end_height - 1)
	heights.add(end_height - 1)

	print_banner([
		f'==> last processed transaction height: {database.max_processed_height()}',
		f'==>      total transactions processed: {count}',
		f'==>        total transactions errored: {error_count}'
	])

	return heights


async def _download_block_timestamps(database, connector, heights):
	print(f'detected transactions in {len(heights)} blocks, looking up timestamps...')
	block_height_timestamp_pairs = await query_block_timestamps(connector, heights)
	for height_timestamp_pair in block_height_timestamp_pairs:
		print(f'> saving block {height_timestamp_pair[0]} with timestamp {height_timestamp_pair[1]}')
		database.set_block_timestamp(*height_timestamp_pair)


async def _download_all(database, network, is_valid_address):
	connector = network.create_connector()
	heights = await _download_requests(database, connector, network, is_valid_address)
	await _download_block_timestamps(database, connector, heights)


async def main_impl(is_unwrap_mode, databases, native_facade, wrapped_facade, _price_oracle):
	if is_unwrap_mode:
		await _download_all(databases.unwrap_request, wrapped_facade, native_facade.is_valid_address)
	else:
		await _download_all(databases.wrap_request, native_facade, wrapped_facade.is_valid_address)


if '__main__' == __name__:
	asyncio.run(main_bootstrapper('download wrap or unwrap requests', main_impl))
