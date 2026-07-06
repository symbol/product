import pytest
from common.symbol.NodeConfiguration import SymbolNodeConfigurationError
from flask import Flask, abort, jsonify

from rest import create_app, load_rest_config, setup_error_handlers
from rest.routes.symbol import setup_symbol_routes

from .test.EnvTestUtils import rest_settings_env


def _write_config(config_path, contents):
	config_path.write_text(contents, encoding='utf8')


@pytest.fixture(name='rest_config_path')
def fixture_rest_config_path(tmp_path):
	config_path = tmp_path / 'app.config'
	_write_config(config_path, '')

	with rest_settings_env(config_path):
		yield config_path


def test_create_app_requires_rest_chain(rest_config_path):
	# Arrange:
	_write_config(rest_config_path, '')

	# Act:
	with pytest.raises(ValueError) as exception_info:
		create_app()

	# Assert:
	assert 'REST_CHAIN is required' == str(exception_info.value)


def test_rejects_unsupported_chain(rest_config_path):
	# Arrange:
	_write_config(rest_config_path, 'REST_CHAIN="unknown"\n')

	# Act:
	with pytest.raises(ValueError) as exception_info:
		create_app()

	# Assert:
	assert str(exception_info.value) == 'Unsupported REST_CHAIN "unknown". Supported values: nem, symbol'


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

	_write_config(rest_config_path, 'REST_CHAIN="test"\n')
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
	_write_config(rest_config_path, 'REST_CHAIN="nem"\n')

	# Act:
	load_rest_config(app)

	# Assert:
	assert 'nem' == app.config['REST_CHAIN']


def _create_error_handler_client():
	app = Flask(__name__)
	setup_error_handlers(app)

	@app.route('/bad-request')
	def bad_request():
		abort(400, 'invalid input')

	return app.test_client()


def test_not_found_handler_returns_json():
	# Arrange:
	client = _create_error_handler_client()

	# Act:
	not_found_response = client.get('/missing')

	# Assert:
	assert 404 == not_found_response.status_code
	assert {
		'message': 'Resource not found',
		'status': 404
	} == not_found_response.json


def test_bad_request_json():
	# Arrange:
	client = _create_error_handler_client()

	# Act:
	bad_request_response = client.get('/bad-request')

	# Assert:
	assert 400 == bad_request_response.status_code
	assert {
		'message': 'invalid input',
		'status': 400
	} == bad_request_response.json


def _create_test_chain_handlers():
	def setup_nem_test_facade(_):
		return {}

	def setup_nem_test_routes(app, _):
		@app.route('/api/nem/test')
		def api_nem_test():
			return jsonify({'chain': 'nem'})

	def setup_symbol_test_facade(_):
		return {}

	def setup_symbol_test_routes(app, _):
		@app.route('/api/symbol/test')
		def api_symbol_test():
			return jsonify({'chain': 'symbol'})

	return {
		'nem': (setup_nem_test_facade, setup_nem_test_routes),
		'symbol': (setup_symbol_test_facade, setup_symbol_test_routes)
	}


class SymbolHealthFacade:
	@staticmethod
	def get_health():
		return {
			'isHealthy': True,
			'errors': []
		}


def test_symbol_chain_routes_only(rest_config_path):
	# Arrange:
	_write_config(rest_config_path, 'REST_CHAIN="symbol"\n')

	# Act:
	client = create_app(
		rest_chain_handlers=_create_test_chain_handlers()
	).test_client()

	# Assert:
	assert 200 == client.get('/api/symbol/test').status_code
	assert 404 == client.get('/api/nem/test').status_code


def test_nem_chain_routes_only(rest_config_path):
	# Arrange:
	_write_config(rest_config_path, 'REST_CHAIN="nem"\n')

	# Act:
	client = create_app(
		rest_chain_handlers=_create_test_chain_handlers()
	).test_client()

	# Assert:
	assert 200 == client.get('/api/nem/test').status_code
	assert 404 == client.get('/api/symbol/test').status_code


def test_symbol_health_route():
	# Arrange:
	app = Flask(__name__)
	setup_symbol_routes(app, SymbolHealthFacade())

	# Act:
	response = app.test_client().get('/api/symbol/health')

	# Assert:
	assert 200 == response.status_code
	assert {
		'isHealthy': True,
		'errors': []
	} == response.json


def test_symbol_db_config_required(rest_config_path, tmp_path):
	# Arrange:
	db_config_path = tmp_path / 'db.ini'
	_write_config(db_config_path, '[nem_db]\ndatabase = nem\n')
	_write_config(rest_config_path, f'''
REST_CHAIN="symbol"
DATABASE_CONFIG_FILEPATH="{db_config_path}"
SYMBOL_NODE_URL="http://localhost:3000"
SYMBOL_NODE_ALLOWED_HOSTS="localhost:3000"
SYMBOL_NODE_ALLOW_LOOPBACK="true"
''')

	# Act:
	with pytest.raises(KeyError) as exception_info:
		create_app()

	# Assert:
	assert 'symbol_db' == exception_info.value.args[0]


def test_symbol_node_url_required(rest_config_path, tmp_path):
	# Arrange:
	db_config_path = tmp_path / 'db.ini'
	_write_config(db_config_path, '''
[symbol_db]
database = symbol
user = postgres
password =
host = 127.0.0.1
port = 5432
''')
	_write_config(rest_config_path, f'''
REST_CHAIN="symbol"
DATABASE_CONFIG_FILEPATH="{db_config_path}"
''')

	# Act:
	with pytest.raises(SymbolNodeConfigurationError) as exception_info:
		create_app()

	# Assert:
	assert 'Symbol node URL is not configured' == str(exception_info.value)


def test_bad_symbol_node_config(rest_config_path, tmp_path):
	# Arrange:
	db_config_path = tmp_path / 'db.ini'
	_write_config(db_config_path, '''
[symbol_db]
database = symbol
user = postgres
password =
host = 127.0.0.1
port = 5432
''')
	_write_config(rest_config_path, f'''
REST_CHAIN="symbol"
DATABASE_CONFIG_FILEPATH="{db_config_path}"
SYMBOL_NODE_URL="http://localhost"
SYMBOL_NODE_ALLOWED_HOSTS="localhost:80"
SYMBOL_NODE_ALLOW_LOOPBACK="true"
''')

	# Act:
	with pytest.raises(SymbolNodeConfigurationError) as exception_info:
		create_app()

	# Assert:
	assert str(exception_info.value) == 'Symbol node URL must include an explicit port'
