import tempfile
from pathlib import Path

import pytest
from common.symbol.NodeConfiguration import SymbolNodeConfigurationError
from common.tests.PostgresTestUtils import PostgresTestDatabase, create_unreachable_db_configuration, drop_symbol_block_tables_if_present
from flask import Flask
from puller.db.SymbolDatabase import SymbolDatabase as PullerSymbolDatabase

from rest import create_app, setup_symbol_facade
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.model.common import DatabaseConfig

from .test.EnvTestUtils import rest_settings_env, temporary_env_values
from .test.SymbolBlockTestUtils import create_symbol_block, create_symbol_importance_block, create_symbol_sync_state
from .test.SymbolHealthTestUtils import create_symbol_health


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


def _create_config_file(
	config_dir,
	include_symbol_db=True,
	database_config=None
):
	db_config_path = Path(config_dir) / 'db_config.ini'
	with open(db_config_path, 'wt', encoding='utf8') as db_config_file:
		db_config_file.write('[nem_db]\n')
		db_config_file.write('database = nem\n')
		db_config_file.write('user = postgres\n')
		db_config_file.write('password = \n')
		db_config_file.write('host = 127.0.0.1\n')
		db_config_file.write('port = 5432\n')

		if include_symbol_db:
			database_config = database_config or DatabaseConfig(
				'symbol',
				'postgres',
				'',
				'127.0.0.1',
				'5433')
			db_config_file.write('[symbol_db]\n')
			db_config_file.write(f'database = {database_config.database}\n')
			db_config_file.write(f'user = {database_config.user}\n')
			db_config_file.write('password = \n')
			db_config_file.write(f'host = {database_config.host}\n')
			db_config_file.write(f'port = {database_config.port}\n')

	return db_config_path


def _create_app_config(
	config_dir,
	db_config_path,
	symbol_node_url='http://localhost:3000'
):
	app_config_path = Path(config_dir) / 'app.config'
	with open(app_config_path, 'wt', encoding='utf8') as app_config_file:
		app_config_file.write('REST_CHAIN="symbol"\n')
		app_config_file.write(f'DATABASE_CONFIG_FILEPATH="{db_config_path}"\n')
		if symbol_node_url:
			app_config_file.write(f'SYMBOL_NODE_URL="{symbol_node_url}"\n')
		app_config_file.write('SYMBOL_NODE_ALLOWED_HOSTS="localhost:3000"\n')
		app_config_file.write('SYMBOL_NODE_ALLOW_LOOPBACK="true"\n')
		app_config_file.write('SYMBOL_NODE_ALLOW_PRIVATE="false"\n')

	return app_config_path


def _drop_symbol_block_tables_if_present(database_config):
	with PullerSymbolDatabase(database_config) as database:
		drop_symbol_block_tables_if_present(database)


def _create_symbol_block_tables(database_config):
	_drop_symbol_block_tables_if_present(database_config)
	with PullerSymbolDatabase(database_config) as database:
		database.create_tables()


def _seed_symbol_block_tables(database_config, sync_state, blocks):
	_drop_symbol_block_tables_if_present(database_config)
	with PullerSymbolDatabase(database_config) as database:
		database.create_tables()
		database.upsert_sync_state(sync_state)
		database.upsert_blocks(blocks)


def _expected_block_list_item(height, is_finalized):
	return {
		'height': height,
		'hash': f'{height:02X}' * 32,
		'previousHash': f'{height - 1:02X}' * 32,
		'timestamp': f'2026-01-{height:02d}T00:00:00Z',
		'networkTimestamp': height * 1000,
		'harvester': 'TBJU67Q5BITMUTRRN6IB4I7FLSDQDWZA34I2PMQ',
		'beneficiaryAddress': 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
		'totalFee': float(height),
		'transactionCount': height,
		'statementCount': height,
		'blockReward': None,
		'isFinalized': is_finalized,
		'difficulty': str(1000000 + height)
	}


