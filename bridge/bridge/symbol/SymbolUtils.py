from binascii import unhexlify
from collections import namedtuple

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.sc import TransactionType

from ..models.WrapRequest import TransactionIdentifier, check_address_and_make_wrap_result, make_wrap_error_result

Predicates = namedtuple('Predicates', ['is_valid_address', 'is_currency_mosaic_id'])


# region extract_wrap_address_from_transaction


def _process_transfer_transaction(predicates, transaction_identifier, transaction_json):
	amount = 0
	for mosaic_json in transaction_json['mosaics']:
		if predicates.is_currency_mosaic_id(int(mosaic_json['id'], 16)):
			amount = int(mosaic_json['amount'])

	if 'message' not in transaction_json:
		return make_wrap_error_result(transaction_identifier, 'required message is missing')

	destination_address = unhexlify(transaction_json['message']).decode('utf8')
	return check_address_and_make_wrap_result(predicates.is_valid_address, transaction_identifier, amount, destination_address)


def _process_transaction(predicates, transaction_identifier, transaction_json):
	transaction_type = transaction_json['type']
	if TransactionType.TRANSFER.value == transaction_type:
		return _process_transfer_transaction(predicates, transaction_identifier, transaction_json)

	error_message = f'transaction type {transaction_type} is not supported'
	return make_wrap_error_result(transaction_identifier, error_message)


def extract_wrap_request_from_transaction(network, is_valid_address, is_currency_mosaic_id, transaction_with_meta_json):
	# pylint: disable=invalid-name
	"""Extracts a wrap request (or error) from a transaction given a network."""

	predicates = Predicates(is_valid_address, is_currency_mosaic_id)

	transaction_json = transaction_with_meta_json['transaction']
	transaction_type = transaction_json['type']

	transaction_identifier = TransactionIdentifier(
		int(transaction_with_meta_json['meta']['height']),
		Hash256(transaction_with_meta_json['meta']['hash']),
		-1,
		network.public_key_to_address(PublicKey(transaction_json['signerPublicKey'])),
	)

	if transaction_type in (TransactionType.AGGREGATE_COMPLETE.value, TransactionType.AGGREGATE_BONDED.value):
		embedded_results = []
		for embedded_transaction_with_meta_json in transaction_json['transactions']:
			embedded_transaction_json = embedded_transaction_with_meta_json['transaction']

			transaction_identifier = TransactionIdentifier(
				transaction_identifier.transaction_height,
				transaction_identifier.transaction_hash,
				embedded_transaction_with_meta_json['meta']['index'],
				network.public_key_to_address(PublicKey(embedded_transaction_json['signerPublicKey']))
			)

			embedded_results.append(_process_transaction(predicates, transaction_identifier, embedded_transaction_json))

		return embedded_results

	return [_process_transaction(predicates, transaction_identifier, transaction_json)]
