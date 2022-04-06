import argparse
import asyncio
import datetime
import json
from binascii import unhexlify
from pathlib import Path

from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address as NemAddress
from symbolchain.nem.NetworkTimestamp import NetworkTimestamp as NemNetworkTimestamp
from symbolchain.symbol.NetworkTimestamp import NetworkTimestamp as SymbolNetworkTimestamp
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Address

from puller.client.NemClient import NemClient, get_incoming_transactions_from
from puller.client.SymbolClient import SymbolClient
from puller.processors.AccountChecker import check_destination_availability
from puller.processors.NemOptinProcessor import process_nem_optin_request

OPTIN_ADDRESS = 'NAQ7RCYM4PRUAKA7AMBLN4NPBJEJMRCHHJYAVA72'
PAYOUT_SIGNER_PUBLIC_KEYS = '7AEC08AA66CB50B0C3D180DE7508D5D82ECEDCDC9E73F61FA7069868BEABA856'


def parse_args():
	parser = argparse.ArgumentParser(description='generate postoptin json')
	parser.add_argument('--nem-node', help='NEM node url', default='http://mercury.elxemental.cloud:7890')
	parser.add_argument('--symbol-node', help='Symbol node url', default='http://wolf.importance.jp:3000')
	parser.add_argument('--optin-address', help='nem optin account address', default=OPTIN_ADDRESS)
	parser.add_argument('--payout-signer-public-keys', help='optin payout signer public keys (comma separated)', default=PAYOUT_SIGNER_PUBLIC_KEYS)

	parser.add_argument('--snapshot-height', help='snapshot height', default=3105500)

	parser.add_argument('--output', help='output path', default='post-optin.json')
	return parser.parse_args()


def to_symbol_address(hex_string):
	return Address(unhexlify(hex_string))


class PayoutTransactionsProcessor:
	def __init__(self, client, nem_client):
		self.client = client
		self.nem_client = nem_client
		self.redemptions = {}
		self.payout_datetimes = {}

	async def process(self, public_key):
		start_id = None
		node_network = await self.client.node_network()

		while True:
			transaction_and_metadata_pairs = await self.client.outgoing_transactions(public_key, start_id)
			if not transaction_and_metadata_pairs:
				break

			for transaction in transaction_and_metadata_pairs:
				self.process_transaction(transaction['transaction'], transaction['meta'], node_network)

			start_id = transaction_and_metadata_pairs[-1]['id']
			print('.', end='', flush=True)
		print()

	def process_transaction(self, transaction, transaction_meta, node_network):
		# note: ignoring txes without message
		if TransactionType.TRANSFER.value != transaction['type'] or 'message' not in transaction or not transaction['mosaics']:
			return

		xym_amount = int(transaction['mosaics'][0]['amount'])
		message = unhexlify(transaction['message']).decode('utf8')
		if message[0] != '\0':
			print(f' [!] ignoring message, with invalid start "{message[0]}", amount: {xym_amount} ({xym_amount / 1_000_000})')
			return

		if message[1] != '{':
			print(f' [!] ignoring message: "{message[1:]}", amount: {xym_amount} ({xym_amount / 1_000_000})')
			return

		data = json.loads(message[1:])
		if ' n1sAddress ' in data:
			nis_address = data[' n1sAddress ']
			recipient_address = transaction['recipientAddress']
			print(f' [!] ignoring known duplicate, paid to {recipient_address}')
			return

		# note: deliberately setting nis balance to same value
		nis_address = data['nisAddress']
		self.redemptions[nis_address] = {
			'type': '1-to-1',
			'source': [{
				'nis-address': nis_address,
				'nis-balance': str(xym_amount),
				'transactions':[]
			}],
			'destination': [
				{
					'sym-address': str(to_symbol_address(transaction['recipientAddress'])),
					'sym-balance': xym_amount,
					'timestamp': transaction_meta['timestamp'],
					'hash': transaction_meta.get('hash', None) or transaction_meta['aggregateHash'],
					'height': transaction_meta['height']
				}
			]
		}

		payout_timestamp = SymbolNetworkTimestamp(int(transaction_meta['timestamp']))
		payout_datetime = payout_timestamp.to_datetime()
		if 'testnet' == node_network.name:
			SYMBOL_TESTNET_EPOCH_TIME = datetime.datetime(2021, 11, 25, 14, 0, 47, tzinfo=datetime.timezone.utc)
			payout_datetime = payout_timestamp.to_datetime(SYMBOL_TESTNET_EPOCH_TIME)

		self.payout_datetimes[nis_address] = payout_datetime


async def process_transaction(transaction, nem_client, symbol_client):
	transaction_height = transaction['meta']['height']

	nem_network = await nem_client.node_network()
	symbol_network = await symbol_client.node_network()

	process_result = process_nem_optin_request(nem_network, transaction)
	if not process_result.is_error:
		process_result = await check_destination_availability(process_result, nem_client, symbol_client)

	if process_result.is_error:
		print(f'{transaction_height} ERROR: {process_result.message}')
		return process_result, None

	nem_source_address = nem_network.public_key_to_address(process_result.multisig_public_key) \
		if process_result.multisig_public_key else process_result.address


	# right now both NEM networks (mainnet and testnet) have same epoch
	time_stamp = transaction['transaction']['timeStamp']
	nem_time_stamp = NemNetworkTimestamp(time_stamp).to_datetime()

	destination_address = symbol_network.public_key_to_address(process_result.destination_public_key)
	return process_result, {
		'nem-source-address': nem_source_address,
		'nem-time-stamp': nem_time_stamp,
		'symbol-destination-address': destination_address
	}


async def main():
	args = parse_args()

	symbol_client = SymbolClient(args.symbol_node)
	nem_client = NemClient(args.nem_node)

	finalized_height = await nem_client.finalized_height()
	snapshot_height = int(args.snapshot_height)

	payout_signer_public_keys = [PublicKey(public_key) for public_key in args.payout_signer_public_keys.split(',')]

	# collect redemptions
	processor = PayoutTransactionsProcessor(symbol_client, nem_client)

	print('payout signer public keys')
	for public_key in payout_signer_public_keys:
		print(f' * {public_key}')
		await processor.process(public_key)

	print('collected payouts, searching for optin requests (this will take a bit)')

	# find optin requests
	async for transaction in get_incoming_transactions_from(nem_client, NemAddress(args.optin_address), snapshot_height):
		transaction_height = transaction['meta']['height']
		if transaction_height > finalized_height:
			continue

		process_result, details = await process_transaction(transaction, nem_client, symbol_client)
		if not process_result.is_error:
			optin_nem_address = str(details['nem-source-address'])
			if optin_nem_address in processor.redemptions.keys():
				if details['nem-time-stamp'] < processor.payout_datetimes[optin_nem_address]:
					# note, this does not check multisigs, so incorrect tx hashes might get included as well :|
					processor.redemptions[optin_nem_address]['source'][0]['transactions'].append({
						'hash': transaction['meta']['hash']['data'],
						'height': transaction['meta']['height'],
					})
				else:
					print('ignoring NEM transaction, sym tx payout timestamp is before optin tx, nem hash:', transaction['meta']['hash']['data'])
		print('.', end='', flush=True)
	print()


	with open(Path(args.output), 'wt', encoding='utf8') as out_file:
		out_file.write(json.dumps(list(processor.redemptions.values()), indent=2))


if '__main__' == __name__:
	asyncio.run(main())
