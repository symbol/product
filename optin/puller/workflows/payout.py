import argparse
import asyncio

from symbolchain.CryptoTypes import Hash256
from symbolchain.nem.Network import Network as NemNetwork
from symbolchain.symbol.Network import Network as SymbolNetwork

from puller.client.SymbolClient import SymbolClient, filter_finalized_transactions
from puller.db.Databases import Databases
from puller.db.InProgressOptinDatabase import OptinRequestStatus
from puller.processors.RequestGrouper import group_requests

# example for processing and paying out post optins

# TODO_:
# 2. implement send_funds


def send_funds(_):
	# TODO_: implement this
	return Hash256('')


async def process_sent_requests(sent_requests, databases, client, symbol_network):
	finalized_transaction_hashes = set(await filter_finalized_transactions(client, set(
		request.transaction_hash for request in request_group for request_group in sent_requests.values()
	)))
	for address, request_group in sent_requests.items():
		for request in request_group:
			if request.transaction_hash in finalized_transaction_hashes:
				databases.inprogress.set_request_status(request, OptinRequestStatus.COMPLETED, request.transaction_hash)

		balance = databases.balances.lookup_balance(address)
		databases.completed.insert_mapping(
			{str(address): balance},
			{str(symbol_network.public_key_to_address(request_group.requests[0].destination_public_key)): balance})


async def process_unprocessed_requests(unprocessed_requests, sent_requests, databases):
	for address, request_group in unprocessed_requests.items():
		if request_group.is_error:
			# inconsistent error detection - what to do?
			continue

		if address in sent_requests or databases.completed.is_opted_in(address):
			databases.inprogress.set_request_status(address, OptinRequestStatus.DUPLICATE, None)
		else:
			if databases.multisig.check_cosigners(address, [request.address for request in request_group.requests]):
				sent_transaction_hash = send_funds(request_group.requests[0].destination_public_key)
				for request in request_group.requests:
					databases.inprogress.set_request_status(request, OptinRequestStatus.SENT, sent_transaction_hash)


async def main():
	parser = argparse.ArgumentParser(description='process post opt in requests')
	parser.add_argument('--symbol-node', help='Symbol node url', default='http://wolf.importance.jp:3000')
	parser.add_argument('--database-directory', help='output database directory', default='_temp')
	args = parser.parse_args()

	nem_network = NemNetwork.MAINNET
	symbol_network = SymbolNetwork.MAINNET
	client = SymbolClient(args.symbol_node)

	with Databases(args.database_directory) as databases:
		sent_requests = group_requests(nem_network, databases.inprogress.get_requests_by_status(OptinRequestStatus.SENT))
		await process_sent_requests(sent_requests, databases, client, symbol_network)

		unprocessed_requests = group_requests(
			nem_network,
			databases.inprogress.get_requests_by_status(OptinRequestStatus.UNPROCESSED))
		await process_unprocessed_requests(unprocessed_requests, sent_requests, databases)


if '__main__' == __name__:
	asyncio.run(main())
