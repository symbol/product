from symbolchain.facade.NemFacade import NemFacade
from symbolchain.nem.Network import Address, Network
from symbolchain.Network import NetworkLocator
from symbollightapi.connector.NemConnector import NemConnector

from .NemUtils import calculate_transfer_transaction_fee, extract_wrap_request_from_transaction


class NemNetworkFacade:
	"""NEM network facade."""

	def __init__(self, config):
		"""Creates a NEM network facade."""

		self.config = config
		self.network = NetworkLocator.find_by_name(Network.NETWORKS, config.network)
		self.rosetta_network_id = ('NEM', self.network.name)
		self.sdk_facade = NemFacade(self.network)

	def create_connector(self):
		"""Creates a connector to the network."""

		return NemConnector(self.config.endpoint)

	@staticmethod
	def make_address(raw_address):
		"""Wraps a raw address into a typed address """

		return Address(raw_address)

	def is_valid_address_string(self, address_string):
		"""Checks if an address string is valid and belongs to this network."""

		return self.network.is_valid_address_string(address_string)

	def extract_wrap_request_from_transaction(self, is_valid_address, transaction_with_meta_json, mosaic_id=None):
		# pylint: disable=invalid-name
		"""Extracts a wrap request (or error) from a transaction ."""

		return [extract_wrap_request_from_transaction(self.network, is_valid_address, mosaic_id, transaction_with_meta_json)]

	async def lookup_account_balance(self, address, mosaic_id=None):
		"""Gets account balance for network currency."""

		connector = self.create_connector()
		return await connector.balance(address, mosaic_id)

	def create_transfer_transaction(self, timestamp, balance_transfer, use_version_one=True, mosaic_id=None):
		"""Creates a transfer transaction."""

		if use_version_one and mosaic_id:
			raise ValueError('version one does not support custom mosaics')

		fee = calculate_transfer_transaction_fee(balance_transfer.amount // 1_000000, balance_transfer.message)
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