def _expected_block_detail(height, is_finalized):
	return {
		**_expected_block_list_item(height, is_finalized),
		'signature': f'{height:02X}' * 64,
		'size': 100 + height,
		'feeMultiplier': height,
		'rawDifficulty': str(1000000 + height),
		'proofGamma': f'{height:02X}' * 32,
		'proofVerificationHash': f'{height:02X}' * 16,
		'proofScalar': f'{height:02X}' * 32,
		'stateHash': f'{height:02X}' * 32,
		'stateHashSubCacheMerkleRoots': [f'ROOT {height}'],
		'receiptsHash': f'{height:02X}' * 32,
		'transactionsHash': f'{height:02X}' * 32,
		'votingEligibleAccountsCount': None,
		'harvestingEligibleAccountsCount': None,
		'totalVotingBalance': None,
		'previousImportanceBlockHash': None,
		'blockType': 'nemesis'
	}


@pytest.fixture(name='symbol_database_config', scope='module')
def fixture_symbol_database_config():
	with PostgresTestDatabase() as db_config:
		yield db_config


def test_symbol_health_with_database(symbol_database_config):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)

		_create_symbol_block_tables(symbol_database_config)
		with rest_settings_env(app_config_path):
			# Act:
			response = create_app().test_client().get('/api/symbol/health')

	# Assert:
	assert 200 == response.status_code
	assert create_symbol_health(
		isHealthy=True,
		dbUp=True
	) == response.json


def test_symbol_health_reports_db_error(symbol_database_config):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)

		_drop_symbol_block_tables_if_present(symbol_database_config)
		with rest_settings_env(app_config_path):
			# Act:
			response = create_app().test_client().get('/api/symbol/health')

	# Assert:
	assert 200 == response.status_code
	assert create_symbol_health(
		dbUp=True,
		errors=[{
			'type': 'database',
			'message': 'Symbol database is unavailable'
		}]
	) == response.json


def test_symbol_blocks_reads_db(symbol_database_config):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)

		_seed_symbol_block_tables(
			symbol_database_config,
			create_symbol_sync_state(
				last_synced_height=3,
				finalized_height=2),
			[create_symbol_block(height) for height in range(1, 4)])
		with rest_settings_env(app_config_path):
			# Act:
			response = create_app().test_client().get(
				'/api/symbol/blocks?limit=2&fromHeight=3&sort=desc')

	# Assert:
	assert 200 == response.status_code
	assert [
		_expected_block_list_item(3, is_finalized=False),
		_expected_block_list_item(2, is_finalized=True)
	] == response.json


def test_symbol_block_reads_db(symbol_database_config):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)

		_seed_symbol_block_tables(
			symbol_database_config,
			create_symbol_sync_state(last_synced_height=2, finalized_height=2),
			[create_symbol_block(2)])
		with rest_settings_env(app_config_path):
			# Act:
			response = create_app().test_client().get('/api/symbol/block/2')

	# Assert:
	assert 200 == response.status_code
	assert _expected_block_detail(2, is_finalized=True) == response.json


def test_symbol_importance_reads_db(symbol_database_config):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)

		_seed_symbol_block_tables(
			symbol_database_config,
			create_symbol_sync_state(last_synced_height=2, finalized_height=2),
			[create_symbol_importance_block(2)])
		with rest_settings_env(app_config_path):
			# Act:
			response = create_app().test_client().get('/api/symbol/block/2')

	# Assert:
	assert 200 == response.status_code
	assert {
		**_expected_block_detail(2, is_finalized=True),
		'votingEligibleAccountsCount': 4,
		'harvestingEligibleAccountsCount': '17',
		'totalVotingBalance': '19000235663367',
		'previousImportanceBlockHash': '86' * 32
	} == response.json


def test_setup_requires_symbol_db():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			include_symbol_db=False)
		app_config_path = _create_app_config(temp_directory, db_config_path)

		with rest_settings_env(app_config_path):
			# Act + Assert:
			with pytest.raises(KeyError, match='symbol_db'):
				create_app()


