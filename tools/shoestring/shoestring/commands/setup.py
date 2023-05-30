import ipaddress
import socket
from pathlib import Path

from symbollightapi.connector.SymbolConnector import SymbolConnector
from zenlog import log

from shoestring.internal.ConfigurationManager import ConfigurationManager, load_patches_from_file
from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.NodewatchClient import NodewatchClient
from shoestring.internal.PackageResolver import download_and_extract_package
from shoestring.internal.PeerDownloader import download_peers
from shoestring.internal.PemUtils import read_public_key_from_public_key_pem_file
from shoestring.internal.Preparer import Preparer
from shoestring.internal.ShoestringConfiguration import parse_shoestring_configuration

SECURITY_MODES = ('default', 'paranoid', 'insecure')


def is_ip_address(hostname):
	try:
		ipaddress.ip_address(hostname)
		return True
	except ValueError:
		return False


def require_hostname(hostname):
	try:
		socket.getaddrinfo(hostname, 7890)
	except socket.gaierror as source_exception:
		raise RuntimeError(f'could not resolve address for host: {hostname}') from source_exception


async def run_main(args):  # pylint: disable=too-many-locals
	config = parse_shoestring_configuration(args.config)

	# detect the current finalized height
	nodewatch_client = NodewatchClient(config.services.nodewatch)
	last_finalized_height = await nodewatch_client.symbol_finalized_height()
	log.info(f'detected last finalized height as {last_finalized_height}')

	with Preparer(Path(args.directory), config, log) as preparer:
		# setup basic directories
		preparer.create_subdirectories()

		# download resource package(s) and peers file(s)
		api_endpoints = await download_peers(
			config.services.nodewatch,
			preparer.directories.resources,
			NodeFeatures.API in config.node.features)

		await download_and_extract_package(args.package, preparer.directories.temp)

		# prepare resources
		preparer.prepare_seed()
		preparer.prepare_resources()

		user_patches = {
			'node': [
				('localnode', 'host', 'read or ask 1'),
				('localnode', 'friendlyName', 'read or ask 2')
			]
		}
		if args.overrides:
			user_patches = load_patches_from_file(args.overrides)

		preparer.configure_resources(user_patches)
		preparer.configure_rest()

		if config.node.api_https and NodeFeatures.API not in config.node.features:
			raise RuntimeError('HTTPS selected but required feature (API) is not selected')

		enable_https = NodeFeatures.API in config.node.features and config.node.api_https
		hostname = ConfigurationManager(preparer.directories.resources).lookup('config-node.properties', [('localnode', 'host')])[0]

		if is_ip_address(hostname):
			if enable_https:
				raise RuntimeError(f'hostname {hostname} looks like IP address and not a hostname and `apiHttps` is set to true')
		else:
			require_hostname(hostname)

		preparer.configure_https()

		preparer.configure_docker({
			'catapult_client_image': config.images.client,
			'catapult_rest_image': config.images.rest,
			'user': f'{config.node.user_id}:{config.node.group_id}',
			'api_https': config.node.api_https,
			'domainname': hostname
		})

		# prepare keys and certificates
		preparer.configure_keys(last_finalized_height)
		preparer.generate_certificates(args.ca_key_path, config.node.ca_common_name, config.node.node_common_name, require_ca=False)

		# prepare transaction
		log.info(f'connecting to {api_endpoints[0]}')
		connector = SymbolConnector(api_endpoints[0])

		account_public_key = read_public_key_from_public_key_pem_file(preparer.directories.certificates / 'ca.pubkey.pem')
		existing_links = await connector.account_links(account_public_key)

		network_time = await connector.network_time()
		transaction = preparer.prepare_linking_transaction(account_public_key, existing_links, network_time.timestamp)

		log.info(transaction)

		transaction_filepath = preparer.directories.output_directory / 'linking_transaction.dat'
		with open(transaction_filepath, 'wb') as outfile:
			outfile.write(transaction.serialize())

		log.info(f'transaction file written to {transaction_filepath}')


def add_arguments(parser):
	parser.add_argument('--config', help='path to shoestring configuration file', required=True)
	parser.add_argument('--security', help='security mode (default: default)', choices=SECURITY_MODES, default='default')
	parser.add_argument(
		'--package',
		help='Network configuration package. Possible values: (name | file:///filename | http(s)://uri) (default: mainnet)',
		default='mainnet')
	parser.add_argument('--directory', help=f'installation directory (default: {Path.home()})', default=str(Path.home()))
	parser.add_argument('--ca-key-path', help='path to main private key PEM file', required=True)
	parser.add_argument('--overrides', help='path to custom user settings')
	parser.set_defaults(func=run_main)
