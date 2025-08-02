import datetime
import unittest
from binascii import unhexlify

from symbolchain.CryptoTypes import Hash256, PrivateKey

from bridge.ethereum.EthereumAdapters import (
	EthereumAddress,
	EthereumNetwork,
	EthereumNetworkTimestamp,
	EthereumPublicKey,
	EthereumSdkFacade
)


class EthereumAdaptersTest(unittest.TestCase):
	ETHEREUM_PUBLIC_KEY_HEX = ''.join([
		'B2B454118618A6D3E79FEDE753F60824C4D7E5EA15B4282D847801C8246A5A7C',
		'AB017D4EFA17D1EB61DA79E3632D33B5123E158135C94CA741BB05566FFFA757'
	])

	# region EthereumAddress

	def test_can_create_ethereum_address_from_string(self):
		# Act:
		address = EthereumAddress('0x0ff070994dd3fdB1441433c219A42286ef85290f')

		# Assert:
		self.assertEqual(unhexlify('0FF070994DD3FDB1441433C219A42286EF85290F'), address.bytes)
		self.assertEqual('0x0FF070994DD3FDB1441433C219A42286EF85290F', str(address))

	def test_can_create_ethereum_address_from_bytes(self):
		# Act:
		address = EthereumAddress(unhexlify('0FF070994DD3FDB1441433C219A42286EF85290F'))

		# Assert:
		self.assertEqual(unhexlify('0FF070994DD3FDB1441433C219A42286EF85290F'), address.bytes)
		self.assertEqual('0x0FF070994DD3FDB1441433C219A42286EF85290F', str(address))

	def test_ethereum_address_supports_comparisons(self):
		# Arrange:
		address = EthereumAddress('0x0ff070994dd3fdB1441433c219A42286ef85290f')

		# Act + Assert:
		self.assertEqual(address, EthereumAddress('0x0ff070994dd3fdB1441433c219A42286ef85290f'))
		self.assertEqual(address, EthereumAddress('0x0FF070994DD3FDB1441433C219A42286EF85290F'))

		self.assertNotEqual(EthereumAddress('0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97'), address)
		self.assertNotEqual(address, EthereumAddress('0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97'))

	# endregion

	# region EthereumPublicKey

	def test_can_create_ethereum_public_key_from_string(self):
		# Act:
		public_key = EthereumPublicKey(f'0x{self.ETHEREUM_PUBLIC_KEY_HEX.lower()}')

		# Assert:
		self.assertEqual(unhexlify(self.ETHEREUM_PUBLIC_KEY_HEX), public_key.bytes)
		self.assertEqual(self.ETHEREUM_PUBLIC_KEY_HEX, str(public_key))
		self.assertEqual(f'EthereumPublicKey(\'{self.ETHEREUM_PUBLIC_KEY_HEX}\')', repr(public_key))

		self.assertEqual(EthereumAddress('0xb5368c39Efb0DbA28C082733FE3F9463A215CC3D'), public_key.address)

	def test_can_create_ethereum_public_key_from_bytes(self):
		# Act:
		public_key = EthereumPublicKey(unhexlify(self.ETHEREUM_PUBLIC_KEY_HEX))

		# Assert:
		self.assertEqual(unhexlify(self.ETHEREUM_PUBLIC_KEY_HEX), public_key.bytes)
		self.assertEqual(self.ETHEREUM_PUBLIC_KEY_HEX, str(public_key))
		self.assertEqual(f'EthereumPublicKey(\'{self.ETHEREUM_PUBLIC_KEY_HEX}\')', repr(public_key))

		self.assertEqual(EthereumAddress('0xb5368c39Efb0DbA28C082733FE3F9463A215CC3D'), public_key.address)

	# endregion

	# region EthereumNetwork

	def test_can_create_ethereum_network(self):
		# Act:
		network = EthereumNetwork('foobar')

		# Assert:
		self.assertEqual('foobar', network.name)
		self.assertEqual(EthereumNetworkTimestamp, network.network_timestamp_class)

	def test_can_convert_timestamp_to_datetime(self):
		# Arrange:
		network = EthereumNetwork('foobar')

		# Act:
		datetime_timestamp = network.to_datetime(EthereumNetworkTimestamp(0x66AA3553))

		# Assert:
		self.assertEqual(datetime.datetime(2024, 7, 31, 13, 0, 3, 0, datetime.timezone.utc), datetime_timestamp)

	# endregion

	# region EthereumSdkFacade

	def test_can_create_ethereum_key_pair(self):
		# Arrange:
		private_key = PrivateKey('0999a20d4fdda8d7273e8a24f70e1105f9dcfcae2fba55e9a08f6e752411ed7a')

		# Act:
		key_pair = EthereumSdkFacade.KeyPair(private_key)

		# Assert:
		self.assertEqual(private_key, key_pair.private_key)
		self.assertEqual(EthereumPublicKey(f'0x{self.ETHEREUM_PUBLIC_KEY_HEX}'), key_pair.public_key)
		self.assertEqual(EthereumAddress('0xb5368c39Efb0DbA28C082733FE3F9463A215CC3D'), key_pair.public_key.address)

	def test_can_create_ethereum_sdk_facade(self):
		# Arrange:
		network = EthereumNetwork('foobar')

		# Act:
		facade = EthereumSdkFacade(network)

		# Assert:
		self.assertEqual(network, facade.network)

	@staticmethod
	def _create_test_transaction_descriptor():
		return {
			'to': '0xF0109fC8DF283027b6285cc889F5aA624EaC1F55',
			'value': 1000000000,
			'gas': 2000000,
			'gasPrice': 234567897654321,
			'nonce': 0,
			'chainId': 1337
		}

	def test_ethereum_sdk_facade_can_sign_transaction(self):
		# Arrange:
		facade = EthereumSdkFacade(EthereumNetwork('foobar'))
		private_key = PrivateKey('0999a20d4fdda8d7273e8a24f70e1105f9dcfcae2fba55e9a08f6e752411ed7a')
		key_pair = EthereumSdkFacade.KeyPair(private_key)

		# Act:
		signed_transaction = facade.sign_transaction(key_pair, self._create_test_transaction_descriptor())

		# Assert:
		self.assertEqual(unhexlify(''.join([
			'f86c8086d55698372431831e848094f0109fc8df283027b6285cc889f5aa624e',
			'ac1f55843b9aca0080820a95a06ff308663c63a472cc873d34d27bf78626122c',
			'7715b87e5ac2e1042d4ddda494a064508194fa59205819f37c7f05a0a24667bd',
			'22be77ee7a2ec14f33001ca3ddb4'
		])), bytes(signed_transaction.raw_transaction))

	def test_ethereum_sdk_facade_can_attach_transaction_signature(self):
		# Arrange:
		facade = EthereumSdkFacade(EthereumNetwork('foobar'))
		private_key = PrivateKey('0999a20d4fdda8d7273e8a24f70e1105f9dcfcae2fba55e9a08f6e752411ed7a')
		key_pair = EthereumSdkFacade.KeyPair(private_key)

		transaction = self._create_test_transaction_descriptor()
		signed_transaction = facade.sign_transaction(key_pair, transaction)

		# Act:
		facade.transaction_factory.attach_signature(transaction, signed_transaction)

		# Assert:
		self.assertEqual(signed_transaction, transaction['signature'])

	def test_ethereum_sdk_facade_can_hash_transaction(self):
		# Arrange:
		facade = EthereumSdkFacade(EthereumNetwork('foobar'))
		private_key = PrivateKey('0999a20d4fdda8d7273e8a24f70e1105f9dcfcae2fba55e9a08f6e752411ed7a')
		key_pair = EthereumSdkFacade.KeyPair(private_key)

		transaction = self._create_test_transaction_descriptor()
		signed_transaction = facade.sign_transaction(key_pair, transaction)
		facade.transaction_factory.attach_signature(transaction, signed_transaction)

		# Act:
		transaction_hash = facade.hash_transaction(transaction)

		# Assert:
		self.assertEqual(Hash256('FA89DF5BC3F2807FF272551A6D6E9E7165EDC773C77E715434B9E07EAE78346D'), transaction_hash)

	# endregion
