from binascii import unhexlify

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nc import MessageType, TransactionType

from ..models.WrapRequest import TransactionIdentifier, check_address_and_make_wrap_result, make_wrap_error_result

# region calculate_transfer_transaction_fee


def calculate_transfer_transaction_fee(xem_amount, message=None):
	"""Calculates a transfer transaction fee given the amount of XEM (whole units) and message to send."""

	message_fee = 0 if not message else len(message) // 32 + 1
	transfer_fee = min(25, max(1, xem_amount // 10_000))
	return 50_000 * (message_fee + transfer_fee)

# endregion


# region extract_wrap_address_from_transaction

def _process_transfer_transaction(is_valid_address, transaction_identifier, transaction_json):
	amount = 0
	transaction_version = transaction_json['version'] & 0x00FFFFFF
	if 1 == transaction_version or 0 == len(transaction_json['mosaics']):
		amount = transaction_json['amount']
	else:
		# search for nem:xem; if not present, amount will be zero
		for mosaic_json in transaction_json['mosaics']:
			if 'nem' == mosaic_json['mosaicId']['namespaceId'] and 'xem' == mosaic_json['mosaicId']['name']:
				amount = transaction_json['amount'] * mosaic_json['quantity'] // 1_000000

	if 0 == len(transaction_json['message']):
		return make_wrap_error_result(transaction_identifier, 'required message is missing')

	if MessageType.PLAIN.value != transaction_json['message']['type']:
		error_message = f'message type {transaction_json["message"]["type"]} is not supported'
		return make_wrap_error_result(transaction_identifier, error_message)

	destination_address = unhexlify(transaction_json['message']['payload']).decode('utf8')
	return check_address_and_make_wrap_result(is_valid_address, transaction_identifier, amount, destination_address)


def extract_wrap_request_from_transaction(network, is_valid_address, transaction_with_meta_json):  # pylint: disable=invalid-name
	"""Extracts a wrap request (or error) from a transaction given a network."""

	transaction_json = transaction_with_meta_json['transaction']
	transaction_type = transaction_json['type']

	transaction_identifier = TransactionIdentifier(
		transaction_with_meta_json['meta']['height'],
		Hash256(transaction_with_meta_json['meta']['hash']['data']),
		-1,
		network.public_key_to_address(PublicKey(transaction_json['signer']))
	)

	if TransactionType.MULTISIG.value == transaction_type:
		transaction_identifier = TransactionIdentifier(
			transaction_identifier.transaction_height,
			transaction_identifier.transaction_hash,
			0,
			network.public_key_to_address(PublicKey(transaction_json['otherTrans']['signer']))
		)

		inner_transaction_type = transaction_json['otherTrans']['type']
		if TransactionType.TRANSFER.value == inner_transaction_type:
			return _process_transfer_transaction(is_valid_address, transaction_identifier, transaction_json['otherTrans'])

		error_message = f'inner transaction type {inner_transaction_type} is not supported'
		return make_wrap_error_result(transaction_identifier, error_message)

	if TransactionType.TRANSFER.value == transaction_type:
		return _process_transfer_transaction(is_valid_address, transaction_identifier, transaction_json)

	error_message = f'transaction type {transaction_type} is not supported'
	return make_wrap_error_result(transaction_identifier, error_message)

# endregion
