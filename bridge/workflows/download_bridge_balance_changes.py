import asyncio

from aiolimiter import AsyncLimiter

from bridge.NetworkUtils import download_rosetta_block_balance_changes

from .main_impl import main_bootstrapper


async def main_impl(databases, _native_network, wrapped_network):
	finalized_chain_height = await wrapped_network.connector.finalized_chain_height()
	end_height = finalized_chain_height + 1

	database_height = databases.balance_change.max_processed_height()
	start_height = max(int(wrapped_network.facade.config.extensions.get('balance_change_scan_start_height', 0)), database_height) + 1

	print(f'searching blockchain for balance changes to {wrapped_network.bridge_address} in range [{start_height}, {end_height})...')

	limiter = AsyncLimiter(20, 0.1)

	async def process_block_balance_changes(height):
		async with limiter:
			balance_changes = await download_rosetta_block_balance_changes(
				wrapped_network.connector,
				*wrapped_network.facade.rosetta_network_id,
				height)
			count = databases.balance_change.add_transfers_filtered_by_address(height, balance_changes, wrapped_network.bridge_address)

			print('.', end='', flush=True)
			return count

	tasks = [process_block_balance_changes(height) for height in range(start_height, end_height)]
	counts = await asyncio.gather(*tasks)

	# add marker in database to indicate last height processed
	databases.balance_change.add_transfer(finalized_chain_height, '', 0)

	print('*** *** ***')
	print(f'==> last processed transaction height: {databases.balance_change.max_processed_height()}')
	print(f'==>   total balance changes processed: {sum(counts)}')


if '__main__' == __name__:
	asyncio.run(main_bootstrapper('download bridge balance changes', main_impl))
