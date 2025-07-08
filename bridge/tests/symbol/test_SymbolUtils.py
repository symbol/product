import unittest
from binascii import hexlify

from symbolchain.CryptoTypes import Hash256
from symbolchain.sc import TransactionType, TransferTransactionV1
from symbolchain.symbol.Network import Address, Network

from bridge.models.WrapRequest import WrapError, WrapRequest
from bridge.symbol.SymbolUtils import extract_wrap_request_from_transaction

from ..test.BridgeTestUtils import (
	PUBLIC_KEYS,
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

	# region extract_wrap_request_from_transaction - aggregate (success)

	@staticmethod
	def _create_aggregate_transaction_with_meta_json(aggregate_transaction_type, embedded_transaction_with_meta_jsons):
		return {
			'meta': {'height': '23456', 'hash': 'C0B52BE17C2F41539E50857855A226A24AFE8B23B51E42F3186FBC725EA63550'},
			'transaction': {
				'type': aggregate_transaction_type.value,
				'signerPublicKey': '167F2FFDAFE27B6A8DCEFB4A12F0D8A2DB8908FC93D69B09A2E9237E55D7043E',
				'transactions': embedded_transaction_with_meta_jsons
			}
		}

	@staticmethod
	def _create_embedded_transaction_transfer_json(index, signer_public_key, amount, destination_address):
		return {
			'meta': {'index': index},
			'transaction': {
				'type': TransactionType.TRANSFER.value,
				'signerPublicKey': signer_public_key,
				'mosaics': [
					{'id': 'FAF0EBED913FA202', 'amount': str(amount)}
				],
				'message': hexlify(destination_address.encode('utf8')).decode('utf8')
			}
		}

	@staticmethod
	def _create_embedded_transaction_other_json(index, signer_public_key, transaction_type):
		return {
			'meta': {'index': index},
			'transaction': {
				'type': transaction_type.value,
				'signerPublicKey': signer_public_key,
			}
		}

	def _assert_can_extract_wrap_request_from_aggregate_with_single_transfer(self, aggregate_transaction_type):
		# Arrange:
		transaction_with_meta_json = self._create_aggregate_transaction_with_meta_json(aggregate_transaction_type, [
			self._create_embedded_transaction_transfer_json(2, PUBLIC_KEYS[0], 1111, '0x4838b106fce9647bdf1e7877bf73ce8b0bad5f90')
		])

		# Act:
		results = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		self.assertEqual(1, len(results))

		expected_request = WrapRequest(
			23456,
			Hash256('C0B52BE17C2F41539E50857855A226A24AFE8B23B51E42F3186FBC725EA63550'),
			2,
			Address('TARJLVFIRSSZF5ZCE64MX7TEAO2OVMGMHYOOF3Q'),
			1111,
			'0x4838b106fce9647bdf1e7877bf73ce8b0bad5f90')
		assert_wrap_request_success(self, results[0], expected_request)

	def test_can_extract_wrap_request_from_aggregate_complete_with_single_transfer(self):
		self._assert_can_extract_wrap_request_from_aggregate_with_single_transfer(TransactionType.AGGREGATE_COMPLETE)

	def test_can_extract_wrap_request_from_aggregate_bonded_with_single_transfer(self):
		self._assert_can_extract_wrap_request_from_aggregate_with_single_transfer(TransactionType.AGGREGATE_BONDED)

	def _assert_can_extract_wrap_request_from_aggregate_with_multiple_transfers(self, aggregate_transaction_type):
		# Arrange:
		destination_addresses = [f'0x4838b106fce9647bdf1e7877bf73ce8b0bad5f{digit}0' for digit in ['9', 'a', 'b']]
		transaction_with_meta_json = self._create_aggregate_transaction_with_meta_json(aggregate_transaction_type, [
			self._create_embedded_transaction_transfer_json(2, PUBLIC_KEYS[0], 1111, destination_addresses[0]),
			self._create_embedded_transaction_transfer_json(4, PUBLIC_KEYS[1], 3333, destination_addresses[1]),
			self._create_embedded_transaction_transfer_json(5, PUBLIC_KEYS[2], 2222, destination_addresses[2])
		])

		# Act:
		results = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		self.assertEqual(3, len(results))

		transaction_location = [23456, Hash256('C0B52BE17C2F41539E50857855A226A24AFE8B23B51E42F3186FBC725EA63550')]
		expected_requests = [
			WrapRequest(*transaction_location, 2, Address('TARJLVFIRSSZF5ZCE64MX7TEAO2OVMGMHYOOF3Q'), 1111, destination_addresses[0]),
			WrapRequest(*transaction_location, 4, Address('TDQXYDP5KBIFK4IXO3AHMSNMLLQC2SGFW2J4D7Q'), 3333, destination_addresses[1]),
			WrapRequest(*transaction_location, 5, Address('TDURH62YHSBIVN7KHX75GAIQVU5IPJUCDTR3SHI'), 2222, destination_addresses[2])
		]
		assert_wrap_request_success(self, results[0], expected_requests[0])
		assert_wrap_request_success(self, results[1], expected_requests[1])
		assert_wrap_request_success(self, results[2], expected_requests[2])

	def test_can_extract_wrap_request_from_aggregate_complete_with_multiple_transfers(self):
		self._assert_can_extract_wrap_request_from_aggregate_with_multiple_transfers(TransactionType.AGGREGATE_COMPLETE)

	def test_can_extract_wrap_request_from_aggregate_bonded_with_multiple_transfers(self):
		self._assert_can_extract_wrap_request_from_aggregate_with_multiple_transfers(TransactionType.AGGREGATE_BONDED)

	def _assert_can_extract_wrap_request_from_aggregate_with_mix_of_transfers_and_non_transfers(self, aggregate_transaction_type):
		# Arrange:
		def make_error_message(value):
			return f'transaction type {value} is not supported'

		destination_addresses = [f'0x4838b106fce9647bdf1e7877bf73ce8b0bad5f{digit}0' for digit in ['9', 'b']]
		transaction_with_meta_json = self._create_aggregate_transaction_with_meta_json(aggregate_transaction_type, [
			self._create_embedded_transaction_transfer_json(2, PUBLIC_KEYS[0], 1111, destination_addresses[0]),
			self._create_embedded_transaction_other_json(4, PUBLIC_KEYS[1], TransactionType.NAMESPACE_REGISTRATION),
			self._create_embedded_transaction_transfer_json(5, PUBLIC_KEYS[2], 2222, destination_addresses[1]),
			self._create_embedded_transaction_other_json(6, PUBLIC_KEYS[3], TransactionType.ADDRESS_ALIAS)
		])

		# Act:
		results = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		self.assertEqual(4, len(results))

		transaction_location = [23456, Hash256('C0B52BE17C2F41539E50857855A226A24AFE8B23B51E42F3186FBC725EA63550')]
		expected_requests = [
			WrapRequest(*transaction_location, 2, Address('TARJLVFIRSSZF5ZCE64MX7TEAO2OVMGMHYOOF3Q'), 1111, destination_addresses[0]),
			WrapRequest(*transaction_location, 5, Address('TDURH62YHSBIVN7KHX75GAIQVU5IPJUCDTR3SHI'), 2222, destination_addresses[1])
		]

		expected_errors = [
			WrapError(*transaction_location, 4, Address('TDQXYDP5KBIFK4IXO3AHMSNMLLQC2SGFW2J4D7Q'), make_error_message(16718)),
			WrapError(*transaction_location, 6, Address('TBJJWMLF4UVB36DBZW3QAPE3NCUYVUF5VUGL7MI'), make_error_message(16974))
		]

		assert_wrap_request_success(self, results[0], expected_requests[0])
		assert_wrap_request_failure(self, results[1], expected_errors[0])
		assert_wrap_request_success(self, results[2], expected_requests[1])
		assert_wrap_request_failure(self, results[3], expected_errors[1])

	def test_can_extract_wrap_request_from_aggregate_complete_with_mix_of_transfers_and_non_transfers(self):
		self._assert_can_extract_wrap_request_from_aggregate_with_mix_of_transfers_and_non_transfers(TransactionType.AGGREGATE_COMPLETE)

	def test_can_extract_wrap_request_from_aggregate_bonded_with_mix_of_transfers_and_non_transfers(self):
		self._assert_can_extract_wrap_request_from_aggregate_with_mix_of_transfers_and_non_transfers(TransactionType.AGGREGATE_BONDED)

	def _assert_can_extract_wrap_request_from_aggregate_with_no_transfers(self, aggregate_transaction_type):
		# Arrange:
		def make_error_message(value):
			return f'transaction type {value} is not supported'

		transaction_with_meta_json = self._create_aggregate_transaction_with_meta_json(aggregate_transaction_type, [
			self._create_embedded_transaction_other_json(4, PUBLIC_KEYS[1], TransactionType.NAMESPACE_REGISTRATION),
			self._create_embedded_transaction_other_json(6, PUBLIC_KEYS[3], TransactionType.ADDRESS_ALIAS)
		])

		# Act:
		results = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		self.assertEqual(2, len(results))

		transaction_location = [23456, Hash256('C0B52BE17C2F41539E50857855A226A24AFE8B23B51E42F3186FBC725EA63550')]
		expected_errors = [
			WrapError(*transaction_location, 4, Address('TDQXYDP5KBIFK4IXO3AHMSNMLLQC2SGFW2J4D7Q'), make_error_message(16718)),
			WrapError(*transaction_location, 6, Address('TBJJWMLF4UVB36DBZW3QAPE3NCUYVUF5VUGL7MI'), make_error_message(16974))
		]

		assert_wrap_request_failure(self, results[0], expected_errors[0])
		assert_wrap_request_failure(self, results[1], expected_errors[1])

	def test_can_extract_wrap_request_from_aggregate_complete_with_no_transfers(self):
		self._assert_can_extract_wrap_request_from_aggregate_with_no_transfers(TransactionType.AGGREGATE_COMPLETE)

	def test_can_extract_wrap_request_from_aggregate_bonded_with_no_transfers(self):
		self._assert_can_extract_wrap_request_from_aggregate_with_no_transfers(TransactionType.AGGREGATE_BONDED)

	# endregion
