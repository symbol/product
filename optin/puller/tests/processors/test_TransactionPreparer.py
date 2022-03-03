import unittest
from binascii import hexlify

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
		expected_signature = '192D25281ACC464A7D43D996EA46A52DDC81244AA7DE5CDFA08C6E51E324A94E' \
			'F0E895BD0BCD8CC9E84D22460FA7964395E8084565679406DD73F2C179BBF400'

		# Act:
		transaction, transaction_hash = preparer.prepare_transaction(recipient_address, 1234, 5678, nem_address)

		# Assert:
		self.assertEqual(294, transaction.size)
		self.assertEqual(TransactionType.TRANSFER, transaction.type_)
		self.assertEqual(PublicKey(key_pair.public_key.bytes), transaction.signer_public_key)
		self.assertEqual(Signature(expected_signature), transaction.signature)
		self.assertEqual(Amount(294 * 1000), transaction.fee)
		self.assertEqual(Timestamp(5678), transaction.deadline)
		self.assertEqual(UnresolvedAddress(recipient_address.bytes), transaction.recipient_address)

		plain_message = b'\0{"nisAddress": "AEBAGBAFAYDQQCIKBMGA2DQPCAIREEYUCULBOGAZ"}'
		self.assertEqual(hexlify(plain_message).upper(), transaction.message)

		self.assertEqual(1, len(transaction.mosaics))
		self.assertEqual(UnresolvedMosaicId(0x1234_5678_90AB_CDEF), transaction.mosaics[0].mosaic_id)
		self.assertEqual(Amount(1234), transaction.mosaics[0].amount)

		# - hash
		expected_hash = preparer.facade.hash_transaction(transaction)
		self.assertEqual(expected_hash, transaction_hash)
		self.assertEqual(Hash256('F37D4B613EBE405A20E6495AD37C6B338C41A9EB45F01D80B4E8E390225A53AF'), transaction_hash)
