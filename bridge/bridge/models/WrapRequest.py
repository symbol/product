from collections import namedtuple

from web3 import Web3

_TRANSACTION_IDENTIFIER_PROPERTY_NAMES = ['transaction_height', 'transaction_hash', 'transaction_subindex', 'sender_address']

TransactionIdentifier = namedtuple('TransactionIdentifier', _TRANSACTION_IDENTIFIER_PROPERTY_NAMES)
WrapRequest = namedtuple('WrapRequest', _TRANSACTION_IDENTIFIER_PROPERTY_NAMES + ['amount', 'destination_address'])
WrapError = namedtuple('WrapError', _TRANSACTION_IDENTIFIER_PROPERTY_NAMES + ['message'])
WrapRequestResult = namedtuple('WrapRequestResult', ['is_error', 'request', 'error'])


# region make_wrap_request_result / make_wrap_error_result

def make_wrap_request_result(transaction_identifier, *args):
	""""Makes a wrap request result from a transaction identifier and (success) wrap request arguments."""

	request = WrapRequest(
		transaction_identifier.transaction_height,
		transaction_identifier.transaction_hash,
		transaction_identifier.transaction_subindex,
		transaction_identifier.sender_address,
		*args)
	return WrapRequestResult(False, request, None)


def make_wrap_error_result(transaction_identifier, *args):
	""""Makes a wrap request result from a transaction identifier and wrap error arguments."""

	error = WrapError(
		transaction_identifier.transaction_height,
		transaction_identifier.transaction_hash,
		transaction_identifier.transaction_subindex,
		transaction_identifier.sender_address,
		*args)
	return WrapRequestResult(True, None, error)

# endregion


# region check_ethereum_address_and_make_wrap_result

def check_ethereum_address_and_make_wrap_result(transaction_identifier, amount, destination_address):  # pylint: disable=invalid-name
	"""Checks the ethereum destination address and returns an appropriate wrap request result based on its validity."""

	if not Web3.is_address(destination_address):
		error_message = f'destination ethereum address {destination_address} is invalid'
		return make_wrap_error_result(transaction_identifier, error_message)

	return make_wrap_request_result(transaction_identifier, amount, destination_address)

# endregion
