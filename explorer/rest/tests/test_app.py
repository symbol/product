import os

import pytest
from flask import Flask, abort, jsonify

from rest import create_app, load_rest_config, setup_error_handlers


def _write_rest_config(config_path, contents):
	config_path.write_text(contents, encoding='utf8')


@pytest.fixture(name='rest_config_path')
def fixture_rest_config_path(tmp_path):
	config_path = tmp_path / 'app.config'
	_write_rest_config(config_path, '')

	previous_rest_settings = os.environ.get('EXPLORER_REST_SETTINGS')
	os.environ['EXPLORER_REST_SETTINGS'] = str(config_path)

	yield config_path

	if previous_rest_settings is None:
		os.environ.pop('EXPLORER_REST_SETTINGS', None)
	else:
		os.environ['EXPLORER_REST_SETTINGS'] = previous_rest_settings


def test_create_app_requires_rest_chain(rest_config_path):
	# Arrange:
	_write_rest_config(rest_config_path, '')

	# Act:
	with pytest.raises(ValueError) as exception_info:
		create_app()

	# Assert:
	assert 'REST_CHAIN is required' == str(exception_info.value)


def test_rejects_unsupported_chain(rest_config_path):
	# Arrange:
	_write_rest_config(rest_config_path, 'REST_CHAIN="symbol"\n')

	# Act:
	with pytest.raises(ValueError) as exception_info:
		create_app()

	# Assert:
	assert 'Unsupported REST_CHAIN "symbol". Supported values: nem' == str(exception_info.value)


def test_registers_selected_chain(rest_config_path):
	# Arrange:
	def setup_test_facade(app):
		return {'chain': app.config['REST_CHAIN']}

	def setup_test_routes(app, test_api_facade):
		@app.route('/api/test/status')
		def api_test_status():
			return jsonify({
				'chain': test_api_facade['chain']
			})

	_write_rest_config(rest_config_path, 'REST_CHAIN="test"\n')
	rest_chain_handlers = {
		'test': (setup_test_facade, setup_test_routes)
	}

	# Act:
	client = create_app(rest_chain_handlers=rest_chain_handlers).test_client()
	response = client.get('/api/test/status')

	# Assert:
	assert 200 == response.status_code
	assert {
		'chain': 'test'
	} == response.json


def test_loads_envvar_config(rest_config_path):
	# Arrange:
	app = Flask(__name__)
	_write_rest_config(rest_config_path, 'REST_CHAIN="nem"\n')

	# Act:
	load_rest_config(app)

	# Assert:
	assert 'nem' == app.config['REST_CHAIN']


def test_error_handlers_json():
	# Arrange:
	app = Flask(__name__)
	setup_error_handlers(app)

	@app.route('/bad-request')
	def bad_request():
		abort(400, 'invalid input')

	client = app.test_client()

	# Act:
	not_found_response = client.get('/missing')
	bad_request_response = client.get('/bad-request')

	# Assert:
	assert 404 == not_found_response.status_code
	assert {
		'message': 'Resource not found',
		'status': 404
	} == not_found_response.json

	assert 400 == bad_request_response.status_code
	assert {
		'message': 'invalid input',
		'status': 400
	} == bad_request_response.json
