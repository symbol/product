import json
from collections import namedtuple

import pytest
from aiohttp import web

from shoestring.healthagents.rest_api import should_run, validate
from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.ShoestringConfiguration import NodeConfiguration

from ..test.LogTestUtils import LogLevel, assert_max_log_level, assert_message_is_logged

# region (REST) server fixture


@pytest.fixture
def server(event_loop, aiohttp_client):
	class MockSymbolServer:
		async def chain_info(self, request):
			return await self._process(request, {
				'height': '1234',
				'scoreHigh': '888999',
				'scoreLow': '222111',
				'latestFinalizedBlock': {
					'finalizationEpoch': 222,
					'finalizationPoint': 10,
					'height': '1198',
					'hash': 'C49C566E4CF60856BC127C9E4748C89E3D38566DE0DAFE1A491012CC27A1C043'
				}
			})

		@staticmethod
		async def _process(_, response_body):
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'})

	# create a mock server
	mock_server = MockSymbolServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/chain/info', mock_server.chain_info)
	server_kwargs = {}
	server = event_loop.run_until_complete(aiohttp_client(app, server_kwargs=server_kwargs))  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server

# endregion


# pylint: disable=invalid-name


# region should_run

def test_should_run_for_api_role():
	# Act + Assert:
	assert should_run(NodeConfiguration(NodeFeatures.API, *([None] * 6)))

	for features in (NodeFeatures.PEER, NodeFeatures.HARVESTER, NodeFeatures.VOTER):
		assert not should_run(NodeConfiguration(features, *([None] * 6))), str(features)

# endregion


# region validate

async def _dispatch_validate(port):
	# Arrange:
	HealthAgentContext = namedtuple('HealthAgentContext', ['rest_endpoint'])
	context = HealthAgentContext(f'http://localhost:{port}')

	# Act:
	await validate(context)


async def test_validate_passes_when_node_is_available_without_https(server, caplog):  # pylint: disable=redefined-outer-name
	# Act:
	await _dispatch_validate(server.port)

	# Assert:
	assert_message_is_logged('REST API accessible, height = 1234', caplog)
	assert_max_log_level(LogLevel.INFO, caplog)


async def test_validate_fails_when_node_is_offline(server, caplog):  # pylint: disable=redefined-outer-name
	# Act:
	await _dispatch_validate(server.port + 1)

	# Assert:
	assert_message_is_logged(f'cannot access REST API at http://localhost:{server.port + 1}', caplog)
	assert_max_log_level(LogLevel.ERROR, caplog)

# endregion
