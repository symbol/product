import json
import os
import re
import tempfile
from pathlib import Path

import pytest

from nodewatch import create_app

# region fixtures


@pytest.fixture
def app():
	with tempfile.TemporaryDirectory() as temp_directory:
		config_filename = Path(temp_directory) / 'config'
		with open(config_filename, 'wt', encoding='utf8') as config_file:
			print(f'creating config file {config_filename}...')
			config_file.write('RESOURCES_PATH="tests/resources"\n')
			config_file.write('MIN_HEIGHT_CLUSTER_SIZE=1\n')  # needed due to small test data
			config_file.write('SYMBOL_EXPLORER_ENDPOINT="<symbol_explorer>"\n')
			config_file.write('NEM_EXPLORER_ENDPOINT="<nem_explorer>"\n')
			config_file.flush()

			temp_file_path = config_filename.resolve()
			os.environ['NODEWATCH_SETTINGS'] = str(temp_file_path)
			return create_app()


@pytest.fixture
def client(app):  # pylint: disable=redefined-outer-name
	return app.test_client()

# endregion


# pylint: disable=invalid-name


# region redirect

def test_redirect_root_to_symbol_summary(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/')
	response_html = str(response.data)

	# Assert:
	assert 302 == response.status_code
	assert 'text/html; charset=utf-8' == response.headers['Content-Type']
	assert 'target URL: <a href="/symbol/summary">/symbol/summary</a>.' in response_html

# endregion


# region nodes [html]

def _assert_nodes_table(response, expected_title, expected_node_names):
	response_html = str(response.data)

	assert 200 == response.status_code
	assert 'text/html; charset=utf-8' == response.headers['Content-Type']
	assert f'<title>Seven Seas Explorer - \\n{expected_title}\\n</title>' in response_html

	for name in expected_node_names:
		assert f'<span class="bbcode">{name}</span>' in response_html


def test_get_nem_harvesters(client):  # pylint: disable=redefined-outer-name
	_assert_nodes_table(client.get('/nem/harvesters'), 'NEM Recent Harvesters', ['Allnodes21', 'TIME', '', 'Hi, I am Alice7'])


def test_get_nem_nodes(client):  # pylint: disable=redefined-outer-name
	_assert_nodes_table(client.get('/nem/nodes'), 'NEM Nodes', ['August', '[c=#e9c086]jusan[/c]', 'cobalt', 'silicon'])


def test_get_symbol_harvesters(client):  # pylint: disable=redefined-outer-name
	_assert_nodes_table(client.get('/symbol/harvesters'), 'Symbol Recent Harvesters', ['jaguar', '(Max50)SN1.MSUS', '', 'Allnodes900'])


def test_get_symbol_nodes(client):  # pylint: disable=redefined-outer-name
	_assert_nodes_table(client.get('/symbol/nodes'), 'Symbol Nodes', [
		'Allnodes250', 'Shin-Kuma-Node', 'ibone74', 'jaguar', 'symbol.ooo maxUnlockedAccounts:100'
	])


def test_get_symbol_voters(client):  # pylint: disable=redefined-outer-name
	_assert_nodes_table(client.get('/symbol/voters'), 'Symbol Voters', ['59026DB', 'Allnodes34'])

# endregion


# region summary [html]

def test_get_nem_summary(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/nem/summary')
	response_html = str(response.data)

	# Assert:
	assert 200 == response.status_code
	assert 'text/html; charset=utf-8' == response.headers['Content-Type']
	assert '<title>Seven Seas Explorer - \\nNEM Summary\\n</title>' in response_html

	assert '<div id=\\\'voting-power-chart\\\'' not in response_html
	for chart_id in ['height-chart', 'harvesting-power-chart', 'harvesting-count-chart', 'node-count-chart']:
		assert f'<div id=\\\'{chart_id}\\\'' in response_html


def test_get_symbol_summary(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/symbol/summary')
	response_html = str(response.data)

	# Assert:
	assert 200 == response.status_code
	assert 'text/html; charset=utf-8' == response.headers['Content-Type']
	assert '<title>Seven Seas Explorer - \\nSymbol Summary\\n</title>' in response_html

	for chart_id in ['voting-power-chart', 'height-chart', 'harvesting-power-chart', 'harvesting-count-chart', 'node-count-chart']:
		assert f'<div id=\\\'{chart_id}\\\'' in response_html

# endregion


# region api [json]

def test_get_api_nem_nodes(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/nem/nodes')
	response_json = json.loads(response.data)

	# Assert: spot check names
	assert 200 == response.status_code
	assert 'application/json' == response.headers['Content-Type']
	assert 4 == len(response_json)
	assert ['August', '[c=#e9c086]jusan[/c]', 'cobalt', 'silicon'] == list(map(lambda descriptor: descriptor['name'], response_json))


def test_get_api_nem_network_height(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/nem/height')
	response_json = json.loads(response.data)

	# Assert:
	assert 200 == response.status_code
	assert 'application/json' == response.headers['Content-Type']
	assert {'height': 3850057, 'finalizedHeight': 3850057 - 360} == response_json


def test_get_api_nem_network_height_chart(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/nem/chart/height')
	response_json = json.loads(response.data)
	chart_json = json.loads(response_json['chartJson'])

	# Assert:
	assert 200 == response.status_code
	assert 'application/json' == response.headers['Content-Type']
	assert 2 == len(response_json)
	assert 1 == len(chart_json['data'])
	assert re.match(r'\d\d:\d\d', response_json['lastRefreshTime'])


def test_get_api_symbol_nodes_api(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/symbol/nodes/api')
	response_json = json.loads(response.data)

	# Assert: spot check names
	assert 200 == response.status_code
	assert 'application/json' == response.headers['Content-Type']
	assert 1 == len(response_json)
	assert [
		'Allnodes250'
	] == list(map(lambda descriptor: descriptor['name'], response_json))


def test_get_api_symbol_nodes_peer(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/symbol/nodes/peer')
	response_json = json.loads(response.data)

	# Assert: spot check names
	assert 200 == response.status_code
	assert 'application/json' == response.headers['Content-Type']
	assert 7 == len(response_json)
	assert [
		'Apple', 'Shin-Kuma-Node', 'ibone74', 'jaguar', 'symbol.ooo maxUnlockedAccounts:100', 'xym pool', 'yasmine farm'
	] == list(map(lambda descriptor: descriptor['name'], response_json))


def test_get_api_symbol_nodes(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/symbol/nodes')
	response_json = json.loads(response.data)

	# Assert: spot check names
	assert 200 == response.status_code
	assert 'application/json' == response.headers['Content-Type']
	assert 8 == len(response_json)
	assert [
		'Allnodes250', 'Apple', 'Shin-Kuma-Node', 'ibone74', 'jaguar', 'symbol.ooo maxUnlockedAccounts:100', 'xym pool', 'yasmine farm'
	] == list(map(lambda descriptor: descriptor['name'], response_json))


def test_get_api_symbol_nodes_order_random(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/symbol/nodes?order=random')
	response_json = json.loads(response.data)

	# Assert: spot check names
	assert 200 == response.status_code
	assert 'application/json' == response.headers['Content-Type']
	assert 8 == len(response_json)
	expected_names = [
		'Allnodes250', 'Apple', 'Shin-Kuma-Node', 'ibone74', 'jaguar', 'symbol.ooo maxUnlockedAccounts:100', 'xym pool', 'yasmine farm'
	]
	actual_names = list(map(lambda descriptor: descriptor['name'], response_json))
	assert sorted(expected_names) == sorted(actual_names)


def test_get_api_symbol_nodes_limit_2(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/symbol/nodes?limit=2')
	response_json = json.loads(response.data)

	# Assert: spot check names
	assert 200 == response.status_code
	assert 'application/json' == response.headers['Content-Type']
	assert 2 == len(response_json)
	assert [
		'Allnodes250', 'Apple'
	] == list(map(lambda descriptor: descriptor['name'], response_json))


def test_get_api_symbol_nodes_ssl_true(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/symbol/nodes?ssl=true')
	response_json = json.loads(response.data)

	# Assert: spot check names
	assert 200 == response.status_code
	assert 'application/json' == response.headers['Content-Type']
	assert 1 == len(response_json)
	assert [
		'xym pool'
	] == list(map(lambda descriptor: descriptor['name'], response_json))


def test_get_api_symbol_nodes_ssl_false(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/symbol/nodes?ssl=false')
	response_json = json.loads(response.data)

	# Assert: spot check names
	assert 200 == response.status_code
	assert 'application/json' == response.headers['Content-Type']
	assert 1 == len(response_json)
	assert [
		'yasmine farm'
	] == list(map(lambda descriptor: descriptor['name'], response_json))


def test_get_api_symbol_node_with_main_public_key(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/symbol/nodes/mainPublicKey/A0AA48B6417BDB1845EB55FB0B1E13255EA8BD0D8FA29AD2D8A906E220571F21')
	response_json = json.loads(response.data)

	# Assert: spot check names
	assert 200 == response.status_code
	assert 'application/json' == response.headers['Content-Type']
	assert 'Allnodes250' == response_json['name']


def test_get_api_symbol_node_with_node_public_key(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/symbol/nodes/nodePublicKey/D05BE3101F2916AA34839DDC1199BE45092103A9B66172FA3D05911DC041AADA')
	response_json = json.loads(response.data)

	# Assert: spot check names
	assert 200 == response.status_code
	assert 'application/json' == response.headers['Content-Type']
	assert 'yasmine farm' == response_json['name']


def test_get_api_symbol_network_height(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/symbol/height')
	response_json = json.loads(response.data)

	# Assert:
	assert 200 == response.status_code
	assert 'application/json' == response.headers['Content-Type']
	assert {'height': 1486760, 'finalizedHeight': 1486740} == response_json


def test_get_api_symbol_network_height_chart(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/symbol/chart/height')
	response_json = json.loads(response.data)
	chart_json = json.loads(response_json['chartJson'])

	# Assert:
	assert 200 == response.status_code
	assert 'application/json' == response.headers['Content-Type']
	assert 2 == len(response_json)
	assert 6 == len(chart_json['data'])
	assert re.match(r'\d\d:\d\d', response_json['lastRefreshTime'])

# endregion
