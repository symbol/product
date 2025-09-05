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


# region api

def test_get_api_openapi(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/openapi')
	response_html = str(response.data)

	# Assert: spot check names
	assert 200 == response.status_code
	assert 'text/html; charset=utf-8' == response.headers['Content-Type']
	assert '<title>NodeWatch API Documentation</title>' in response_html
	assert 'url: "/static/openapi/openapi.yaml"' in response_html


def _assert_response_status_code_and_headers(response, expected_status_code):
	assert expected_status_code == response.status_code
	assert 'application/json' == response.headers['Content-Type']
	assert response.headers['Access-Control-Allow-Origin'] == '*'


def test_get_api_nem_nodes(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/nem/nodes')
	response_json = json.loads(response.data)

	# Assert: spot check names
	_assert_response_status_code_and_headers(response, 200)
	assert 4 == len(response_json)
	assert ['August', '[c=#e9c086]jusan[/c]', 'cobalt', 'silicon'] == list(map(lambda descriptor: descriptor['name'], response_json))


def test_get_api_nem_network_height(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/nem/height')
	response_json = json.loads(response.data)

	# Assert:
	_assert_response_status_code_and_headers(response, 200)
	assert {'height': 3850057, 'finalizedHeight': 3850057 - 360} == response_json


def test_get_api_nem_network_height_chart(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/nem/chart/height')
	response_json = json.loads(response.data)
	chart_json = json.loads(response_json['chartJson'])

	# Assert:
	_assert_response_status_code_and_headers(response, 200)
	assert 2 == len(response_json)
	assert 1 == len(chart_json['data'])
	assert re.match(r'\d\d:\d\d', response_json['lastRefreshTime'])


def _assert_get_nodes_count(response, expected_count):
	# Act:
	response_json = json.loads(response.data)

	# Assert:
	_assert_response_status_code_and_headers(response, 200)
	assert expected_count == len(response_json)


def test_get_api_nem_nodes_count(client):  # pylint: disable=redefined-outer-name
	_assert_get_nodes_count(client.get('/api/nem/nodes/count'), 2)


def _assert_get_api_nodes(response, expected_node_names):
	# Act:
	response_json = json.loads(response.data)

	# Assert: spot check names
	_assert_response_status_code_and_headers(response, 200)
	assert len(expected_node_names) == len(response_json)
	assert expected_node_names == list(map(lambda descriptor: descriptor['name'], response_json))


def test_get_api_symbol_nodes_api(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nodes(client.get('/api/symbol/nodes/api'), ['Allnodes250'])


def test_get_api_symbol_nodes_peer(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nodes(
		client.get('/api/symbol/nodes/peer'),
		['Apple', 'Shin-Kuma-Node', 'ibone74', 'jaguar', 'symbol.ooo maxUnlockedAccounts:100']
	)


def test_get_api_symbol_nodes_peer_with_only_ssl(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nodes(client.get('/api/symbol/nodes/peer?only_ssl'), ['ibone74'])


def test_get_api_symbol_nodes_peer_with_only_ssl_true(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nodes(client.get('/api/symbol/nodes/peer?only_ssl=true'), ['ibone74'])


def test_get_api_symbol_nodes_peer_with_only_ssl_false(client):  # pylint: disable=redefined-outer-name
	_assert_get_api_nodes(
		client.get('/api/symbol/nodes/peer?only_ssl=false'),
		['Apple', 'Shin-Kuma-Node', 'ibone74', 'jaguar', 'symbol.ooo maxUnlockedAccounts:100']
	)


def test_get_api_symbol_network_height(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/symbol/height')
	response_json = json.loads(response.data)

	# Assert:
	_assert_response_status_code_and_headers(response, 200)
	assert {'height': 1486760, 'finalizedHeight': 1486740} == response_json


def test_get_api_symbol_network_height_chart(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/api/symbol/chart/height')
	response_json = json.loads(response.data)
	chart_json = json.loads(response_json['chartJson'])

	# Assert:
	_assert_response_status_code_and_headers(response, 200)
	assert 2 == len(response_json)
	assert 4 == len(chart_json['data'])
	assert re.match(r'\d\d:\d\d', response_json['lastRefreshTime'])


def _assert_api_symbol_node_with_public_key_not_found(response):
	# Act:
	response_json = json.loads(response.data)

	# Assert:
	_assert_response_status_code_and_headers(response, 404)
	assert response_json == {'message': 'Resource not found', 'status': 404}


def _assert_api_symbol_node_with_invalid_public_key(response):
	# Act:
	response_json = json.loads(response.data)

	# Assert:
	_assert_response_status_code_and_headers(response, 400)
	assert response_json == {'message': 'Bad request', 'status': 400}


def _assert_api_symbol_node_with_public_key_found(response, expected_name):
	# Act:
	response_json = json.loads(response.data)

	# Assert: spot check names
	_assert_response_status_code_and_headers(response, 200)
	assert expected_name == response_json['name']


def test_get_api_symbol_node_with_invalid_main_public_key(client):  # pylint: disable=redefined-outer-name
	_assert_api_symbol_node_with_invalid_public_key(client.get('/api/symbol/nodes/mainPublicKey/invalid'))


def test_get_api_symbol_node_with_invalid_node_public_key(client):  # pylint: disable=redefined-outer-name
	_assert_api_symbol_node_with_invalid_public_key(client.get('/api/symbol/nodes/nodePublicKey/invalid'))


def test_get_api_symbol_node_with_main_public_key_not_found(client):  # pylint: disable=redefined-outer-name
	_assert_api_symbol_node_with_public_key_not_found(
		client.get('/api/symbol/nodes/mainPublicKey/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
	)


def test_get_api_symbol_node_with_node_public_key_not_found(client):  # pylint: disable=redefined-outer-name
	_assert_api_symbol_node_with_public_key_not_found(
		client.get('/api/symbol/nodes/nodePublicKey/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
	)


def test_get_api_symbol_node_with_main_public_key(client):  # pylint: disable=redefined-outer-name
	_assert_api_symbol_node_with_public_key_found(
		client.get('/api/symbol/nodes/mainPublicKey/A0AA48B6417BDB1845EB55FB0B1E13255EA8BD0D8FA29AD2D8A906E220571F21'),
		'Allnodes250'
	)


def test_get_api_symbol_node_with_node_public_key(client):  # pylint: disable=redefined-outer-name
	_assert_api_symbol_node_with_public_key_found(
		client.get('/api/symbol/nodes/nodePublicKey/FBEAFCB15D2674ECB8DC1CD2C028C4AC0D463489069FDD415F30BB71EAE69864'),
		'Apple'
	)


def test_get_api_symbol_nodes_count(client):  # pylint: disable=redefined-outer-name
	_assert_get_nodes_count(client.get('/api/symbol/nodes/count'), 2)


# endregion
