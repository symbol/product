import asyncio
import logging

from symbollightapi.connector.ConnectorExtensions import filter_finalized_transactions, query_block_timestamps

from .main_impl import main_bootstrapper


async def _check_finalized_transactions(database, network):
	logger = logging.getLogger(__name__)

	payout_transaction_hashes = database.unconfirmed_payout_transaction_hashes()
	logger.info('found %s unconfirmed payout transaction hashes', len(payout_transaction_hashes))

	connector = network.create_connector()
	transaction_hash_height_pairs = await filter_finalized_transactions(connector, payout_transaction_hashes)
	logger.info('found %s finalized payout transactions', len(transaction_hash_height_pairs))

	heights = set()
	for hash_height_pair in transaction_hash_height_pairs:
		logger.info('> marking payout transaction %s complete at height %s', hash_height_pair[0], hash_height_pair[1])
		database.mark_payout_completed(*hash_height_pair)
		heights.add(hash_height_pair[1])

	logger.info('detected transactions in %s blocks, looking up timestamps...', len(heights))
	block_height_timestamp_pairs = await query_block_timestamps(connector, heights)
	for height_timestamp_pair in block_height_timestamp_pairs:
		logger.info('> saving block %s with timestamp %s', height_timestamp_pair[0], height_timestamp_pair[1])
		database.set_payout_block_timestamp(*height_timestamp_pair)


async def main_impl(is_unwrap_mode, databases, native_facade, wrapped_facade, _price_oracle):
	if is_unwrap_mode:
		await _check_finalized_transactions(databases.unwrap_request, native_facade)
	else:
		await _check_finalized_transactions(databases.wrap_request, wrapped_facade)


if '__main__' == __name__:
	asyncio.run(main_bootstrapper('check finalized transactions', main_impl))
