import argparse
import asyncio
import sqlite3
from pathlib import Path

from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address

from puller.client.NemClient import NemClient, get_incoming_transactions_from
from puller.client.SymbolClient import SymbolClient
from puller.db.InProgressOptinDatabase import InProgressOptinDatabase, OptinRequestStatus
from puller.processors.AccountChecker import check_destination_availability
from puller.processors.NemOptinProcessor import process_nem_optin_request

# example for downloading post optins.
# this is placeholder as successes will need to undergo more processing and be inserted into database.


OPTIN_ADDRESS = 'NAQ7RCYM4PRUAKA7AMBLN4NPBJEJMRCHHJYAVA72'
PAYOUT_SIGNER_PUBLIC_KEYS = '7AEC08AA66CB50B0C3D180DE7508D5D82ECEDCDC9E73F61FA7069868BEABA856'


def parse_args():
	parser = argparse.ArgumentParser(description='download postoptin transactions')
	parser.add_argument('--nem-node', help='NEM node url', default='http://mercury.elxemental.cloud:7890')
	parser.add_argument('--symbol-node', help='Symbol node url', default='http://wolf.importance.jp:3000')
	parser.add_argument('--database-directory', help='output database directory', default='_temp')
	parser.add_argument('--optin-address', help='optin account address', default=OPTIN_ADDRESS)
	parser.add_argument('--payout-signer-public-keys', help='payout signer public keys (comma separated)', default=PAYOUT_SIGNER_PUBLIC_KEYS)
	parser.add_argument('--snapshot-height', help='snapshot height', default=3105500)
	return parser.parse_args()


async def process_transaction(transaction, nem_client, symbol_client, database, payout_signer_public_keys):
	transaction_height = transaction['meta']['height']

	nem_network = await nem_client.node_network()
	symbol_network = await symbol_client.node_network()

	process_result = process_nem_optin_request(nem_network, transaction)
	if not process_result.is_error:
		process_result = await check_destination_availability(process_result, nem_client, symbol_client)

	if process_result.is_error:
		print(f'{transaction_height} ERROR: {process_result.message}')
		database.add_error(process_result)
	else:
		destination_address = symbol_network.public_key_to_address(process_result.destination_public_key)
		for payout_signer_public_key in payout_signer_public_keys:
			optin_transaction_infos = await symbol_client.find_payout_transactions(PublicKey(payout_signer_public_key), destination_address)
			optin_transaction_info = next((info for info in optin_transaction_infos if process_result.address == info.address), None)
			if optin_transaction_info:
				print(f'{transaction_height} SUCCESS (DUPLICATE) (from {payout_signer_public_key})')
				database.add_request(process_result)
				database.set_request_status(process_result, OptinRequestStatus.DUPLICATE, optin_transaction_info.transaction_hash)
				return process_result

		print(f'{transaction_height} SUCCESS (NEW)')
		database.add_request(process_result)

	return process_result


async def main():
	# pylint: disable=too-many-locals

	args = parse_args()

	nem_client = NemClient(args.nem_node)
	symbol_client = SymbolClient(args.symbol_node)

	finalized_height = await nem_client.finalized_height()
	snapshot_height = int(args.snapshot_height)

	payout_signer_public_keys = [PublicKey(public_key) for public_key in args.payout_signer_public_keys.split(',')]

	print('payout signer public keys')
	for public_key in payout_signer_public_keys:
		print(f' * {public_key}')

	with sqlite3.connect(Path(args.database_directory) / 'in_progress.db') as connection:
		database = InProgressOptinDatabase(connection)
		database.create_tables()

		count = 0
		error_count = 0

		database_height = database.max_processed_height()
		start_height = max(snapshot_height, database_height + 1)
		print(f'processing opt-in transactions from {start_height} to {finalized_height}')

		async for transaction in get_incoming_transactions_from(nem_client, Address(args.optin_address), snapshot_height):
			transaction_height = transaction['meta']['height']
			if transaction_height > finalized_height:
				continue

			if transaction_height <= database_height:
				break

			process_result = await process_transaction(transaction, nem_client, symbol_client, database, payout_signer_public_keys)
			if process_result.is_error:
				error_count += 1

			count += 1

		print('*** *** ***')
		print(f'==> last processed transaction height: {database.max_processed_height()}')
		print(f'==>      total transactions processed: {count}')
		print(f'==>        total transactions errored: {error_count}')


if '__main__' == __name__:
	asyncio.run(main())
