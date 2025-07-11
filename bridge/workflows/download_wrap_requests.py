import asyncio

from symbollightapi.connector.ConnectorExtensions import get_incoming_transactions_from, query_block_timestamps

from bridge.WorkflowUtils import calculate_search_range, extract_mosaic_id

from .main_impl import main_bootstrapper, print_banner


async def _download_requests(database, connector, network, is_valid_address):
	(start_height, end_height) = await calculate_search_range(connector, database)
	mosaic_id = extract_mosaic_id(network.config, network.is_currency_mosaic_id)

	print(f'searching address {network.bridge_address} for {mosaic_id.formatted} deposits in range [{start_height}, {end_height})...')

	count = 0
	error_count = 0
	heights = set()
	async for transaction in get_incoming_transactions_from(connector, network.bridge_address, start_height, end_height):
		results = network.extract_wrap_request_from_transaction(is_valid_address, transaction, *mosaic_id.args)
		for result in results:
			if result.is_error:
				database.add_error(result.error)
				error_count += 1
			else:
				database.add_request(result.request)
				heights.add(result.request.transaction_height)
				count += 1

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
		database.set_block_timestamp(*height_timestamp_pair)
		print(f'> saving block {height_timestamp_pair[0]} with timestamp {height_timestamp_pair[1]}')


async def _download_all(database, network, is_valid_address):
	connector = network.create_connector()
	heights = await _download_requests(database, connector, network, is_valid_address)
	await _download_block_timestamps(database, connector, heights)


async def main_impl(is_unwrap_mode, databases, native_facade, wrapped_facade):
	if is_unwrap_mode:
		await _download_all(databases.unwrap_request, wrapped_facade, native_facade.is_valid_address_string)
	else:
		await _download_all(databases.wrap_request, native_facade, wrapped_facade.is_valid_address_string)


if '__main__' == __name__:
	asyncio.run(main_bootstrapper('download wrap or unwrap requests', main_impl))
