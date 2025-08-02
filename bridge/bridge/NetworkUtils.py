from collections import namedtuple
from decimal import ROUND_UP, Decimal

from symbolchain.CryptoTypes import Hash256, PrivateKey
from symbollightapi.model.Constants import TimeoutSettings, TransactionStatus
from symbollightapi.model.Exceptions import NodeException

BalanceChange = namedtuple('BalanceChange', ['address', 'currency_id', 'amount', 'transaction_hash'])
BalanceTransfer = namedtuple('BalanceTransfer', ['signer_public_key', 'recipient_address', 'amount', 'message'])
TrySendResult = namedtuple('TrySendResult', ['is_error', 'transaction_hash', 'net_amount', 'total_fee', 'error_message'])

# region TransactionSender


class TransactionSender:
	"""Utility class for sending transactions to a network."""

	@staticmethod
	def _load_key_pair(network_facade):
		private_key = PrivateKey(network_facade.config.extensions['signing_private_key'])
		return network_facade.sdk_facade.KeyPair(private_key)

	def __init__(self, network_facade, mosaic_id=None):
		"""Creates a sender."""

		self.network_facade = network_facade
		self.sender_key_pair = self._load_key_pair(self.network_facade)
		self.mosaic_id = mosaic_id

		self.percentage_conversion_fee = Decimal(network_facade.config.extensions.get('percentage_conversion_fee', 0))
		self.unconfirmed_wait_time_seconds = network_facade.config.extensions.get('unconfirmed_wait_time_seconds', 60)
		self.timestamp = None

	async def init(self):
		"""Initializes the sender."""

		connector = self.network_facade.create_connector()
		self.timestamp = await connector.network_time()

	async def try_send_transfer(self, destination_address, amount, messsage=None):
		"""Sends a transfer to the network."""

		def make_balance_transfer(amount):
			return BalanceTransfer(self.sender_key_pair.public_key, destination_address, amount, messsage)

		transaction_fee = self.network_facade.calculate_transfer_transaction_fee(make_balance_transfer(amount))
		conversion_fee = int((self.percentage_conversion_fee * amount).quantize(1, rounding=ROUND_UP))

		total_fee = transaction_fee + conversion_fee
		if amount < total_fee:
			error_message = f'total fee (transaction {transaction_fee} + conversion {conversion_fee}) exceeds transfer amount {amount}'
			return TrySendResult(True, None, None, None, error_message)

		net_amount = amount - total_fee
		transaction = self.network_facade.create_transfer_transaction(self.timestamp, make_balance_transfer(net_amount), self.mosaic_id)
		transaction_hash = await self.send_transaction(transaction)
		return TrySendResult(False, transaction_hash, net_amount, total_fee, None)

	async def send_transaction(self, transaction):
		"""Sends a transaction to the network."""

		connector = self.network_facade.create_connector()

		facade = self.network_facade.sdk_facade
		signature = facade.sign_transaction(self.sender_key_pair, transaction)
		facade.transaction_factory.attach_signature(transaction, signature)

		transaction_hash = facade.hash_transaction(transaction)
		await connector.announce_transaction(transaction)

		is_unconfirmed = await connector.try_wait_for_announced_transaction(
			transaction_hash,
			TransactionStatus.UNCONFIRMED,
			TimeoutSettings(self.unconfirmed_wait_time_seconds, 1))

		if not is_unconfirmed:
			raise NodeException(f'aborting because transaction {transaction_hash} did not transition to unconfirmed status')

		return transaction_hash

# endregion


# region download_rosetta_block_balance_changes

async def download_rosetta_block_balance_changes(connector, blockchain, network, height):  # pylint: disable=invalid-name
	"""Downloads balance changes from a rosetta block."""

	def _extract_currency_id(currency_json):
		has_id = 'metadata' in currency_json and 'id' in currency_json['metadata']
		return currency_json['metadata']['id'] if has_id else currency_json['symbol']

	response_json = await connector.post('block', {
		'network_identifier': {'blockchain': blockchain, 'network': network},
		'block_identifier': {'index': str(height)}
	})

	balance_changes = []
	for transaction_json in response_json['block']['transactions']:
		transaction_hash = Hash256(transaction_json['transaction_identifier']['hash'])
		for operation_json in transaction_json['operations']:
			if 'transfer' == operation_json['type'] and 'success' == operation_json['status']:
				balance_change = BalanceChange(
					operation_json['account']['address'],
					_extract_currency_id(operation_json['amount']['currency']),
					int(operation_json['amount']['value']),
					transaction_hash)
				balance_changes.append(balance_change)

	return balance_changes

# endregion
