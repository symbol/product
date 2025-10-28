import unittest
from binascii import hexlify, unhexlify

from symbolchain.CryptoTypes import Hash256
from symbolchain.nem.Network import Address

from bridge.models.WrapRequest import (
	TransactionIdentifier,
	WrapError,
	WrapRequest,
	check_address_and_make_wrap_result,
	coerce_zero_balance_wrap_request_to_error,
	make_wrap_error_result,
	make_wrap_request_result
)

from ..test.BridgeTestUtils import assert_wrap_request_failure, assert_wrap_request_success


class WrapRequestTest(unittest.TestCase):
	VALID_ADDRESS = '4838b106fce9647bdf1e7877bf73ce8b0bad5f97'

	# region test utils

	@staticmethod
	def _create_test_transaction_identifier_arguments():
		return [
			7654,
			Hash256('C0B52BE17C2F41539E50857855A226A24AFE8B23B51E42F3186FBC725EA63550'),
			5,
			Address('TB7GF436SYPM4UQF2YYI563QIETUO5NZR6EREKPI')
		]

	# endregion

	# region make_wrap_request_result / make_wrap_error_result

	def test_can_make_wrap_request_result(self):
		# Arrange:
		transaction_identifier = TransactionIdentifier(*self._create_test_transaction_identifier_arguments())

		# Act:
		result = make_wrap_request_result(transaction_identifier, 8888_000000, self.VALID_ADDRESS)

		# Assert:
		expected_request = WrapRequest(*self._create_test_transaction_identifier_arguments(), 8888_000000, self.VALID_ADDRESS)
		assert_wrap_request_success(self, result, expected_request)

	def test_can_make_wrap_error_result(self):
		# Arrange:
		transaction_identifier = TransactionIdentifier(*self._create_test_transaction_identifier_arguments())

		# Act:
		result = make_wrap_error_result(transaction_identifier, 'this is an error message')

		# Assert:
		expected_error = WrapError(*self._create_test_transaction_identifier_arguments(), 'this is an error message')
		assert_wrap_request_failure(self, result, expected_error)

	# endregion

	# region coerce_zero_balance_wrap_request_to_error

	def test_coerce_zero_balance_wrap_request_to_error_does_not_change_nonzero_wrap_request(self):
		# Arrange:
		transaction_identifier = TransactionIdentifier(*self._create_test_transaction_identifier_arguments())
		result = coerce_zero_balance_wrap_request_to_error(make_wrap_request_result(transaction_identifier, 8888_000000, self.VALID_ADDRESS))

		# Assert:
		expected_request = WrapRequest(*self._create_test_transaction_identifier_arguments(), 8888_000000, self.VALID_ADDRESS)
		assert_wrap_request_success(self, result, expected_request)

	def test_coerce_zero_balance_wrap_request_to_error_does_not_change_error(self):
		# Arrange:
		transaction_identifier = TransactionIdentifier(*self._create_test_transaction_identifier_arguments())

		# Act:
		result = coerce_zero_balance_wrap_request_to_error(make_wrap_error_result(transaction_identifier, 'this is an error message'))

		# Assert:
		expected_error = WrapError(*self._create_test_transaction_identifier_arguments(), 'this is an error message')
		assert_wrap_request_failure(self, result, expected_error)

	def test_coerce_zero_balance_wrap_request_to_error_changes_zero_wrap_request_to_error(self):
		# Arrange:
		transaction_identifier = TransactionIdentifier(*self._create_test_transaction_identifier_arguments())
		result = coerce_zero_balance_wrap_request_to_error(make_wrap_request_result(transaction_identifier, 0, self.VALID_ADDRESS))

		# Assert:
		expected_error = WrapError(*self._create_test_transaction_identifier_arguments(), 'wrap request must have nonzero amount')
		assert_wrap_request_failure(self, result, expected_error)

	# endregion

	# region check_address_and_make_wrap_result

	@staticmethod
	def _check_address_and_make_wrap_result(transaction_identifier, amount, destination_address):
		def is_valid_address(address):
			if isinstance(address, bytes):
				address = hexlify(address).decode('utf8')

			is_valid = WrapRequestTest.VALID_ADDRESS == address
			return (is_valid, f'>{address}<' if is_valid else None)

		return check_address_and_make_wrap_result(is_valid_address, transaction_identifier, amount, destination_address)

	def _assert_can_check_address_and_make_wrap_result_when_address_is_valid(self, destination_address):
		# Arrange:
		transaction_identifier = TransactionIdentifier(*self._create_test_transaction_identifier_arguments())

		# Act:
		result = self._check_address_and_make_wrap_result(transaction_identifier, 4444, destination_address)

		# Assert:
		expected_request = WrapRequest(*self._create_test_transaction_identifier_arguments(), 4444, f'>{self.VALID_ADDRESS}<')
		assert_wrap_request_success(self, result, expected_request)

	def test_can_check_address_and_make_wrap_result_when_address_is_valid(self):
		self._assert_can_check_address_and_make_wrap_result_when_address_is_valid(self.VALID_ADDRESS)

	def test_can_check_address_and_make_wrap_result_when_address_is_valid_ignores_whitespace(self):
		self._assert_can_check_address_and_make_wrap_result_when_address_is_valid(f'\0\n\t {self.VALID_ADDRESS}\0\n\t ')

	def test_can_check_address_and_make_wrap_result_when_address_is_valid_bytes(self):
		self._assert_can_check_address_and_make_wrap_result_when_address_is_valid(unhexlify(self.VALID_ADDRESS))

	def _assert_can_check_address_and_make_wrap_result_when_address_is_invalid(
		self,
		destination_address,
		expected_formatted_destination_address  # pylint: disable=invalid-name
	):
		# Arrange:
		transaction_identifier = TransactionIdentifier(*self._create_test_transaction_identifier_arguments())

		# Act:
		result = self._check_address_and_make_wrap_result(transaction_identifier, 4444, destination_address)

		# Assert:
		expected_error = WrapError(
			*self._create_test_transaction_identifier_arguments(),
			f'destination address {expected_formatted_destination_address} is invalid')

		assert_wrap_request_failure(self, result, expected_error)

	def test_can_check_address_and_make_wrap_result_when_address_is_invalid(self):
		self._assert_can_check_address_and_make_wrap_result_when_address_is_invalid(
			self.VALID_ADDRESS[:-4],
			'4838b106fce9647bdf1e7877bf73ce8b0bad')

	def test_can_check_address_and_make_wrap_result_when_address_is_invalid_ignores_whitespace(self):
		self._assert_can_check_address_and_make_wrap_result_when_address_is_invalid(
			f'\0\n\t {self.VALID_ADDRESS[:-4]}\0\n\t ',
			'4838b106fce9647bdf1e7877bf73ce8b0bad')

	def test_can_check_address_and_make_wrap_result_when_address_is_invalid_bytes(self):
		self._assert_can_check_address_and_make_wrap_result_when_address_is_invalid(
			unhexlify(self.VALID_ADDRESS)[:-2],
			'4838B106FCE9647BDF1E7877BF73CE8B0BAD')

	# endregion
