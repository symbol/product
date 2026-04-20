from pathlib import Path

from symbolchain import sc
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.symbol.KeyPair import KeyPair
from zenlog import log

from ..internal.PemUtils import read_private_key_from_private_key_pem_file
from ..internal.ShoestringConfiguration import parse_shoestring_configuration
from ..internal.TransactionSerializer import write_transaction_to_file


def _is_aggregate(transaction):
	return transaction.type_ in (sc.TransactionType.AGGREGATE_BONDED, sc.TransactionType.AGGREGATE_COMPLETE)


def _is_signed(transaction):
	return any(transaction.signature.bytes)


def _has_cosignature(transaction, public_key):
	return any(public_key.bytes == cosignature.signer_public_key.bytes for cosignature in transaction.cosignatures)


def _load_transaction(filename):
	with open(filename, 'rb') as infile:
		payload = infile.read()

	return sc.TransactionFactory.deserialize(payload)


def _print_transaction(transaction):
	if not _is_aggregate(transaction):
		log.info(_('signer-transaction').format(transaction=transaction))
		return

	child_transactions = transaction.transactions
	transaction.transactions = []

	log.info(_('signer-aggregate-transaction').format(transaction=transaction))
	log.info(_('signer-inner-transactions'))
	for child_transaction in child_transactions:
		log.info(f'  {child_transaction}')

	transaction.transactions = child_transactions


def _sign_transaction(facade, key_pair, transaction):
	signature = facade.sign_transaction(key_pair, transaction)
	facade.transaction_factory.attach_signature(transaction, signature)

	transaction_hash = facade.hash_transaction(transaction)

	log.info(_('signer-signed-transaction').format(transaction_type=transaction.type_, transaction_hash=transaction_hash))
	return transaction_hash


def _cosign_transaction(facade, key_pair, transaction):
	cosignature = facade.cosign_transaction(key_pair, transaction)
	transaction.cosignatures.append(cosignature)

	transaction_hash = facade.hash_transaction(transaction)
	log.info(_('signer-signed-transaction').format(transaction_type=transaction.type_, transaction_hash=transaction_hash))
	return transaction_hash


def run_main(args):
	config = parse_shoestring_configuration(args.config)
	facade = SymbolFacade(config.network)

	transaction = _load_transaction(args.filename)
	key_pair = KeyPair(read_private_key_from_private_key_pem_file(args.ca_key_path, config.node.ca_password))
	is_cosigning = False

	# For multisig payloads, the prebuilt aggregate can carry the multisig account public key as a placeholder.
	# The first real signer becomes the aggregate initiator / announcer and therefore replaces the outer signer.
	if _is_aggregate(transaction) and not _is_signed(transaction):
		transaction.signer_public_key = sc.PublicKey(key_pair.public_key.bytes)
	elif _is_aggregate(transaction):
		is_cosigning = key_pair.public_key.bytes != transaction.signer_public_key.bytes

		if is_cosigning and _has_cosignature(transaction, key_pair.public_key):
			log.info(_('signer-signed-transaction').format(
				transaction_type=transaction.type_,
				transaction_hash=facade.hash_transaction(transaction)))
			if args.save:
				write_transaction_to_file(transaction, Path(args.filename))
			return

	_print_transaction(transaction)

	transaction_hash = _cosign_transaction(facade, key_pair, transaction) if is_cosigning else _sign_transaction(facade, key_pair, transaction)

	if args.save:
		write_transaction_to_file(transaction, Path(args.filename))

	if is_cosigning or sc.TransactionType.AGGREGATE_BONDED != transaction.type_:
		return

	hash_lock_transaction = facade.transaction_factory.create({
		'type': 'hash_lock_transaction_v1',
		'signer_public_key': key_pair.public_key,

		'deadline': transaction.deadline,

		'mosaic': {
			'mosaic_id': config.transaction.currency_mosaic_id,
			'amount': config.transaction.locked_funds_per_aggregate
		},
		'duration': config.transaction.hash_lock_duration,
		'hash': transaction_hash
	})

	hash_lock_transaction.fee = sc.Amount(config.transaction.fee_multiplier * hash_lock_transaction.size)
	_sign_transaction(facade, key_pair, hash_lock_transaction)

	if args.save:
		write_transaction_to_file(hash_lock_transaction, Path(args.filename).with_suffix('.hash_lock.dat'))


def add_arguments(parser):
	parser.add_argument('--config', help=_('argument-help-config'), required=True)
	parser.add_argument('--ca-key-path', help=_('argument-help-ca-key-path'), required=True)
	parser.add_argument('--save', help=_('argument-help-signer-save'), action='store_true')
	parser.add_argument('filename', help=_('argument-help-signer-filename'))
	parser.set_defaults(func=run_main)
