import asyncio

from aiolimiter import AsyncLimiter
from symbollightapi.model.Constants import DEFAULT_ASYNC_LIMITER_ARGUMENTS
from symbollightapi.model.Exceptions import NodeException

from bridge.NetworkUtils import download_rosetta_block_balance_changes
from bridge.WorkflowUtils import calculate_search_range

from .main_impl import main_bootstrapper, print_banner

MAX_CONCURRENT_CONNECTION_COUNT = 20
MAX_RETRY_COUNT = 10


class BalanceChangesDownloader:
	def __init__(self, database, network):
		self.database = database
		self.network = network
		self.connector = self.network.create_connector(require_rosetta=True)

		self.semaphore = asyncio.Semaphore(MAX_CONCURRENT_CONNECTION_COUNT)  # limit concurrent connections
		self.limiter = AsyncLimiter(*DEFAULT_ASYNC_LIMITER_ARGUMENTS)  # limit connection bursts

	async def download(self, height):
		async with self.semaphore:
			async with self.limiter:
				for _ in range(MAX_RETRY_COUNT):
					try:
						count = await self._download(height)
						print('.', end='', flush=True)
						return count
					except NodeException:
						print('x', end='', flush=True)
						await asyncio.sleep(1)

				raise NodeException(f'all attempts to query height {height} failed')

	async def _download(self, height):
		balance_changes = await download_rosetta_block_balance_changes(
			self.connector,
			*self.network.rosetta_network_id,
			height)
		return self.database.add_transfers_filtered_by_address(height, balance_changes, self.network.bridge_address)


async def download_balance_changes(database, network):
	connector = network.create_connector()
	config_extensions = network.config.extensions
	(start_height, end_height) = await calculate_search_range(connector, database, config_extensions, 'balance_change_scan_start_height')

	print(f'searching blockchain for balance changes to {network.bridge_address} in range [{start_height}, {end_height})...')

	downloader = BalanceChangesDownloader(database, network)

	tasks = [downloader.download(height) for height in range(start_height, end_height)]
	counts = await asyncio.gather(*tasks)

	# add marker in database to indicate last height processed
	database.add_transfer(end_height - 1, '', 0)

	print()
	print_banner([
		f'==> last processed transaction height: {database.max_processed_height()}',
		f'==>   total balance changes processed: {sum(counts)}'
	])


async def main_impl(is_unwrap_mode, databases, native_facade, _wrapped_facade):
	if is_unwrap_mode:
		raise ValueError('this workflow is not compatible with unwrap mode')

	await download_balance_changes(databases.balance_change, native_facade)


if '__main__' == __name__:
	asyncio.run(main_bootstrapper('download bridge balance changes', main_impl))
