import unittest

from symbolchain.CryptoTypes import Hash256, PrivateKey
from symbolchain.nem.Network import Address as NemAddress
from symbolchain.sc import Amount, MosaicId, PublicKey, Signature, Timestamp, TransactionType, UnresolvedAddress, UnresolvedMosaicId
from symbolchain.symbol.KeyPair import KeyPair

from puller.processors.TransactionPreparer import TransactionPreparer


class TransactionPreparerTest(unittest.TestCase):

	def test_can_prepare_transaction(self):
		# Arrange:
		nem_address = NemAddress(bytes(range(1, 26)))
		key_pair = KeyPair(PrivateKey('E88283CE35FE74C89FFCB2D8BFA0A2CF6108BDC0D07606DEE34D161C30AC2F1E'))
		preparer = TransactionPreparer('testnet', MosaicId(0x1234_5678_90AB_CDEF), key_pair)
		recipient_address = preparer.facade.Address('TDJUZBOUALJJBV4AOR5BS42JWJD4B2MF3HD6GUI')

		# Act:
		transaction, transaction_hash = preparer.prepare_transaction(recipient_address, 1234, 5678, nem_address)

		# Assert:
		expected_size = 235
		expected_signature = Signature(
			'52E6569963B622A3AB2F7E0C023A40B9F568AD7A9A17372A631741E1613FC5FE'
			'C1373088C2EEF82A3AC692B01362A2F329D47B4AADE4F10D836D40C95954C604')
		expected_hash = Hash256('84E879F68CF5178512117416A4752B33A1305D8F12E638BD27C212C6269F0D9F')
		expected_message = b'\0{"nisAddress": "AEBAGBAFAYDQQCIKBMGA2DQPCAIREEYUCULBOGAZ"}'

		self.assertEqual(expected_size, transaction.size)
		self.assertEqual(TransactionType.TRANSFER, transaction.type_)
		self.assertEqual(PublicKey(key_pair.public_key.bytes), transaction.signer_public_key)
		self.assertEqual(expected_signature, transaction.signature)
		self.assertEqual(Amount(expected_size * 1000), transaction.fee)
		self.assertEqual(Timestamp(5678), transaction.deadline)
		self.assertEqual(UnresolvedAddress(recipient_address.bytes), transaction.recipient_address)

		self.assertEqual(expected_message, transaction.message)

		self.assertEqual(1, len(transaction.mosaics))
		self.assertEqual(UnresolvedMosaicId(0x1234_5678_90AB_CDEF), transaction.mosaics[0].mosaic_id)
		self.assertEqual(Amount(1234), transaction.mosaics[0].amount)

		# - hash
		calculated_hash = preparer.facade.hash_transaction(transaction)
		self.assertEqual(expected_hash, transaction_hash)
		self.assertEqual(calculated_hash, transaction_hash)
