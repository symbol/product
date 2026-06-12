from unittest.mock import Mock, patch

import pytest
from flask import Flask, abort

from rest import create_app, load_rest_config, setup_error_handlers


def test_create_app_requires_rest_chain():
	with patch('rest.load_rest_config'):
		with pytest.raises(ValueError, match='REST_CHAIN is required'):
			create_app()


def test_rejects_unsupported_chain():
	with patch('rest.load_rest_config', side_effect=lambda app: app.config.update(REST_CHAIN='symbol')):
		with pytest.raises(ValueError, match='Unsupported REST_CHAIN "symbol". Supported values: nem'):
			create_app()


def test_registers_selected_chain():
	facade = Mock(name='facade')
	setup_facade = Mock(return_value=facade)
	setup_routes = Mock()

	with patch.dict('rest.REST_CHAIN_HANDLERS', {'nem': (setup_facade, setup_routes)}, clear=True):
		with patch('rest.load_rest_config', side_effect=lambda app: app.config.update(REST_CHAIN='nem')):
			app = create_app()

	assert app is not None
	setup_facade.assert_called_once_with(app)
	setup_routes.assert_called_once_with(app, facade)


def test_loads_envvar_config(monkeypatch, tmp_path):
	config_path = tmp_path / 'app.config'
	config_path.write_text('REST_CHAIN="nem"\n', encoding='utf8')
	app = Flask(__name__)
	monkeypatch.setenv('EXPLORER_REST_SETTINGS', str(config_path))

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
