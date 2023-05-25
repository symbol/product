import os

from symbolchain.CryptoTypes import PrivateKey
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.sc import TransactionFactory, TransactionType
from symbolchain.symbol.KeyPair import KeyPair
from zenlog import log

from ..internal.OpensslExecutor import OpensslExecutor
from ..internal.PemUtils import read_private_key_from_private_key_pem_file
from ..internal.ShoestringConfiguration import parse_shoestring_configuration


def _load_private_key(key_path, password):
	if not password:
		return read_private_key_from_private_key_pem_file(key_path)

	# use OpensslExecutor instead of cryptography API to support all openssl password input formats automatically
	openssl_executor = OpensslExecutor(os.environ.get('OPENSSL_EXECUTABLE', 'openssl'))
	lines = openssl_executor.dispatch([
		'pkey',
		'-in', key_path,
		'-noout',
		'-text'
	] + ([] if not password else ['-passin', password]), show_output=False)

	is_private_key_line = False
	raw_private_key_str = ''
	for line in lines:
		if line.startswith('priv:'):
			is_private_key_line = True
		elif line.startswith('pub:'):
			break
		elif is_private_key_line:
			raw_private_key_str += line

	return PrivateKey(''.join([ch.upper() for ch in raw_private_key_str if '0' <= ch <= '9' or 'a' <= ch <= 'f']))


def run_main(args):
	with open(args.filename, 'rb') as infile:
		payload = infile.read()

	transaction = TransactionFactory.deserialize(payload)

	if transaction.type_ in [TransactionType.AGGREGATE_BONDED, TransactionType.AGGREGATE_COMPLETE]:
		temp = transaction.transactions
		transaction.transactions = []
		log.info(f'Aggregate transaction: {transaction}')
		log.info('Inner transactions:')
		for sub_transaction in temp:
			log.info(f'  {sub_transaction}')

		transaction.transactions = temp
	else:
		log.info(f'Transaction: {transaction}')

	# todo: query if it's ok to sign

	config = parse_shoestring_configuration(args.config)
	facade = SymbolFacade(config.network)

	key_pair = KeyPair(_load_private_key(args.ca_key_path, config.node.ca_password))

	signature = facade.sign_transaction(key_pair, transaction)
	facade.transaction_factory.attach_signature(transaction, signature)

	transaction_hash = facade.hash_transaction(transaction)
	print(f'transaction hash: {transaction_hash}')

	if args.save:
		with open(args.filename, 'wb') as outfile:
			outfile.write(transaction.serialize())

		log.info(f'Saved {args.filename}')


def add_arguments(parser):
	parser.add_argument('--config', help='path to shoestring configuration file', required=True)
	parser.add_argument('--ca-key-path', help='path to main private key PEM file', required=True)
	parser.add_argument('--save', action='store_true', help='save signed payload into same file as input')
	parser.add_argument('filename', help='transaction binary payload')
	parser.set_defaults(func=run_main)
