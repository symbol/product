import argparse
import asyncio

from symbolchain.nem.Network import Network as NemNetwork

from puller.client.SymbolClient import SymbolClient, filter_finalized_transactions
from puller.db.Databases import Databases
from puller.db.InProgressOptinDatabase import OptinRequestStatus
from puller.processors.RequestGrouper import group_requests


class Processor:
	def __init__(self, databases, client, symbol_network, is_dry_run):
		# pylint: disable=too-many-arguments

		self.databases = databases
		self.client = client
		self.symbol_network = symbol_network
		self.is_dry_run = is_dry_run

	async def process_sent_requests(self, sent_requests):
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
				request = request_group.requests[0]

				balance = self.databases.balances.lookup_balance(address)
				symbol_address = self.symbol_network.public_key_to_address(request.destination_public_key)

				metadata = await self.client.transaction_confirmed_metadata(request.payout_transaction_hash)

				print(f'updating completed database with mapping from {address} to {symbol_address} with amount {balance}')
				if not self.is_dry_run:
					self.databases.completed.insert_mapping(
						{str(address): balance},
						{
							str(symbol_address): {
								'sym-balance': balance,
								'hash': str(request.payout_transaction_hash),
								'height': metadata['height'],
								'timestamp': metadata['timestamp']
							}
						},
						{
							str(address): [
								{
									'hash': str(request.optin_transaction_hash),
									'height': request.optin_transaction_height
								}
							] for request in request_group.requests
						})

		print(f'transactions completed since last run: {completed}')


async def main():
	parser = argparse.ArgumentParser(description='inspects and updates previously sent payouts')
	parser.add_argument('--symbol-node', help='Symbol node url', default='http://wolf.importance.jp:3000')
	parser.add_argument('--database-directory', help='output database directory', default='_temp')
	parser.add_argument('--network', help='NEM and Symbol network', choices=['testnet', 'mainnet'], default='mainnet')
	parser.add_argument('--dry-run', help='print transactions without sending', action='store_true')
	args = parser.parse_args()

	client = SymbolClient(args.symbol_node)
	symbol_network = await client.node_network()
	nem_network = NemNetwork.TESTNET if 'testnet' == args.network else NemNetwork.MAINNET

	with Databases(args.database_directory) as databases:
		print('checking previously sent requests')

		processor = Processor(databases, client, symbol_network, args.dry_run)
		sent_requests = group_requests(nem_network, databases.inprogress.get_requests_by_status(OptinRequestStatus.SENT))

		if sent_requests:
			print(f' * checking {len(sent_requests)} with SENT status')
			await processor.process_sent_requests(sent_requests)
		else:
			print(' * skipping, no SENT requests found')


if '__main__' == __name__:
	asyncio.run(main())
