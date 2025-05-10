import os
import tempfile
from collections import namedtuple
from pathlib import Path

from shoestring.internal.ConfigurationManager import load_shoestring_patches_from_file
from shoestring.internal.OpensslExecutor import OpensslExecutor
from shoestring.wizard.shoestring_dispatcher import dispatch_shoestring_command
from shoestring.wizard.ShoestringOperation import ShoestringOperation

from ..test.TestPackager import prepare_testnet_package

CertificatesScreen = namedtuple('CertificatesScreen', ['ca_common_name', 'node_common_name'])
NodeSettingsScreen = namedtuple('NodeSettingsScreen', ['domain_name', 'friendly_name', 'api_https', 'metadata_info'])
ObligatoryScreen = namedtuple('ObligatoryScreen', ['destination_directory', 'ca_pem_path'])
SingleValueScreen = namedtuple('SingleValueScreen', ['current_value'])
ToggleScreen = namedtuple('ToggleScreen', ['active'])
WelcomeScreen = namedtuple('WelcomeScreen', ['operation'])
BootstrapSettingsScreen = namedtuple('BootstrapSettingsScreen', ['active', 'include_node_key', 'path'])


def _create_executor(dispatched_args):
	async def executor(args):
		dispatched_args.extend(args)

	return executor


def _strip_folder(path):
	return Path(path).name


def _create_setup_screens(
	package_directory,
	output_directory,
	node_type,
	node_metadata,
	bootstrap_enabled=False,
	include_node_key=True,
	path=''
):  # pylint: disable=too-many-arguments,too-many-positional-arguments
	return {
		'obligatory': ObligatoryScreen(output_directory, Path(package_directory) / 'ca.pem'),
		'node-settings': NodeSettingsScreen('symbol.fyi', 'node explorer', False, node_metadata),
		'network-type': SingleValueScreen(f'file://{Path(package_directory) / "resources.zip"}'),
		'node-type': SingleValueScreen(node_type),
		'harvesting': ToggleScreen(False),
		'voting': ToggleScreen(False),
		'certificates': CertificatesScreen('ca', 'peer'),
		'welcome': WelcomeScreen(ShoestringOperation.SETUP),
		'bootstrap': BootstrapSettingsScreen(bootstrap_enabled, include_node_key, path)
	}


# pylint: disable=invalid-name


async def test_can_dispatch_setup_command():
	# Arrange:
	dispatched_args = []
	with tempfile.TemporaryDirectory() as package_directory:
		prepare_testnet_package(package_directory, 'resources.zip')

		with tempfile.TemporaryDirectory() as output_directory:
			# Act:
			await dispatch_shoestring_command(
				_create_setup_screens(package_directory, output_directory, 'peer', None, False),
				_create_executor(dispatched_args))

			# Assert:
			for i in (2, 8):
				dispatched_args[i] = _strip_folder(dispatched_args[i])  # strip temporary folder used during setup

			assert [
				'setup',
				'--config', 'shoestring.ini',
				'--directory', output_directory,
				'--ca-key-path', str(Path(package_directory) / 'ca.pem'),
				'--overrides', 'overrides.ini',
				'--package', f'file://{Path(package_directory) / "resources.zip"}',
				'--security', 'insecure'
			] == dispatched_args

			# - shoestring configuration files were created
			shoestring_directory = Path(output_directory) / 'shoestring'
			assert shoestring_directory.exists()
			assert (shoestring_directory / 'shoestring.ini').exists()
			assert (shoestring_directory / 'overrides.ini').exists()
			assert not (shoestring_directory / 'rest_overrides.json').exists()


