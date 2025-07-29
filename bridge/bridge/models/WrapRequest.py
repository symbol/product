from collections import namedtuple

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


# region coerce_zero_balance_wrap_request_to_error

def coerce_zero_balance_wrap_request_to_error(result):  # pylint: disable=invalid-name
	"""Coerces a zero balance wrap request into an error."""

	if not result.is_error and 0 == result.request.amount:
		return make_wrap_error_result(result.request, 'wrap request must have nonzero amount')

	return result

# endregion


# region check_address_and_make_wrap_result

def check_address_and_make_wrap_result(is_valid_address, transaction_identifier, amount, destination_address):
	"""Checks the destination address and returns an appropriate wrap request result based on its validity."""

	destination_address = destination_address.strip('\0\n\t ')
	if not is_valid_address(destination_address):
		error_message = f'destination address {destination_address} is invalid'
		return make_wrap_error_result(transaction_identifier, error_message)

	return make_wrap_request_result(transaction_identifier, amount, destination_address)

# endregion
