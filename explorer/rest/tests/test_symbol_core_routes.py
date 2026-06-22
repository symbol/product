import os
import tempfile
from contextlib import contextmanager
from pathlib import Path

import pytest
from flask import Flask

from rest import create_app, setup_symbol_facade
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.model.common import DatabaseConfig

from .test import PostgresTestUtils as postgres_test_utils
from .test.PostgresTestUtils import PostgresTestDatabase, create_unreachable_db_config


def _create_config_file(config_dir, include_symbol_db=True, database_config=None):
	db_config_path = Path(config_dir) / 'db_config.ini'
	with open(db_config_path, 'wt', encoding='utf8') as db_config_file:
		db_config_file.write('[nem_db]\n')
		db_config_file.write('database = nem\n')
		db_config_file.write('user = postgres\n')
		db_config_file.write('password = \n')
		db_config_file.write('host = 127.0.0.1\n')
		db_config_file.write('port = 5432\n')

		if include_symbol_db:
			database_config = database_config or DatabaseConfig('symbol', 'postgres', '', '127.0.0.1', '5433')
			db_config_file.write('[symbol_db]\n')
			db_config_file.write(f'database = {database_config.database}\n')
			db_config_file.write(f'user = {database_config.user}\n')
			db_config_file.write('password = \n')
			db_config_file.write(f'host = {database_config.host}\n')
			db_config_file.write(f'port = {database_config.port}\n')

	return db_config_path


def _create_app_config(config_dir, db_config_path):
	app_config_path = Path(config_dir) / 'app.config'
	with open(app_config_path, 'wt', encoding='utf8') as app_config_file:
		app_config_file.write(f'DATABASE_CONFIG_FILEPATH="{db_config_path}"\n')
		app_config_file.write('SYMBOL_NODE_URL="http://localhost:3000"\n')
		app_config_file.write('SYMBOL_NODE_ALLOWED_HOSTS="localhost:3000"\n')
		app_config_file.write('SYMBOL_NODE_ALLOW_LOOPBACK="true"\n')
		app_config_file.write('SYMBOL_NODE_ALLOW_PRIVATE="false"\n')

	return app_config_path


@contextmanager
def _rest_settings_env(config_path):
	previous_value = os.environ.get('EXPLORER_REST_SETTINGS')
	os.environ['EXPLORER_REST_SETTINGS'] = str(config_path)

	try:
		yield
	finally:
		if previous_value is None:
			os.environ.pop('EXPLORER_REST_SETTINGS', None)
		else:
			os.environ['EXPLORER_REST_SETTINGS'] = previous_value


@pytest.fixture(name='symbol_database_config', scope='module')
def fixture_symbol_database_config():
	with PostgresTestDatabase() as db_config:
		yield db_config


def test_symbol_health_with_database(symbol_database_config):
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(temp_directory, database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app_config_path.write_text(f'REST_CHAIN="symbol"\n{app_config_path.read_text(encoding="utf8")}', encoding='utf8')

		with _rest_settings_env(app_config_path):
			response = create_app().test_client().get('/api/symbol/health')

	assert 200 == response.status_code
	assert {
		'isHealthy': True,
		'dbUp': True,
		'nodeConfigured': True,
		'backendSynced': False,
		'lastDBSyncedAt': None,
		'lastDBHeight': None,
		'errors': []
	} == response.json


def test_symbol_facade_config(symbol_database_config):
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(temp_directory, database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)
		app.config.from_pyfile(app_config_path)

		facade = setup_symbol_facade(app)

	assert isinstance(facade, SymbolRestFacade)
	assert facade.is_configured()
	assert 'http://localhost:3000' == facade.node_config.base_url


def test_symbol_facade_envvar(symbol_database_config):
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(temp_directory, database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)

		with _rest_settings_env(app_config_path):
			facade = setup_symbol_facade(app)

	assert facade.is_configured()
	assert 'http://localhost:3000' == facade.node_config.base_url


def test_symbol_facade_without_db():
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(temp_directory, include_symbol_db=False)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)
		app.config.from_pyfile(app_config_path)

		facade = setup_symbol_facade(app)

	assert isinstance(facade, SymbolRestFacade)
	assert not facade.is_configured()
	assert not facade.get_health()['dbUp']


