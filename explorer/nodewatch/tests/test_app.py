# pylint: disable=invalid-name


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
	assert 5 == len(response_json)
	assert [
		'Apple', 'Shin-Kuma-Node', 'ibone74', 'jaguar', 'symbol.ooo maxUnlockedAccounts:100'
	] == list(map(lambda descriptor: descriptor['name'], response_json))


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
	assert 4 == len(chart_json['data'])
	assert re.match(r'\d\d:\d\d', response_json['lastRefreshTime'])

# endregion
