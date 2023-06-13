from pathlib import Path

from symbollightapi.connector.SymbolConnector import SymbolConnector
from zenlog import log

from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.MultisigAnalyzer import calculate_min_cosignatures_count
from shoestring.internal.NodeDownloader import detect_api_endpoints
from shoestring.internal.PemUtils import read_public_key_from_private_key_pem_file
from shoestring.internal.ShoestringConfiguration import parse_shoestring_configuration


async def run_main(args):
	config = parse_shoestring_configuration(args.config)

	api_endpoint = (await detect_api_endpoints(config.services.nodewatch, 1))[0]

	log.info(_('general-connecting-to-node').format(endpoint=api_endpoint))
	connector = SymbolConnector(api_endpoint)

	public_key = read_public_key_from_private_key_pem_file(args.ca_key_path)
	address = config.network.public_key_to_address(public_key)
	min_cosignatures_count = await calculate_min_cosignatures_count(connector, address)
	log.info(_('min-cosignatures-count-cosignatures-detected').format(min_cosignatures_count=min_cosignatures_count, address=address))

	if args.update:
		config_filepath = Path(args.config)
		ConfigurationManager(config_filepath.parent).patch(config_filepath.name, {
			('transaction', 'minCosignaturesCount', min_cosignatures_count)
		})


def add_arguments(parser):
	parser.add_argument('--config', help=_('argument-help-config'), required=True)
	parser.add_argument('--ca-key-path', help=_('argument-help-ca-key-path'), required=True)
	parser.add_argument('--update', help=_('argument-help-min-cosignatures-count-update'), action='store_true')
	parser.set_defaults(func=run_main)
