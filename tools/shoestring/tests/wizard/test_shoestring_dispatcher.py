import tempfile
from collections import namedtuple
from pathlib import Path

from shoestring.internal.ConfigurationManager import load_shoestring_patches_from_file
from shoestring.wizard.shoestring_dispatcher import dispatch_shoestring_command
from shoestring.wizard.ShoestringOperation import ShoestringOperation

from ..test.TestPackager import prepare_testnet_package

CertificatesScreen = namedtuple('CertificatesScreen', ['ca_common_name', 'node_common_name'])
NodeSettingsScreen = namedtuple('NodeSettingsScreen', ['domain_name', 'friendly_name', 'api_https', 'metadata_info'])
ObligatoryScreen = namedtuple('ObligatoryScreen', ['destination_directory', 'ca_pem_path'])
SingleValueScreen = namedtuple('SingleValueScreen', ['current_value'])
ToggleScreen = namedtuple('ToggleScreen', ['active'])
WelcomeScreen = namedtuple('WelcomeScreen', ['operation'])


def _create_executor(dispatched_args):
	async def executor(args):
		dispatched_args.extend(args)

	return executor


def _strip_folder(path):
	return Path(path).name


def _create_setup_screens(package_directory, output_directory, node_type, node_metadata):
	return {
		'obligatory': ObligatoryScreen(output_directory, Path(package_directory) / 'ca.pem'),
		'node-settings': NodeSettingsScreen('symbol.fyi', 'node explorer', False, node_metadata),
		'network-type': SingleValueScreen(f'file://{Path(package_directory) / "resources.zip"}'),
		'node-type': SingleValueScreen(node_type),
		'harvesting': ToggleScreen(False),
		'voting': ToggleScreen(False),
		'certificates': CertificatesScreen('ca', 'peer'),
		'welcome': WelcomeScreen(ShoestringOperation.SETUP)
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
				_create_setup_screens(package_directory, output_directory, 'peer', None),
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
