import json
import os
import tempfile
from pathlib import Path

import pytest

from bridge.api import create_app

# region fixtures


@pytest.fixture
def app():
	with tempfile.TemporaryDirectory() as temp_directory:
		config_filename = Path(temp_directory) / 'config'
		with open(config_filename, 'wt', encoding='utf8') as config_file:
			print(f'creating config file {config_filename}...')
			config_file.write('CONFIG_PATH="tests/resources/sample.config.properties"\n')
			config_file.flush()

			temp_file_path = config_filename.resolve()
			os.environ['BRIDGE_API_SETTINGS'] = str(temp_file_path)
			return create_app()


@pytest.fixture
def client(app):  # pylint: disable=redefined-outer-name
	return app.test_client()

# endregion


# pylint: disable=invalid-name


# region root (/)

def test_root(client):  # pylint: disable=redefined-outer-name
	# Act:
	response = client.get('/')
	response_json = json.loads(response.data)

	# Assert:
	assert 200 == response.status_code
	assert 'application/json' == response.headers['Content-Type']
	assert {
		'native_network': {
			'blockchain': 'nem',
			'network': 'testnet',
			'bridgeAddress': 'TBINJOHFNWMNUOJ2KW3DWJTLRVNAOGQCE6FECSQJ',
			'tokenId': 'nem:xem'
		},
		'wrapped_network': {
			'blockchain': 'symbol',
			'network': 'testnet',
			'bridgeAddress': 'TCRZANFBD6O6EGYCBAH6ICTLAMH6OGBV6CEH7UY',
			'tokenId': 'id:5D6CFC64A20E86E6'
		}
	} == response_json

# endregion
