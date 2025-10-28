from binascii import unhexlify
from collections import namedtuple

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.sc import TransactionType

from ..models.WrapRequest import TransactionIdentifier, check_address_and_make_wrap_result, make_wrap_error_result

Predicates = namedtuple('Predicates', ['is_valid_address', 'is_matching_mosaic_id'])


# region extract_wrap_address_from_transaction


def _process_transfer_transaction(predicates, transaction_identifier, transaction_json):
	amount = 0
	for mosaic_json in transaction_json['mosaics']:
		if predicates.is_matching_mosaic_id(int(mosaic_json['id'], 16)):
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


def extract_wrap_request_from_transaction(network, is_valid_address, is_matching_mosaic_id, transaction_with_meta_json):
	# pylint: disable=invalid-name
	"""Extracts a wrap request (or error) from a transaction given a network."""

	predicates = Predicates(is_valid_address, is_matching_mosaic_id)

	transaction_json = transaction_with_meta_json['transaction']
	meta_json = transaction_with_meta_json['meta']

	if 'hash' in meta_json:
		transaction_hash = Hash256(meta_json['hash'])
		transaction_subindex = -1
	else:
		transaction_hash = Hash256(meta_json['aggregateHash'])
		transaction_subindex = int(meta_json['index'])

	transaction_identifier = TransactionIdentifier(
		int(transaction_with_meta_json['meta']['height']),
		transaction_hash,
		transaction_subindex,
		network.public_key_to_address(PublicKey(transaction_json['signerPublicKey'])),
	)

	return [_process_transaction(predicates, transaction_identifier, transaction_json)]
