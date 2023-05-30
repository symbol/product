import tempfile
from pathlib import Path

import pytest

from shoestring.__main__ import main
from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.NodeFeatures import NodeFeatures

from ..test.ConfigurationTestUtils import prepare_shoestring_configuration
from ..test.FileSystemTestUtils import assert_expected_files_and_permissions
from ..test.MockNodewatchServer import setup_mock_nodewatch_server
from ..test.TestPackager import prepare_testnet_package
from .test_setup import API_OUTPUT_FILES, HARVESTER_OUTPUT_FILES, HTTPS_OUTPUT_FILES, PEER_OUTPUT_FILES, VOTER_OUTPUT_FILES

# region server fixture


@pytest.fixture
def server(event_loop, aiohttp_client):
	return setup_mock_nodewatch_server(event_loop, aiohttp_client, True)

# endregion


# region changed files

PEER_CHANGED_FILES = [
	'docker-compose.yaml',
	'userconfig',
	'userconfig/resources',
	'userconfig/resources/config-extensions-recovery.properties',
	'userconfig/resources/config-extensions-server.properties',
	'userconfig/resources/config-finalization.properties',
	'userconfig/resources/config-inflation.properties',
	'userconfig/resources/config-logging-recovery.properties',
	'userconfig/resources/config-logging-server.properties',
	'userconfig/resources/config-network.properties',
	'userconfig/resources/config-node.properties',
	'userconfig/resources/config-task.properties',
	'userconfig/resources/config-timesync.properties',
	'userconfig/resources/config-user.properties',
	'userconfig/resources/peers-p2p.json'
]

HTTPS_CHANGED_FILES = [
	'https-proxy',  # metadata is changed due to delete and add of file
	'https-proxy/nginx.conf.erb'
]

API_CHANGED_FILES = [
	'mongo',
	'mongo/mongoDbDrop.js',
	'mongo/mongoDbPrepare.js',
	'mongo/mongoLockHashDbPrepare.js',
	'mongo/mongoLockSecretDbPrepare.js',
	'mongo/mongoMetadataDbPrepare.js',
	'mongo/mongoMosaicDbPrepare.js',
	'mongo/mongoMultisigDbPrepare.js',
	'mongo/mongoNamespaceDbPrepare.js',
	'mongo/mongoRestrictionAccountDbPrepare.js',
	'mongo/mongoRestrictionMosaicDbPrepare.js',
	'startup',
	'startup/delayrestapi.sh',
	'startup/mongors.sh',
	'startup/startBroker.sh',
	'startup/startServer.sh',
	'startup/wait.sh',
	'userconfig/resources/config-database.properties',
	'userconfig/resources/config-extensions-broker.properties',
	'userconfig/resources/config-logging-broker.properties',
	'userconfig/resources/config-messaging.properties',
	'userconfig/resources/config-pt.properties',
	'userconfig/resources/peers-api.json',
	'userconfig/rest.json'
]

HARVESTER_CHANGED_FILES = [
	'userconfig/resources/config-harvesting.properties'
]

# endregion


# region assert_can_upgrade_node

def _set_hostname_in_overrides(user_overrides_filepath, hostname, friendly_name):
	with open(user_overrides_filepath, 'wt', encoding='utf8') as outfile:
		outfile.write('\n'.join([
			'[node.localnode]',
			'',
			f'host = {hostname}',  # must be a name that resolves properly
			f'friendlyName = {friendly_name}'
		]))


def _prepare_overrides(directory, friendly_name):
	_set_hostname_in_overrides(Path(directory) / 'user_overrides.ini', 'localhost', friendly_name)


def _get_mtimes_map(output_directory):
	return {str(path.relative_to(output_directory)): path.stat().st_mtime for path in Path(output_directory).glob('**/*')}


def _read_friendly_name(config_manager):
	return config_manager.lookup('config-node.properties', [('localnode', 'friendlyName')])[0]


def _read_harvester_private_keys(config_manager):
	return config_manager.lookup('config-harvesting.properties', [
		('harvesting', 'harvesterSigningPrivateKey'),
		('harvesting', 'harvesterVrfPrivateKey')
	])


def _get_changed_files(map1, map2):
	return sorted([key for key, value in map1.items() if value != map2[key]])


def _assert_changed_files(setup_mtimes_map, output_directory, expected_changed_files):
	upgrade_mtimes_map = _get_mtimes_map(output_directory)
	changed_files = _get_changed_files(setup_mtimes_map, upgrade_mtimes_map)
	assert expected_changed_files == changed_files


