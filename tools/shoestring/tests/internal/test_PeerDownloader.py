import json
import tempfile
from pathlib import Path

import pytest

from shoestring.internal.PeerDownloader import download_peers, load_api_endpoints

from ..test.MockNodewatchServer import setup_mock_nodewatch_server

# region server fixture


@pytest.fixture
def nodewatch_server(event_loop, aiohttp_client):
	return setup_mock_nodewatch_server(event_loop, aiohttp_client)

# endregion


# pylint: disable=invalid-name


# region download_peers

def _assert_peers_file_contents(filepath, expected_description, expected_public_keys):
	with open(filepath, 'rt', encoding='utf8') as infile:
		peers = json.loads(infile.read())
		assert 2 == len(peers)
		assert peers['_info'] == expected_description

		assert len(expected_public_keys) == len(peers['knownPeers'])
		public_keys = sorted([node['publicKey'] for node in peers['knownPeers']])
		assert expected_public_keys == public_keys


async def test_can_download_peers_for_peer_node(nodewatch_server):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory_name:
		output_directory = Path(output_directory_name)

		# Act:
		endpoints = await download_peers(nodewatch_server.make_url(''), output_directory, False, min_balance=98.995728)

		# Assert: only peer nodes were downloaded
		assert [
			f'{nodewatch_server.make_url("")}/api/symbol/nodes/peer'
		] == nodewatch_server.mock.urls

		# - check generated files
		generated_files = list(path.name for path in output_directory.iterdir())
		assert ['peers-p2p.json'] == generated_files

		_assert_peers_file_contents(
			output_directory / 'peers-p2p.json',
			'this file contains a list of p2p peers and can be shared',
			[
				'3DC99526E1149E3D2581563B2C7A963908A1A0044509240F139A86331C986884',
				'776B597C1C80782224A3DA9A19FD5D23A3281CF866B9F4720A4414568447A92A',
				'D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA'
			])

		# - check returned api endpoints
		assert [
			'http://ik1-432-48199.vs.sakura.ne.jp:3333',
			'http://wolf.importance.jp:3000'
		] == sorted(endpoints)


async def test_can_download_peers_for_api_node(nodewatch_server):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory_name:
		output_directory = Path(output_directory_name)

		# Act:
		endpoints = await download_peers(nodewatch_server.make_url(''), output_directory, True, min_balance=98.995728)

		# Assert: peer and api nodes were downloaded
		assert [
			f'{nodewatch_server.make_url("")}/api/symbol/nodes/peer',
			f'{nodewatch_server.make_url("")}/api/symbol/nodes/api'
		] == nodewatch_server.mock.urls

		# - check generated files
		generated_files = sorted(list(path.name for path in output_directory.iterdir()))
		assert ['peers-api.json', 'peers-p2p.json'] == generated_files

		_assert_peers_file_contents(
			output_directory / 'peers-p2p.json',
			'this file contains a list of p2p peers and can be shared',
			[
				'3DC99526E1149E3D2581563B2C7A963908A1A0044509240F139A86331C986884',
				'776B597C1C80782224A3DA9A19FD5D23A3281CF866B9F4720A4414568447A92A',
				'D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA'
			])

		_assert_peers_file_contents(
			output_directory / 'peers-api.json',
			'this file contains a list of api peers and can be shared',
			[
				'529BF60BB1011FCAE51C8D798E23224ACBA29D18B5054830F83E4E8E9A3BE526',
				'776B597C1C80782224A3DA9A19FD5D23A3281CF866B9F4720A4414568447A92A',
				'D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA'
			])

		assert [
			'http://ik1-432-48199.vs.sakura.ne.jp:3333',
			'http://symbol.harvest-monitor.com:3000',
			'http://wolf.importance.jp:3000'
		] == sorted(endpoints)

# endregion


# region load_api_endpoints

async def test_can_load_api_endpoints_from_peer_file(nodewatch_server):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory_name:
		output_directory = Path(output_directory_name)
		await download_peers(nodewatch_server.make_url(''), output_directory, False, min_balance=98.995728)

		# Act:
		api_endpoints = load_api_endpoints(output_directory)

		# Assert:
		assert [
			'http://ik1-432-48199.vs.sakura.ne.jp:3333',
			'http://wolf.importance.jp:3000'
		] == sorted(api_endpoints)


async def test_can_load_api_endpoints_from_peer_and_api_files(nodewatch_server):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory_name:
		output_directory = Path(output_directory_name)
		await download_peers(nodewatch_server.make_url(''), output_directory, True, min_balance=98.995728)

		# Act:
		api_endpoints = load_api_endpoints(output_directory)

		# Assert:
		assert [
			'http://ik1-432-48199.vs.sakura.ne.jp:3333',
			'http://symbol.harvest-monitor.com:3000',
			'http://wolf.importance.jp:3000'
		] == sorted(api_endpoints)


def _strip_api_port_property(peers_filepath):
	with open(peers_filepath, 'rt', encoding='utf8') as infile:
		peers_json = json.loads(infile.read())
		for node_json in peers_json['knownPeers']:
			if 'api_port' in node_json['endpoint']:
				del node_json['endpoint']['api_port']

		with open(peers_filepath, 'wt', encoding='utf8') as outfile:
			json.dump(peers_json, outfile, indent=2)


async def test_can_load_api_endpoints_when_api_port_is_implicit(nodewatch_server):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory_name:
		output_directory = Path(output_directory_name)
		await download_peers(nodewatch_server.make_url(''), output_directory, True, min_balance=98.995728)

		# - drop optional api_port property to emulate original format, which assumes 3000 port
		for name in ('p2p', 'api'):
			_strip_api_port_property(output_directory / f'peers-{name}.json')

		# Act:
		api_endpoints = load_api_endpoints(output_directory)

		# Assert:
		assert [
			'http://ik1-432-48199.vs.sakura.ne.jp:3000',
			'http://symbol.harvest-monitor.com:3000',
			'http://wolf.importance.jp:3000'
		] == sorted(api_endpoints)

# endregion