async def test_can_dispatch_setup_command_with_custom_rest_overrides():
	# Arrange:
	dispatched_args = []
	with tempfile.TemporaryDirectory() as package_directory:
		prepare_testnet_package(package_directory, 'resources.zip')

		with tempfile.TemporaryDirectory() as output_directory:
			# Act:
			await dispatch_shoestring_command(
				_create_setup_screens(package_directory, output_directory, 'dual', '{"animal": "wolf"}'),
				_create_executor(dispatched_args))

			# Assert:
			for i in (2, 8, 14):
				dispatched_args[i] = _strip_folder(dispatched_args[i])  # strip temporary folder used during setup

			assert [
				'setup',
				'--config', 'shoestring.ini',
				'--directory', output_directory,
				'--ca-key-path', str(Path(package_directory) / 'ca.pem'),
				'--overrides', 'overrides.ini',
				'--package', f'file://{Path(package_directory) / "resources.zip"}',
				'--security', 'insecure',
				'--rest-overrides', 'rest_overrides.json'
			] == dispatched_args

			# - shoestring configuration files were created
			shoestring_directory = Path(output_directory) / 'shoestring'
			assert shoestring_directory.exists()
			assert (shoestring_directory / 'shoestring.ini').exists()
			assert (shoestring_directory / 'overrides.ini').exists()
			assert (shoestring_directory / 'rest_overrides.json').exists()


async def _assert_can_dispatch_setup_command_with_bootstrap(
	harvesting_enabled=False,
	voting_enabled=False,
	include_node_key=True,
	expected_features=None
):  # pylint: disable=too-many-locals
	# Arrange:
	dispatched_args = []
	with tempfile.TemporaryDirectory() as package_directory:
		prepare_testnet_package(package_directory, 'resources.zip')

		# setup bootstrap files
		bootstrap_node_path = Path(package_directory) / 'nodes/node'
		bootstrap_node_path.mkdir(parents=True)
		bootstrap_resources_path = bootstrap_node_path / 'server-config/resources'
		bootstrap_resources_path.mkdir(parents=True)
		bootstrap_voting_keys_path = bootstrap_node_path / 'votingkeys'
		if voting_enabled:
			bootstrap_voting_keys_path.mkdir(parents=True)

		def _create_private_key(filename):
			OpensslExecutor(os.environ.get('OPENSSL_EXECUTABLE', 'openssl')).dispatch([
				'genpkey',
				'-out', filename,
				'-outform', 'PEM',
				'-algorithm', 'ed25519'
			])

		bootstrap_node_key_path = bootstrap_node_path / 'cert'
		bootstrap_node_key_path.mkdir(parents=True)
		_create_private_key(bootstrap_node_key_path / 'node.key.pem')

		def _create_bootstrap_file(extension, content):
			with open(bootstrap_resources_path / f'config-{extension}.properties', 'wt', encoding='utf8') as outfile:
				outfile.write('\n'.join(content))

		_create_bootstrap_file('harvesting', [
			'[harvesting]',
			'harvesterSigningPrivateKey = 089C662614A68C49F62F6C0B54F3F66D2D5DB0AFCD62BD69BF7A16312A83B746',
			'harvesterVrfPrivateKey = 87E1184A136E92C62981848680AEA78D0BF098911B658295454B94EDBEE25808',
			f'enableAutoHarvesting = {str(harvesting_enabled).lower()}',
			'beneficiaryAddress = TC7HURP6562IXITM25FQFAOZ3DDTM35GMVZBG3Q',
		])
		_create_bootstrap_file('finalization', [
			'[finalization]',
			f'enableVoting = {str(voting_enabled).lower()}'
		])

		with tempfile.TemporaryDirectory() as output_directory:
			# Act:
			await dispatch_shoestring_command(
				_create_setup_screens(package_directory, output_directory, 'peer', None, True, include_node_key, package_directory),
				_create_executor(dispatched_args))

			# Assert:
			for i in (2, 8):
				dispatched_args[i] = _strip_folder(dispatched_args[i])  # strip temporary folder used during setup

			assert [
				'setup',
				'--config', 'shoestring.ini',
				'--directory', output_directory,
				'--ca-key-path', str(Path(package_directory) / 'ca.pem'),
				'--overrides', 'overrides.ini',
				'--package', f'file://{Path(package_directory) / "resources.zip"}',
				'--security', 'insecure'
			] == dispatched_args

			# - shoestring configuration files were created
			shoestring_directory = Path(output_directory) / 'shoestring'
			assert shoestring_directory.exists()
			assert (shoestring_directory / 'shoestring.ini').exists()
			assert (shoestring_directory / 'overrides.ini').exists()
			assert not (shoestring_directory / 'rest_overrides.json').exists()

			# - Bootstrap configuration was imported
			shoestring_config = load_shoestring_patches_from_file(shoestring_directory / 'shoestring.ini', ['imports', 'node'])
			bootstrap_import_path = shoestring_directory / 'bootstrap-import'
			expected_imports = [
				('imports', 'harvester', str(bootstrap_import_path / 'config-harvesting.properties')),
				*([('imports', 'voter', str(bootstrap_import_path / 'votingkeys'))] if voting_enabled else []),
				*([('imports', 'nodeKey', str(bootstrap_import_path / 'node.key.pem'))] if include_node_key else []),
				('node', 'features', expected_features)
			]

			for key in expected_imports:
				assert key in shoestring_config


