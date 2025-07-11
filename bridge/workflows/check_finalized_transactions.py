import asyncio

from symbollightapi.connector.ConnectorExtensions import filter_finalized_transactions

from .main_impl import main_bootstrapper


async def _check_finalized_transactions(database, network):
	payout_transaction_hashes = database.unconfirmed_payout_transaction_hashes()
	print(f'found {len(payout_transaction_hashes)} unconfirmed payout transaction hashes')

	connector = network.create_connector()
	transaction_hash_height_pairs = await filter_finalized_transactions(connector, payout_transaction_hashes)
	print(f'found {len(transaction_hash_height_pairs)} finalized payout transactions')

	for hash_height_pair in transaction_hash_height_pairs:
		database.mark_payout_completed(*hash_height_pair)
		print(f'> marking payout transaction {hash_height_pair[0]} complete at height {hash_height_pair[1]}')


async def main_impl(is_unwrap_mode, databases, native_facade, wrapped_facade):
	if is_unwrap_mode:
		await _check_finalized_transactions(databases.unwrap_request, native_facade)
	else:
		await _check_finalized_transactions(databases.wrap_request, wrapped_facade)


if '__main__' == __name__:
	asyncio.run(main_bootstrapper('check finalized transactions', main_impl))
