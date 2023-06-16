import tempfile
from pathlib import Path

from shoestring.__main__ import main
from shoestring.commands.health import HealthAgentContext
from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.Preparer import Preparer
from shoestring.internal.ShoestringConfiguration import ImportsConfiguration, NodeConfiguration, ShoestringConfiguration

from ..test.ConfigurationTestUtils import prepare_shoestring_configuration
from ..test.LogTestUtils import assert_all_messages_are_logged

# region HealthAgentContext


def _write_resources(directories, host, port, rest_port):
	with open(directories.resources / 'config-node.properties', 'wt', encoding='utf8') as outfile:
		outfile.write('\n'.join([
			'[node]',
			'',
			f'port = {port}',
			'',
			'[localnode]',
			'',
			f'host = {host}'
		]))

	with open(directories.userconfig / 'rest.json', 'wt', encoding='utf8') as outfile:
		outfile.write(f'{{"port": {rest_port}}}\n')


def _create_configuration(api_https):
	return ShoestringConfiguration(
		*(4 * [None]),
		ImportsConfiguration(None, None),
		NodeConfiguration(NodeFeatures.PEER, None, None, None, api_https, 'CA', 'NODE'))


# pylint: disable=invalid-name


def test_can_detect_endpoints_without_https():
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with Preparer(output_directory, _create_configuration(False)) as preparer:
			preparer.create_subdirectories()
			_write_resources(preparer.directories, 'symbol.fyi', 1111, 2345)

			# Act:
			context = HealthAgentContext(preparer.directories, preparer.config)

			# Assert:
			assert ('localhost', 1111) == context.peer_endpoint
			assert 'http://localhost:2345' == context.rest_endpoint
			assert 'ws://localhost:2345/ws' == context.websocket_endpoint


def test_can_detect_endpoints_with_https():
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with Preparer(output_directory, _create_configuration(True)) as preparer:
			preparer.create_subdirectories()
			_write_resources(preparer.directories, 'symbol.fyi', 1111, 2345)

			# Act:
			context = HealthAgentContext(preparer.directories, preparer.config)

			# Assert:
			assert ('localhost', 1111) == context.peer_endpoint
			assert 'https://symbol.fyi:3001' == context.rest_endpoint
			assert 'wss://symbol.fyi:3001/ws' == context.websocket_endpoint

# endregion


# region command

async def test_can_run_health_command(caplog):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with tempfile.TemporaryDirectory() as package_directory:
			with Preparer(output_directory, _create_configuration(False)) as preparer:
				preparer.create_subdirectories()
				preparer.generate_certificates(Path(output_directory) / 'ca.key.pem', require_ca=False)
				_write_resources(preparer.directories, 'symbol.fyi', 1111, 2345)

				config_filepath = prepare_shoestring_configuration(package_directory, NodeFeatures.PEER, '', api_https=False)

				# Act:
				await main([
					'health',
					'--config', str(config_filepath),
					'--directory', output_directory
				])

				# Assert:
				assert_all_messages_are_logged([
					'running health agent for peer certificate',
					'ca certificate not near expiry (7299 day(s))',
					'node certificate not near expiry (374 day(s))',
					'running health agent for peer API',
					'cannot access peer API at localhost on port 1111'
				], caplog)

# endregion
