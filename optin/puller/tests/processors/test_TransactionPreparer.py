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
		expected_signature = 'A49FD8A4C9FDC48C0C284D9C09EC35900EAAB707DBA2C839A2DA49D12FFB6B37' \
			'FE42A76F1326C31DBB1B635434A474BCBB1417C8892D8FBE70EB2BF6AC6AC20D'

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
		self.assertEqual(Hash256('054A580F6AE737ED57A05F2E8DE94697A2A067048029C5B412C0B1BDC0630C0F'), transaction_hash)
