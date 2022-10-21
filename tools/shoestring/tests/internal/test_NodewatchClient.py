import pytest

from shoestring.internal.NodewatchClient import NodewatchClient

from ..test.MockNodewatchServer import setup_mock_nodewatch_server

# region server fixture


@pytest.fixture
def server(event_loop, aiohttp_client):
	return setup_mock_nodewatch_server(event_loop, aiohttp_client)

# endregion


# pylint: disable=invalid-name

# region symbol_finalized_height

async def test_can_get_symbol_finalized_height(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = NodewatchClient(server.make_url(''))

	# Act:
	finalized_height = await client.symbol_finalized_height()

	# Assert:
	assert [f'{server.make_url("")}/api/symbol/height'] == server.mock.urls
	assert 2033136 == finalized_height

# endregion
