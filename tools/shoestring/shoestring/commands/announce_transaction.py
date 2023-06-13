from symbolchain import sc
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbollightapi.connector.SymbolConnector import SymbolConnector
from zenlog import log

from shoestring.internal.NodeDownloader import detect_api_endpoints
from shoestring.internal.ShoestringConfiguration import parse_shoestring_configuration


async def run_main(args):
	config = parse_shoestring_configuration(args.config)

	api_endpoint = (await detect_api_endpoints(config.services.nodewatch, 1))[0]

	log.info(_('general-connecting-to-node').format(endpoint=api_endpoint))
	connector = SymbolConnector(api_endpoint)

	with open(args.transaction, 'rb') as infile:
		transaction_bytes = infile.read()
		transaction = sc.TransactionFactory.deserialize(transaction_bytes)

	transaction_type = transaction.type_
	transaction_hash = SymbolFacade(config.network).hash_transaction(transaction)
	log.info(_('announce-transaction-preparing-to-announce').format(transaction_hash=transaction_hash, transaction_type=transaction_type))

	announce_transaction = connector.announce_transaction
	if sc.TransactionType.AGGREGATE_BONDED == transaction_type:
		announce_transaction = connector.announce_partial_transaction

	await announce_transaction(transaction)
	log.info(_('announce-transaction-announce-successful'))


def add_arguments(parser):
	parser.add_argument('--config', help=_('argument-help-config'), required=True)
	parser.add_argument('--transaction', help=_('argument-help-announce-transaction-transaction'), required=True)
	parser.set_defaults(func=run_main)
