import tempfile
from pathlib import Path

import pytest

from shoestring.__main__ import main
from shoestring.internal.NodeFeatures import NodeFeatures

from ..test.MockNodewatchServer import setup_mock_nodewatch_server
from ..test.TestPackager import prepare_mainnet_package

# region server fixture


@pytest.fixture
def server(event_loop, aiohttp_client):
	return setup_mock_nodewatch_server(event_loop, aiohttp_client)

# endregion


async def _assert_can_prepare_node(server, node_features, expected_output_files):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with tempfile.TemporaryDirectory() as package_directory:
			prepare_mainnet_package(package_directory, 'resources.zip')

			with tempfile.TemporaryDirectory() as ca_directory:
				# Act:
				await main([
					'setup',
					'--security', 'insecure',
					'--package', f'file://{Path(package_directory) / "resources.zip"}',
					'--nodewatch', str(server.make_url('')),
					'--directory', output_directory,
					'--ca-key-path', str(Path(ca_directory) / 'xyz.key.pem'),
					'--features', str(node_features.value)  # TODO: move to configuration
				])

				# Assert: spot check all expected files were created
				output_files = sorted(str(path)[len(output_directory):] for path in Path(output_directory).glob('**/*'))
				assert expected_output_files == output_files

				ca_files = sorted(str(path)[len(ca_directory):] for path in Path(ca_directory).glob('**/*'))
				assert ['/xyz.key.pem'] == ca_files


async def test_can_prepare_peer_node(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_node(server, NodeFeatures.HARVESTER, [
		'/data',
		'/docker-compose.yaml',
		'/keys',
		'/keys/cert',
		'/keys/cert/ca.crt.pem',
		'/keys/cert/ca.pubkey.pem',
		'/keys/cert/node.crt.pem',
		'/keys/cert/node.full.crt.pem',
		'/keys/cert/node.key.pem',
		'/keys/remote.pem',
		'/keys/vrf.pem',
		'/linking_transaction.dat',
		'/logs',
		'/resources',
		'/resources/config-extensions-recovery.properties',
		'/resources/config-extensions-server.properties',
		'/resources/config-finalization.properties',
		'/resources/config-harvesting.properties',
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
	])


async def test_can_prepare_peer_voter_node(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_node(server, NodeFeatures.HARVESTER | NodeFeatures.VOTER, [
		'/data',
		'/docker-compose.yaml',
		'/keys',
		'/keys/cert',
		'/keys/cert/ca.crt.pem',
		'/keys/cert/ca.pubkey.pem',
		'/keys/cert/node.crt.pem',
		'/keys/cert/node.full.crt.pem',
		'/keys/cert/node.key.pem',
		'/keys/remote.pem',
		'/keys/voting',
		'/keys/voting/private_key_tree1.dat',
		'/keys/vrf.pem',
		'/linking_transaction.dat',
		'/logs',
		'/resources',
		'/resources/config-extensions-recovery.properties',
		'/resources/config-extensions-server.properties',
		'/resources/config-finalization.properties',
		'/resources/config-harvesting.properties',
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
	])


async def test_can_prepare_dual_node(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_node(server, NodeFeatures.API | NodeFeatures.HARVESTER, [
		'/data',
		'/dbdata',
		'/docker-compose.yaml',
		'/keys',
		'/keys/cert',
		'/keys/cert/ca.crt.pem',
		'/keys/cert/ca.pubkey.pem',
		'/keys/cert/node.crt.pem',
		'/keys/cert/node.full.crt.pem',
		'/keys/cert/node.key.pem',
		'/keys/remote.pem',
		'/keys/vrf.pem',
		'/linking_transaction.dat',
		'/logs',
		'/mongo',
		'/mongo/mongoDbPrepare.js',
		'/resources',
		'/resources/config-database.properties',
		'/resources/config-extensions-broker.properties',
		'/resources/config-extensions-recovery.properties',
		'/resources/config-extensions-server.properties',
		'/resources/config-finalization.properties',
		'/resources/config-harvesting.properties',
		'/resources/config-inflation.properties',
		'/resources/config-logging-broker.properties',
		'/resources/config-logging-recovery.properties',
		'/resources/config-logging-server.properties',
		'/resources/config-messaging.properties',
		'/resources/config-network.properties',
		'/resources/config-node.properties',
		'/resources/config-pt.properties',
		'/resources/config-task.properties',
		'/resources/config-timesync.properties',
		'/resources/config-user.properties',
		'/resources/peers-api.json',
		'/resources/peers-p2p.json',
		'/seed',
		'/seed/index.dat',
		'/startup',
		'/startup/delayrestapi.sh',
		'/startup/mongors.sh',
		'/startup/rest.json',
		'/startup/startBroker.sh',
		'/startup/startServer.sh',
		'/startup/wait.sh'
	])


async def test_can_prepare_dual_voter_node(server):  # pylint: disable=redefined-outer-name
	await _assert_can_prepare_node(server, NodeFeatures.API | NodeFeatures.HARVESTER | NodeFeatures.VOTER, [
		'/data',
		'/dbdata',
		'/docker-compose.yaml',
		'/keys',
		'/keys/cert',
		'/keys/cert/ca.crt.pem',
		'/keys/cert/ca.pubkey.pem',
		'/keys/cert/node.crt.pem',
		'/keys/cert/node.full.crt.pem',
		'/keys/cert/node.key.pem',
		'/keys/remote.pem',
		'/keys/voting',
		'/keys/voting/private_key_tree1.dat',
		'/keys/vrf.pem',
		'/linking_transaction.dat',
		'/logs',
		'/mongo',
		'/mongo/mongoDbPrepare.js',
		'/resources',
		'/resources/config-database.properties',
		'/resources/config-extensions-broker.properties',
		'/resources/config-extensions-recovery.properties',
		'/resources/config-extensions-server.properties',
		'/resources/config-finalization.properties',
		'/resources/config-harvesting.properties',
		'/resources/config-inflation.properties',
		'/resources/config-logging-broker.properties',
		'/resources/config-logging-recovery.properties',
		'/resources/config-logging-server.properties',
		'/resources/config-messaging.properties',
		'/resources/config-network.properties',
		'/resources/config-node.properties',
		'/resources/config-pt.properties',
		'/resources/config-task.properties',
		'/resources/config-timesync.properties',
		'/resources/config-user.properties',
		'/resources/peers-api.json',
		'/resources/peers-p2p.json',
		'/seed',
		'/seed/index.dat',
		'/startup',
		'/startup/delayrestapi.sh',
		'/startup/mongors.sh',
		'/startup/rest.json',
		'/startup/startBroker.sh',
		'/startup/startServer.sh',
		'/startup/wait.sh'
	])
