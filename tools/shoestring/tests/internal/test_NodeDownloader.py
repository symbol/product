from functools import reduce

import pytest

from shoestring.internal.NodeDownloader import NodeDownloader

from ..test.MockNodewatchServer import setup_mock_nodewatch_server

# region server fixture


@pytest.fixture
def server(event_loop, aiohttp_client):
	return setup_mock_nodewatch_server(event_loop, aiohttp_client)

# endregion


# pylint: disable=invalid-name

# region download

async def test_can_download_peer_nodes(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	downloader = NodeDownloader(server.make_url(''))

	# Act:
	await downloader.download_peer_nodes()

	# Assert:
	assert [f'{server.make_url("")}/api/symbol/nodes/peer'] == server.mock.urls
	assert 5 == len(downloader.nodes)
	assert [
		'', '! symplanet2', 'Thank you !', 'The Wolf Farm owned by Tresto(@TrendStream)', '! symplanet1'
	] == [node['name'] for node in downloader.nodes]


async def test_can_download_api_nodes(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	downloader = NodeDownloader(server.make_url(''))

	# Act:
	await downloader.download_api_nodes()

	# Assert:
	assert [f'{server.make_url("")}/api/symbol/nodes/api'] == server.mock.urls
	assert 2 == len(downloader.nodes)
	assert ['150C8CE', '3E8846B'] == [node['name'] for node in downloader.nodes]

# endregion


# region select_[peer|api]_nodes

async def _create_downloader_with_nodes(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	downloader = NodeDownloader(server.make_url(''))
	await downloader.download_peer_nodes()
	await downloader.download_api_nodes()

	# Sanity:
	assert [
		f'{server.make_url("")}/api/symbol/nodes/peer',
		f'{server.make_url("")}/api/symbol/nodes/api'
	] == server.mock.urls
	return downloader


async def test_can_select_peer_nodes_with_endpoint(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	downloader = await _create_downloader_with_nodes(server)

	# Act:
	nodes = downloader.select_peer_nodes()
	nodes.sort(key=lambda node: node['publicKey'])

	# Assert:
	assert [
		{
			'publicKey': '3DC99526E1149E3D2581563B2C7A963908A1A0044509240F139A86331C986884',
			'endpoint': {'host': '149.102.132.10', 'port': 7900},
			'metadata': {'name': '! symplanet1', 'roles': 'Peer,Voting'}
		},
		{
			'publicKey': '50C16D3DAA2A708E3781ED201F15AEF23F0B3989584DF832284A67F14372B104',
			'endpoint': {'host': '0-0-5symbol.open-nodes.com', 'port': 7900},
			'metadata': {'name': 'Thank you !', 'roles': 'Peer,Api,Voting'}
		},
		{
			'publicKey': '776B597C1C80782224A3DA9A19FD5D23A3281CF866B9F4720A4414568447A92A',
			'endpoint': {'host': 'ik1-432-48199.vs.sakura.ne.jp', 'port': 7900},
			'metadata': {'name': '', 'roles': 'Peer,Api'}
		},
		{
			'publicKey': 'D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA',
			'endpoint': {'host': 'wolf.importance.jp', 'port': 7900},
			'metadata': {'name': 'The Wolf Farm owned by Tresto(@TrendStream)', 'roles': 'Peer,Api'}
		}
	] == nodes


async def test_can_select_api_nodes_with_endpoint(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	downloader = await _create_downloader_with_nodes(server)

	# Act:
	nodes = downloader.select_api_nodes()
	nodes.sort(key=lambda node: node['publicKey'])

	# Assert:
	assert [
		{
			'publicKey': '50C16D3DAA2A708E3781ED201F15AEF23F0B3989584DF832284A67F14372B104',
			'endpoint': {'host': '0-0-5symbol.open-nodes.com', 'port': 7900},
			'metadata': {'name': 'Thank you !', 'roles': 'Peer,Api,Voting'}
		},
		{
			'publicKey': '529BF60BB1011FCAE51C8D798E23224ACBA29D18B5054830F83E4E8E9A3BE526',
			'endpoint': {'host': 'symbol.harvest-monitor.com', 'port': 7900},
			'metadata': {'name': '150C8CE', 'roles': 'Api'}
		},
		{
			'publicKey': '776B597C1C80782224A3DA9A19FD5D23A3281CF866B9F4720A4414568447A92A',
			'endpoint': {'host': 'ik1-432-48199.vs.sakura.ne.jp', 'port': 7900},
			'metadata': {'name': '', 'roles': 'Peer,Api'}
		},
		{
			'publicKey': 'D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA',
			'endpoint': {'host': 'wolf.importance.jp', 'port': 7900},
			'metadata': {'name': 'The Wolf Farm owned by Tresto(@TrendStream)', 'roles': 'Peer,Api'}
		}
	] == nodes


async def test_can_filter_selected_peer_nodes_by_min_balance(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	downloader = await _create_downloader_with_nodes(server)
	downloader.min_balance = 98.995728

	# Act:
	nodes = downloader.select_peer_nodes()
	nodes.sort(key=lambda node: node['publicKey'])

	# Assert:
	assert [
		{
			'publicKey': '3DC99526E1149E3D2581563B2C7A963908A1A0044509240F139A86331C986884',
			'endpoint': {'host': '149.102.132.10', 'port': 7900},
			'metadata': {'name': '! symplanet1', 'roles': 'Peer,Voting'}
		},
		{
			'publicKey': '776B597C1C80782224A3DA9A19FD5D23A3281CF866B9F4720A4414568447A92A',
			'endpoint': {'host': 'ik1-432-48199.vs.sakura.ne.jp', 'port': 7900},
			'metadata': {'name': '', 'roles': 'Peer,Api'}
		},
		{
			'publicKey': 'D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA',
			'endpoint': {'host': 'wolf.importance.jp', 'port': 7900},
			'metadata': {'name': 'The Wolf Farm owned by Tresto(@TrendStream)', 'roles': 'Peer,Api'}
		}
	] == nodes


async def test_can_filter_selected_api_nodes_by_min_balance(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	downloader = await _create_downloader_with_nodes(server)
	downloader.min_balance = 98.995728

	# Act:
	nodes = downloader.select_api_nodes()
	nodes.sort(key=lambda node: node['publicKey'])

	# Assert:
	assert [
		{
			'publicKey': '529BF60BB1011FCAE51C8D798E23224ACBA29D18B5054830F83E4E8E9A3BE526',
			'endpoint': {'host': 'symbol.harvest-monitor.com', 'port': 7900},
			'metadata': {'name': '150C8CE', 'roles': 'Api'}
		},
		{
			'publicKey': '776B597C1C80782224A3DA9A19FD5D23A3281CF866B9F4720A4414568447A92A',
			'endpoint': {'host': 'ik1-432-48199.vs.sakura.ne.jp', 'port': 7900},
			'metadata': {'name': '', 'roles': 'Peer,Api'}
		},
		{
			'publicKey': 'D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA',
			'endpoint': {'host': 'wolf.importance.jp', 'port': 7900},
			'metadata': {'name': 'The Wolf Farm owned by Tresto(@TrendStream)', 'roles': 'Peer,Api'}
		}
	] == nodes


async def test_can_limit_selected_peer_nodes(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	downloader = await _create_downloader_with_nodes(server)
	downloader.max_output_nodes = 2

	# Act:
	nodes = downloader.select_peer_nodes()
	node_public_keys = set(node['publicKey'] for node in nodes)

	# Assert:
	assert 2 == len(nodes)
	expected_public_keys = [
		'3DC99526E1149E3D2581563B2C7A963908A1A0044509240F139A86331C986884',
		'50C16D3DAA2A708E3781ED201F15AEF23F0B3989584DF832284A67F14372B104',
		'776B597C1C80782224A3DA9A19FD5D23A3281CF866B9F4720A4414568447A92A',
		'D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA'
	]
	matching_public_key_count = reduce(
		lambda total, public_key: total + (1 if public_key in node_public_keys else 0),
		expected_public_keys,
		0)
	assert 2 == matching_public_key_count


async def test_can_limit_selected_api_nodes(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	downloader = await _create_downloader_with_nodes(server)
	downloader.max_output_nodes = 2

	# Act:
	nodes = downloader.select_api_nodes()
	node_public_keys = set(node['publicKey'] for node in nodes)

	# Assert:
	assert 2 == len(nodes)
	expected_public_keys = [
		'50C16D3DAA2A708E3781ED201F15AEF23F0B3989584DF832284A67F14372B104',
		'529BF60BB1011FCAE51C8D798E23224ACBA29D18B5054830F83E4E8E9A3BE526',
		'776B597C1C80782224A3DA9A19FD5D23A3281CF866B9F4720A4414568447A92A',
		'D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA'
	]
	matching_public_key_count = reduce(
		lambda total, public_key: total + (1 if public_key in node_public_keys else 0),
		expected_public_keys,
		0)
	assert 2 == matching_public_key_count

# endregion


# region select_api_endpoints

async def test_can_select_api_endpoints(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	downloader = await _create_downloader_with_nodes(server)

	# Act:
	endpoints = downloader.select_api_endpoints()
	endpoints.sort()

	# Assert:
	assert [
		'http://0-0-5symbol.open-nodes.com:3000',
		'http://ik1-432-48199.vs.sakura.ne.jp:3000',
		'http://symbol.harvest-monitor.com:3000',
		'http://wolf.importance.jp:3000'
	] == endpoints


async def test_can_filter_selected_api_endpoints_by_min_balance(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	downloader = await _create_downloader_with_nodes(server)
	downloader.min_balance = 98.995728

	# Act:
	endpoints = downloader.select_api_endpoints()
	endpoints.sort()

	# Assert:
	assert [
		'http://ik1-432-48199.vs.sakura.ne.jp:3000',
		'http://symbol.harvest-monitor.com:3000',
		'http://wolf.importance.jp:3000'
	] == endpoints


async def test_can_limit_selected_api_endpoints(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	downloader = await _create_downloader_with_nodes(server)
	downloader.max_output_nodes = 2

	# Act:
	endpoints = downloader.select_api_endpoints()

	# Assert:
	assert 2 == len(endpoints)
	expected_endpoints = [
		'http://0-0-5symbol.open-nodes.com:3000',
		'http://ik1-432-48199.vs.sakura.ne.jp:3000',
		'http://symbol.harvest-monitor.com:3000',
		'http://wolf.importance.jp:3000'
	]
	matching_endpoint_count = reduce(
		lambda total, endpoint: total + (1 if endpoint in endpoints else 0),
		expected_endpoints,
		0)
	assert 2 == matching_endpoint_count

# endregion
