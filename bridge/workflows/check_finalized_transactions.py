import asyncio
import logging

from symbollightapi.connector.ConnectorExtensions import filter_finalized_transactions, query_block_timestamps

from bridge.db.WrapRequestDatabase import WrapRequestStatus
from bridge.WorkflowUtils import check_expiry

from .main_impl import main_bootstrapper


async def _check_finalized_transactions(database, payout_network, request_network):
	logger = logging.getLogger(__name__)

	payout_transaction_hashes = database.unconfirmed_payout_transaction_hashes()
	logger.info('found %s unconfirmed payout transaction hashes', len(payout_transaction_hashes))

	connector = payout_network.create_connector()
	transaction_hash_height_pairs = await filter_finalized_transactions(connector, payout_transaction_hashes)
	logger.info('found %s finalized payout transactions', len(transaction_hash_height_pairs))

	heights = set()
	for hash_height_pair in transaction_hash_height_pairs:
		database.mark_payout_completed(*hash_height_pair)
		heights.add(hash_height_pair[1])

	logger.info('detected transactions in %s blocks, looking up timestamps...', len(heights))
	block_height_timestamp_pairs = await query_block_timestamps(connector, heights)
	for height_timestamp_pair in block_height_timestamp_pairs:
		database.set_payout_block_timestamp(*height_timestamp_pair)

	logger.info('checking expired requests ...')
	sent_requests = database.requests_by_status(WrapRequestStatus.SENT)
	for request in sent_requests:
		error_message = check_expiry(request_network.config.extensions, database, request)
		if error_message:
			database.mark_payout_failed(request, error_message)


async def main_impl(execution_context, databases, native_facade, wrapped_facade, _price_oracle):
	if execution_context.is_unwrap_mode:
		await _check_finalized_transactions(databases.unwrap_request, native_facade, wrapped_facade)
	else:
		await _check_finalized_transactions(databases.wrap_request, wrapped_facade, native_facade)


if '__main__' == __name__:
	asyncio.run(main_bootstrapper('check finalized transactions', main_impl))
