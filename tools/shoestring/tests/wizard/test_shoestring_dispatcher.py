import tempfile
from collections import namedtuple
from pathlib import Path

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
			assert not (shoestring_directory / 'node_metadata.json').exists()


async def test_can_dispatch_setup_command_with_custom_metadata():
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
				'--metadata', 'node_metadata.json'
			] == dispatched_args

			# - shoestring configuration files were created
			shoestring_directory = Path(output_directory) / 'shoestring'
			assert shoestring_directory.exists()
			assert (shoestring_directory / 'shoestring.ini').exists()
			assert (shoestring_directory / 'overrides.ini').exists()
			assert (shoestring_directory / 'node_metadata.json').exists()


async def test_can_dispatch_upgrade_command():
	# Act:
	dispatched_args = []
	await dispatch_shoestring_command({
		'obligatory': ObligatoryScreen('/path/to/symbol', '/path/to/ca.pem'),
		'network-type': SingleValueScreen('sai'),
		'welcome': WelcomeScreen(ShoestringOperation.UPGRADE)
	}, _create_executor(dispatched_args))

	# Assert:
	assert [
		'upgrade',
		'--config', '/path/to/symbol/shoestring/shoestring.ini',
		'--directory', '/path/to/symbol',
		'--overrides', '/path/to/symbol/shoestring/overrides.ini',
		'--package', 'sai'
	] == dispatched_args
