import tempfile
from pathlib import Path

import pytest

from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.NodewatchClient import NodewatchClient, get_current_finalization_epoch

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


# region symbol_finalized_height

async def test_can_get_current_finalization_epoch(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with open(Path(output_directory) / 'config-network.properties', 'wt', encoding='utf8') as outfile:
			outfile.write('\n'.join([
				'[chain]',
				'',
				'votingSetGrouping = 720'
			]))

		# Act:
		current_finalization_epoch = await get_current_finalization_epoch(server.make_url(''), ConfigurationManager(output_directory))

		# Assert:
		assert [f'{server.make_url("")}/api/symbol/height'] == server.mock.urls
		assert 2825 == current_finalization_epoch  # 1 + ceil(2033136 / 720) = 2825

# endregion
