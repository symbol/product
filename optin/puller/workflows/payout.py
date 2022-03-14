import argparse
import asyncio
import getpass
from pathlib import Path

from symbolchain.nem.Network import Network as NemNetwork
from symbolchain.PrivateKeyStorage import PrivateKeyStorage
from symbolchain.symbol.KeyPair import KeyPair
from symbolchain.symbol.Network import Network as SymbolNetwork

from puller.client.SymbolClient import SymbolClient, filter_finalized_transactions
from puller.db.Databases import Databases
from puller.db.InProgressOptinDatabase import OptinRequestStatus
from puller.processors.RequestGrouper import group_requests
from puller.processors.TransactionPreparer import TransactionPreparer

# example for processing and paying out post optins


def get_key_pair(filepath):
	password = getpass.getpass(f'Enter password for {filepath}: ')
	storage = PrivateKeyStorage(filepath.parent, password.strip())
	return KeyPair(storage.load(filepath.stem))


async def process_sent_requests(sent_requests, databases, client, symbol_network):
	if not sent_requests:
		return

	hashes = []
	for request_group in sent_requests.values():
		hashes.extend([request.payout_transaction_hash for request in request_group.requests])

	finalized_transaction_hashes = set(await filter_finalized_transactions(client, set(hashes)))

	completed = 0
	for address, request_group in sent_requests.items():
		for request in request_group.requests:
			if request.optin_transaction_hash in finalized_transaction_hashes:
				databases.inprogress.set_request_status(request, OptinRequestStatus.COMPLETED, request.transaction_hash)
				completed += 1

		balance = databases.balances.lookup_balance(address)
		symbol_address = symbol_network.public_key_to_address(request_group.requests[0].destination_public_key)
		databases.completed.insert_mapping(
			{str(address): balance},
			{str(symbol_address): balance})

	print(f'transactions completed since last run: {completed}')


async def process_unprocessed_requests(unprocessed_requests, sent_requests, databases, symbol_network, send_funds):
	for address, request_group in unprocessed_requests.items():
		if request_group.is_error:
			# inconsistent error detection - what to do?
			continue

		if address in sent_requests or databases.completed.is_opted_in(address):
			for request in request_group.requests:
				databases.inprogress.set_request_status(request, OptinRequestStatus.DUPLICATE, None)
		else:
			if databases.multisig.check_cosigners(address, [request.address for request in request_group.requests]):
				balance = databases.balances.lookup_balance(address)
				symbol_address = symbol_network.public_key_to_address(request_group.requests[0].destination_public_key)
				sent_transaction_hash = await send_funds(symbol_address, balance, address)
				print(f'hash: {sent_transaction_hash}')
				for request in request_group.requests:
					databases.inprogress.set_request_status(request, OptinRequestStatus.SENT, sent_transaction_hash)


async def main():
	parser = argparse.ArgumentParser(description='process post opt in requests')
	parser.add_argument('--symbol-node', help='Symbol node url', default='http://wolf.importance.jp:3000')
	parser.add_argument('--database-directory', help='output database directory', default='_temp')
	parser.add_argument('--network', help='NEM and Symbol network', choices=['testnet', 'mainnet'], default='mainnet')
	parser.add_argument('--hot', help='path to password-protected hot wallet PEM file', default='hotwallet.pem')
	args = parser.parse_args()

	nem_network = NemNetwork.MAINNET
	symbol_network = SymbolNetwork.MAINNET
	if 'testnet' == args.network:
		nem_network = NemNetwork.TESTNET
		symbol_network = SymbolNetwork.TESTNET

	client = SymbolClient(args.symbol_node)

	currency_mosaic_id = await client.network_currency()
	key_pair = get_key_pair(Path(args.hot))

	print(f'building preparer around {symbol_network.public_key_to_address(key_pair.public_key)}')
	preparer = TransactionPreparer(args.network, currency_mosaic_id, key_pair)

	async def send_funds(destination_address, amount, nem_address):
		node_time = await client.node_time()
		deadline = node_time.add_hours(1).timestamp
		transaction, transaction_hash = preparer.prepare_transaction(destination_address, amount, deadline, nem_address)
		await client.announce(transaction.serialize())
		return transaction_hash

	with Databases(args.database_directory) as databases:
		sent_requests = group_requests(nem_network, databases.inprogress.get_requests_by_status(OptinRequestStatus.SENT))
		print(f'sent requests count: {len(sent_requests)}')
		await process_sent_requests(sent_requests, databases, client, symbol_network)

		unprocessed_requests = group_requests(
			nem_network,
			databases.inprogress.get_requests_by_status(OptinRequestStatus.UNPROCESSED))
		await process_unprocessed_requests(unprocessed_requests, sent_requests, databases, symbol_network, send_funds)


if '__main__' == __name__:
	asyncio.run(main())
