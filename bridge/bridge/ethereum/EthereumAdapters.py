import datetime
from collections import namedtuple

from eth_account import Account
from eth_keys import keys
from symbolchain.ByteArray import ByteArray
from symbolchain.CryptoTypes import Hash256

from .RpcUtils import parse_rpc_response_hex_bytes

EthereumNetworkTimestamp = namedtuple('EthereumNetworkTimestamp', ['timestamp'])
EthereumTransactionFactory = namedtuple('EthereumTransactionFactory', ['attach_signature'])


class EthereumAddress(ByteArray):
	"""Represents an Ethereum address."""

	SIZE = 20

	def __init__(self, address):
		"""Creates an address from a decoded or encoded address."""

		raw_bytes = address
		if isinstance(address, str):
			raw_bytes = parse_rpc_response_hex_bytes(address)

		super().__init__(self.SIZE, raw_bytes, EthereumAddress)

	def __str__(self):
		return f'0x{super().__str__()}'


class EthereumPublicKey(ByteArray):
	"""Represents a public key."""

	SIZE = 64

	def __init__(self, public_key):
		"""Creates a public key from bytes or a hex string."""

		raw_bytes = public_key
		if isinstance(public_key, str):
			raw_bytes = parse_rpc_response_hex_bytes(public_key)

		super().__init__(self.SIZE, raw_bytes, EthereumPublicKey)

		# Ethereum public keys are not stored directly in transactions
		# store address within public key to minimize conversions
		self.address = EthereumAddress(keys.PublicKey(raw_bytes).to_canonical_address())

	def __repr__(self):
		return f'EthereumPublicKey(\'{str(self)}\')'


class EthereumNetwork:
	"""Represents an Ethereum network."""

	def __init__(self, name):
		"""Creates a new network."""

		self.name = name
		self.network_timestamp_class = EthereumNetworkTimestamp

	@staticmethod
	def to_datetime(reference_network_timestamp):
		"""Converts a network timestamp to a datetime."""

		return datetime.datetime.fromtimestamp(reference_network_timestamp.timestamp, tz=datetime.timezone.utc)


class EthereumSdkFacade:
	"""Facade used to interact with Ethereum blockchain."""

	class KeyPair:
		"""Ethereum key pair."""

		def __init__(self, private_key):
			"""Creates a key pair from a private key."""

			self.private_key = private_key
			self.public_key = EthereumPublicKey(keys.PrivateKey(self.private_key.bytes).public_key.to_bytes())

			self._account = Account().from_key(self.private_key.bytes)

	@staticmethod
	def _attach_signature(transaction, signature):
		# transaction is a dict, so just store the signature in it

		transaction['signature'] = signature

	def __init__(self, network):
		"""Creates an Ethereum facade."""

		self.network = network
		self.transaction_factory = EthereumTransactionFactory(self._attach_signature)

	@staticmethod
	def sign_transaction(key_pair, transaction):
		"""Signs an Ethereum transaction."""

		return key_pair._account.sign_transaction(transaction)  # pylint: disable=protected-access

	@staticmethod
	def hash_transaction(transaction):
		"""Hashes an Ethereum transaction."""

		# Ethereum transactions are hashed during signing
		return Hash256(bytes(transaction['signature'].hash))