def test_symbol_facade_db_error():
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(temp_directory, database_config=create_unreachable_db_config())
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)
		app.config.from_pyfile(app_config_path)

		facade = setup_symbol_facade(app)

	health = facade.get_health()
	assert isinstance(facade, SymbolRestFacade)
	assert not facade.is_configured()
	assert not health['isHealthy']
	assert not health['dbUp']
	assert health['nodeConfigured']
	assert [{
		'type': 'database',
		'message': 'Symbol database is unavailable'
	}] == health['errors']
	assert 'connection refused' not in str(health)


def test_symbol_facade_node_error(symbol_database_config):
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(temp_directory, database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)
		app.config.from_pyfile(app_config_path)
		app.config['SYMBOL_NODE_ALLOWED_HOSTS'] = 'example.com:3000'

		facade = setup_symbol_facade(app)

	health = facade.get_health()
	assert not facade.is_configured()
	assert not health['isHealthy']
	assert [
		{
			'type': 'configuration',
			'message': 'Configured Symbol node host is not in SYMBOL_NODE_ALLOWED_HOSTS'
		},
		{
			'type': 'configuration',
			'message': 'Symbol node URL is not configured'
		}
	] == health['errors']


def test_rest_env_removes_missing(monkeypatch):
	monkeypatch.delenv('EXPLORER_REST_SETTINGS', raising=False)

	with tempfile.TemporaryDirectory() as temp_directory:
		config_path = Path(temp_directory) / 'app.config'

		with _rest_settings_env(config_path):
			assert str(config_path) == os.environ['EXPLORER_REST_SETTINGS']

	assert 'EXPLORER_REST_SETTINGS' not in os.environ


def test_rest_env_restores_existing(monkeypatch):
	monkeypatch.setenv('EXPLORER_REST_SETTINGS', 'previous.config')

	with tempfile.TemporaryDirectory() as temp_directory:
		config_path = Path(temp_directory) / 'app.config'

		with _rest_settings_env(config_path):
			assert str(config_path) == os.environ['EXPLORER_REST_SETTINGS']

	assert 'previous.config' == os.environ['EXPLORER_REST_SETTINGS']


def test_external_postgres_config(monkeypatch):
	monkeypatch.setenv('EXPLORER_TEST_POSTGRES_HOST', 'postgres.example')
	monkeypatch.setenv('EXPLORER_TEST_POSTGRES_DATABASE', 'symbol_test')
	monkeypatch.setenv('EXPLORER_TEST_POSTGRES_USER', 'symbol_user')
	monkeypatch.setenv('EXPLORER_TEST_POSTGRES_PORT', '15432')

	with PostgresTestDatabase() as db_config:
		assert DatabaseConfig('symbol_test', 'symbol_user', '', 'postgres.example', '15432') == db_config


def test_testing_postgresql_fallback(monkeypatch):
	class FakePostgresql:
		def __init__(self):
			self.stopped = False

		@staticmethod
		def dsn():
			return {
				'database': 'generated',
				'user': 'postgres',
				'host': '127.0.0.1',
				'port': '5432'
			}

		def stop(self):
			self.stopped = True

	monkeypatch.delenv('EXPLORER_TEST_POSTGRES_HOST', raising=False)
	fake_postgresql = FakePostgresql()
	monkeypatch.setattr(postgres_test_utils.testing.postgresql, 'Postgresql', lambda: fake_postgresql)

	with PostgresTestDatabase() as db_config:
		assert DatabaseConfig('generated', 'postgres', '', '127.0.0.1', '5432') == db_config

	assert fake_postgresql.stopped
