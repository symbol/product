import asyncio

from symbollightapi.connector.ConnectorExtensions import filter_finalized_transactions, query_block_timestamps

from .main_impl import main_bootstrapper


async def main_impl(databases, _native_network, wrapped_network):
	payout_transaction_hashes = databases.wrap_request.unconfirmed_payout_transaction_hashes()
	print(f'found {len(payout_transaction_hashes)} unconfirmed payout transaction hashes')

	connector = wrapped_network.facade.create_connector()
	transaction_hash_height_pairs = await filter_finalized_transactions(connector, payout_transaction_hashes)
	print(f'found {len(transaction_hash_height_pairs)} finalized payout transactions')

	for hash_height_pair in transaction_hash_height_pairs:
		databases.wrap_request.mark_payout_completed(*hash_height_pair)
		print(f'marking payout transaction {hash_height_pair[0]} complete at height {hash_height_pair[1]}')

	heights = {hash_height_pair[1] for hash_height_pair in transaction_hash_height_pairs}
	print(f'found {len(heights)} block heights')

	block_height_timestamp_pairs = await query_block_timestamps(connector, heights)
	for height_timestamp_pair in block_height_timestamp_pairs:
		databases.wrap_request.set_block_timestamp(*height_timestamp_pair)
		print(f'saving block {height_timestamp_pair[0]} with timestamp {height_timestamp_pair[1]}')


if '__main__' == __name__:
	asyncio.run(main_bootstrapper('check finalized transactions', main_impl))
