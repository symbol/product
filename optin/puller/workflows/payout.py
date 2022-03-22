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


class Processor:
	def __init__(self, databases, client, symbol_network, transaction_preparer, is_dry_run):
		# pylint: disable=too-many-arguments

		self.databases = databases
		self.client = client
		self.symbol_network = symbol_network
		self.transaction_preparer = transaction_preparer
		self.is_dry_run = is_dry_run

	async def process_sent_requests(self, sent_requests):
		if not sent_requests:
			return

		hashes = []
		for request_group in sent_requests.values():
			hashes.extend([request.payout_transaction_hash for request in request_group.requests])

		finalized_transaction_hashes = set(await filter_finalized_transactions(self.client, set(hashes)))

		completed = 0
		for address, request_group in sent_requests.items():
			is_request_group_finalized = True
			for request in request_group.requests:
				if request.payout_transaction_hash in finalized_transaction_hashes:
					print(f'marking request with transaction hash {request.payout_transaction_hash} COMPLETED')
					if not self.is_dry_run:
						self.databases.inprogress.set_request_status(request, OptinRequestStatus.COMPLETED, request.payout_transaction_hash)

					completed += 1
				else:
					is_request_group_finalized = False

			if is_request_group_finalized:
				balance = self.databases.balances.lookup_balance(address)
				symbol_address = self.symbol_network.public_key_to_address(request_group.requests[0].destination_public_key)

				print(f'updating completed database with mapping from {address} to {symbol_address} with amount {balance}')
				if not self.is_dry_run:
					self.databases.completed.insert_mapping({str(address): balance}, {str(symbol_address): balance})

		print(f'transactions completed since last run: {completed}')

	async def process_unprocessed_requests(self, unprocessed_requests, sent_requests):
		node_time = await self.client.node_time()
		deadline = node_time.add_hours(1).timestamp

		for address, request_group in unprocessed_requests.items():
			if request_group.is_error:
				# inconsistent error detection - what to do?
				continue

			if address in sent_requests or self.databases.completed.is_opted_in(address):
				for request in request_group.requests:
					print(f'marking request with optin transaction hash {request.optin_transaction_hash} DUPLICATE')
					if not self.is_dry_run:
						self.databases.inprogress.set_request_status(request, OptinRequestStatus.DUPLICATE, None)
			else:
				if self.databases.multisig.check_cosigners(address, [request.address for request in request_group.requests]):
					balance = self.databases.balances.lookup_balance(address)
					symbol_address = self.symbol_network.public_key_to_address(request_group.requests[0].destination_public_key)
					sent_transaction_hash = await self.send_funds(symbol_address, balance, deadline, address)

					print(f'marking request with transaction hash {sent_transaction_hash} SENT')
					if not self.is_dry_run:
						for request in request_group.requests:
							self.databases.inprogress.set_request_status(request, OptinRequestStatus.SENT, sent_transaction_hash)

	async def send_funds(self, destination_address, amount, deadline, nem_address):
		transaction, transaction_hash = self.transaction_preparer.prepare_transaction(destination_address, amount, deadline, nem_address)

		print(f'sending payout transaction with hash {transaction_hash}')
		print(transaction)

		if not self.is_dry_run:
			await self.client.announce(transaction.serialize())

		return transaction_hash


async def main():
	parser = argparse.ArgumentParser(description='process post opt in requests')
	parser.add_argument('--symbol-node', help='Symbol node url', default='http://wolf.importance.jp:3000')
	parser.add_argument('--database-directory', help='output database directory', default='_temp')
	parser.add_argument('--network', help='NEM and Symbol network', choices=['testnet', 'mainnet'], default='mainnet')
	parser.add_argument('--hot', help='path to password-protected hot wallet PEM file', default='hotwallet.pem')
	parser.add_argument('--dry-run', help='print transactions without sending', action='store_true')
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
	transaction_preparer = TransactionPreparer(args.network, currency_mosaic_id, key_pair)

	with Databases(args.database_directory) as databases:
		processor = Processor(databases, client, symbol_network, transaction_preparer, args.dry_run)

		sent_requests = group_requests(nem_network, databases.inprogress.get_requests_by_status(OptinRequestStatus.SENT))
		print(f'sent requests count: {len(sent_requests)}')
		await processor.process_sent_requests(sent_requests)

		unprocessed_requests = group_requests(
			nem_network,
			databases.inprogress.get_requests_by_status(OptinRequestStatus.UNPROCESSED))
		await processor.process_unprocessed_requests(unprocessed_requests, sent_requests)


if '__main__' == __name__:
	asyncio.run(main())
