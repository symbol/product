import tempfile
from pathlib import Path
from unittest.mock import patch

import testing.postgresql
from flask import Flask
from psycopg2 import OperationalError

from rest import create_app, setup_symbol_facade
from rest.facade.SymbolRestFacade import SymbolRestFacade


def _create_config_file(config_dir, include_symbol_db=True):
	db_config_path = Path(config_dir) / 'db_config.ini'
	with open(db_config_path, 'wt', encoding='utf8') as db_config_file:
		db_config_file.write('[nem_db]\n')
		db_config_file.write('database = nem\n')
		db_config_file.write('user = postgres\n')
		db_config_file.write('password = \n')
		db_config_file.write('host = 127.0.0.1\n')
		db_config_file.write('port = 5432\n')

		if include_symbol_db:
			db_config_file.write('[symbol_db]\n')
			db_config_file.write('database = symbol\n')
			db_config_file.write('user = postgres\n')
			db_config_file.write('password = \n')
			db_config_file.write('host = 127.0.0.1\n')
			db_config_file.write('port = 5433\n')

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


def test_symbol_health_with_database(monkeypatch):
	postgresql = testing.postgresql.Postgresql()
	try:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_config_file(temp_directory)
			db_config = postgresql.dsn()
			db_config_path.write_text(
				'[symbol_db]\n'
				f'database = {db_config["database"]}\n'
				f'user = {db_config["user"]}\n'
				'password = \n'
				f'host = {db_config["host"]}\n'
				f'port = {db_config["port"]}\n',
				encoding='utf8'
			)

			app_config_path = _create_app_config(temp_directory, db_config_path)
			app_config_path.write_text(f'REST_CHAIN="symbol"\n{app_config_path.read_text(encoding="utf8")}', encoding='utf8')
			monkeypatch.setenv('EXPLORER_REST_SETTINGS', str(app_config_path))

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
	finally:
		postgresql.stop()


def test_symbol_facade_config():
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(temp_directory)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)
		app.config.from_pyfile(app_config_path)

		# SymbolDatabase opens a real connection pool on construction; patch it here
		# so these tests stay focused on config loading and facade construction.
		with patch('rest.facade.SymbolRestFacade.SymbolDatabase') as database_factory:
			facade = setup_symbol_facade(app)

	assert isinstance(facade, SymbolRestFacade)
	assert facade.is_configured()
	assert 'http://localhost:3000' == facade.node_config.base_url
	database_factory.assert_called_once()


def test_symbol_facade_envvar(monkeypatch):
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(temp_directory)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)
		monkeypatch.setenv('EXPLORER_REST_SETTINGS', str(app_config_path))

		# Keep this test independent from an external PostgreSQL service.
		with patch('rest.facade.SymbolRestFacade.SymbolDatabase'):
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
		db_config_path = _create_config_file(temp_directory)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)
		app.config.from_pyfile(app_config_path)

		# Force the database constructor failure path without requiring a broken DB.
		with patch('rest.facade.SymbolRestFacade.SymbolDatabase', side_effect=OperationalError('connection refused')):
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
		app.config['SYMBOL_NODE_ALLOWED_HOSTS'] = 'example.com:3000'

		# Keep this test focused on node config validation rather than DB setup.
		with patch('rest.facade.SymbolRestFacade.SymbolDatabase'):
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
