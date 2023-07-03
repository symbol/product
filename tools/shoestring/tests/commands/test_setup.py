import configparser
import json
import os
import tempfile
from enum import Enum
from pathlib import Path

import pytest
from symbolchain.CryptoTypes import PrivateKey
from symbolchain.PrivateKeyStorage import PrivateKeyStorage

from shoestring.__main__ import main
from shoestring.internal.NodeFeatures import NodeFeatures

from ..test.CertificateTestUtils import assert_certificate_properties
from ..test.ConfigurationTestUtils import prepare_shoestring_configuration
from ..test.FileSystemTestUtils import assert_expected_files_and_permissions
from ..test.MockNodewatchServer import setup_mock_nodewatch_server
from ..test.TestPackager import prepare_testnet_package

# region server fixture


@pytest.fixture
def server(event_loop, aiohttp_client):
	return setup_mock_nodewatch_server(event_loop, aiohttp_client, True)

# endregion


# region output files

PEER_OUTPUT_FILES = {
	'data': 0o700,
	'docker-compose.yaml': 0o400,
	'keys': 0o700,
	'keys/cert': 0o700,
	'keys/cert/ca.crt.pem': 0o400,
	'keys/cert/ca.pubkey.pem': 0o400,
	'keys/cert/node.crt.pem': 0o400,
	'keys/cert/node.full.crt.pem': 0o400,
	'keys/cert/node.key.pem': 0o400,
	'logs': 0o700,
	'seed': 0o700,
	'seed/00000': 0o700,
	'seed/00000/00001.dat': 0o400,
	'seed/00000/00001.proof': 0o400,
	'seed/00000/00001.stmt': 0o400,
	'seed/00000/hashes.dat': 0o400,
	'seed/00000/proof.heights.dat': 0o400,
	'seed/index.dat': 0o400,
	'seed/proof.index.dat': 0o400,
	'userconfig': 0o700,
	'userconfig/resources': 0o700,
	'userconfig/resources/config-extensions-recovery.properties': 0o400,
	'userconfig/resources/config-extensions-server.properties': 0o400,
	'userconfig/resources/config-finalization.properties': 0o400,
	'userconfig/resources/config-inflation.properties': 0o400,
	'userconfig/resources/config-logging-recovery.properties': 0o400,
	'userconfig/resources/config-logging-server.properties': 0o400,
	'userconfig/resources/config-network.properties': 0o400,
	'userconfig/resources/config-node.properties': 0o400,
	'userconfig/resources/config-task.properties': 0o400,
	'userconfig/resources/config-timesync.properties': 0o400,
	'userconfig/resources/config-user.properties': 0o400,
	'userconfig/resources/peers-p2p.json': 0o400
}

HTTPS_OUTPUT_FILES = {
	'https-proxy': 0o700,
	'https-proxy/nginx.conf.erb': 0o400
}

API_OUTPUT_FILES = {
	'dbdata': 0o700,
	'mongo': 0o700,
	'mongo/mongoDbDrop.js': 0o400,
	'mongo/mongoDbPrepare.js': 0o400,
	'mongo/mongoLockHashDbPrepare.js': 0o400,
	'mongo/mongoLockSecretDbPrepare.js': 0o400,
	'mongo/mongoMetadataDbPrepare.js': 0o400,
	'mongo/mongoMosaicDbPrepare.js': 0o400,
	'mongo/mongoMultisigDbPrepare.js': 0o400,
	'mongo/mongoNamespaceDbPrepare.js': 0o400,
	'mongo/mongoRestrictionAccountDbPrepare.js': 0o400,
	'mongo/mongoRestrictionMosaicDbPrepare.js': 0o400,
	'rest-cache': 0o700,
	'startup': 0o700,
	'startup/delayrestapi.sh': 0o400,
	'startup/mongors.sh': 0o400,
	'startup/startBroker.sh': 0o400,
	'startup/startServer.sh': 0o400,
	'startup/wait.sh': 0o400,
	'userconfig/resources/config-database.properties': 0o400,
	'userconfig/resources/config-extensions-broker.properties': 0o400,
	'userconfig/resources/config-logging-broker.properties': 0o400,
	'userconfig/resources/config-messaging.properties': 0o400,
	'userconfig/resources/config-pt.properties': 0o400,
	'userconfig/resources/peers-api.json': 0o400,
	'userconfig/rest.json': 0o400
}

