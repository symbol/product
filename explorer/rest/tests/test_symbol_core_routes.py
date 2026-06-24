import tempfile
from contextlib import contextmanager
from pathlib import Path

import pytest
from common.symbol.NodeConfig import SymbolNodeConfigurationError
from flask import Flask

from rest import create_app, setup_symbol_facade
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.model.common import DatabaseConfig

from .test.EnvTestUtils import temporary_env_values
from .test.PostgresTestUtils import PostgresTestDatabase, create_unreachable_db_config
from .test.SymbolHealthTestUtils import create_symbol_health


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
	with temporary_env_values({'EXPLORER_REST_SETTINGS': str(config_path)}):
		yield


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
	assert create_symbol_health(
		isHealthy=True,
		dbUp=True,
		nodeConfigured=True,
	) == response.json


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


def test_symbol_facade_needs_db():
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(temp_directory, include_symbol_db=False)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)
		app.config.from_pyfile(app_config_path)

		with pytest.raises(KeyError, match='symbol_db'):
			setup_symbol_facade(app)


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


def test_symbol_facade_node_error():
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(temp_directory)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)
		app.config.from_pyfile(app_config_path)
		app.config['SYMBOL_NODE_URL'] = 'http://localhost'

		with pytest.raises(SymbolNodeConfigurationError, match='Symbol node URL must include an explicit port'):
			setup_symbol_facade(app)


def test_symbol_facade_needs_node(symbol_database_config):
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(temp_directory, database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)
		app.config.from_pyfile(app_config_path)
		app.config.pop('SYMBOL_NODE_URL')

		with pytest.raises(SymbolNodeConfigurationError, match='Symbol node URL is not configured'):
			setup_symbol_facade(app)
