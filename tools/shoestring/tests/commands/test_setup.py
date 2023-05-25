import configparser
import tempfile
from enum import Enum
from pathlib import Path

import pytest
from symbolchain.CryptoTypes import PrivateKey
from symbolchain.PrivateKeyStorage import PrivateKeyStorage

from shoestring.__main__ import main
from shoestring.internal.NodeFeatures import NodeFeatures

from ..test.ConfigurationTestUtils import prepare_shoestring_configuration
from ..test.MockNodewatchServer import setup_mock_nodewatch_server
from ..test.TestPackager import prepare_testnet_package

# region server fixture


@pytest.fixture
def server(event_loop, aiohttp_client):
	return setup_mock_nodewatch_server(event_loop, aiohttp_client, True)

# endregion


# region output files

PEER_OUTPUT_FILES = [
	'data',
	'docker-compose.yaml',
	'keys',
	'keys/cert',
	'keys/cert/ca.crt.pem',
	'keys/cert/ca.pubkey.pem',
	'keys/cert/node.crt.pem',
	'keys/cert/node.full.crt.pem',
	'keys/cert/node.key.pem',
	'linking_transaction.dat',
	'logs',
	'seed',
	'seed/00000',
	'seed/00000/00001.dat',
	'seed/00000/00001.proof',
	'seed/00000/00001.stmt',
	'seed/00000/hashes.dat',
	'seed/00000/proof.heights.dat',
	'seed/index.dat',
	'seed/proof.index.dat',
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

API_OUTPUT_FILES = [
	'dbdata',
	'https-proxy',
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
	'rest-cache',
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

HARVESTER_OUTPUT_FILES = [
	'keys/remote.pem',
	'keys/vrf.pem',
	'userconfig/resources/config-harvesting.properties'
]

VOTER_OUTPUT_FILES = [
	'keys/voting',
	'keys/voting/private_key_tree1.dat'
]

# endregion


# region assert_can_prepare_node

class CaMode(Enum):
	NONE = 0
	WITHOUT_PASSWORD = 1
	WITH_PASSWORD = 2


async def _assert_can_prepare_node(
	server,  # pylint: disable=redefined-outer-name
	node_features,
	expected_output_files,
	ca_mode=CaMode.NONE):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with tempfile.TemporaryDirectory() as package_directory:
			ca_password = 'abc' if CaMode.WITH_PASSWORD == ca_mode else ''
			prepare_shoestring_configuration(package_directory, node_features, server.make_url(''), ca_password)
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
					'--ca-key-path', str(Path(ca_directory) / 'xyz.key.pem')
				])

				# Assert: spot check all expected files were created
				output_files = sorted(str(path.relative_to(output_directory)) for path in Path(output_directory).glob('**/*'))
				assert expected_output_files == output_files

				ca_files = sorted(str(path.relative_to(ca_directory)) for path in Path(ca_directory).glob('**/*'))
				assert ['xyz.key.pem'] == ca_files

				if CaMode.NONE != ca_mode:
					# - original CA private key is preserved
					private_key_storage = PrivateKeyStorage(ca_directory, ca_password)
					reloaded_ca_private_key = private_key_storage.load('xyz.key')
					assert ca_private_key == reloaded_ca_private_key

# endregion


# region feature variance

async def test_can_prepare_peer_node(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_node(server, NodeFeatures.PEER, PEER_OUTPUT_FILES)


async def test_can_prepare_api_node(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_node(server, NodeFeatures.API, sorted(PEER_OUTPUT_FILES + API_OUTPUT_FILES))


async def test_can_prepare_harvester_node(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_node(server, NodeFeatures.HARVESTER, sorted(PEER_OUTPUT_FILES + HARVESTER_OUTPUT_FILES))


async def test_can_prepare_voter_node(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_node(server, NodeFeatures.VOTER, sorted(PEER_OUTPUT_FILES + VOTER_OUTPUT_FILES))


async def test_can_prepare_full_node(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_node(
		server,
		NodeFeatures.API | NodeFeatures.HARVESTER | NodeFeatures.VOTER,
		sorted(PEER_OUTPUT_FILES + API_OUTPUT_FILES + HARVESTER_OUTPUT_FILES + VOTER_OUTPUT_FILES))

# endregion


# region CA variance

async def test_can_prepare_peer_node_with_existing_ca_without_password(server):  # pylint: disable=redefined-outer-name,invalid-name
	await _assert_can_prepare_node(server, NodeFeatures.PEER, PEER_OUTPUT_FILES, CaMode.WITHOUT_PASSWORD)


async def test_can_prepare_peer_node_with_existing_ca_with_password(server):  # pylint: disable=redefined-outer-name,invalid-name
	await _assert_can_prepare_node(server, NodeFeatures.PEER, PEER_OUTPUT_FILES, CaMode.WITH_PASSWORD)

# endregion


# region overrides

async def test_can_apply_user_overrides(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with tempfile.TemporaryDirectory() as package_directory:
			prepare_shoestring_configuration(package_directory, NodeFeatures.PEER, server.make_url(''))
			prepare_testnet_package(package_directory, 'resources.zip')

			user_overrides_filepath = Path(package_directory) / 'overrides.properties'
			with open(user_overrides_filepath, 'wt', encoding='utf8') as outfile:
				outfile.write('\n'.join([
					'[node.localnode]',
					'',
					'host = foo.symbol.ninja',
					'friendlyName = Foo Ninja'
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
					'--overrides', str(user_overrides_filepath)
				])

				# Assert: check user properties were applied
				node_parser = configparser.ConfigParser()
				node_parser.optionxform = str
				node_parser.read(Path(output_directory) / 'userconfig' / 'resources' / 'config-node.properties')

				assert 'foo.symbol.ninja' == node_parser['localnode']['host']
				assert 'Foo Ninja' == node_parser['localnode']['friendlyName']

# endregion