HARVESTER_OUTPUT_FILES = {
	'keys/remote.pem': 0o400,
	'keys/vrf.pem': 0o400,
	'userconfig/resources/config-harvesting.properties': 0o400
}

VOTER_OUTPUT_FILES = {
	'keys/voting': 0o700,
	'keys/voting/private_key_tree1.dat': 0o600
}

STATE_CHANGE_OUTPUT_FILES = {
	'linking_transaction.dat': 0o600
}

# endregion


# region assert_can_prepare_node

class CaMode(Enum):
	NONE = 0
	WITHOUT_PASSWORD = 1
	WITH_PASSWORD = 2


def _set_hostname_in_overrides(user_overrides_filepath, hostname):
	with open(user_overrides_filepath, 'wt', encoding='utf8') as outfile:
		outfile.write('\n'.join([
			'[node.localnode]',
			'',
			f'host = {hostname}',  # must be a name that resolves properly
			'friendlyName = Foo Ninja'
		]))


def _prepare_overrides(directory):
	_set_hostname_in_overrides(Path(directory) / 'user_overrides.ini', 'localhost')


async def _assert_can_prepare_node(
	server,  # pylint: disable=redefined-outer-name
	node_features,
	expected_output_files,
	ca_mode=CaMode.NONE,
	api_https=False
):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with tempfile.TemporaryDirectory() as package_directory:
			ca_password = 'abc' if CaMode.WITH_PASSWORD == ca_mode else ''
			prepare_shoestring_configuration(
				package_directory,
				node_features,
				server.make_url(''),
				ca_password=ca_password,
				api_https=api_https,
				ca_common_name='my CA CN',
				node_common_name='my Node CN')
			_prepare_overrides(package_directory)
			prepare_testnet_package(package_directory, 'resources.zip')

			ca_private_key = None
			with tempfile.TemporaryDirectory() as ca_directory:
				if CaMode.NONE != ca_mode:
					ca_private_key = PrivateKey.random()
					private_key_storage = PrivateKeyStorage(ca_directory, ca_password)
					private_key_storage.save('xyz.key', ca_private_key)

				# Act:
				await main([
					'setup',
					'--config', str(Path(package_directory) / 'sai.shoestring.ini'),
					'--security', 'insecure',
					'--package', f'file://{Path(package_directory) / "resources.zip"}',
					'--directory', output_directory,
					'--ca-key-path', str(Path(ca_directory) / 'xyz.key.pem'),
					'--overrides', str(Path(package_directory) / 'user_overrides.ini')
				])

				# Assert: spot check all expected output files and permissions
				assert_expected_files_and_permissions(output_directory, expected_output_files)

				# - spot check all expected CA files are present
				ca_files = sorted(str(path.relative_to(ca_directory)) for path in Path(ca_directory).glob('**/*'))
				assert ['xyz.key.pem'] == ca_files

				if CaMode.NONE != ca_mode:
					# - original CA private key is preserved
					private_key_storage = PrivateKeyStorage(ca_directory, ca_password)
					reloaded_ca_private_key = private_key_storage.load('xyz.key')
					assert ca_private_key == reloaded_ca_private_key

				# - check certificates
				certificates_directory = Path(output_directory) / 'keys' / 'cert'
				assert_certificate_properties(certificates_directory / 'node.crt.pem', 'my CA CN', 'my Node CN', 375)
				assert_certificate_properties(certificates_directory / 'ca.crt.pem', 'my CA CN', 'my CA CN', 20 * 365)

# endregion


# pylint: disable=invalid-name


# region feature variance

