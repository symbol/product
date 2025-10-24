import inspect
from collections import namedtuple
from decimal import ROUND_UP, Decimal

from symbolchain.CryptoTypes import Hash256, PrivateKey
from symbollightapi.model.Constants import TimeoutSettings, TransactionStatus
from symbollightapi.model.Exceptions import HttpException, InsufficientBalanceException, NodeException, NodeTransientException

BalanceChange = namedtuple('BalanceChange', ['address', 'currency_id', 'amount', 'transaction_hash'])
BalanceTransfer = namedtuple('BalanceTransfer', ['signer_public_key', 'recipient_address', 'amount', 'message'])
TrySendResult = namedtuple('TrySendResult', ['is_error', 'transaction_hash', 'net_amount', 'total_fee', 'error_message'])
FeeInformation = namedtuple('FeeInformation', ['transaction', 'conversion', 'total'])

# region estimate_balance_transfer_fees


async def _await_if_awaitable(value):
	if inspect.isawaitable(value):
		return await value

	return value


async def estimate_balance_transfer_fees(network_facade, balance_transfer, fee_multiplier):
	"""Estimates balance transfer fees."""

	mosaic_id = network_facade.extract_mosaic_id().id
	transaction_fee = Decimal(await _await_if_awaitable(network_facade.calculate_transfer_transaction_fee(balance_transfer, mosaic_id)))
	transaction_fee *= fee_multiplier  # convert fee to source network currency

	percentage_conversion_fee = Decimal(network_facade.config.extensions.get('percentage_conversion_fee', 0))
	conversion_fee = percentage_conversion_fee * Decimal(balance_transfer.amount)

	total_fee = int((transaction_fee + conversion_fee).quantize(1, rounding=ROUND_UP))

	return FeeInformation(transaction_fee, conversion_fee, total_fee)

# endregion


# region TransactionSender

class TransactionSender:
	"""Utility class for sending transactions to a network."""

	def __init__(self, network_facade):
		"""Creates a sender."""

		self.network_facade = network_facade
		self.mosaic_id = self.network_facade.extract_mosaic_id().id

		self.unconfirmed_wait_time_seconds = network_facade.config.extensions.get('unconfirmed_wait_time_seconds', 60)
		self.sender_key_pair = None
		self.timestamp = None

	async def init(self, vault_connector=None):
		"""Initializes the sender."""

		vault_key_prefix = 'vault:'
		config_private_key = self.network_facade.config.extensions['signer_private_key']
		if config_private_key.startswith(vault_key_prefix):
			secret_data = await vault_connector.read_kv_secret_data(config_private_key[len(vault_key_prefix):])
			private_key = PrivateKey(secret_data['signerPrivateKey'])
		else:
			private_key = PrivateKey(config_private_key)

		self.sender_key_pair = self.network_facade.sdk_facade.KeyPair(private_key)

		connector = self.network_facade.create_connector()
		self.timestamp = await connector.network_time()

	async def try_send_transfer(self, destination_address, fee_multiplier, amount, messsage=None):
		"""Sends a transfer to the network."""

		def make_balance_transfer(amount):
			return BalanceTransfer(self.sender_key_pair.public_key, destination_address, amount, messsage)

		fee_information = await estimate_balance_transfer_fees(self.network_facade, make_balance_transfer(amount), fee_multiplier)

		if amount < fee_information.total:
			error_message = ''.join([
				f'total fee (transaction {fee_information.transaction:.0f} + conversion {fee_information.conversion:.0f})'
				f' exceeds transfer amount {amount}'
			])
			return TrySendResult(True, None, None, None, error_message)

		net_amount = amount - fee_information.total
		transaction = await _await_if_awaitable(self.network_facade.create_transfer_transaction(
			self.timestamp,
			make_balance_transfer(net_amount),
			self.mosaic_id))
		transaction_hash = await self.send_transaction(transaction)
		return TrySendResult(False, transaction_hash, net_amount, fee_information.total, None)

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


# region is_transient_error

def is_transient_error(error):
	"""Determines if an error is transient. If False, it should be considered permanent."""

	if isinstance(error, HttpException):
		# 408: request timeout
		# 429: too many requests
		# 503: service unavailable
		return error.http_status_code in (408, 429, 503)

	if isinstance(error, (InsufficientBalanceException, NodeTransientException)):
		return True

	return False

# endregion
