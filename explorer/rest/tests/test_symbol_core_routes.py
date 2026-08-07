import tempfile
from pathlib import Path

import pytest
from common.symbol.NativeMosaic import NativeMosaicInfo
from common.symbol.NodeConfiguration import SymbolNodeConfigurationError
from common.tests.PostgresTestUtils import PostgresTestDatabase, create_unreachable_db_configuration, drop_symbol_block_tables_if_present
from flask import Flask
from puller.db.SymbolDatabase import SymbolDatabase as PullerSymbolDatabase
from symbolchain.symbol.Network import Network

from rest import create_app, setup_symbol_facade
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.model.common import DatabaseConfig
from rest.routes.symbol import setup_symbol_routes
from rest.symbol_node import fetch_native_mosaic_info

from .test.EnvTestUtils import rest_settings_env
from .test.SymbolBlockTestUtils import create_symbol_block, create_symbol_importance_block, create_symbol_sync_state
from .test.SymbolHealthTestUtils import create_symbol_health

NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)
TARGET_ADDRESS = bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')
SENDER_ADDRESS = bytes.fromhex('98' + '11' * 23)
RECIPIENT_ADDRESS = bytes.fromhex('98' + '22' * 23)


class SetupConnector:
	def __init__(self, _endpoint):
		self.responses = {
			'network/properties': {'chain': {'currencyMosaicId': "0x72C0'212E'67A0'8BCE"}},
			'mosaics/72C0212E67A08BCE': {'mosaic': {'divisibility': 3}}
		}

	async def get(self, path):
		return self.responses[path]


class BadSetupConnector(SetupConnector):
	def __init__(self, endpoint):
		super().__init__(endpoint)
		self.responses['mosaics/72C0212E67A08BCE'] = {'mosaic': {}}


def _create_symbol_app():
	return create_app(rest_chain_handlers={
		'symbol': (_setup_test_symbol_facade, setup_symbol_routes)
	})


def _fetch_test_native_mosaic_info(_node_config):
	return NATIVE_MOSAIC_INFO


def _setup_test_symbol_facade(app):
	return setup_symbol_facade(app, native_mosaic_info_fetcher=_fetch_test_native_mosaic_info)


def _fetch_setup_native_mosaic_info(node_config):
	return fetch_native_mosaic_info(node_config, SetupConnector)


def _fetch_bad_native_mosaic_info(node_config):
	return fetch_native_mosaic_info(node_config, BadSetupConnector)


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


def _update_block_reward(database_config, height, reward):
	with PullerSymbolDatabase(database_config) as database:
		with database.connection.cursor() as cursor:
			cursor.execute(
				'UPDATE symbol_blocks SET block_reward = %s WHERE height = %s',
				(reward, height))
			database.connection.commit()


