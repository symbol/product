from symbolchain.CryptoTypes import Hash256

from ..models.WrapRequest import TransactionIdentifier, check_address_and_make_wrap_result, make_wrap_error_result
from .EthereumAdapters import EthereumAddress
from .RpcUtils import parse_rpc_response_hex_bytes


def extract_wrap_request_from_transaction(is_valid_address, target_search_address, transaction_with_meta_json):
	# pylint: disable=invalid-name
	"""Extracts a wrap request (or error) from a transaction."""

	ADDRESS_OFFSET = 16
	AMOUNT_OFFSET = ADDRESS_OFFSET + 20
	DESTINATION_ADDRESS_OFFSET = AMOUNT_OFFSET + 32

	transaction_json = transaction_with_meta_json['transaction']
	transaction_identifier = TransactionIdentifier(
		transaction_with_meta_json['meta']['height'],
		Hash256(parse_rpc_response_hex_bytes(transaction_json['hash'])),
		-1,
		EthereumAddress(transaction_json['from'])
	)

	input_data = parse_rpc_response_hex_bytes(transaction_json['input'])
	if len(input_data) < DESTINATION_ADDRESS_OFFSET:
		return make_wrap_error_result(transaction_identifier, 'unable to parse input data')

	recipient_address = input_data[ADDRESS_OFFSET:AMOUNT_OFFSET]
	if recipient_address != target_search_address.bytes:
		return None

	if DESTINATION_ADDRESS_OFFSET == len(input_data):
		return make_wrap_error_result(transaction_identifier, 'required message is missing')

	if not transaction_with_meta_json['meta']['isSuccess']:
		return make_wrap_error_result(transaction_identifier, 'ethereum transaction failed on ethereum blockchain')

	amount = int.from_bytes(input_data[AMOUNT_OFFSET:DESTINATION_ADDRESS_OFFSET], 'big')
	destination_address = input_data[DESTINATION_ADDRESS_OFFSET:]
	return check_address_and_make_wrap_result(is_valid_address, transaction_identifier, amount, destination_address)
