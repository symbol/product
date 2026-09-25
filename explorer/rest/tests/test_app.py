import gc
import weakref
from pathlib import Path

import pytest
from common.symbol.NativeMosaic import NativeMosaicInfo
from common.symbol.NodeConfiguration import SymbolNodeConfiguration, SymbolNodeConfigurationError
from common.tests.PostgresTestUtils import PostgresTestDatabase, drop_symbol_block_tables_if_present
from flask import Flask, abort, jsonify
from psycopg2 import OperationalError
from psycopg2.pool import PoolError
from puller.db.SymbolDatabase import SymbolDatabase as PullerSymbolDatabase

from rest import create_app, load_rest_config, setup_error_handlers, setup_symbol_facade
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.routes.symbol import setup_symbol_routes

from .test.EnvTestUtils import rest_settings_env
from .test.SymbolHealthTestUtils import create_symbol_health


def _write_config(config_path, contents):
	config_path.write_text(contents, encoding='utf8')


def _write_symbol_database_config(config_dir, database_config):
	assert '' == database_config.password
	db_config_path = Path(config_dir) / 'symbol_db.ini'
	_write_config(db_config_path, f'''[symbol_db]
database = {database_config.database}
user = {database_config.user}
password =
host = {database_config.host}
port = {database_config.port}
''')
	return db_config_path


def _write_symbol_app_config(config_dir, db_config_path):
	app_config_path = Path(config_dir) / 'symbol_app.config'
	_write_config(app_config_path, f'''REST_CHAIN="symbol"
DATABASE_CONFIG_FILEPATH="{db_config_path}"
SYMBOL_NODE_URL="http://localhost:3000"
SYMBOL_NODE_ALLOWED_HOSTS="localhost:3000"
SYMBOL_NODE_ALLOW_LOOPBACK="true"
SYMBOL_NODE_ALLOW_PRIVATE="false"
SYMBOL_NATIVE_MOSAIC_ID="72C0212E67A08BCE"
''')
	return app_config_path


@pytest.fixture(name='rest_config_path')
def fixture_rest_config_path(tmp_path):
	config_path = tmp_path / 'app.config'
	_write_config(config_path, '')

	with rest_settings_env(config_path):
		yield config_path


@pytest.fixture(name='symbol_database_config', scope='module')
def fixture_symbol_database_config():
	with PostgresTestDatabase() as db_config:
		yield db_config


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


class CloseableDatabase:
	def __init__(self, close_error=None):
		self.close_error = close_error
		self.close_called = False

	def close(self):
		self.close_called = True
		if self.close_error:
			raise self.close_error


def _create_handlers_with_route_setup_failure(database):
	def setup_facade(app):
		app.extensions['symbol_database'] = database
		return object()

	def setup_routes(_app, _facade):
		raise RuntimeError('route setup failed')

	return {'symbol': (setup_facade, setup_routes)}


def test_create_app_preserves_route_setup_error_when_database_cleanup_fails(rest_config_path):  # pylint: disable=invalid-name
	# Arrange:
	_write_config(rest_config_path, 'REST_CHAIN="symbol"\n')
	database = CloseableDatabase(OSError('database close failed'))

	# Act:
	with pytest.raises(RuntimeError, match='route setup failed'):
		create_app(rest_chain_handlers=_create_handlers_with_route_setup_failure(database))

	# Assert:
	assert database.close_called


def test_create_app_propagates_keyboard_interrupt_during_cleanup(rest_config_path):  # pylint: disable=invalid-name
	# Arrange:
	_write_config(rest_config_path, 'REST_CHAIN="symbol"\n')
	database = CloseableDatabase(KeyboardInterrupt('cleanup interrupted'))

	# Act:
	with pytest.raises(KeyboardInterrupt, match='cleanup interrupted'):
		create_app(rest_chain_handlers=_create_handlers_with_route_setup_failure(database))

	# Assert:
	assert database.close_called


