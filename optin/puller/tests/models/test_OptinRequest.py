import unittest

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nem.Network import Address

from puller.models.OptinRequest import OptinRequest, OptinRequestError

HASH = 'FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA'
PUBLIC_KEY_1 = '138F8ECE0F01DC7CCD196F2C6249CBB78CF2822D23376C96C949DF859D5A0FC5'
PUBLIC_KEY_2 = '1BB7ACCACE4C2527F425B2156C676105DF013404F7FA1F169377CA05393AECBE'
NEM_ADDRESS = 'NBMUCRGBBF7LIVQWS2AHYOEAM7NMSDHJX7SQ54GJ'


class OptinRequestTest(unittest.TestCase):
	def test_can_create_request_regular(self):
		# Act:
		request = OptinRequest(Address(NEM_ADDRESS), Hash256(HASH), {'type': 100, 'destination': PUBLIC_KEY_1})

		# Assert:
		self.assertEqual(Address(NEM_ADDRESS), request.address)
		self.assertEqual(Hash256(HASH), request.transaction_hash)
		self.assertEqual(PublicKey(PUBLIC_KEY_1), request.destination_public_key)
		self.assertEqual(None, request.multisig_public_key)
		self.assertEqual(False, request.is_error)

	def test_can_create_request_multisig(self):
		# Act:
		request = OptinRequest(Address(NEM_ADDRESS), Hash256(HASH), {
			'type': 101, 'destination': PUBLIC_KEY_1, 'origin': PUBLIC_KEY_2
		})

		# Assert:
		self.assertEqual(Address(NEM_ADDRESS), request.address)
		self.assertEqual(Hash256(HASH), request.transaction_hash)
		self.assertEqual(PublicKey(PUBLIC_KEY_1), request.destination_public_key)
		self.assertEqual(PublicKey(PUBLIC_KEY_2), request.multisig_public_key)
		self.assertEqual(False, request.is_error)

	def test_can_create_request_error(self):
		# Act:
		error = OptinRequestError(Address(NEM_ADDRESS), Hash256(HASH), 'this is an error message')

		# Assert:
		self.assertEqual(Address(NEM_ADDRESS), error.address)
		self.assertEqual(Hash256(HASH), error.transaction_hash)
		self.assertEqual('this is an error message', error.message)
		self.assertEqual(True, error.is_error)
