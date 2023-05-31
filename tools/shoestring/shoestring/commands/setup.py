import ipaddress
import socket
from pathlib import Path

from symbollightapi.connector.SymbolConnector import SymbolConnector
from zenlog import log

from shoestring.internal.ConfigurationManager import ConfigurationManager, load_patches_from_file
from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.NodewatchClient import get_current_finalization_epoch
from shoestring.internal.PackageResolver import download_and_extract_package
from shoestring.internal.PeerDownloader import download_peers
from shoestring.internal.PemUtils import read_public_key_from_public_key_pem_file
from shoestring.internal.Preparer import Preparer
from shoestring.internal.ShoestringConfiguration import parse_shoestring_configuration

SECURITY_MODES = ('default', 'paranoid', 'insecure')


def _resolve_hostname_and_configure_https(config, preparer):
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
	return hostname


async def _prepare_keys_and_certificates(config, preparer, ca_key_path):
	# detect the current finalization epoch
	current_finalization_epoch = await get_current_finalization_epoch(config.services.nodewatch, preparer.config_manager)

	# prepare keys and certificates
	preparer.configure_keys(current_finalization_epoch)
	preparer.generate_certificates(ca_key_path, config.node.ca_common_name, config.node.node_common_name, require_ca=False)


async def _prepare_linking_transaction(preparer, api_endpoint):
	log.info(f'connecting to {api_endpoint}')
	connector = SymbolConnector(api_endpoint)

	account_public_key = read_public_key_from_public_key_pem_file(preparer.directories.certificates / 'ca.pubkey.pem')
	existing_links = await connector.account_links(account_public_key)

	network_time = await connector.network_time()
	transaction = preparer.prepare_linking_transaction(account_public_key, existing_links, network_time.timestamp)

	log.info(transaction)

	transaction_filepath = preparer.directories.output_directory / 'linking_transaction.dat'
	with open(transaction_filepath, 'wb') as outfile:
		outfile.write(transaction.serialize())

	transaction_filepath.chmod(0o400)
	log.info(f'transaction file written to {transaction_filepath}')


async def run_main(args):
	config = parse_shoestring_configuration(args.config)

	with Preparer(Path(args.directory), config, log) as preparer:
		is_initial_setup = not preparer.directories.resources.exists()

		if is_initial_setup:
			# setup basic directories
			preparer.create_subdirectories()

		# download resource package(s) and peers file(s)
		api_endpoints = await download_peers(
			config.services.nodewatch,
			preparer.directories.resources,
			NodeFeatures.API in config.node.features)
		await download_and_extract_package(args.package, preparer.directories.temp)

		# prepare nemesis data and resources
		if is_initial_setup:
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

		hostname = _resolve_hostname_and_configure_https(config, preparer)

		preparer.configure_docker({
			'catapult_client_image': config.images.client,
			'catapult_rest_image': config.images.rest,
			'user': f'{config.node.user_id}:{config.node.group_id}',
			'api_https': config.node.api_https,
			'domainname': hostname
		})

		if is_initial_setup:
			# prepare keys and certificates
			await _prepare_keys_and_certificates(config, preparer, args.ca_key_path)

			# generate transaction
			await _prepare_linking_transaction(preparer, api_endpoints[0])


def add_arguments(parser, is_initial_setup=True):
	parser.add_argument('--config', help='path to shoestring configuration file', required=True)
	parser.add_argument(
		'--package',
		help='Network configuration package. Possible values: (name | file:///filename | http(s)://uri) (default: mainnet)',
		default='mainnet')
	parser.add_argument('--directory', help=f'installation directory (default: {Path.home()})', default=str(Path.home()))
	parser.add_argument('--overrides', help='path to custom user settings')

	if is_initial_setup:
		parser.add_argument('--security', help='security mode (default: default)', choices=SECURITY_MODES, default='default')
		parser.add_argument('--ca-key-path', help='path to main private key PEM file', required=True)

		parser.set_defaults(func=run_main)
