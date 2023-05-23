import tempfile
from pathlib import Path

from symbolchain.CryptoTypes import PrivateKey
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.PrivateKeyStorage import PrivateKeyStorage
from symbolchain.sc import TransactionFactory
from symbolchain.symbol.KeyPair import KeyPair

from shoestring.__main__ import main


async def _assert_can_sign_transaction(transaction_descriptor_factory):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		# - generate and save signing private key
		signer_key_pair = KeyPair(PrivateKey.random())
		private_key_storage = PrivateKeyStorage(output_directory)
		private_key_storage.save('main', signer_key_pair.private_key)

		# - generate and write out (unsigned) transaction
		facade = SymbolFacade('testnet')
		transaction_filepath = Path(output_directory) / 'transaction.dat'
		with open(transaction_filepath, 'wb') as outfile:
			transaction = facade.transaction_factory.create(transaction_descriptor_factory(signer_key_pair.public_key))
			outfile.write(transaction.serialize())

			# Sanity:
			assert not facade.verify_transaction(transaction, transaction.signature)

		# Act:
		await main([
			'signer',
			'--config', str(Path('tests/resources/testnet.properties').absolute()),
			'--ca-key-path', str(Path(output_directory) / 'main.pem'),
			'--save',
			str(transaction_filepath)
		])

		# Assert:
		with open(transaction_filepath, 'rb') as infile:
			transaction_bytes = infile.read()
			transaction = TransactionFactory.deserialize(transaction_bytes)

			assert facade.verify_transaction(transaction, transaction.signature)


async def test_can_sign_regular_transaction():
	await _assert_can_sign_transaction(lambda signer_public_key: {
		'type': 'account_key_link_transaction_v1',
		'signer_public_key': signer_public_key,

		'linked_public_key': KeyPair(PrivateKey.random()).public_key,
		'link_action': 'link',
	})


async def test_can_sign_aggregate_transaction():
	# Arrange:
	def create_transaction_descriptor(signer_public_key):
		facade = SymbolFacade('testnet')
		embedded_transactions = [
			facade.transaction_factory.create_embedded({
				'type': 'account_key_link_transaction_v1',
				'signer_public_key': signer_public_key,

				'linked_public_key': KeyPair(PrivateKey.random()).public_key,
				'link_action': 'link',
			})
		]

		return {
			'type': 'aggregate_complete_transaction_v2',
			'signer_public_key': signer_public_key,
			'fee': 0,
			'deadline': 0,
			'transactions_hash': facade.hash_embedded_transactions(embedded_transactions),
			'transactions': embedded_transactions
		}

	# Act + Assert:
	await _assert_can_sign_transaction(create_transaction_descriptor)
