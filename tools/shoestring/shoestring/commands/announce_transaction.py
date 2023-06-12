from symbolchain import sc
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbollightapi.connector.SymbolConnector import SymbolConnector
from zenlog import log

from shoestring.internal.NodeDownloader import detect_api_endpoints
from shoestring.internal.ShoestringConfiguration import parse_shoestring_configuration


async def run_main(args):
	config = parse_shoestring_configuration(args.config)

	api_endpoint = (await detect_api_endpoints(config.services.nodewatch, 1))[0]

	log.info(f'connecting to {api_endpoint}')
	connector = SymbolConnector(api_endpoint)

	with open(args.transaction, 'rb') as infile:
		transaction_bytes = infile.read()
		transaction = sc.TransactionFactory.deserialize(transaction_bytes)

	transaction_type = transaction.type_
	transaction_hash = SymbolFacade(config.network).hash_transaction(transaction)
	log.info(f'preparing to announce transaction {transaction_hash} of type {transaction_type}')

	announce_transaction = connector.announce_transaction
	if sc.TransactionType.AGGREGATE_BONDED == transaction_type:
		announce_transaction = connector.announce_partial_transaction

	await announce_transaction(transaction)
	log.info('transaction was successfully sent to the network')


def add_arguments(parser):
	parser.add_argument('--config', help='path to shoestring configuration file', required=True)
	parser.add_argument('--transaction', help='file containing serialized transaction to send', required=True)
	parser.set_defaults(func=run_main)
