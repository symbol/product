import tempfile
import unittest
from pathlib import Path

from symbolchain.CryptoTypes import PublicKey
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.sc import TransactionFactory
from symbolchain.symbol.Network import NetworkTimestamp

from shoestring.internal.LinkTransactionBuilder import LinkTransactionBuilder
from shoestring.internal.TransactionSerializer import write_transaction_to_file


class TransactionSerializerTest(unittest.TestCase):
	def test_can_write_transaction_to_file(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as directory:
			builder = LinkTransactionBuilder(PublicKey('1695B400FC0111F56F5630AC7EDDF5F9AAA45EED21B8E400A2C26BEF8E758FCE'), 'testnet')
			transaction, transaction_hash = builder.build(NetworkTimestamp(1234), 987, 0)

			# Act:
			transaction_filepath = Path(directory) / 'foo.dat'
			write_transaction_to_file(transaction, transaction_filepath)

			# Assert: correct permissions
			self.assertEqual(0o600, transaction_filepath.stat().st_mode & 0o777)

			# - correct contents
			with open(transaction_filepath, 'rb') as infile:
				read_transaction = TransactionFactory.deserialize(infile.read())
				read_transaction_hash = SymbolFacade('testnet').hash_transaction(read_transaction)

				self.assertEqual(transaction_hash, read_transaction_hash)
