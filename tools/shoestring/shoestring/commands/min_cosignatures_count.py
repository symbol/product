from pathlib import Path

from symbollightapi.connector.SymbolConnector import SymbolConnector
from zenlog import log

from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.MultisigAnalyzer import calculate_min_cosignatures_count
from shoestring.internal.NodeDownloader import NodeDownloader
from shoestring.internal.PemUtils import read_public_key_from_private_key_pem_file
from shoestring.internal.ShoestringConfiguration import parse_shoestring_configuration


async def _detect_api_endpoint(nodewatch_endpoint):
	downloader = NodeDownloader(nodewatch_endpoint)
	downloader.max_output_nodes = 1
	await downloader.download_peer_nodes()
	return downloader.select_api_endpoints()[0]


async def run_main(args):
	config = parse_shoestring_configuration(args.config)

	api_endpoint = await _detect_api_endpoint(config.services.nodewatch)

	log.info(f'connecting to {api_endpoint}')
	connector = SymbolConnector(api_endpoint)

	public_key = read_public_key_from_private_key_pem_file(args.ca_key_path)
	address = config.network.public_key_to_address(public_key)
	min_cosignatures_count = await calculate_min_cosignatures_count(connector, address)
	log.info(f'detected at least {min_cosignatures_count} cosignatures are required for transactions from {address}')

	if args.update:
		config_filepath = Path(args.config)
		ConfigurationManager(config_filepath.parent).patch(config_filepath.name, {
			('transaction', 'minCosignaturesCount', min_cosignatures_count)
		})


def add_arguments(parser):
	parser.add_argument('--config', help='path to shoestring configuration file', required=True)
	parser.add_argument('--ca-key-path', help='path to main private key PEM file', required=True)
	parser.add_argument('--update', help='update the shoestring configuration file', action='store_true')
	parser.set_defaults(func=run_main)
