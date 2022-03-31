import argparse
import asyncio
import json
from binascii import unhexlify
from pathlib import Path

from symbolchain.CryptoTypes import PublicKey
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Address

from puller.client.SymbolClient import SymbolClient

PAYOUT_SIGNER_PUBLIC_KEYS = '7AEC08AA66CB50B0C3D180DE7508D5D82ECEDCDC9E73F61FA7069868BEABA856'


def parse_args():
	parser = argparse.ArgumentParser(description='generate postoptin json')
	parser.add_argument('--symbol-node', help='Symbol node url', default='http://wolf.importance.jp:3000')
	parser.add_argument(
		'--payout-signer-public-keys',
		help='optin payout signer public keys (comma separated)',
		default=PAYOUT_SIGNER_PUBLIC_KEYS)
	parser.add_argument('--output', help='output path', default='./resources/postoptin.mainnet.json')
	return parser.parse_args()


def to_symbol_address(hex_string):
	return Address(unhexlify(hex_string))


class PayoutTransactionsProcessor:
	def __init__(self, client):
		self.client = client
		self.redemptions = []

	async def process(self, public_key):
		start_id = None
		while True:
			transaction_and_metadata_pairs = await self.client.outgoing_transactions(public_key, start_id)
			if not transaction_and_metadata_pairs:
				break

			for transaction in transaction_and_metadata_pairs:
				self.process_transaction(transaction['transaction'])

			start_id = transaction_and_metadata_pairs[-1]['id']
			print('.', end='', flush=True)
		print()

	def process_transaction(self, transaction):
		# note: ignoring txes without message
		if TransactionType.TRANSFER.value != transaction['type'] or 'message' not in transaction:
			return

		xym_amount = int(transaction['mosaics'][0]['amount'])
		message = unhexlify(transaction['message']).decode('utf8')
		assert message[0] == '\0'

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
		self.redemptions.append({
			'type': '1-to-1',
			'source': [{'nis-address': nis_address, 'nis-balance': str(xym_amount)}],
			'destination': [
				{'sym-address': str(to_symbol_address(transaction['recipientAddress'])), 'sym-balance': xym_amount}
			]
		})


async def main():
	args = parse_args()

	symbol_client = SymbolClient(args.symbol_node)
	payout_signer_public_keys = [PublicKey(public_key) for public_key in args.payout_signer_public_keys.split(',')]

	processor = PayoutTransactionsProcessor(symbol_client)

	print('payout signer public keys')
	for public_key in payout_signer_public_keys:
		print(f' * {public_key}')
		await processor.process(public_key)

	with open(Path(args.output), 'wt', encoding='utf8') as out_file:
		out_file.write(json.dumps(processor.redemptions, indent=2))


if '__main__' == __name__:
	asyncio.run(main())