async def _assert_can_upgrade_node(
	server,  # pylint: disable=redefined-outer-name
	node_features,
	expected_output_files,
	expected_changed_files,
	api_https=False):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with tempfile.TemporaryDirectory() as package_directory:
			prepare_shoestring_configuration(package_directory, node_features, server.make_url(''), api_https=api_https)
			_prepare_overrides(package_directory, 'name from setup')
			prepare_testnet_package(package_directory, 'resources.zip')

			common_args = [
				'--config', str(Path(package_directory) / 'sai.shoestring.ini'),
				'--package', f'file://{Path(package_directory) / "resources.zip"}',
				'--directory', output_directory,
				'--overrides', str(Path(package_directory) / 'user_overrides.ini')
			]

			with tempfile.TemporaryDirectory() as ca_directory:
				# - prepare directory by running initial setup command
				await main([
					'setup',
					'--security', 'insecure',
					'--ca-key-path', str(Path(ca_directory) / 'xyz.key.pem'),
				] + common_args)

				setup_mtimes_map = _get_mtimes_map(output_directory)

				config_manager = ConfigurationManager(Path(output_directory) / 'userconfig' / 'resources')
				if NodeFeatures.HARVESTER in node_features:
					setup_harvester_private_keys = _read_harvester_private_keys(config_manager)

				# Sanity:
				assert 'name from setup' == _read_friendly_name(config_manager)

				# Act: upgrade (with different overrides)
				_prepare_overrides(package_directory, 'name from upgrade')
				await main(['upgrade'] + common_args)

				# Assert: spot check all expected output files and permissions
				assert_expected_files_and_permissions(output_directory, expected_output_files)

				# - check expected changed files are changed
				_assert_changed_files(setup_mtimes_map, output_directory, expected_changed_files)

				# - check latest config overrides are used during upgrade
				assert 'name from upgrade' == _read_friendly_name(config_manager)

				if NodeFeatures.HARVESTER in node_features:
					# - original harvesting private keys are retained
					upgrade_harvester_private_keys = _read_harvester_private_keys(config_manager)
					assert setup_harvester_private_keys == upgrade_harvester_private_keys

# endregion


# pylint: disable=invalid-name


# region feature variance

async def test_can_upgrade_peer_node(server):  # pylint: disable=redefined-outer-name
	await _assert_can_upgrade_node(server, NodeFeatures.PEER, PEER_OUTPUT_FILES, PEER_CHANGED_FILES)


async def test_can_upgrade_api_node(server):  # pylint: disable=redefined-outer-name
	expected_output_files = {**PEER_OUTPUT_FILES, **API_OUTPUT_FILES}
	expected_changed_files = sorted(PEER_CHANGED_FILES + API_CHANGED_FILES)
	await _assert_can_upgrade_node(server, NodeFeatures.API, expected_output_files, expected_changed_files)


async def test_can_upgrade_api_node_with_https(server):  # pylint: disable=redefined-outer-name
	expected_output_files = {**PEER_OUTPUT_FILES, **API_OUTPUT_FILES, **HTTPS_OUTPUT_FILES}
	expected_changed_files = sorted(PEER_CHANGED_FILES + API_CHANGED_FILES + HTTPS_CHANGED_FILES)
	await _assert_can_upgrade_node(server, NodeFeatures.API, expected_output_files, expected_changed_files, api_https=True)


async def test_can_upgrade_harvester_node(server):  # pylint: disable=redefined-outer-name
	expected_output_files = {**PEER_OUTPUT_FILES, **HARVESTER_OUTPUT_FILES}
	expected_changed_files = sorted(PEER_CHANGED_FILES + HARVESTER_CHANGED_FILES)
	await _assert_can_upgrade_node(server, NodeFeatures.HARVESTER, expected_output_files, expected_changed_files)


async def test_can_upgrade_voter_node(server):  # pylint: disable=redefined-outer-name
	expected_output_files = {**PEER_OUTPUT_FILES, **VOTER_OUTPUT_FILES}
	await _assert_can_upgrade_node(server, NodeFeatures.VOTER, expected_output_files, PEER_CHANGED_FILES)


async def test_can_upgrade_full_node(server):  # pylint: disable=redefined-outer-name
	node_features = NodeFeatures.API | NodeFeatures.HARVESTER | NodeFeatures.VOTER
	expected_output_files = {**PEER_OUTPUT_FILES, **API_OUTPUT_FILES, **HARVESTER_OUTPUT_FILES, **VOTER_OUTPUT_FILES}
	expected_changed_files = sorted(PEER_CHANGED_FILES + API_CHANGED_FILES + HARVESTER_CHANGED_FILES)
	await _assert_can_upgrade_node(server, node_features, expected_output_files, expected_changed_files)

# endregion
