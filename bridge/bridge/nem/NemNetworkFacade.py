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

	def create_connector(self):
		"""Creates a connector to the network."""

		return NemConnector(self.config.endpoint)

	@staticmethod
	def make_address(raw_address):
		"""Wraps a raw address into a typed address """

		return Address(raw_address)

	def extract_wrap_request_from_transaction(self, transaction_with_meta_json):  # pylint: disable=invalid-name
		"""Extracts a wrap request (or error) from a transaction ."""

		return [extract_wrap_request_from_transaction(self.network, transaction_with_meta_json)]

	async def lookup_account_balance(self, address):
		"""Gets account balance for network currency."""

		connector = self.create_connector()
		return await connector.balance(address)

	def create_transfer_transaction(self, timestamp, balance_transfer, use_version_one=True):
		"""Creates a transfer transaction."""

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
			transfer_json = {
				**transfer_json,
				'type': 'transfer_transaction_v2',
				'amount': 1_000000,
				'mosaics': [
					{
						'mosaic': {
							'mosaic_id': {'namespace_id': {'name': 'nem'}, 'name': 'xem'},
							'amount': balance_transfer.amount
						}
					}
				]
			}

		facade = NemFacade(self.network)
		return facade.transaction_factory.create(transfer_json)
