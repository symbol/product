import unittest
from binascii import hexlify, unhexlify

from symbolchain.CryptoTypes import Hash256

from bridge.ethereum.EthereumAdapters import EthereumAddress
from bridge.ethereum.EthereumUtils import extract_wrap_request_from_transaction
from bridge.models.WrapRequest import WrapRequest

from ..test.BridgeTestUtils import (
	assert_wrap_request_failure,
	assert_wrap_request_success,
	change_request_destination_address,
	make_wrap_error_from_request
)

TARGET_SEARCH_ADDRESS = '00d6dcee7c21a8c7ab697602367992fc1b75f9ba'


class EthereumUtilsTest(unittest.TestCase):
	# region extract_wrap_request_from_transaction - transfer (success)

	@staticmethod
	def _extract_wrap_request_from_transaction(transaction_with_meta_json):
		def is_valid_address(address):
			return (
				unhexlify('983678467BDE6B234D8DDE673914A407AAB7287F244835DF') == address,
				hexlify(address).decode('utf8').upper()
			)

		return extract_wrap_request_from_transaction(
			is_valid_address,
			EthereumAddress(f'0x{TARGET_SEARCH_ADDRESS}'),
			transaction_with_meta_json)

	@staticmethod
	def _create_simple_wrap_request():
		return WrapRequest(
			1234,
			Hash256('C0B52BE17C2F41539E50857855A226A24AFE8B23B51E42F3186FBC725EA63550'),
			-1,
			EthereumAddress('0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97'),
			9999_000000,
			'983678467BDE6B234D8DDE673914A407AAB7287F244835DF')

	@staticmethod
	def _create_transfer_json(request, **kwargs):
		input_data = ''.join([
			'0x',
			'a9059cbb000000000000000000000000',
			kwargs.get('recipient_address', TARGET_SEARCH_ADDRESS),
			hexlify(request.amount.to_bytes(32, 'big')).decode('utf8'),
			request.destination_address
		])

		transaction_with_meta_json = {
			'meta': {
				'height': request.transaction_height,
				'isSuccess': True
			},
			'transaction': {
				'from': str(request.sender_address),
				'hash': f'0x{request.transaction_hash}',
				'input': input_data
			}
		}

		return transaction_with_meta_json

	def test_can_extract_wrap_request_from_simple_transfer(self):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_with_meta_json = self._create_transfer_json(request)

		# Act:
		result = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		assert_wrap_request_success(self, result, request)

	# endregion

	# region extract_wrap_request_from_transaction - transfer (neutral)

	def test_cannot_extract_wrap_request_from_simple_transfer_with_mismatched_recipient_address(self):
		# Arrange: create a transaction with a different receipient
		request = self._create_simple_wrap_request()
		transaction_with_meta_json = self._create_transfer_json(request, recipient_address='0ff070994dd3fdB1441433c219A42286ef85290f')

		# Act:
		result = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		self.assertIsNone(result)

	def test_cannot_extract_wrap_request_from_simple_transfer_with_mismatched_recipient_address_without_message(self):
		# Arrange: create a transaction with a different receipient and without a message
		request = self._create_simple_wrap_request()
		transaction_with_meta_json = self._create_transfer_json(request, recipient_address='0ff070994dd3fdB1441433c219A42286ef85290f')
		transaction_with_meta_json['transaction']['input'] = transaction_with_meta_json['transaction']['input'][:69 * 2]

		# Act:
		result = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		self.assertIsNone(result)

	# endregion

	# region extract_wrap_request_from_transaction - transfer (failure)

	def _assert_cannot_extract_wrap_request_from_simple_transfer(self, expected_error_message, **kwargs):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_with_meta_json = self._create_transfer_json(request, **kwargs)

		input_data_limit = kwargs.get('input_data_limit', None)
		if input_data_limit is not None:
			input_data_char_limit = (1 + input_data_limit) * 2
			transaction_with_meta_json['transaction']['input'] = transaction_with_meta_json['transaction']['input'][:input_data_char_limit]

		# Act:
		result = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		assert_wrap_request_failure(self, result, make_wrap_error_from_request(request, expected_error_message))

	def test_cannot_extract_wrap_request_from_simple_transfer_without_input_data(self):
		self._assert_cannot_extract_wrap_request_from_simple_transfer(
			'unable to parse input data',
			input_data_limit=0)

	def test_cannot_extract_wrap_request_from_simple_transfer_with_input_data_too_small(self):
		self._assert_cannot_extract_wrap_request_from_simple_transfer(
			'unable to parse input data',
			input_data_limit=67)

	def test_cannot_extract_wrap_request_from_simple_transfer_without_message(self):
		self._assert_cannot_extract_wrap_request_from_simple_transfer(
			'required message is missing',
			input_data_limit=68)

	def test_cannot_extract_wrap_request_from_transfer_with_invalid_message(self):
		# Arrange:
		request = self._create_simple_wrap_request()
		request = change_request_destination_address(request, '983678467BDE6B234D8DDE673914A407AAB7287F244835')  # too short
		transaction_with_meta_json = self._create_transfer_json(request)

		# Act:
		result = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		expected_error_message = 'destination address 983678467BDE6B234D8DDE673914A407AAB7287F244835 is invalid'
		assert_wrap_request_failure(self, result, make_wrap_error_from_request(request, expected_error_message))

	def test_cannot_extract_wrap_request_from_transfer_with_failed_ethereum_transaction(self):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_with_meta_json = self._create_transfer_json(request)
		transaction_with_meta_json['meta']['isSuccess'] = False

		# Act:
		result = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		expected_error_message = 'ethereum transaction failed on ethereum blockchain'
		assert_wrap_request_failure(self, result, make_wrap_error_from_request(request, expected_error_message))

	# endregion