async def test_can_prepare_peer_node(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_node(server, NodeFeatures.PEER, PEER_OUTPUT_FILES)


async def test_can_prepare_api_node(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_node(server, NodeFeatures.API, {**PEER_OUTPUT_FILES, **API_OUTPUT_FILES})


async def test_can_prepare_api_node_with_https(server):  # pylint: disable=redefined-outer-name
	expected_output_files = {**PEER_OUTPUT_FILES, **API_OUTPUT_FILES, **HTTPS_OUTPUT_FILES}
	await _assert_can_prepare_node(server, NodeFeatures.API, expected_output_files, api_https=True)


async def test_can_prepare_harvester_node(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_node(server, NodeFeatures.HARVESTER, {
		**PEER_OUTPUT_FILES, **HARVESTER_OUTPUT_FILES, **STATE_CHANGE_OUTPUT_FILES
	})


async def test_can_prepare_voter_node(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_node(server, NodeFeatures.VOTER, {
		**PEER_OUTPUT_FILES, **VOTER_OUTPUT_FILES, **STATE_CHANGE_OUTPUT_FILES
	})


async def test_can_prepare_full_node(server):  # pylint: disable=redefined-outer-name
	expected_output_files = {
		**PEER_OUTPUT_FILES, **API_OUTPUT_FILES, **HARVESTER_OUTPUT_FILES, **VOTER_OUTPUT_FILES, **STATE_CHANGE_OUTPUT_FILES
	}
	await _assert_can_prepare_node(server, NodeFeatures.API | NodeFeatures.HARVESTER | NodeFeatures.VOTER, expected_output_files)

# endregion


# region CA variance

async def test_can_prepare_peer_node_with_existing_ca_without_password(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_node(server, NodeFeatures.PEER, PEER_OUTPUT_FILES, CaMode.WITHOUT_PASSWORD)


async def test_can_prepare_peer_node_with_existing_ca_with_password(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_node(server, NodeFeatures.PEER, PEER_OUTPUT_FILES, CaMode.WITH_PASSWORD)

# endregion


# region relative output path

async def test_can_prepare_node_with_relative_output_directory(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory(dir=os.getcwd()) as output_directory:
		with tempfile.TemporaryDirectory() as package_directory:
			prepare_shoestring_configuration(
				package_directory,
				NodeFeatures.PEER,
				server.make_url(''),
				api_https=False,
				ca_common_name='my CA CN',
				node_common_name='my Node CN')
			_prepare_overrides(package_directory)
			prepare_testnet_package(package_directory, 'resources.zip')

			with tempfile.TemporaryDirectory() as ca_directory:
				# Act:
				await main([
					'setup',
					'--config', str(Path(package_directory) / 'sai.shoestring.ini'),
					'--security', 'insecure',
					'--package', f'file://{Path(package_directory) / "resources.zip"}',
					'--directory', str(Path(output_directory).relative_to(os.getcwd())),
					'--ca-key-path', str(Path(ca_directory) / 'xyz.key.pem'),
					'--overrides', str(Path(package_directory) / 'user_overrides.ini')
				])

				# Assert: spot check all expected output files and permissions
				assert_expected_files_and_permissions(output_directory, PEER_OUTPUT_FILES)

				# - spot check all expected CA files are present
				ca_files = sorted(str(path.relative_to(ca_directory)) for path in Path(ca_directory).glob('**/*'))
				assert ['xyz.key.pem'] == ca_files

				# - check certificates
				certificates_directory = Path(output_directory) / 'keys' / 'cert'
				assert_certificate_properties(certificates_directory / 'node.crt.pem', 'my CA CN', 'my Node CN', 375)
				assert_certificate_properties(certificates_directory / 'ca.crt.pem', 'my CA CN', 'my CA CN', 20 * 365)

# endregion


# region overrides

async def _assert_can_prepare_with_hostname(server, hostname, node_features, api_https=None):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with tempfile.TemporaryDirectory() as package_directory:
			prepare_shoestring_configuration(package_directory, node_features, server.make_url(''), api_https=api_https)
			prepare_testnet_package(package_directory, 'resources.zip')

			user_overrides_filepath = Path(package_directory) / 'overrides.properties'
			_set_hostname_in_overrides(user_overrides_filepath, hostname)

			with tempfile.TemporaryDirectory() as ca_directory:
				# Act:
				await main([
					'setup',
					'--config', str(Path(package_directory) / 'sai.shoestring.ini'),
					'--security', 'insecure',
					'--package', f'file://{Path(package_directory) / "resources.zip"}',
					'--directory', output_directory,
					'--ca-key-path', str(Path(ca_directory) / 'xyz.key.pem'),
					'--overrides', str(user_overrides_filepath)
				])

				# Assert: check user properties were applied
				node_parser = configparser.ConfigParser()
				node_parser.optionxform = str
				node_parser.read(Path(output_directory) / 'userconfig' / 'resources' / 'config-node.properties')

				assert hostname == node_parser['localnode']['host']
				assert 'Foo Ninja' == node_parser['localnode']['friendlyName']


async def test_can_apply_user_overrides(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_with_hostname(server, 'symbol.fyi', NodeFeatures.PEER, False)


async def test_can_apply_custom_node_metadata(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with tempfile.TemporaryDirectory() as package_directory:
			_prepare_overrides(package_directory)
			prepare_shoestring_configuration(package_directory, NodeFeatures.API, server.make_url(''))
			prepare_testnet_package(package_directory, 'resources.zip')

			node_metadata_filepath = Path(package_directory) / 'metadata.json'
			with open(node_metadata_filepath, 'wt', encoding='utf8') as outfile:
				outfile.write('\n'.join([
					'{',
					'  "animal": "wolf",',
					'  "weight": "43kg",',
					'  "height": "72cm"',
					'}'
				]))

			with tempfile.TemporaryDirectory() as ca_directory:
				# Act:
				await main([
					'setup',
					'--config', str(Path(package_directory) / 'sai.shoestring.ini'),
					'--security', 'insecure',
					'--package', f'file://{Path(package_directory) / "resources.zip"}',
					'--directory', output_directory,
					'--ca-key-path', str(Path(ca_directory) / 'xyz.key.pem'),
					'--overrides', str(Path(package_directory) / 'user_overrides.ini'),
					'--metadata', str(node_metadata_filepath)
				])

				# Assert: check custom node metadata was applied
				with open(Path(output_directory) / 'userconfig' / 'rest.json', 'rt', encoding='utf8') as rest_config_infile:
					rest_config = json.load(rest_config_infile)

				assert {
					'animal': 'wolf',
					'weight': '43kg',
					'height': '72cm'
				} == rest_config['nodeMetadata']

# endregion


# region hostname checks

async def test_can_prepare_api_with_ip_without_https(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_with_hostname(server, '1.2.3.4', NodeFeatures.API, False)


async def test_can_prepare_api_with_hostname_with_https(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_with_hostname(server, 'symbol.fyi', NodeFeatures.API, True)


async def test_can_prepare_peer_with_hostname(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_with_hostname(server, 'symbol.fyi', NodeFeatures.PEER, False)


async def _assert_cannot_prepare_with_hostname(
	server,  # pylint: disable=redefined-outer-name
	hostname,
	node_features,
	expected_exception,
	api_https=None
):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with tempfile.TemporaryDirectory() as package_directory:
			prepare_shoestring_configuration(package_directory, node_features, server.make_url(''), api_https=api_https)
			prepare_testnet_package(package_directory, 'resources.zip')

			user_overrides_filepath = Path(package_directory) / 'overrides.properties'
			_set_hostname_in_overrides(user_overrides_filepath, hostname)

			with tempfile.TemporaryDirectory() as ca_directory:
				# Act + Assert:
				with pytest.raises(RuntimeError) as excinfo:
					await main([
						'setup',
						'--config', str(Path(package_directory) / 'sai.shoestring.ini'),
						'--security', 'insecure',
						'--package', f'file://{Path(package_directory) / "resources.zip"}',
						'--directory', output_directory,
						'--ca-key-path', str(Path(ca_directory) / 'xyz.key.pem'),
						'--overrides', str(user_overrides_filepath)
					])

				assert expected_exception in str(excinfo.value)


async def test_cannot_prepare_api_with_ip_with_https(server):  # pylint: disable=redefined-outer-name
	await _assert_cannot_prepare_with_hostname(
		server,
		'1.2.3.4',
		NodeFeatures.API,
		'hostname 1.2.3.4 looks like IP address and not a hostname',
		True)


async def test_cannot_prepare_with_invalid_hostname(server):  # pylint: disable=redefined-outer-name
	await _assert_cannot_prepare_with_hostname(
		server,
		'foo bar baz',
		NodeFeatures.PEER,
		'could not resolve address for host: foo bar baz',
		False)


async def test_cannot_prepare_peer_with_https(server):  # pylint: disable=redefined-outer-name
	await _assert_cannot_prepare_with_hostname(
		server,
		'symbol.fyi',
		NodeFeatures.PEER,
		'HTTPS selected but required feature (API) is not selected',
		True)

# endregion
