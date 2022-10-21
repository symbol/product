from pathlib import Path

from symbollightapi.connector.SymbolConnector import SymbolConnector
from zenlog import log

from shoestring.internal.ConfigurationManager import load_patches_from_file
from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.NodewatchClient import NodewatchClient
from shoestring.internal.PackageResolver import download_and_extract_package
from shoestring.internal.PeerDownloader import download_peers
from shoestring.internal.PemUtils import read_public_key_from_public_key_pem_file
from shoestring.internal.Preparer import Preparer

SECURITY_MODES = ('default', 'paranoid', 'insecure')


async def run_main(args):
	# detect the current finalized height
	nodewatch_client = NodewatchClient(args.nodewatch)
	last_finalized_height = await nodewatch_client.symbol_finalized_height()
	log.info(f'detected last finalized height as {last_finalized_height}')

	node_features = NodeFeatures(int(args.features))
	with Preparer(Path(args.directory), node_features, log) as preparer:
		# setup basic directories
		preparer.create_subdirectories()

		# download resource package(s) and peers file(s)
		await download_peers(args.nodewatch, preparer.directories.resources, NodeFeatures.API in node_features)

		await download_and_extract_package(args.package, preparer.directories.temp)

		# prepare resources
		preparer.prepare_resources()
		preparer.prepare_seed()

		user_patches = {
			'node': [
				('localnode', 'host', 'read or ask 1'),
				('localnode', 'friendlyName', 'read or ask 2')
			]
		}
		if args.overrides:
			user_patches = load_patches_from_file(args.overrides)

		preparer.configure_resources(user_patches)
		preparer.configure_mongo()  # TODO: should this be merged with configure_docker

		# os.getuid() could be used, but that might not be the best idea,
		# would be best to have it in user settings alnog with the ones above
		user_entry = '1000:1000'
		preparer.configure_docker(user_entry)

		# TODO: WIP - currently:
		#  * ca priv key is passed via --ca-key-path
		#  * client is hardcoded and sai network is used - preparer downloaded peers for proper network,
		#    so should we just pick node from there?
		# * when testing, it seems produced transaction hash is not valid? (wrong network?)
		#   although signer, using 'testnet' produces valid one
		#
		# * we're missing https in docker

		# prepare keys
		preparer.configure_keys(last_finalized_height)
		preparer.generate_certificates(
			args.ca_key_path,
			'CA CN: flag or generate 1',
			'NODE CN: flag or generate 2',
			require_ca=False)

		client = SymbolConnector('http://401-sai-dual.symboltest.net:3000')

		account_public_key = read_public_key_from_public_key_pem_file(preparer.directories.certificates / 'ca.pubkey.pem')
		existing_links = await client.account_links(account_public_key)

		network_time = await client.network_time()
		transaction = preparer.prepare_linking_transaction(account_public_key, existing_links, network_time.timestamp)

		log.info(transaction)

		# TODO: should this be moved?
		transaction_filepath = preparer.directories.output_directory / 'linking_transaction.dat'
		with open(transaction_filepath, 'wb') as outfile:
			outfile.write(transaction.serialize())

		log.info(f'transaction file written to {transaction_filepath}')


def add_arguments(parser):
	parser.add_argument('--security', help='security mode (default: default)', choices=SECURITY_MODES, default='default')
	parser.add_argument(
		'--package',
		help='Network configuration package. Possible values: (name | file:///filename | http(s)://uri) (default: mainnet)',
		default='mainnet')
	parser.add_argument(
		'--nodewatch',
		help='either nodewatch URI or location of file with peer files (file:///filename)',
		default='http://forkwatch.symbol.tools')
	parser.add_argument(
		'--features',
		help='desired node features',
		default=(NodeFeatures.API | NodeFeatures.HARVESTER | NodeFeatures.VOTER))
	parser.add_argument('--directory', help=f'destination directory (default: {Path.home()})', default=str(Path.home()))
	parser.add_argument('--ca-key-path', help='path to main private key PEM file', required=True)
	parser.add_argument('--overrides', help='path to custom user settings')
	parser.set_defaults(func=run_main)