def test_health_reports_db_error():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=create_unreachable_db_configuration())
		app_config_path = _create_app_config(temp_directory, db_config_path)

		with rest_settings_env(app_config_path):
			# Act:
			response = create_app().test_client().get('/api/symbol/health')

	# Assert:
	assert 200 == response.status_code
	assert create_symbol_health(errors=[{
		'type': 'database',
		'message': 'Symbol database is unavailable'
	}]) == response.json


def test_setup_rejects_bad_node_url():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(temp_directory)
		app_config_path = _create_app_config(
			temp_directory,
			db_config_path,
			symbol_node_url='http://localhost')

		with rest_settings_env(app_config_path):
			# Act + Assert:
			with pytest.raises(
				SymbolNodeConfigurationError,
				match='Symbol node URL must include an explicit port'
			):
				create_app()


def test_setup_requires_node_url(symbol_database_config):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=symbol_database_config)
		app_config_path = _create_app_config(
			temp_directory,
			db_config_path,
			symbol_node_url=None)

		with rest_settings_env(app_config_path):
			# Act + Assert:
			with pytest.raises(
				SymbolNodeConfigurationError,
				match='Symbol node URL is not configured'
			):
				create_app()


def test_symbol_facade_config(symbol_database_config):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)
		app.config.from_pyfile(app_config_path)

		# Act:
		facade = setup_symbol_facade(app)

	# Assert:
	assert isinstance(facade, SymbolRestFacade)
	assert facade.is_configured()
	assert 'http://localhost:3000' == facade.node_config.base_url


def test_symbol_facade_requires_db():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			include_symbol_db=False)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)
		app.config.from_pyfile(app_config_path)

		# Act:
		with pytest.raises(KeyError) as exception_info:
			setup_symbol_facade(app)

	# Assert:
	assert 'symbol_db' == exception_info.value.args[0]


def test_symbol_facade_db_error():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=create_unreachable_db_configuration())
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)
		app.config.from_pyfile(app_config_path)

		# Act:
		facade = setup_symbol_facade(app)

	# Assert:
	health = facade.get_health()
	assert isinstance(facade, SymbolRestFacade)
	assert not facade.is_configured()
	assert not health['isHealthy']
	assert not health['dbUp']
	assert [{
		'type': 'database',
		'message': 'Symbol database is unavailable'
	}] == health['errors']
	assert 'connection refused' not in str(health)


def test_symbol_facade_node_error(symbol_database_config):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)
		app.config.from_pyfile(app_config_path)
		app.config['SYMBOL_NODE_ALLOWED_HOSTS'] = 'example.com:3000'

		# Act:
		with pytest.raises(SymbolNodeConfigurationError) as exception_info:
			setup_symbol_facade(app)

	# Assert:
	assert str(exception_info.value) == 'Configured Symbol node host is not in SYMBOL_NODE_ALLOWED_HOSTS'


def test_external_postgres_config():
	# Arrange:
	postgres_env = {
		'EXPLORER_TEST_POSTGRES_HOST': 'postgres.example',
		'EXPLORER_TEST_POSTGRES_DATABASE': 'symbol_test',
		'EXPLORER_TEST_POSTGRES_USER': 'symbol_user',
		'EXPLORER_TEST_POSTGRES_PORT': '15432',
		'EXPLORER_TEST_POSTGRES_CREATE_DATABASE': 'false'
	}

	# Act:
	with temporary_env_values(postgres_env):
		with PostgresTestDatabase() as db_config:
			result = db_config

	# Assert:
	assert DatabaseConfig(
		'symbol_test',
		'symbol_user',
		'',
		'postgres.example',
		'15432') == result


def test_testing_postgresql_fallback():
	# Arrange:
	fake_postgresql = FakePostgresql()

	# Act:
	with temporary_env_values({'EXPLORER_TEST_POSTGRES_HOST': None}):
		with PostgresTestDatabase(
			postgresql_factory=lambda: fake_postgresql
		) as db_config:
			result = db_config

	# Assert:
	assert DatabaseConfig(
		'generated',
		'postgres',
		'',
		'127.0.0.1',
		'5432') == result
	assert fake_postgresql.stopped
