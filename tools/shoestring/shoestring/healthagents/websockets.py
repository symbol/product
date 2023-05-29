import asyncio
import json

from websockets import connect  # pylint: disable=no-name-in-module,import-self
from zenlog import log

from shoestring.internal.ConfigurationManager import parse_time_span
from shoestring.internal.NodeFeatures import NodeFeatures

NAME = 'REST websockets'


def should_run(node_config):
	return NodeFeatures.API in node_config.features


async def validate(context):
	async with connect(context.websocket_endpoint) as websocket:
		# extract user id from connect response
		response_json = json.loads(await websocket.recv())
		user_id = response_json['uid']
		log.info(f'websocket connected to {context.websocket_endpoint}, subscribing and waiting for block')

		# subscribe to block messages
		subscribe_message = {'uid': user_id, 'subscribe': 'block'}
		await websocket.send(json.dumps(subscribe_message))

		# determine the target time
		raw_target_time = context.config_manager.lookup('config-network.properties', [('chain', 'blockGenerationTargetTime')])[0]
		target_time_ms = parse_time_span(raw_target_time)
		timeout_s = 2 * target_time_ms / 1000

		# wait for the next block message
		try:
			response_json = json.loads(await asyncio.wait_for(websocket.recv(), timeout=timeout_s))
			topic = response_json['topic']
			if 'block' == topic:
				height = int(response_json['data']['block']['height'])
				log.info(f'websocket received a block with height {height}')
			else:
				log.error(f'received a message but it has wrong topic \'{topic}\'')
		except asyncio.exceptions.TimeoutError:
			log.error('timeout when waiting for a block, this might indicate a problem between broker <-> REST')
