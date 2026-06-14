import pytest
from flask import Flask, abort, jsonify

import rest
from rest import create_app, load_rest_config, setup_error_handlers


def _write_rest_config(monkeypatch, tmp_path, contents):
	config_path = tmp_path / 'app.config'
	config_path.write_text(contents, encoding='utf8')
	monkeypatch.setenv('EXPLORER_REST_SETTINGS', str(config_path))


def test_create_app_requires_rest_chain(monkeypatch, tmp_path):
	_write_rest_config(monkeypatch, tmp_path, '')

	with pytest.raises(ValueError, match='REST_CHAIN is required'):
		create_app()


def test_rejects_unsupported_chain(monkeypatch, tmp_path):
	_write_rest_config(monkeypatch, tmp_path, 'REST_CHAIN="symbol"\n')

	with pytest.raises(ValueError, match='Unsupported REST_CHAIN "symbol". Supported values: nem'):
		create_app()


def test_registers_selected_chain(monkeypatch, tmp_path):
	def setup_test_facade(app):
		return {'chain': app.config['REST_CHAIN']}

	def setup_test_routes(app, test_api_facade):
		@app.route('/api/test/status')
		def api_test_status():
			return jsonify({
				'chain': test_api_facade['chain']
			})

	_write_rest_config(monkeypatch, tmp_path, 'REST_CHAIN="test"\n')
	monkeypatch.setitem(rest.REST_CHAIN_HANDLERS, 'test', (setup_test_facade, setup_test_routes))

	client = create_app().test_client()
	response = client.get('/api/test/status')

	assert 200 == response.status_code
	assert {
		'chain': 'test'
	} == response.json


def test_loads_envvar_config(monkeypatch, tmp_path):
	app = Flask(__name__)
	_write_rest_config(monkeypatch, tmp_path, 'REST_CHAIN="nem"\n')

	load_rest_config(app)

	assert 'nem' == app.config['REST_CHAIN']


def test_error_handlers_json():
	app = Flask(__name__)
	setup_error_handlers(app)

	@app.route('/bad-request')
	def bad_request():
		abort(400, 'invalid input')

	client = app.test_client()

	not_found_response = client.get('/missing')
	bad_request_response = client.get('/bad-request')

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
