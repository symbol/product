import argparse
import asyncio
import datetime
import logging

from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address
from symbolchain.nem.NetworkTimestamp import NetworkTimestamp as NemNetworkTimestamp
from symbolchain.symbol.NetworkTimestamp import NetworkTimestamp as SymbolNetworkTimestamp

from puller.client.NemClient import NemClient, get_incoming_transactions_from
from puller.client.SymbolClient import SymbolClient
from puller.db.Databases import Databases
from puller.db.InProgressOptinDatabase import OptinRequestStatus
from puller.processors.AccountChecker import check_destination_availability
from puller.processors.NemOptinProcessor import process_nem_optin_request

# example for downloading post optins.
# this is placeholder as successes will need to undergo more processing and be inserted into database.

SYMBOL_TESTNET_EPOCH_TIME = datetime.datetime(2021, 11, 25, 14, 0, 47, tzinfo=datetime.timezone.utc)
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


class DownloadTransactionProcessor:
	@classmethod
	async def create(cls, nem_client, symbol_client, databases):
		# pylint: disable=attribute-defined-outside-init
		self = DownloadTransactionProcessor()
		self.nem_client = nem_client
		self.symbol_client = symbol_client
		self.databases = databases

		self.nem_network = await nem_client.node_network()
		self.symbol_network = await symbol_client.node_network()

		self.finalized_nem_height = await nem_client.finalized_height()
		self.finalized_symbol_height = await symbol_client.finalized_height()

		return self

	async def _handle_already_paid(self, nem_transaction, destination_address, payout_transaction_info, process_result):
		logging.debug('handling already paid sym: %s', destination_address)
		nem_transation_datetime = NemNetworkTimestamp(nem_transaction['transaction']['timeStamp']).to_datetime()

		payout_timestamp = SymbolNetworkTimestamp(int(payout_transaction_info.transaction['meta']['timestamp']))
		payout_datetime = payout_timestamp.to_datetime()
		if 'testnet' == self.symbol_network.name:
			payout_datetime = payout_timestamp.to_datetime(SYMBOL_TESTNET_EPOCH_TIME)

		payout_transaction_hash = payout_transaction_info.transaction_hash
		if nem_transation_datetime > payout_datetime:
			# mark optin transactions made AFTER payout transaction as duplicates, this will not add anything to completed table
			# so _next_ transaction that is made before payout transaction will be added correctly
			logging.debug('nem transaction time is newer than payout timestamp, payout hash: %s', payout_transaction_hash)
			return False

		source_address = payout_transaction_info.address
		nem_transaction = {'hash': nem_transaction['meta']['hash']['data'], 'height': nem_transaction['meta']['height']}
		if not self.databases.completed.is_opted_in(source_address):
			logging.debug('adding to completed, nem source: %s -> sym dest: %s', source_address, destination_address)

			self.databases.inprogress.add_request(process_result)
			self.databases.inprogress.set_request_status(process_result, OptinRequestStatus.COMPLETED, payout_transaction_hash)

			payout_amount = payout_transaction_info.transaction['transaction']['mosaics'][0]['amount']
			self.databases.completed.insert_mapping(
				{str(source_address): payout_amount},
				{
					str(destination_address): {
						'sym-balance': payout_amount,
						'hash': str(payout_transaction_hash),
						'height': payout_transaction_info.transaction['meta']['height']
					}
				},
				{str(source_address): [nem_transaction]}
			)

			return True

		# already is in completed db, so check if account is multisig
		logging.debug('nem %s already opted in, checking if multisig', source_address)
		account_info = await self.nem_client.account(source_address)
		if account_info['meta']['cosignatories']:
			logging.debug('inserting transaction %s, %s', source_address, nem_transaction)
			self.databases.completed.insert_transaction(source_address, nem_transaction)
			return True

		return False

	def _handle_error(self, transaction_height, process_result):
		print(f'{transaction_height} ERROR: {process_result.message}')
		self.databases.inprogress.add_error(process_result)
		return process_result

	async def process_transaction(self, transaction, payout_signer_public_keys):
		transaction_height = transaction['meta']['height']

		process_result = process_nem_optin_request(self.nem_network, transaction)
		if process_result.is_error:
			return self._handle_error(transaction_height, process_result)

		destination_address = self.symbol_network.public_key_to_address(process_result.destination_public_key)
		for payout_signer_public_key in payout_signer_public_keys:
			payout_transaction_infos = await self.symbol_client.find_payout_transactions(PublicKey(payout_signer_public_key), destination_address)
			request_address = process_result.address
			if process_result.multisig_public_key:
				request_address = self.nem_network.public_key_to_address(process_result.multisig_public_key)

			payout_transaction_info = next((info for info in payout_transaction_infos if request_address == info.address), None)
			if payout_transaction_info:
				if int(payout_transaction_info.transaction['meta']['height']) > self.finalized_symbol_height:
					print(f'{transaction_height} SUCCESS (SENT) for {process_result.address} (from {payout_signer_public_key})')
					self.databases.inprogress.add_request(process_result)
					self.databases.inprogress.set_request_status(process_result, OptinRequestStatus.SENT, payout_transaction_info.transaction_hash)
					return process_result

				if await self._handle_already_paid(transaction, destination_address, payout_transaction_info, process_result):
					return process_result

				print(f'{transaction_height} SUCCESS (DUPLICATE) for {process_result.address} (from {payout_signer_public_key})')
				self.databases.inprogress.add_request(process_result)
				self.databases.inprogress.set_request_status(process_result, OptinRequestStatus.DUPLICATE, payout_transaction_info.transaction_hash)
				return process_result

		if not process_result.is_error:
			process_result = await check_destination_availability(process_result, self.nem_client, self.symbol_client)

		if process_result.is_error:
			return self._handle_error(transaction_height, process_result)

		request_status = self.databases.inprogress.add_request(process_result)
		print(f'{transaction_height} SUCCESS ({request_status}) for {process_result.address}')
		return process_result


async def main():
	# pylint: disable=too-many-locals

	args = parse_args()

	logging.basicConfig(filename='debug.log', level=logging.DEBUG)

	nem_client = NemClient(args.nem_node)
	symbol_client = SymbolClient(args.symbol_node)

	snapshot_height = int(args.snapshot_height)
	payout_signer_public_keys = [PublicKey(public_key) for public_key in args.payout_signer_public_keys.split(',')]

	print('payout signer public keys')
	for public_key in payout_signer_public_keys:
		print(f' * {public_key}')

	with Databases(args.database_directory) as databases:
		databases.inprogress.create_tables()
		databases.completed.create_tables()

		count = 0
		error_count = 0

		database_height = databases.inprogress.max_processed_height()
		start_height = max(snapshot_height, database_height + 1)

		processor = await DownloadTransactionProcessor.create(nem_client, symbol_client, databases)
		print(f'processing opt-in transactions from {start_height} to {processor.finalized_nem_height}, sent to {Address(args.optin_address)}')

		async for transaction in get_incoming_transactions_from(nem_client, Address(args.optin_address), snapshot_height):
			transaction_height = transaction['meta']['height']
			if transaction_height > processor.finalized_nem_height:
				continue

			if transaction_height <= database_height:
				break

			process_result = await processor.process_transaction(transaction, payout_signer_public_keys)
			if process_result.is_error:
				error_count += 1

			count += 1

		print('*** *** ***')
		print(f'==> last processed transaction height: {databases.inprogress.max_processed_height()}')
		print(f'==>      total transactions processed: {count}')
		print(f'==>        total transactions errored: {error_count}')


if '__main__' == __name__:
	asyncio.run(main())
