import configparser
import tempfile
from enum import Enum
from pathlib import Path

import pytest
from symbolchain.CryptoTypes import PrivateKey
from symbolchain.PrivateKeyStorage import PrivateKeyStorage

from shoestring.__main__ import main
from shoestring.internal.NodeFeatures import NodeFeatures

from ..test.MockNodewatchServer import setup_mock_nodewatch_server
from ..test.TestPackager import prepare_mainnet_package

# region server fixture


@pytest.fixture
def server(event_loop, aiohttp_client):
	return setup_mock_nodewatch_server(event_loop, aiohttp_client)

# endregion


# region output files

PEER_OUTPUT_FILES = [
	'/data',
	'/docker-compose.yaml',
	'/keys',
	'/keys/cert',
	'/keys/cert/ca.crt.pem',
	'/keys/cert/ca.pubkey.pem',
	'/keys/cert/node.crt.pem',
	'/keys/cert/node.full.crt.pem',
	'/keys/cert/node.key.pem',
	'/linking_transaction.dat',
	'/logs',
	'/resources',
	'/resources/config-extensions-recovery.properties',
	'/resources/config-extensions-server.properties',
	'/resources/config-finalization.properties',
	'/resources/config-inflation.properties',
	'/resources/config-logging-recovery.properties',
	'/resources/config-logging-server.properties',
	'/resources/config-network.properties',
	'/resources/config-node.properties',
	'/resources/config-task.properties',
	'/resources/config-timesync.properties',
	'/resources/config-user.properties',
	'/resources/peers-p2p.json',
	'/seed',
	'/seed/index.dat',
	'/startup',
	'/startup/startServer.sh'
]

API_OUTPUT_FILES = [
	'/dbdata',
	'/https-proxy',
	'/mongo',
	'/mongo/mongoDbPrepare.js',
	'/resources/config-database.properties',
	'/resources/config-extensions-broker.properties',
	'/resources/config-logging-broker.properties',
	'/resources/config-messaging.properties',
	'/resources/config-pt.properties',
	'/resources/peers-api.json',
	'/rest-cache',
	'/startup/delayrestapi.sh',
	'/startup/mongors.sh',
	'/startup/rest.json',
	'/startup/startBroker.sh',
	'/startup/wait.sh'
]

HARVESTER_OUTPUT_FILES = [
	'/keys/remote.pem',
	'/keys/vrf.pem',
	'/resources/config-harvesting.properties',
]

VOTER_OUTPUT_FILES = [
	'/keys/voting',
	'/keys/voting/private_key_tree1.dat',
]

# endregion


# region assert_can_prepare_node

class CaMode(Enum):
	NONE = 0
	WITHOUT_PASSWORD = 1
	WITH_PASSWORD = 2


def _prepare_configuration(directory, services_nodewatch, node_features, ca_password=''):
	parser = configparser.ConfigParser()
	parser.read(Path('tests/resources/testnet.properties').absolute())

	parser['services']['nodewatch'] = str(services_nodewatch)

	node_features_str = str(node_features)
	parser['node']['features'] = node_features_str[node_features_str.index('.') + 1:]
	parser['node']['caPassword'] = f'pass:{ca_password}' if ca_password else ''

	with open(Path(directory) / 'testnet.properties', 'wt', encoding='utf8') as outfile:
		parser.write(outfile)


async def _assert_can_prepare_node(
	server,  # pylint: disable=redefined-outer-name
	node_features,
	expected_output_files,
	ca_mode=CaMode.NONE):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with tempfile.TemporaryDirectory() as package_directory:
			ca_password = 'abc' if CaMode.WITH_PASSWORD == ca_mode else ''
			_prepare_configuration(package_directory, server.make_url(''), node_features, ca_password)
			prepare_mainnet_package(package_directory, 'resources.zip')

			ca_private_key = None
			with tempfile.TemporaryDirectory() as ca_directory:
				if CaMode.NONE != ca_mode:
					ca_private_key = PrivateKey.random()
					private_key_storage = PrivateKeyStorage(ca_directory, ca_password)
					private_key_storage.save('xyz.key', ca_private_key)

				# Act:
				await main([
					'setup',
					'--config', str(Path(package_directory) / 'testnet.properties'),
					'--security', 'insecure',
					'--package', f'file://{Path(package_directory) / "resources.zip"}',
					'--directory', output_directory,
					'--ca-key-path', str(Path(ca_directory) / 'xyz.key.pem'),
				])

				# Assert: spot check all expected files were created
				output_files = sorted(str(path)[len(output_directory):] for path in Path(output_directory).glob('**/*'))
				assert expected_output_files == output_files

				ca_files = sorted(str(path)[len(ca_directory):] for path in Path(ca_directory).glob('**/*'))
				assert ['/xyz.key.pem'] == ca_files

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
