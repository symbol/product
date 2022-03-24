import argparse
import asyncio
import getpass
from pathlib import Path

from symbolchain.nem.Network import Network as NemNetwork
from symbolchain.PrivateKeyStorage import PrivateKeyStorage
from symbolchain.symbol.KeyPair import KeyPair

from puller.client.SymbolClient import SymbolClient
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
	def __init__(self, databases, client, symbol_network, transaction_preparer):
		# pylint: disable=too-many-arguments

		self.databases = databases
		self.client = client
		self.symbol_network = symbol_network
		self.transaction_preparer = transaction_preparer
		self.is_dry_run = True

	def _set_request_status_all(self, requests, new_status, payout_transaction_hash):
		for request in requests:
			print(
				f'marking request with optin transaction hash {request.optin_transaction_hash} '
				f'and payout transaction hash {payout_transaction_hash} as {new_status}')

			if not self.is_dry_run:
				self.databases.inprogress.set_request_status(request, new_status, payout_transaction_hash)

	async def process_unprocessed_request(self, address, request_group, sent_requests, deadline):
		if request_group.is_error:
			# inconsistent error detection - what to do?
			print('request error detected, skipping')
			return True

		if address in sent_requests or self.databases.completed.is_opted_in(address):
			self._set_request_status_all(request_group.requests, OptinRequestStatus.DUPLICATE, None)
			return False

		if self.databases.multisig.check_cosigners(address, [request.address for request in request_group.requests]):
			balance = self.databases.balances.lookup_balance(address)
			if not balance:
				self._set_request_status_all(request_group.requests, OptinRequestStatus.ERROR_ZERO, None)
				return True

			symbol_address = self.symbol_network.public_key_to_address(request_group.requests[0].destination_public_key)
			sent_transaction_hash = await self.send_funds(symbol_address, balance, deadline, address)

			self._set_request_status_all(request_group.requests, OptinRequestStatus.SENT, sent_transaction_hash)
			return True

		return False  # no pending modifications

	async def send_funds(self, destination_address, amount, deadline, nem_address):
		transaction, transaction_hash = self.transaction_preparer.prepare_transaction(destination_address, amount, deadline, nem_address)

		print('preparing to send transaction:')
		print(f'       TRANSACTION HASH: {transaction_hash}')
		print(f'   NEM ADDRESS (SOURCE): {nem_address}')
		print(f'  SYMBOL ADDRESS (DEST): {destination_address}')
		print(f'                 AMOUNT: {transaction.mosaics[0].amount.value / 1000000:,.6f}')
		print()
		print(transaction)
		print()

		if not self.is_dry_run:
			await self.client.announce(transaction.serialize())

		return transaction_hash


async def process_all(processor, unprocessed_requests, sent_requests, deadline, is_dry_run):
	print(f'processing {len(sent_requests)} SENT requests and {len(unprocessed_requests)} UNPROCESSED requests')

	for address, request_group in unprocessed_requests.items():
		print()

		processor.is_dry_run = True
		require_prompt = await processor.process_unprocessed_request(address, request_group, sent_requests, deadline)

		if is_dry_run:
			continue

		if require_prompt:
			user_input = input('Press Y to send transaction and update databases: ')
			if 'y' != user_input.lower():
				print('goodbye')
				return

		print()

		processor.is_dry_run = False
		await processor.process_unprocessed_request(address, request_group, sent_requests, deadline)


async def main():
	parser = argparse.ArgumentParser(description='inspects unprocessed optin requests and initiates new payouts')
	parser.add_argument('--symbol-node', help='Symbol node url', default='http://wolf.importance.jp:3000')
	parser.add_argument('--database-directory', help='output database directory', default='_temp')
	parser.add_argument('--network', help='NEM and Symbol network', choices=['testnet', 'mainnet'], default='mainnet')
	parser.add_argument('--hot', help='path to password-protected hot wallet PEM file', default='hotwallet.pem')
	parser.add_argument('--dry-run', help='print transactions without sending', action='store_true')
	args = parser.parse_args()

	client = SymbolClient(args.symbol_node)
	currency_mosaic_id = await client.network_currency()
	symbol_network = await client.node_network()
	nem_network = NemNetwork.TESTNET if 'testnet' == args.network else NemNetwork.MAINNET

	key_pair = get_key_pair(Path(args.hot))
	print(f'building preparer around {symbol_network.public_key_to_address(key_pair.public_key)}')

	transaction_preparer = TransactionPreparer(args.network, currency_mosaic_id, key_pair)

	node_time = await client.node_time()
	deadline = node_time.add_hours(1).timestamp
	print(f'using deadline {deadline}')

	with Databases(args.database_directory) as databases:
		processor = Processor(databases, client, symbol_network, transaction_preparer)
		sent_requests = group_requests(nem_network, databases.inprogress.get_requests_by_status(OptinRequestStatus.SENT))
		unprocessed_requests = group_requests(
			nem_network,
			databases.inprogress.get_requests_by_status(OptinRequestStatus.UNPROCESSED))

		await process_all(processor, unprocessed_requests, sent_requests, deadline, args.dry_run)


if '__main__' == __name__:
	asyncio.run(main())
