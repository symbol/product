from binascii import unhexlify
from collections import namedtuple

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nc import MessageType, TransactionType
from web3 import Web3

TransactionIdentifier = namedtuple('TransactionIdentifier', ['transaction_height', 'transaction_hash', 'signer_public_key'])
WrapRequest = namedtuple('WrapRequest', ['transaction_identifier', 'amount', 'target_address_eth'])
WrapError = namedtuple('WrapError', ['transaction_identifier', 'message'])
WrapRequestResult = namedtuple('WrapRequestResult', ['is_error', 'request', 'error'])


# region calculate_transfer_transaction_fee

def calculate_transfer_transaction_fee(xem_amount, message=None):
	"""Calculates a transfer transaction fee given the amount of XEM (whole units) and message to send."""

	message_fee = 0 if not message else len(message) // 32 + 1
	transfer_fee = min(25, max(1, xem_amount // 10_000))
	return 50_000 * (message_fee + transfer_fee)

# endregion


# region extract_wrap_address_from_transaction

def _make_wrap_request_result(*args):
	return WrapRequestResult(False, WrapRequest(*args), None)


def _make_wrap_error_result(*args):
	return WrapRequestResult(True, None, WrapError(*args))


def _process_transfer_transaction(transaction_identifier, transaction_with_meta_json):
	transaction_json = transaction_with_meta_json['transaction']

	amount = 0
	if 1 == transaction_json['version'] or 0 == len(transaction_json['mosaics']):
		amount = transaction_json['amount']
	else:
		# search for nem:xem; if not present, amount will be zero
		for mosaic_json in transaction_json['mosaics']:
			if 'nem' == mosaic_json['mosaicId']['namespaceId'] and 'xem' == mosaic_json['mosaicId']['name']:
				amount = transaction_json['amount'] * mosaic_json['quantity'] // 1_000000

	if MessageType.PLAIN.value != transaction_json['message']['type']:
		error_message = f'message type {transaction_json["message"]["type"]} is not supported'
		return _make_wrap_error_result(transaction_identifier, error_message)

	target_address_eth = unhexlify(transaction_json['message']['payload']).decode('utf8')
	if not Web3.is_address(target_address_eth):
		error_message = f'target ethereum address {target_address_eth} is invalid'
		return _make_wrap_error_result(transaction_identifier, error_message)

	return _make_wrap_request_result(transaction_identifier, amount, target_address_eth)


def extract_wrap_request_from_transaction(transaction_with_meta_json):  # pylint: disable=invalid-name
	transaction_type = transaction_with_meta_json['transaction']['type']

	transaction_identifier = TransactionIdentifier(
		transaction_with_meta_json['meta']['height'],
		Hash256(transaction_with_meta_json['meta']['hash']['data']),
		PublicKey(transaction_with_meta_json['transaction']['signer'])
	)

	if TransactionType.MULTISIG.value == transaction_type:
		transaction_identifier = TransactionIdentifier(
			transaction_identifier.transaction_height,
			transaction_identifier.transaction_hash,
			PublicKey(transaction_with_meta_json['transaction']['otherTrans']['signer'])
		)

		inner_transaction_type = transaction_with_meta_json['transaction']['otherTrans']['type']
		if TransactionType.TRANSFER.value == inner_transaction_type:
			return _process_transfer_transaction(transaction_identifier, {
				'meta': transaction_with_meta_json['meta'],
				'transaction': transaction_with_meta_json['transaction']['otherTrans']
			})

		error_message = f'inner transaction type {inner_transaction_type} is not supported'
		return _make_wrap_error_result(transaction_identifier, error_message)

	if TransactionType.TRANSFER.value == transaction_type:
		return _process_transfer_transaction(transaction_identifier, transaction_with_meta_json)

	error_message = f'transaction type {transaction_type} is not supported'
	return _make_wrap_error_result(transaction_identifier, error_message)

# endregion