async def test_can_dispatch_setup_command_import_bootstrap_with_no_feature():
	await _assert_can_dispatch_setup_command_with_bootstrap(expected_features='PEER')


async def test_can_dispatch_setup_command_import_bootstrap_with_harvesting():
	await _assert_can_dispatch_setup_command_with_bootstrap(True, False, expected_features='HARVESTER')


async def test_can_dispatch_setup_command_import_bootstrap_with_voter():
	await _assert_can_dispatch_setup_command_with_bootstrap(False, True, expected_features='VOTER')


async def test_can_dispatch_setup_command_import_bootstrap_with_harvesting_and_voter():
	await _assert_can_dispatch_setup_command_with_bootstrap(True, True, expected_features='HARVESTER|VOTER')


async def test_can_dispatch_setup_command_import_bootstrap_with_include_node_key_disabled():
	await _assert_can_dispatch_setup_command_with_bootstrap(False, True, False, 'VOTER')


def _prepare_shoestring_file(output_filename):
	with open(output_filename, 'wt', encoding='utf8') as outfile:
		outfile.write('\n'.join([
			'[network]',
			'ubuntuCore = 24.04',
			'',
			'[imports]',
			'rest = symbol-rest:2.4.0',
			'',
			'[transaction]',
			'fee = 20',
			'',
			'[node]',
			'apiHttps = false',
			'caCommonName = upgrade',
			'nodeCommonName = node.upgrade',
			'features = API'
		]))


async def test_can_dispatch_upgrade_command():
	# Arrange:
	expected_keys = [
		('node', 'apiHttps', 'false'),
		('node', 'caCommonName', 'upgrade'),
		('node', 'nodeCommonName', 'node.upgrade'),
		('node', 'features', 'API')
	]
	dispatched_args = []
	with tempfile.TemporaryDirectory() as package_directory:
		shoestring_directory = Path(package_directory) / 'shoestring'
		shoestring_directory.mkdir()
		shoestring_filepath = shoestring_directory / 'shoestring.ini'
		_prepare_shoestring_file(shoestring_filepath)

		# Act:
		await dispatch_shoestring_command({
			'obligatory': ObligatoryScreen(package_directory, str(Path(package_directory) / 'ca.pem')),
			'network-type': SingleValueScreen('sai'),
			'welcome': WelcomeScreen(ShoestringOperation.UPGRADE)
		}, _create_executor(dispatched_args))

		# Assert:
		assert [
			'upgrade',
			'--config', f'{shoestring_directory}/shoestring.ini',
			'--directory', package_directory,
			'--overrides', f'{shoestring_directory}/overrides.ini',
			'--package', 'sai'
		] == dispatched_args

		# node_patches is a superset of expected_keys
		node_patches = load_shoestring_patches_from_file(shoestring_filepath, ['node'])
		for key in expected_keys:
			assert key in node_patches
