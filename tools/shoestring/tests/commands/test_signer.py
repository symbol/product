import tempfile
from pathlib import Path

from symbolchain.CryptoTypes import Hash256, PrivateKey, PublicKey
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.PrivateKeyStorage import PrivateKeyStorage
from symbolchain.sc import NetworkType, TransactionFactory, TransactionType
from symbolchain.symbol.KeyPair import KeyPair
from symbolchain.symbol.Network import NetworkTimestamp

from shoestring.__main__ import main
from shoestring.internal.NodeFeatures import NodeFeatures

from ..test.ConfigurationTestUtils import prepare_shoestring_configuration


def _assert_hash_lock_transaction(transaction, expected_signer_public_key, expected_hash):
	assert 184 == transaction.size
	assert TransactionType.HASH_LOCK == transaction.type_
	assert 1 == transaction.version
	assert NetworkType.TESTNET == transaction.network

	assert expected_signer_public_key == PublicKey(transaction.signer_public_key.bytes)
	assert 184 * 200 == transaction.fee.value
	assert NetworkTimestamp(1234000) == NetworkTimestamp(transaction.deadline.value)  # should be same as agggregate

	assert 1440 == transaction.duration.value
	assert expected_hash == Hash256(transaction.hash.bytes)


async def _assert_can_sign_transaction(transaction_descriptor_factory, check_hash_lock=False, ca_password=None):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		# - generate and save signing private key
		signer_key_pair = KeyPair(PrivateKey.random())
		private_key_storage = PrivateKeyStorage(output_directory, ca_password)
		private_key_storage.save('main', signer_key_pair.private_key)

		# - generate and write out (unsigned) transaction
		facade = SymbolFacade('testnet')
		transaction_filepath = Path(output_directory) / 'transaction.dat'
		with open(transaction_filepath, 'wb') as outfile:
			transaction = facade.transaction_factory.create({
				**transaction_descriptor_factory(signer_key_pair.public_key),
				'deadline': 1234000
			})
			outfile.write(transaction.serialize())

			# Sanity:
			assert not facade.verify_transaction(transaction, transaction.signature)

		# - prepare shoestring configuration
		config_filepath = prepare_shoestring_configuration(output_directory, NodeFeatures.PEER, ca_password=ca_password)

		# Act:
		await main([
			'signer',
			'--config', str(config_filepath),
			'--ca-key-path', str(Path(output_directory) / 'main.pem'),
			'--save',
			str(transaction_filepath)
		])

		# Assert:
		with open(transaction_filepath, 'rb') as infile:
			transaction_bytes = infile.read()
			transaction = TransactionFactory.deserialize(transaction_bytes)

			assert facade.verify_transaction(transaction, transaction.signature)

		hash_lock_transaction_filepath = Path(output_directory) / 'transaction.hash_lock.dat'
		if not check_hash_lock:
			assert not hash_lock_transaction_filepath.exists()
			return

		assert hash_lock_transaction_filepath.exists()

		aggregate_transaction_hash = facade.hash_transaction(transaction)
		with open(hash_lock_transaction_filepath, 'rb') as infile:
			transaction_bytes = infile.read()
			transaction = TransactionFactory.deserialize(transaction_bytes)

			assert facade.verify_transaction(transaction, transaction.signature)

			_assert_hash_lock_transaction(transaction, signer_key_pair.public_key, aggregate_transaction_hash)


# pylint: disable=invalid-name


# region normal transaction

async def test_can_sign_regular_transaction():
	await _assert_can_sign_transaction(lambda signer_public_key: {
		'type': 'account_key_link_transaction_v1',
		'signer_public_key': signer_public_key,

		'linked_public_key': KeyPair(PrivateKey.random()).public_key,
		'link_action': 'link'
	})


async def test_can_sign_transaction_with_password_protected_key():
	await _assert_can_sign_transaction(lambda signer_public_key: {
		'type': 'account_key_link_transaction_v1',
		'signer_public_key': signer_public_key,

		'linked_public_key': KeyPair(PrivateKey.random()).public_key,
		'link_action': 'link'
	}, ca_password='abc123')

# endregion


# region aggregate transaction

def _create_aggregate_transaction_descriptor(transaction_type, signer_public_key):
	facade = SymbolFacade('testnet')
	embedded_transactions = [
		facade.transaction_factory.create_embedded({
			'type': 'account_key_link_transaction_v1',
			'signer_public_key': signer_public_key,

			'linked_public_key': KeyPair(PrivateKey.random()).public_key,
			'link_action': 'link'
		})
	]

	return {
		'type': transaction_type,
		'signer_public_key': signer_public_key,
		'fee': 0,
		'deadline': 0,
		'transactions_hash': facade.hash_embedded_transactions(embedded_transactions),
		'transactions': embedded_transactions
	}


async def test_can_sign_aggregate_complete_transaction():
	# Arrange: signer public keys match CA key pair
	def create_transaction_descriptor(signer_public_key):
		return _create_aggregate_transaction_descriptor('aggregate_complete_transaction_v2', signer_public_key)

	# Act + Assert:
	await _assert_can_sign_transaction(create_transaction_descriptor)


async def test_can_sign_aggregate_complete_transaction_with_wrong_outer_public_key():
	# Arrange: signer public keys do NOT match CA key pair, so aggregate signer public key will be updated to match
	def create_transaction_descriptor(_):
		return _create_aggregate_transaction_descriptor('aggregate_complete_transaction_v2', KeyPair(PrivateKey.random()).public_key)

	# Act + Assert:
	await _assert_can_sign_transaction(create_transaction_descriptor)


async def test_can_sign_aggregate_bonded_transaction():
	# Arrange: signer public keys match CA key pair
	def create_transaction_descriptor(signer_public_key):
		return _create_aggregate_transaction_descriptor('aggregate_bonded_transaction_v2', signer_public_key)

	# Act + Assert:
	await _assert_can_sign_transaction(create_transaction_descriptor, check_hash_lock=True)


async def test_can_sign_aggregate_bonded_transaction_with_wrong_outer_public_key():
	# Arrange: signer public keys do NOT match CA key pair, so aggregate signer public key will be updated to match
	def create_transaction_descriptor(_):
		return _create_aggregate_transaction_descriptor('aggregate_bonded_transaction_v2', KeyPair(PrivateKey.random()).public_key)

	# Act + Assert:
	await _assert_can_sign_transaction(create_transaction_descriptor, check_hash_lock=True)

# endregion
