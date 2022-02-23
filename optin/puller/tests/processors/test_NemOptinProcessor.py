import json
import unittest
from binascii import hexlify

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nem.Network import Address

from puller.processors.NemOptinProcessor import process_nem_optin_request

TRANSACTION_HEIGHT = 1234567890625
TRANSACTION_HASH = Hash256('087A85B5E716A141437D56FC973B7280919C5D14ACF85AEE9C0F85F83E6D589A')
TRANSACTION_SIGNER_ADDRESS = Address('NABHFGE5ORQD3LE4O6B7JUFN47ECOFBFASC3SCAC')
TRANSACTION_SIGNER_PUBLIC_KEY = PublicKey('96EB2A145211B1B7AB5F0D4B14F8ABC8D695C7AEE31A3CFC2D4881313C68EEA3')


class PreprocessNemTest(unittest.TestCase):
	def _assert_error(self, error, expected_message):
		self.assertEqual(TRANSACTION_SIGNER_ADDRESS, error.address)
		self.assertEqual(TRANSACTION_HEIGHT, error.transaction_height)
		self.assertEqual(TRANSACTION_HASH, error.transaction_hash)
		self.assertEqual(expected_message, error.message)
		self.assertEqual(True, error.is_error)

	def test_fails_when_transaction_does_not_have_message(self):
		# Act:
		error = process_nem_optin_request({
			'meta': {'hash': {'data': str(TRANSACTION_HASH)}, 'height': TRANSACTION_HEIGHT},
			'transaction': {'type': 123, 'signer': str(TRANSACTION_SIGNER_PUBLIC_KEY)}
		})

		# Assert:
		self._assert_error(error, 'transaction does not have a message')

	def _assert_invalid_message(self, message, expected_error_message):
		# Act:
		error = process_nem_optin_request({
			'meta': {'hash': {'data': str(TRANSACTION_HASH)}, 'height': TRANSACTION_HEIGHT},
			'transaction': {'type': 123, 'signer': str(TRANSACTION_SIGNER_PUBLIC_KEY), 'message': message}
		})

		# Assert:
		self._assert_error(error, expected_error_message)

	def test_fails_when_transaction_message_is_empty(self):
		self._assert_invalid_message({}, 'transaction message is not present')

	def test_fails_when_transaction_message_has_wrong_type(self):
		self._assert_invalid_message({'type': 2}, 'transaction message has wrong type')

	def test_fails_when_transaction_message_cannot_be_decoded(self):
		self._assert_invalid_message({'type': 1, 'payload': 'ABABABA%%%%BABABABABAB'}, 'transaction message is not hex encoded')

	def test_fails_when_transaction_message_is_not_valid_json(self):
		self._assert_invalid_message({'type': 1, 'payload': 'ABABABABABABABABAB'}, 'transaction message is not valid json')

	def _assert_invalid_optin_message(self, payload, expected_error_message):
		# Act:
		error = process_nem_optin_request({
			'meta': {'hash': {'data': str(TRANSACTION_HASH)}, 'height': TRANSACTION_HEIGHT},
			'transaction': {
				'type': 123,
				'signer': str(TRANSACTION_SIGNER_PUBLIC_KEY),
				'message': {'type': 1, 'payload': hexlify(json.dumps(payload).encode('utf8'))}
			}
		})

		# Assert:
		self._assert_error(error, expected_error_message)

	def test_fails_when_optin_message_json_is_not_dict(self):
		self._assert_invalid_optin_message([1, 2, 3], 'transaction optin message JSON is not an object')

	def test_fails_when_optin_message_has_unexpected_type(self):
		self._assert_invalid_optin_message({}, 'transaction optin message has unexpected type: None')
		self._assert_invalid_optin_message({'type': 17}, 'transaction optin message has unexpected type: 17')

	def test_fails_when_optin_message_has_invalid_destination(self):
		self._assert_invalid_optin_message({'type': 100}, 'transaction optin message is malformed')
		self._assert_invalid_optin_message({'type': 100, 'destination': 'AABBCC'}, 'transaction optin message is malformed')

	def test_fails_when_optin_message_has_invalid_origin(self):
		destination_public_key = PublicKey('5EFEABA9E29297B6221820171DE215DAFD0DA17DE206710EA5788121D43D5AF1')
		self._assert_invalid_optin_message(
			{'type': 101, 'destination': str(destination_public_key)},
			'transaction optin message is malformed')
		self._assert_invalid_optin_message(
			{'type': 101, 'destination': str(destination_public_key), 'origin': 'AABBCC'},
			'transaction optin message is malformed')

	def _process_valid_payload(self, payload):
		# Act:
		request = process_nem_optin_request({
			'meta': {'hash': {'data': str(TRANSACTION_HASH)}, 'height': TRANSACTION_HEIGHT},
			'transaction': {
				'type': 123,
				'signer': str(TRANSACTION_SIGNER_PUBLIC_KEY),
				'message': {'type': 1, 'payload': hexlify(json.dumps(payload).encode('utf8'))}
			}
		})

		# Assert:
		self.assertEqual(TRANSACTION_SIGNER_ADDRESS, request.address)
		self.assertEqual(TRANSACTION_HEIGHT, request.transaction_height)
		self.assertEqual(TRANSACTION_HASH, request.transaction_hash)
		self.assertEqual(False, request.is_error)
		return request

	def test_can_process_non_multisig_optin(self):
		# Arrange:
		destination_public_key = PublicKey('1433CE6D1C3F154B007CED915DA527681B5C5FE261B7316EF00B6B03E14305BD')

		# Act:
		request = self._process_valid_payload({
			'type': 100,
			'destination': str(destination_public_key)
		})

		# Assert:
		self.assertEqual(destination_public_key, request.destination_public_key)
		self.assertEqual(None, request.multisig_public_key)

	def test_can_process_multisig_optin(self):
		# Arrange:
		destination_public_key = PublicKey('1433CE6D1C3F154B007CED915DA527681B5C5FE261B7316EF00B6B03E14305BD')
		origin_public_key = PublicKey('A50E646D59677056672A30374682C78AE0EF74A8CD66A258866E99B5DF2DCA3D')

		# Act:
		request = self._process_valid_payload({
			'type': 101,
			'destination': str(destination_public_key),
			'origin': str(origin_public_key)
		})

		# Assert:
		self.assertEqual(destination_public_key, request.destination_public_key)
		self.assertEqual(origin_public_key, request.multisig_public_key)
