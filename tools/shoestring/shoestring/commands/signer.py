from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.PrivateKeyStorage import PrivateKeyStorage
from symbolchain.sc import TransactionFactory, TransactionType
from symbolchain.symbol.KeyPair import KeyPair
from zenlog import log


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

	# Query if it's ok to sign

	# TODO: figure out network... (via nodewatch client?)
	facade = SymbolFacade('testnet')

	key_storage = PrivateKeyStorage('.')
	key_pair = KeyPair(key_storage.load(args.ca_key_path.removesuffix('.pem')))

	signature = facade.sign_transaction(key_pair, transaction)
	facade.transaction_factory.attach_signature(transaction, signature)

	transaction_hash = facade.hash_transaction(transaction)
	print(f'transaction hash: {transaction_hash}')

	if args.save:
		with open(args.filename, 'wb') as outfile:
			outfile.write(transaction.serialize())

		log.info(f'Saved {args.filename}')


def add_arguments(parser):
	parser.add_argument('--ca-key-path', help='path to main private key PEM file', required=True)
	parser.add_argument('filename', help='transaction binary payload')
	parser.add_argument('--save', action='store_true', help='save signed payload into same file as input')
	parser.set_defaults(func=run_main)
