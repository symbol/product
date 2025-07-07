import asyncio

from aiolimiter import AsyncLimiter

from ..model.Constants import DEFAULT_ASYNC_LIMITER_ARGUMENTS

# region get_incoming_transactions_from


async def get_incoming_transactions_from(connector, address, start_height=None, end_height=None):
	"""Uses the specified connector to retrieve all transactions sent to an account in the range [start_height, end_height)."""

	start_id = None
	while True:
		transactions_json = await connector.incoming_transactions(address, start_id)
		if not transactions_json:
			return

		for transaction_json in transactions_json:
			transaction_height = int(transaction_json['meta']['height'])
			if start_height and transaction_height < start_height:
				return

			if end_height and transaction_height >= end_height:
				continue

			yield transaction_json

		start_id = connector.extract_transaction_id(transactions_json[-1])

# endregion


# region filter_finalized_transactions

async def filter_finalized_transactions(connector, transaction_hashes):
	"""Filters transaction hashes and returns only finalized ones with heights."""

	finalized_chain_height = await connector.finalized_chain_height()
	transaction_hash_height_pairs = await connector.filter_confirmed_transactions(transaction_hashes)
	return list(filter(
		lambda transaction_hash_height_pair: transaction_hash_height_pair[1] <= finalized_chain_height,
		transaction_hash_height_pairs))

# endregion


# region query_block_timestamps

async def query_block_timestamps(connector, heights, async_limiter_arguments=DEFAULT_ASYNC_LIMITER_ARGUMENTS):
	"""Finds the timestamps for all blocks with the specified heights."""

	limiter = AsyncLimiter(*async_limiter_arguments)

	async def get_block_height_timestamp_pair(height):
		async with limiter:
			block_json = await connector.block_headers(height)
			timestamp = connector.extract_block_timestamp(block_json)
			return (height, timestamp)

	tasks = [get_block_height_timestamp_pair(height) for height in heights]
	block_height_timestamp_pairs = await asyncio.gather(*tasks)
	return block_height_timestamp_pairs

# endregion
