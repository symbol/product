from collections import namedtuple

from symbolchain.CryptoTypes import PrivateKey

BalanceTransfer = namedtuple('BalanceTransfer', ['signer_public_key', 'recipient_address', 'amount', 'message'])


class TransactionSender:
	"""Utility class for sending transactions to a network."""

	@staticmethod
	def _load_key_pair(network_facade):
		private_key = PrivateKey(network_facade.config.extensions['signing_private_key'])
		return network_facade.sdk_facade.KeyPair(private_key)

	def __init__(self, network_facade, send_arguments=None):
		"""Creates a sender."""

		self.network_facade = network_facade
		self.sender_key_pair = self._load_key_pair(self.network_facade)
		self.send_arguments = send_arguments or []

		self.timestamp = None

	async def init(self):
		"""Initializes the sender."""

		connector = self.network_facade.create_connector()
		self.timestamp = await connector.network_time()

	async def send_transfer(self, destination_address, amount, messsage):
		"""Sends a transfer to the network."""

		transaction = self.network_facade.create_transfer_transaction(
			self.timestamp,
			BalanceTransfer(self.sender_key_pair.public_key, destination_address, amount, messsage),
			*(self.send_arguments)
		)

		return await self.send_transaction(transaction)

	async def send_transaction(self, transaction):
		"""Sends a transaction to the network."""

		connector = self.network_facade.create_connector()

		facade = self.network_facade.sdk_facade
		signature = facade.sign_transaction(self.sender_key_pair, transaction)
		facade.transaction_factory.attach_signature(transaction, signature)

		transaction_hash = facade.hash_transaction(transaction)
		await connector.announce_transaction(transaction)
		return transaction_hash
