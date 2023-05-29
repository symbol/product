import json
import tempfile
from collections import namedtuple
from pathlib import Path

from websockets.server import serve

from shoestring.healthagents.websockets import should_run, validate
from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.ShoestringConfiguration import NodeConfiguration

from ..test.LogTestUtils import LogLevel, assert_max_log_level, assert_message_is_logged

WEBSOCKET_PORT = 9876


# pylint: disable=invalid-name


# region should_run

def test_should_run_for_api_role():
	# Act + Assert:
	assert should_run(NodeConfiguration(NodeFeatures.API, *([None] * 6)))

	for features in (NodeFeatures.PEER, NodeFeatures.HARVESTER, NodeFeatures.VOTER):
		assert not should_run(NodeConfiguration(features, *([None] * 6))), str(features)

# endregion


# region validate

def _create_server_emulator(response_topic='block'):
	async def emulate_server(websocket):
		await websocket.send('{"uid": 1234}')
		async for message in websocket:
			message_json = json.loads(message)

			if 1234 == message_json['uid']:
				await websocket.send(f'{{"topic": "{response_topic}", "data": {{ "block": {{ "height": "9876" }} }} }}')

	return emulate_server


def _write_resources(directory, block_generation_target_time):
	with open(Path(directory) / 'config-network.properties', 'wt', encoding='utf8') as outfile:
		outfile.write('\n'.join([
			'[chain]',
			'',
			f'blockGenerationTargetTime = {block_generation_target_time}'
		]))


async def _dispatch_validate(resources_directory):
	# Arrange:
	HealthAgentContext = namedtuple('HealthAgentContext', ['websocket_endpoint', 'config_manager'])
	context = HealthAgentContext(f'ws://localhost:{WEBSOCKET_PORT}/ws', ConfigurationManager(resources_directory))

	# Act:
	await validate(context)


async def test_validate_passes_when_websocket_responds_with_block_topic_payload(caplog):
	# Arrange: start websocket server and prepare resources
	async with serve(_create_server_emulator(), 'localhost', 9876):
		with tempfile.TemporaryDirectory() as resources_directory:
			_write_resources(resources_directory, '5s')

			# Act:
			await _dispatch_validate(resources_directory)

			# Assert:
			assert_message_is_logged('websocket received a block with height 9876', caplog)
			assert_max_log_level(LogLevel.INFO, caplog)


async def test_validate_fails_when_websocket_responds_with_other_topic_payload(caplog):
	# Arrange: start websocket server - configured to return wrong topic - and prepare resources
	async with serve(_create_server_emulator('confirmedAdded'), 'localhost', 9876):
		with tempfile.TemporaryDirectory() as resources_directory:
			_write_resources(resources_directory, '5s')

			# Act:
			await _dispatch_validate(resources_directory)

			# Assert:
			assert_message_is_logged('received a message but it has wrong topic \'confirmedAdded\'', caplog)
			assert_max_log_level(LogLevel.ERROR, caplog)


async def test_validate_fails_when_websocket_times_out(caplog):
	# Arrange: start websocket server and prepare resources with 0s timeout
	async with serve(_create_server_emulator(), 'localhost', 9876):
		with tempfile.TemporaryDirectory() as resources_directory:
			_write_resources(resources_directory, '0s')

			# Act:
			await _dispatch_validate(resources_directory)

			# Assert:
			assert_message_is_logged('timeout when waiting for a block, this might indicate a problem between broker <-> REST', caplog)
			assert_max_log_level(LogLevel.ERROR, caplog)

# endregion
