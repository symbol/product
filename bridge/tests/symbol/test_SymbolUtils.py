import unittest
from binascii import hexlify

from symbolchain.CryptoTypes import Hash256
from symbolchain.sc import TransactionType, TransferTransactionV1
from symbolchain.symbol.Network import Address, Network

from bridge.models.WrapRequest import WrapRequest
from bridge.symbol.SymbolUtils import extract_wrap_request_from_transaction

from ..test.BridgeTestUtils import (
	assert_wrap_request_failure,
	assert_wrap_request_success,
	change_request_amount,
	change_request_destination_address,
	make_wrap_error_from_request
)


class SymbolUtilsTest(unittest.TestCase):
	# region extract_wrap_request_from_transaction - transfer (success)

	@staticmethod
	def _extract_wrap_request_from_transaction(transaction_with_meta_json):
		def is_valid_address(address):
			return '0x4838b106fce9647bdf1e7877bf73ce8b0bad5f' == address[:-2] and address[-2:] in ('97', '90', 'a0', 'b0')

		def is_matching_mosaic_id(mosaic_id):
			return 0xFAF0EBED913FA202 == mosaic_id

		return extract_wrap_request_from_transaction(Network.TESTNET, is_valid_address, is_matching_mosaic_id, transaction_with_meta_json)

	@staticmethod
	def _create_simple_wrap_request(transaction_subindex=-1):
		return WrapRequest(
			23456,
			Hash256('C0B52BE17C2F41539E50857855A226A24AFE8B23B51E42F3186FBC725EA63550'),
			transaction_subindex,
			Address('TA6MYQRFJI24C2Y2WPX7QKAPMUDIS5FWZOBIBEA'),
			7777_000000,
			'0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97')

	@staticmethod
	def _create_transfer_json(request, mosaics, **kwargs):
		# workaround to create a transaction from a request
		# use a reverse lookup because request includes address but transaction requires public key
		signer_address_to_public_key_mapping = {
			Address('TA6MYQRFJI24C2Y2WPX7QKAPMUDIS5FWZOBIBEA'): '4B7E7A084005D2149B44F6A782D9E597C0FABE56F4FEEC1738FE5152C69D55C3'
		}

		transaction_with_meta_json = {
			'meta': {
				'height': str(request.transaction_height),
				'hash': str(request.transaction_hash),
			},
			'transaction': {
				'type': kwargs.get('transaction_type', TransferTransactionV1.TRANSACTION_TYPE.value),
				'signerPublicKey': signer_address_to_public_key_mapping[request.sender_address],
				'mosaics': mosaics,
				'message': hexlify(request.destination_address.encode('utf8')).decode('utf8')
			}
		}

		return transaction_with_meta_json

	def _assert_can_extract_wrap_request_from_simple_transfer(self, mosaics, **kwargs):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_with_meta_json = self._create_transfer_json(request, mosaics, **kwargs)

		# Act:
		results = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		self.assertEqual(1, len(results))
		assert_wrap_request_success(self, results[0], request)

	def test_can_extract_wrap_request_from_transfer_with_single_mosaic(self):
		self._assert_can_extract_wrap_request_from_simple_transfer([
			{'id': 'FAF0EBED913FA202', 'amount': '7777000000'}
		])

	def test_can_extract_wrap_request_from_transfer_with_multiple_mosaics(self):
		self._assert_can_extract_wrap_request_from_simple_transfer([
			{'id': 'F9F0EBED913FA202', 'amount': '5555000000'},
			{'id': 'FAF0EBED913FA202', 'amount': '7777000000'},
			{'id': 'FBF0EBED913FA202', 'amount': '8888000000'},
		])

	def test_can_extract_wrap_request_from_transfer_with_multiple_mosaics_without_currency_mosaic(self):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_with_meta_json = self._create_transfer_json(request, [
			{'id': 'F9F0EBED913FA202', 'amount': '5555000000'},
			{'id': 'FBF0EBED913FA202', 'amount': '8888000000'},
		])

		# Act:
		results = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		self.assertEqual(1, len(results))
		assert_wrap_request_success(self, results[0], change_request_amount(request, 0))

	def test_can_extract_wrap_request_from_transfer_matching_custom_mosaic(self):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_with_meta_json = self._create_transfer_json(request, [
			{'id': 'F9F0EBED913FA202', 'amount': '5555000000'},
			{'id': 'FBF0EBED913FA202', 'amount': '8888000000'},
		])

		# Act: extract transfers of a custom mosaic (not the currency mosaic)
		results = extract_wrap_request_from_transaction(
			Network.TESTNET,
			lambda _: True,
			lambda mosaic_id: 0xFBF0EBED913FA202 == mosaic_id,
			transaction_with_meta_json)

		# Assert:
		self.assertEqual(1, len(results))
		assert_wrap_request_success(self, results[0], change_request_amount(request, 8888000000))

	# endregion

	# region extract_wrap_request_from_transaction - transfer (failure)

	def _assert_cannot_extract_wrap_request_from_simple_transfer(self, expected_error_message, **kwargs):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_with_meta_json = self._create_transfer_json(request, [
			{'id': 'FAF0EBED913FA202', 'amount': '7777000000'}
		], **kwargs)

		if kwargs.get('clear_message', False):
			del transaction_with_meta_json['transaction']['message']

		# Act:
		results = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		self.assertEqual(1, len(results))
		assert_wrap_request_failure(self, results[0], make_wrap_error_from_request(request, expected_error_message))

	def test_cannot_extract_wrap_request_from_simple_transfer_without_message(self):
		self._assert_cannot_extract_wrap_request_from_simple_transfer(
			'required message is missing',
			clear_message=True)

	def test_cannot_extract_wrap_request_from_other_transaction(self):
		self._assert_cannot_extract_wrap_request_from_simple_transfer(
			'transaction type 16718 is not supported',
			transaction_type=TransactionType.NAMESPACE_REGISTRATION.value)

	def test_cannot_extract_wrap_request_from_transfer_with_invalid_message(self):
		# Arrange:
		request = self._create_simple_wrap_request()
		request = change_request_destination_address(request, '0x4838b106fce9647bdf1e7877bf73ce8b0bad5f')  # too short
		transaction_with_meta_json = self._create_transfer_json(request, [
			{'id': 'FAF0EBED913FA202', 'amount': '7777000000'}
		])

		# Act:
		results = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		self.assertEqual(1, len(results))

		expected_error_message = 'destination address 0x4838b106fce9647bdf1e7877bf73ce8b0bad5f is invalid'
		assert_wrap_request_failure(self, results[0], make_wrap_error_from_request(request, expected_error_message))

	# endregion

	# region extract_wrap_request_from_transaction - transfer embedded (success)

	@staticmethod
	def _create_embedded_transfer_json(request, mosaics, **kwargs):
		# workaround to create a transaction from a request
		# use a reverse lookup because request includes address but transaction requires public key
		signer_address_to_public_key_mapping = {
			Address('TA6MYQRFJI24C2Y2WPX7QKAPMUDIS5FWZOBIBEA'): '4B7E7A084005D2149B44F6A782D9E597C0FABE56F4FEEC1738FE5152C69D55C3'
		}

		transaction_with_meta_json = {
			'meta': {
				'height': str(request.transaction_height),
				'aggregateHash': str(request.transaction_hash),
				'index': request.transaction_subindex
			},
			'transaction': {
				'type': kwargs.get('transaction_type', TransferTransactionV1.TRANSACTION_TYPE.value),
				'signerPublicKey': signer_address_to_public_key_mapping[request.sender_address],
				'mosaics': mosaics,
				'message': hexlify(request.destination_address.encode('utf8')).decode('utf8')
			}
		}

		return transaction_with_meta_json

	def _assert_can_extract_wrap_request_from_simple_embedded_transfer(self, mosaics, **kwargs):
		# Arrange:
		request = self._create_simple_wrap_request(transaction_subindex=kwargs.get('transaction_subindex'))
		transaction_with_meta_json = self._create_embedded_transfer_json(request, mosaics, **kwargs)

		# Act:
		results = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		self.assertEqual(1, len(results))
		assert_wrap_request_success(self, results[0], request)

	def test_can_extract_wrap_request_from_embedded_transfer_with_single_mosaic(self):
		self._assert_can_extract_wrap_request_from_simple_embedded_transfer([
			{'id': 'FAF0EBED913FA202', 'amount': '7777000000'}
		], transaction_subindex=2)

	def test_can_extract_wrap_request_from_embedded_transfer_with_multiple_mosaics(self):
		self._assert_can_extract_wrap_request_from_simple_embedded_transfer([
			{'id': 'F9F0EBED913FA202', 'amount': '5555000000'},
			{'id': 'FAF0EBED913FA202', 'amount': '7777000000'},
			{'id': 'FBF0EBED913FA202', 'amount': '8888000000'},
		], transaction_subindex=3)

	def test_can_extract_wrap_request_from_embedded_transfer_with_multiple_mosaics_without_currency_mosaic(self):
		# Arrange:
		request = self._create_simple_wrap_request(transaction_subindex=4)
		transaction_with_meta_json = self._create_embedded_transfer_json(request, [
			{'id': 'F9F0EBED913FA202', 'amount': '5555000000'},
			{'id': 'FBF0EBED913FA202', 'amount': '8888000000'},
		])

		# Act:
		results = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		self.assertEqual(1, len(results))
		assert_wrap_request_success(self, results[0], change_request_amount(request, 0))

	def test_can_extract_wrap_request_from_embedded_transfer_matching_custom_mosaic(self):
		# Arrange:
		request = self._create_simple_wrap_request(transaction_subindex=5)
		transaction_with_meta_json = self._create_embedded_transfer_json(request, [
			{'id': 'F9F0EBED913FA202', 'amount': '5555000000'},
			{'id': 'FBF0EBED913FA202', 'amount': '8888000000'},
		])

		# Act: extract transfers of a custom mosaic (not the currency mosaic)
		results = extract_wrap_request_from_transaction(
			Network.TESTNET,
			lambda _: True,
			lambda mosaic_id: 0xFBF0EBED913FA202 == mosaic_id,
			transaction_with_meta_json)

		# Assert:
		self.assertEqual(1, len(results))
		assert_wrap_request_success(self, results[0], change_request_amount(request, 8888000000))

	# endregion
