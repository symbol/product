from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.Network import NetworkLocator
from symbolchain.sc import Amount
from symbolchain.symbol.IdGenerator import generate_mosaic_alias_id
from symbolchain.symbol.Network import Address, Network
from symbollightapi.connector.SymbolConnector import SymbolConnector

from .SymbolUtils import extract_wrap_request_from_transaction


class SymbolNetworkFacade:
	"""Symbol network facade."""

	def __init__(self, config):
		"""Creates a Symbol network facade."""

		self.config = config
		self.network = NetworkLocator.find_by_name(Network.NETWORKS, config.network)
		self.currency_mosaic_ids = []

	def is_currency_mosaic_id(self, mosaic_id):
		"""Determines if a mosaic id represents the network currency mosaic id."""

		return mosaic_id in self.currency_mosaic_ids

	async def load_currency_mosaic_ids(self):
		"""Loads currency mosaic ids."""

		connector = self.create_connector()
		currency_mosaic_id = await connector.currency_mosaic_id()

		self.currency_mosaic_ids = [
			currency_mosaic_id,
			generate_mosaic_alias_id('symbol.xym')
		]

	def create_connector(self):
		"""Creates a connector to the network."""

		return SymbolConnector(self.config.endpoint)

	@staticmethod
	def make_address(raw_address):
		"""Wraps a raw address into a typed address """

		return Address(raw_address)

	def is_valid_address_string(self, address_string):
		"""Checks if an address string is valid and belongs to this network."""

		return self.network.is_valid_address_string(address_string)

	def extract_wrap_request_from_transaction(self, is_valid_address, transaction_with_meta_json):  # pylint: disable=invalid-name
		"""Extracts a wrap request (or error) from a transaction ."""

		return extract_wrap_request_from_transaction(self.network, is_valid_address, self.is_currency_mosaic_id, transaction_with_meta_json)

	async def lookup_account_balance(self, address):
		"""Gets account balance for network currency."""

		connector = self.create_connector()
		formatted_currency_mosaic_id = hex(self.currency_mosaic_ids[0])[2:].upper()
		return await connector.balance(address, formatted_currency_mosaic_id)

	def create_transfer_transaction(self, timestamp, balance_transfer):
		"""Creates a transfer transaction."""

		transfer_json = {
			'type': 'transfer_transaction_v1',
			'signer_public_key': balance_transfer.signer_public_key,
			'recipient_address': balance_transfer.recipient_address,
			'deadline': timestamp.add_hours(1).timestamp,
			'mosaics': [
				{'mosaic_id': generate_mosaic_alias_id('symbol.xym'), 'amount': balance_transfer.amount}
			]
		}

		if balance_transfer.message:
			transfer_json['message'] = balance_transfer.message

		facade = SymbolFacade(self.network)
		transaction = facade.transaction_factory.create(transfer_json)

		transaction.fee = Amount(self.config.extensions['transaction_fee_multiplier'] * transaction.size)
		return transaction