def test_discard_app_closes_db(rest_config_path):
	# Arrange:
	_write_config(rest_config_path, 'REST_CHAIN="symbol"\n')
	database = CloseableDatabase()

	def setup_facade(app):
		app.extensions['symbol_database'] = database
		return object()

	def setup_routes(_app, _facade):
		pass

	app = create_app(rest_chain_handlers={'symbol': (setup_facade, setup_routes)})
	app_reference = weakref.ref(app)

	# Act:
	del app
	gc.collect()

	# Assert:
	assert app_reference() is None
	assert database.close_called


def test_unsynced_app_keeps_pool_open(rest_config_path, symbol_database_config):
	"""A connected DB without sync state starts, and health leaves its pool usable."""
	# Arrange:
	db_config_path = _write_symbol_database_config(rest_config_path.parent, symbol_database_config)
	app_config_path = _write_symbol_app_config(rest_config_path.parent, db_config_path)
	with PullerSymbolDatabase(symbol_database_config) as puller_database:
		drop_symbol_block_tables_if_present(puller_database)
		puller_database.create_tables()

	with rest_settings_env(app_config_path):
		# Act:
		app = create_app()
		response = app.test_client().get('/api/symbol/health')
		symbol_database = app.extensions['symbol_database']
		with symbol_database.connection() as connection:
			with connection.cursor() as cursor:
				cursor.execute('SELECT 1')
				result = cursor.fetchone()
		symbol_database.close()

	with PullerSymbolDatabase(symbol_database_config) as puller_database:
		drop_symbol_block_tables_if_present(puller_database)

	# Assert:
	assert 200 == response.status_code
	assert create_symbol_health() == response.json
	assert (1,) == result


def test_route_failure_closes_db_pool(rest_config_path, symbol_database_config):
	# Arrange:
	db_config_path = _write_symbol_database_config(rest_config_path.parent, symbol_database_config)
	app_config_path = _write_symbol_app_config(rest_config_path.parent, db_config_path)
	created_databases = []

	def setup_facade(app):
		facade = setup_symbol_facade(app)
		created_databases.append(app.extensions['symbol_database'])
		return facade

	def fail_route_setup(_app, _facade):
		raise RuntimeError('route setup failed')

	with rest_settings_env(app_config_path):
		# Act:
		with pytest.raises(RuntimeError, match='route setup failed'):
			create_app(rest_chain_handlers={'symbol': (setup_facade, fail_route_setup)})

	# Assert:
	assert len(created_databases) == 1
	with pytest.raises(PoolError, match='connection pool is closed'):
		with created_databases[0].connection():
			pass


@pytest.mark.parametrize('url', [
	pytest.param('/api/symbol/blocks', id='blocks-list'),
	pytest.param('/api/symbol/block/1', id='block-detail'),
	pytest.param('/api/symbol/receipts', id='receipts-list'),
	pytest.param('/api/symbol/block/1/receipts', id='block-receipts')
])
def test_injected_db_errors_return_503(rest_config_path, url):
	# Arrange:
	_write_config(rest_config_path, 'REST_CHAIN="symbol"\n')

	class FailingDatabase:
		@staticmethod
		def get_blocks(_from_height, _limit, _sort):
			raise OperationalError('database unavailable')

		@staticmethod
		def get_block(_height):
			raise OperationalError('database unavailable')

		@staticmethod
		def get_receipts(_query):
			raise OperationalError('database unavailable')

	def setup_facade(_app):
		return SymbolRestFacade(
			FailingDatabase(),
			SymbolNodeConfiguration.from_url('http://127.0.0.1:3000', allow_loopback=True),
			NativeMosaicInfo('72C0212E67A08BCE', 6))

	# Act:
	app = create_app(rest_chain_handlers={'symbol': (setup_facade, setup_symbol_routes)})
	response = app.test_client().get(url)

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


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
SYMBOL_NATIVE_MOSAIC_ID="72C0212E67A08BCE"
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
SYMBOL_NATIVE_MOSAIC_ID="72C0212E67A08BCE"
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
SYMBOL_NATIVE_MOSAIC_ID="72C0212E67A08BCE"
''')

	# Act:
	with pytest.raises(SymbolNodeConfigurationError) as exception_info:
		create_app()

	# Assert:
	assert str(exception_info.value) == 'Symbol node URL must include an explicit port'
