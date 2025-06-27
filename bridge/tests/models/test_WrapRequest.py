import unittest

from symbolchain.CryptoTypes import Hash256
from symbolchain.nem.Network import Address

from bridge.models.WrapRequest import (
	TransactionIdentifier,
	WrapError,
	WrapRequest,
	check_ethereum_address_and_make_wrap_result,
	make_wrap_error_result,
	make_wrap_request_result
)

from ..test.BridgeTestUtils import assert_wrap_request_failure, assert_wrap_request_success


class WrapRequestTest(unittest.TestCase):
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
		result = make_wrap_request_result(transaction_identifier, 8888_000000, '0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97')

		# Assert:
		expected_request = WrapRequest(
			*self._create_test_transaction_identifier_arguments(),
			8888_000000,
			'0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97')
		assert_wrap_request_success(self, result, expected_request)

	def test_can_make_wrap_error_result(self):
		# Arrange:
		transaction_identifier = TransactionIdentifier(*self._create_test_transaction_identifier_arguments())

		# Act:
		result = make_wrap_error_result(transaction_identifier, 'this is an error message')

		# Assert:
		expected_error = WrapError(
			*self._create_test_transaction_identifier_arguments(),
			'this is an error message')
		assert_wrap_request_failure(self, result, expected_error)

	# endregion

	# region check_ethereum_address_and_make_wrap_result

	def test_can_check_ethereum_address_and_make_wrap_result_when_address_is_valid(self):
		# Arrange:
		transaction_identifier = TransactionIdentifier(*self._create_test_transaction_identifier_arguments())

		# Act:
		result = check_ethereum_address_and_make_wrap_result(transaction_identifier, 4444, '0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97')

		# Assert:
		expected_request = WrapRequest(
			*self._create_test_transaction_identifier_arguments(),
			4444,
			'0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97')
		assert_wrap_request_success(self, result, expected_request)

	def test_can_check_ethereum_address_and_make_wrap_result_when_address_is_invalid(self):
		# Arrange:
		transaction_identifier = TransactionIdentifier(*self._create_test_transaction_identifier_arguments())

		# Act:
		result = check_ethereum_address_and_make_wrap_result(transaction_identifier, 4444, '0x4838b106fce9647bdf1e7877bf73ce8b0bad')

		# Assert:
		expected_error = WrapError(
			*self._create_test_transaction_identifier_arguments(),
			'destination ethereum address 0x4838b106fce9647bdf1e7877bf73ce8b0bad is invalid')
		assert_wrap_request_failure(self, result, expected_error)

	# endregion
