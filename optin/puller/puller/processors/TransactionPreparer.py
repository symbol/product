import json

from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.sc import Amount


def convert_to_dumb_format(nem_address):
	message_obj = {'nisAddress': str(nem_address)}
	return f'\0{json.dumps(message_obj)}'.encode('utf8')


class TransactionPreparer:
	"""Payout transaction preparer."""

	def __init__(self, network_name, currency_mosaic_id, key_pair):
		"""Creates transaction preparer."""

		self.facade = SymbolFacade(network_name)
		self.currency_mosaic_id = currency_mosaic_id
		self.key_pair = key_pair

	def prepare_transaction(self, recipient_address, amount, deadline, nem_address):
		"""Prepares transaction."""

		message = convert_to_dumb_format(nem_address)
		transaction = self.facade.transaction_factory.create({
			'type': 'transfer_transaction',
			'signer_public_key': self.key_pair.public_key,
			'fee': 0,
			'deadline': deadline,
			'recipient_address': recipient_address,
			'message': message,
			'mosaics': [{'mosaic_id': self.currency_mosaic_id.value, 'amount': amount}]
		})
		size = transaction.size
		transaction.fee = Amount(size * 1_000)

		signature = self.facade.sign_transaction(self.key_pair, transaction)
		self.facade.transaction_factory.attach_signature(transaction, signature)

		return transaction, self.facade.hash_transaction(transaction)