def _seed_symbol_receipts(database_config, sync_state, blocks, receipts):
	_seed_symbol_block_tables(database_config, sync_state, blocks)
	with PullerSymbolDatabase(database_config) as database:
		by_height = {}
		for receipt in receipts:
			by_height.setdefault(receipt['height'], []).append(receipt)
		for height, rows in by_height.items():
			database.upsert_receipts_for_height(height, rows, 0)


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

		_seed_symbol_block_tables(
			symbol_database_config,
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[])
		with rest_settings_env(app_config_path):
			# Act:
			response = _create_symbol_app().test_client().get('/api/symbol/health')

	# Assert:
	assert 200 == response.status_code
	health = response.json
	assert health['lastDBSyncedAt']
	health['lastDBSyncedAt'] = None
	assert create_symbol_health(
		isHealthy=True,
		dbUp=True,
		finalizedHeight=1,
		backendSynced=True,
		lastDBHeight=1,
		status='healthy'
	) == health


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
			response = _create_symbol_app().test_client().get('/api/symbol/health')

	# Assert:
	assert 200 == response.status_code
	assert create_symbol_health(
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
			response = _create_symbol_app().test_client().get(
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
			response = _create_symbol_app().test_client().get('/api/symbol/block/2')

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
			response = _create_symbol_app().test_client().get('/api/symbol/block/2')

	# Assert:
	assert 200 == response.status_code
	assert {
		**_expected_block_detail(2, is_finalized=True),
		'votingEligibleAccountsCount': 4,
		'harvestingEligibleAccountsCount': '17',
		'totalVotingBalance': '19000235663367',
		'previousImportanceBlockHash': '86' * 32
	} == response.json


def test_symbol_block_list_reward(symbol_database_config):
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
		_update_block_reward(symbol_database_config, 2, 1234567)
		with rest_settings_env(app_config_path):
			# Act:
			response = _create_symbol_app().test_client().get('/api/symbol/blocks?limit=1')

	# Assert:
	expected = _expected_block_list_item(2, is_finalized=True)
	expected['blockReward'] = 1.234567
	assert 200 == response.status_code
	assert [expected] == response.json


def test_symbol_block_detail_reward(symbol_database_config):
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
		_update_block_reward(symbol_database_config, 2, 2000000)
		with rest_settings_env(app_config_path):
			# Act:
			response = _create_symbol_app().test_client().get('/api/symbol/block/2')

	# Assert:
	expected = _expected_block_detail(2, is_finalized=True)
	expected['blockReward'] = 2.0
	assert 200 == response.status_code
	assert expected == response.json


def test_symbol_receipts_read_db(symbol_database_config):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		receipt = {
			'height': 2,
			'receipt_type': 'harvestFee',
			'receipt_group': 'balanceChange',
			'version': 1,
			'source_primary_id': 0,
			'source_secondary_id': 0,
			'sender_address': SENDER_ADDRESS,
			'recipient_address': RECIPIENT_ADDRESS,
			'target_address': TARGET_ADDRESS,
			'mosaic_id': '72C0212E67A08BCE',
			'amount': 1234567,
			'artifact_id': None,
			'raw_payload': {'type': 'harvestFee'}
		}
		_seed_symbol_receipts(
			symbol_database_config,
			create_symbol_sync_state(last_synced_height=2, finalized_height=2),
			[create_symbol_block(2)],
			[receipt])
		with rest_settings_env(app_config_path):
			# Act:
			response = _create_symbol_app().test_client().get('/api/symbol/receipts')

	# Assert:
	assert 200 == response.status_code
	assert {
		'data': [{
			'version': 1,
			'height': 2,
			'type': 'harvestFee',
			'group': 'balanceChange',
			'targetAddress': str(Network.MAINNET.address_class(TARGET_ADDRESS)),
			'sender': str(Network.MAINNET.address_class(SENDER_ADDRESS)),
			'to': str(Network.MAINNET.address_class(RECIPIENT_ADDRESS)),
			'artifactId': None,
			'mosaics': [{
				'id': NATIVE_MOSAIC_INFO.id,
				'name': NATIVE_MOSAIC_INFO.id,
				'amount': 1.234567,
				'isNative': True
			}]
		}],
		'pagination': {'nextCursor': None}
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
			response = _create_symbol_app().test_client().get('/api/symbol/health')

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
		facade = setup_symbol_facade(app, native_mosaic_info_fetcher=_fetch_test_native_mosaic_info)

	# Assert:
	assert isinstance(facade, SymbolRestFacade)
	assert facade.is_configured()
	assert 'http://localhost:3000' == facade.node_config.base_url


def test_setup_uses_connector_factory():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(temp_directory)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)
		app.config.from_pyfile(app_config_path)

		# Act:
		facade = setup_symbol_facade(app, native_mosaic_info_fetcher=_fetch_setup_native_mosaic_info)

	# Assert:
	assert NativeMosaicInfo('72C0212E67A08BCE', 3) == facade.native_mosaic_info


def test_setup_rejects_bad_native_info():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(temp_directory)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)
		app.config.from_pyfile(app_config_path)

		# Act + Assert:
		with pytest.raises(ValueError, match='Mosaic response must include mosaic.divisibility'):
			setup_symbol_facade(app, native_mosaic_info_fetcher=_fetch_bad_native_mosaic_info)


def test_setup_uses_native_fetcher():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(temp_directory)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		app = Flask(__name__)
		app.config.from_pyfile(app_config_path)

		def native_fetcher(_node_config):
			return NativeMosaicInfo('ABCDEF0123456789', 2)

		# Act:
		facade = setup_symbol_facade(app, native_mosaic_info_fetcher=native_fetcher)

	# Assert:
	assert NativeMosaicInfo('ABCDEF0123456789', 2) == facade.native_mosaic_info


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
		facade = setup_symbol_facade(app, native_mosaic_info_fetcher=_fetch_test_native_mosaic_info)

	# Assert:
	health = facade.get_health()
	assert isinstance(facade, SymbolRestFacade)
	assert not facade.is_configured()
	assert create_symbol_health(errors=[{
		'type': 'database',
		'message': 'Symbol database is unavailable'
	}]) == health


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
