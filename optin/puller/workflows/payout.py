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

MICROXYM_PER_XYM = 1000000


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

		self.total_amount = 0
		self.total_fees = 0
		self.total_transactions = 0

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

		if self.databases.multisig.is_multisig(address):
			cosigner_addresses = [request.address for request in request_group.requests if request.multisig_public_key]
			if self.databases.multisig.check_cosigners(address, cosigner_addresses):
				await self.process_payout(address, request_group, deadline)
			else:
				print(f'[!] multisig account {address} detected, but cosigner check failed')
				return False
		else:
			if not next((request.multisig_public_key for request in request_group.requests), None):
				await self.process_payout(address, request_group, deadline)
			else:
				print(f'[!] normal account {address} detected, but no normal optins are present')
				return False

		return True

	async def process_payout(self, address, request_group, deadline):
		balance = self.databases.balances.lookup_balance(address)
		if not balance:
			self._set_request_status_all(request_group.requests, OptinRequestStatus.ERROR_ZERO, None)
			return

		symbol_address = self.symbol_network.public_key_to_address(request_group.requests[0].destination_public_key)
		sent_transaction_hash = await self.send_funds(symbol_address, balance, deadline, address)

		self._set_request_status_all(request_group.requests, OptinRequestStatus.SENT, sent_transaction_hash)

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

		if self.is_dry_run:
			# only count in dry mode to avoid double counting in commit mode, which runs twice sequentially (dry mode, commit mode)
			self.total_transactions += 1
			self.total_amount += transaction.mosaics[0].amount.value
			self.total_fees += transaction.fee.value
		else:
			await self.client.announce(transaction.serialize())

		return transaction_hash


async def calculate_deadline(client):
	node_time = await client.node_time()
	deadline = node_time.add_hours(1).timestamp
	print(f'using deadline {deadline}')
	return deadline


def request_user_consent(action_message):
	user_input = input(f'Press Y to {action_message}: ')
	if 'y' != user_input.lower():
		print('goodbye')
		return False

	return True


async def process_all(processor, unprocessed_requests, sent_requests, client, funder_balance, is_dry_run):
	# pylint: disable=too-many-arguments

	print(f'processing {len(sent_requests)} SENT requests and {len(unprocessed_requests)} UNPROCESSED requests')

	for address, request_group in unprocessed_requests.items():
		deadline = await calculate_deadline(client)
		print()

		processor.is_dry_run = True
		require_prompt = await processor.process_unprocessed_request(address, request_group, sent_requests, deadline)

		if is_dry_run:
			continue

		if funder_balance < processor.total_amount + processor.total_fees:
			print('[!] funding account has insufficient funds, please refill it!')
			return

		if require_prompt:
			if not request_user_consent('send transaction and update databases'):
				return

		print()

		processor.is_dry_run = False
		await processor.process_unprocessed_request(address, request_group, sent_requests, deadline)

	print()
	print(f'     TOTAL TRANSACTIONS: {processor.total_transactions}')
	print(f'           TOTAL AMOUNT: {processor.total_amount / MICROXYM_PER_XYM:,.6f}')
	print(f'             TOTAL FEES: {processor.total_fees / MICROXYM_PER_XYM:,.6f}')
	print(f'          FEES + AMOUNT: {(processor.total_amount + processor.total_fees) / MICROXYM_PER_XYM:,.6f}')


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

	funder_key_pair = get_key_pair(Path(args.hot))
	funder_address = symbol_network.public_key_to_address(funder_key_pair.public_key)
	funder_balance = await client.balance(funder_address)

	print(f'building preparer around {funder_address} with balance {funder_balance / MICROXYM_PER_XYM}')
	if not request_user_consent('continue'):
		return

	transaction_preparer = TransactionPreparer(args.network, currency_mosaic_id, funder_key_pair,)

	with Databases(args.database_directory) as databases:
		processor = Processor(databases, client, symbol_network, transaction_preparer)
		sent_requests = group_requests(nem_network, databases.inprogress.get_requests_by_status(OptinRequestStatus.SENT))
		unprocessed_requests = group_requests(
			nem_network,
			databases.inprogress.get_requests_by_status(OptinRequestStatus.UNPROCESSED))

		await process_all(processor, unprocessed_requests, sent_requests, client, funder_balance, args.dry_run)


if '__main__' == __name__:
	asyncio.run(main())
