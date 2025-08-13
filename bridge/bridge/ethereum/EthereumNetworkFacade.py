from binascii import hexlify
from decimal import ROUND_UP, Decimal

from symbolchain.CryptoTypes import PrivateKey
from web3 import Web3

from ..models.Constants import PrintableMosaicId
from .EthereumAdapters import EthereumAddress, EthereumNetwork, EthereumPublicKey, EthereumSdkFacade
from .EthereumConnector import EthereumConnector
from .EthereumUtils import extract_wrap_request_from_transaction

DEFAULT_MULTIPLES = {
	'gas_multiple': '1.15',
	'gas_price_multiple': '1.2',
	'priority_fee_multiple': '1.05'
}


class EthereumNetworkFacade:  # pylint: disable=too-many-instance-attributes
	"""Ethereum network facade."""

	def __init__(self, config):
		"""Creates an Ethereum network facade."""

		self.config = config
		self.network = EthereumNetwork(self.config.network)
		self.rosetta_network_id = None
		self.sdk_facade = EthereumSdkFacade(self.network)
		self.bridge_address = EthereumAddress(self.config.bridge_address)

		# for ERC tokens search contract address
		self.transaction_search_address = EthereumAddress(self.config.mosaic_id or self.config.bridge_address)
		self.chain_id = int(self.config.extensions['chain_id'])
		self.native_token_precision = 18

		self.address_to_nonce_map = {}

	def _is_currency_mosaic_id(self):
		return not self.config.mosaic_id

	async def init(self):
		"""Downloads information from the network to initialize the facade."""

		connector = self.create_connector()
		signer_public_key = EthereumSdkFacade.KeyPair(PrivateKey(self.config.extensions['signer_private_key'])).public_key
		signer_address = signer_public_key.address
		self.address_to_nonce_map[signer_address] = await connector.nonce(signer_address, 'pending')

	def extract_mosaic_id(self):
		"""
		Extracts the wrapped mosaic id from config and converts it into both a printable version
		and a version that can be passed to network facades as arguments.
		"""

		config_mosaic_id = self.config.mosaic_id
		return PrintableMosaicId(config_mosaic_id, 'ETH' if self._is_currency_mosaic_id() else config_mosaic_id)

	def create_connector(self, **_kwargs):
		"""Creates a connector to the network."""

		is_finalization_supported = 'True' == self.config.extensions.get('is_finalization_supported', 'True')
		return EthereumConnector(self.config.endpoint, is_finalization_supported)

	@staticmethod
	def make_address(raw_address):
		"""Wraps a raw address into a typed address."""

		return EthereumAddress(raw_address)

	@staticmethod
	def make_public_key(raw_public_key):
		"""Wraps a raw public key into a typed public key."""

		return EthereumPublicKey(raw_public_key)

	@staticmethod
	def is_valid_address(raw_address):
		"""Checks if an address is valid and belongs to this network."""

		is_valid = Web3.is_address(raw_address)
		return (is_valid, raw_address if is_valid else None)

	def extract_wrap_request_from_transaction(self, is_valid_address, transaction_with_meta_json, _mosaic_id=None):
		# pylint: disable=invalid-name
		"""Extracts a wrap request (or error) from a transaction ."""

		wrap_request = extract_wrap_request_from_transaction(is_valid_address, self.bridge_address, transaction_with_meta_json)
		return [wrap_request] if wrap_request else []

	@staticmethod
	def _make_simple_transaction_object(balance_transfer, mosaic_id):
		recipient_address = balance_transfer.recipient_address
		if not isinstance(balance_transfer.recipient_address, EthereumAddress):
			recipient_address = EthereumAddress(balance_transfer.recipient_address)

		if not mosaic_id:
			return {
				'from': str(balance_transfer.signer_public_key.address),
				'to': str(recipient_address),
				'value': hex(balance_transfer.amount)
			}

		input_data = ''.join([
			'0x',
			'a9059cbb000000000000000000000000',
			str(balance_transfer.recipient_address)[2:],
			hexlify(balance_transfer.amount.to_bytes(32, 'big')).decode('utf8')
		])

		transaction = {
			'from': str(balance_transfer.signer_public_key.address),
			'to': mosaic_id,
			'data': input_data
		}
		return transaction

	def _apply_multiple(self, value, multiple_key):
		multiple = Decimal(self.config.extensions.get(multiple_key, DEFAULT_MULTIPLES[multiple_key]))
		return int((Decimal(value) * multiple).quantize(1, rounding=ROUND_UP))

	async def _calculate_gas(self, transaction):
		connector = self.create_connector()

		gas_estimate = Decimal(await connector.estimate_gas(transaction))
		gas_estimate = self._apply_multiple(gas_estimate, 'gas_multiple')

		gas_price = await connector.gas_price()
		gas_price = self._apply_multiple(gas_price, 'gas_price_multiple')

		fee_information = await connector.estimate_fees_from_history(int(self.config.extensions.get('fee_history_blocks_count', '10')))
		base_fee = self._apply_multiple(fee_information.base_fee, 'gas_price_multiple')
		priority_fee = self._apply_multiple(fee_information.priority_fee, 'priority_fee_multiple')

		max_fee_per_gas = base_fee + priority_fee
		if gas_price > max_fee_per_gas:
			minimum_tip = gas_price - base_fee
			if minimum_tip > priority_fee:
				max_fee_per_gas += minimum_tip - priority_fee
				priority_fee = minimum_tip

		return (gas_estimate, max_fee_per_gas, priority_fee)

	async def create_transfer_transaction(self, _timestamp, balance_transfer, mosaic_id):
		"""Creates a transfer transaction."""

		signer_address = balance_transfer.signer_public_key.address
		nonce = self.address_to_nonce_map.get(signer_address, None)
		if nonce is None:
			raise ValueError(f'unable to create transaction for sender {signer_address} with unknown nonce')

		self.address_to_nonce_map[balance_transfer.signer_public_key.address] += 1

		transaction = self._make_simple_transaction_object(balance_transfer, mosaic_id)
		(gas, max_fee_per_gas, max_priority_fee_per_gas) = await self._calculate_gas(transaction)
		transaction.update({
			'nonce': nonce,
			'chainId': self.chain_id,

			'gas': gas,
			'maxFeePerGas': max_fee_per_gas,
			'maxPriorityFeePerGas': max_priority_fee_per_gas
		})

		return transaction

	async def calculate_transfer_transaction_fee(self, balance_transfer, mosaic_id):
		"""Calculates a transfer transaction fee."""

		transaction = self._make_simple_transaction_object(balance_transfer, mosaic_id)
		(gas, max_fee_per_gas, _) = await self._calculate_gas(transaction)
		return gas * max_fee_per_gas
