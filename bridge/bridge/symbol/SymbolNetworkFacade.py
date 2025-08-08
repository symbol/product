from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.Network import NetworkLocator
from symbolchain.sc import Amount
from symbolchain.symbol.IdGenerator import generate_mosaic_alias_id
from symbolchain.symbol.Network import Address, Network, NetworkTimestamp
from symbollightapi.connector.SymbolConnector import SymbolConnector

from ..models.AddressValidator import try_convert_network_address_to_string
from ..models.Constants import PrintableMosaicId
from .SymbolUtils import extract_wrap_request_from_transaction


class SymbolNetworkFacade:
	"""Symbol network facade."""

	def __init__(self, config):
		"""Creates a Symbol network facade."""

		self.config = config
		self.network = NetworkLocator.find_by_name(Network.NETWORKS, config.network)
		self.rosetta_network_id = ('Symbol', self.network.name)
		self.sdk_facade = SymbolFacade(self.network)
		self.bridge_address = Address(config.bridge_address)
		self.transaction_search_address = self.bridge_address

		self.currency_mosaic_ids = []

	async def init(self):
		"""Downloads information from the network to initialize the facade."""

		connector = self.create_connector()
		currency_mosaic_id = await connector.currency_mosaic_id()

		self.currency_mosaic_ids = [
			currency_mosaic_id,
			generate_mosaic_alias_id('symbol.xym')
		]

	def is_currency_mosaic_id(self, mosaic_id):
		"""Determines if a mosaic id represents the network currency mosaic id."""

		return mosaic_id in self.currency_mosaic_ids

	def extract_mosaic_id(self):
		"""
		Extracts the wrapped mosaic id from config and converts it into both a printable version
		and a version that can be passed to network facades as arguments.
		"""

		config_mosaic_id = self.config.extensions['mosaic_id']
		mosaic_id_parts = tuple(config_mosaic_id.split(':'))

		mosaic_id = int(mosaic_id_parts[1], 16)
		if self.is_currency_mosaic_id(mosaic_id):
			mosaic_id = None

		return PrintableMosaicId(mosaic_id, mosaic_id_parts[1])

	def create_connector(self, **_kwargs):
		"""Creates a connector to the network."""

		return SymbolConnector(self.config.endpoint)

	@staticmethod
	def make_address(raw_address):
		"""Wraps a raw address into a typed address """

		return Address(raw_address)

	def is_valid_address(self, raw_address):
		"""Checks if an address is valid and belongs to this network."""

		address_str = try_convert_network_address_to_string(self.network, raw_address)
		return (address_str is not None, address_str)

	def extract_wrap_request_from_transaction(self, is_valid_address, transaction_with_meta_json, mosaic_id=None):
		# pylint: disable=invalid-name
		"""Extracts a wrap request (or error) from a transaction ."""

		is_matching_mosaic_id = self.is_currency_mosaic_id
		if mosaic_id:
			def is_custom_mosaic_id(test_mosaic_id):
				return mosaic_id == test_mosaic_id

			is_matching_mosaic_id = is_custom_mosaic_id

		return extract_wrap_request_from_transaction(self.network, is_valid_address, is_matching_mosaic_id, transaction_with_meta_json)

	def create_transfer_transaction(self, timestamp, balance_transfer, mosaic_id=None):
		"""Creates a transfer transaction."""

		transfer_json = {
			'type': 'transfer_transaction_v1',
			'signer_public_key': balance_transfer.signer_public_key,
			'recipient_address': balance_transfer.recipient_address,
			'deadline': timestamp.add_hours(1).timestamp,
			'mosaics': [
				{'mosaic_id': mosaic_id if mosaic_id else generate_mosaic_alias_id('symbol.xym'), 'amount': balance_transfer.amount}
			]
		}

		if balance_transfer.message:
			transfer_json['message'] = balance_transfer.message

		transaction = self.sdk_facade.transaction_factory.create(transfer_json)
		transaction.fee = Amount(int(self.config.extensions['transaction_fee_multiplier']) * transaction.size)
		return transaction

	def calculate_transfer_transaction_fee(self, balance_transfer, mosaic_id=None):
		"""Calculates a transfer transaction fee."""

		return self.create_transfer_transaction(NetworkTimestamp(0), balance_transfer, mosaic_id).fee.value
