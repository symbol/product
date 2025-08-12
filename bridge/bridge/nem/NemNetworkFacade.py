from symbolchain.CryptoTypes import PublicKey
from symbolchain.facade.NemFacade import NemFacade
from symbolchain.nem.Network import Address, Network
from symbolchain.Network import NetworkLocator
from symbollightapi.connector.NemConnector import NemConnector

from ..models.AddressValidator import try_convert_network_address_to_string
from ..models.Constants import PrintableMosaicId
from .NemUtils import calculate_transfer_transaction_fee, extract_wrap_request_from_transaction


class NemNetworkFacade:
	"""NEM network facade."""

	def __init__(self, config):
		"""Creates a NEM network facade."""

		self.config = config
		self.network = NetworkLocator.find_by_name(Network.NETWORKS, config.network)
		self.rosetta_network_id = ('NEM', self.network.name)
		self.sdk_facade = NemFacade(self.network)
		self.bridge_address = Address(config.bridge_address)
		self.transaction_search_address = self.bridge_address
		self.native_token_precision = 6

		self.mosaic_id_to_fee_information_map = {}

	async def init(self):
		"""Downloads information from the network to initialize the facade."""

		connector = self.create_connector()

		formatted_mosaic_id = self.config.mosaic_id
		self.mosaic_id_to_fee_information_map[formatted_mosaic_id] = await connector.mosaic_fee_information(formatted_mosaic_id.split(':'))

	@staticmethod
	def is_currency_mosaic_id(mosaic_id):
		"""Determines if a mosaic id represents the network currency mosaic id."""

		return ('nem', 'xem') == mosaic_id

	def extract_mosaic_id(self):
		"""
		Extracts the wrapped mosaic id from config and converts it into both a printable version
		and a version that can be passed to network facades as arguments.
		"""

		config_mosaic_id = self.config.mosaic_id
		mosaic_id_parts = tuple(config_mosaic_id.split(':'))

		if self.is_currency_mosaic_id(mosaic_id_parts):
			mosaic_id_parts = None

		return PrintableMosaicId(mosaic_id_parts, config_mosaic_id)

	def create_connector(self, **kwargs):
		"""Creates a connector to the network."""

		if kwargs.get('require_rosetta', False):
			return NemConnector(self.config.extensions['rosetta_endpoint'])

		return NemConnector(self.config.endpoint)

	@staticmethod
	def make_address(raw_address):
		"""Wraps a raw address into a typed address."""

		return Address(raw_address)

	@staticmethod
	def make_public_key(raw_public_key):
		"""Wraps a raw public key into a typed public key."""

		return PublicKey(raw_public_key)

	def is_valid_address(self, raw_address):
		"""Checks if an address is valid and belongs to this network."""

		address_str = try_convert_network_address_to_string(self.network, raw_address)
		return (address_str is not None, address_str)

	def extract_wrap_request_from_transaction(self, is_valid_address, transaction_with_meta_json, mosaic_id=None):
		# pylint: disable=invalid-name
		"""Extracts a wrap request (or error) from a transaction ."""

		return [extract_wrap_request_from_transaction(self.network, is_valid_address, mosaic_id, transaction_with_meta_json)]

	def create_transfer_transaction(self, timestamp, balance_transfer, mosaic_id=None, prefer_version_one=True):
		"""Creates a transfer transaction."""

		use_version_one = prefer_version_one and (mosaic_id is None or self.is_currency_mosaic_id(mosaic_id))

		fee = self.calculate_transfer_transaction_fee(balance_transfer, mosaic_id)
		transfer_json = {
			'signer_public_key': balance_transfer.signer_public_key,
			'recipient_address': balance_transfer.recipient_address,
			'timestamp': timestamp.timestamp,
			'deadline': timestamp.add_hours(1).timestamp,
			'fee': fee
		}

		if balance_transfer.message:
			transfer_json['message'] = {
				'message_type': 'plain',
				'message': balance_transfer.message
			}

		if use_version_one:
			transfer_json = {
				**transfer_json,
				'type': 'transfer_transaction_v1',
				'amount': balance_transfer.amount
			}
		else:
			mosaic_id = mosaic_id or ('nem', 'xem')
			transfer_json = {
				**transfer_json,
				'type': 'transfer_transaction_v2',
				'amount': 1_000000,
				'mosaics': [
					{
						'mosaic': {
							'mosaic_id': {'namespace_id': {'name': mosaic_id[0].encode('utf8')}, 'name': mosaic_id[1].encode('utf8')},
							'amount': balance_transfer.amount
						}
					}
				]
			}

		return self.sdk_facade.transaction_factory.create(transfer_json)

	def calculate_transfer_transaction_fee(self, balance_transfer, mosaic_id=None):
		"""Calculates a transfer transaction fee."""

		formatted_mosaic_id = ':'.join(mosaic_id or ('nem', 'xem'))
		mosaic_fee_information = self.mosaic_id_to_fee_information_map.get(formatted_mosaic_id, None)
		if mosaic_fee_information is None:
			raise ValueError(f'unable to create transaction for mosaic {formatted_mosaic_id} with unknown fee information')

		return calculate_transfer_transaction_fee(mosaic_fee_information, balance_transfer.amount, balance_transfer.message)
