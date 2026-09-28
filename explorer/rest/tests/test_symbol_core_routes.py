import json
import tempfile
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from unittest.mock import patch

import pytest
from common.symbol.NativeMosaic import NativeMosaicInfo, NativeMosaicValidationError
from common.symbol.NodeConfiguration import SymbolNodeConfigurationError
from common.tests.PostgresTestUtils import PostgresTestDatabase, create_unreachable_db_configuration, drop_symbol_block_tables_if_present
from flask import Flask
from puller.db.SymbolDatabase import SymbolDatabase as PullerSymbolDatabase

from rest import create_app, setup_symbol_facade
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.model.common import DatabaseConfig
from rest.routes.symbol import setup_symbol_routes

from .test.EnvTestUtils import rest_settings_env
from .test.SymbolBlockTestUtils import create_symbol_block, create_symbol_importance_block, create_symbol_receipt, create_symbol_sync_state
from .test.SymbolHealthTestUtils import create_symbol_health

NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)


class RecordingHTTPServer(ThreadingHTTPServer):
	def __init__(self, server_address, request_handler):
		super().__init__(server_address, request_handler)
		self.request_paths = []


@contextmanager
def _running_http_server(request_handler):
	server = RecordingHTTPServer(('127.0.0.1', 0), request_handler)
	thread = Thread(target=server.serve_forever)
	thread.start()
	try:
		yield server
	finally:
		server.shutdown()
		thread.join()
		server.server_close()


def _create_json_handler():
	class JsonHandler(BaseHTTPRequestHandler):
		def do_GET(self):  # pylint: disable=invalid-name
			self.server.request_paths.append(self.path)
			body = json.dumps({'chain': {}}).encode('utf8')
			self.send_response(200)
			self.send_header('Content-Type', 'application/json')
			self.send_header('Content-Length', str(len(body)))
			self.end_headers()
			self.wfile.write(body)

		def log_message(self, _format, *args):  # pylint: disable=arguments-differ,unused-argument
			return

	return JsonHandler


def _create_symbol_app():
	return create_app()


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
	symbol_node_url='http://localhost:3000',
	native_mosaic_id=NATIVE_MOSAIC_INFO.id
):
	app_config_path = Path(config_dir) / 'app.config'
	with open(app_config_path, 'wt', encoding='utf8') as app_config_file:
		app_config_file.write('REST_CHAIN="symbol"\n')
		app_config_file.write(f'DATABASE_CONFIG_FILEPATH="{db_config_path}"\n')
		if native_mosaic_id is not None:
			app_config_file.write(f'SYMBOL_NATIVE_MOSAIC_ID={native_mosaic_id!r}\n')
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


def _get_symbol_response(database_config, sync_state, blocks, path):
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		_seed_symbol_block_tables(database_config, sync_state, blocks)
		with rest_settings_env(app_config_path):
			return _create_symbol_app().test_client().get(path)


def _expected_block_list_item(height, is_finalized, block_reward=None):
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
		'blockReward': block_reward,
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


def _expected_receipt(  # pylint: disable=too-many-arguments,too-many-positional-arguments
	receipt_type, receipt_group, target_address=None, mosaic_id=None, expected_amount=0, artifact_id=None):
	mosaics = []
	if mosaic_id:
		mosaics = [{
			'id': mosaic_id,
			'name': mosaic_id,
			'amount': expected_amount,
			'isNative': True
		}]

	return {
		'version': 1,
		'height': 2,
		'type': receipt_type,
		'group': receipt_group,
		'targetAddress': target_address,
		'sender': None,
		'to': None,
		'artifactId': artifact_id,
		'mosaics': mosaics
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


def test_symbol_blocks_reads_rewards(symbol_database_config):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)

		_seed_symbol_block_tables(
			symbol_database_config,
			create_symbol_sync_state(last_synced_height=3, finalized_height=1),
			[
				create_symbol_block(1),
				create_symbol_block(2, block_reward=0),
				create_symbol_block(3, block_reward=1234567)
			])
		with PullerSymbolDatabase(symbol_database_config) as database:
			database.upsert_receipts_for_height(2, [], 0)
			database.upsert_receipts_for_height(3, [], 1234567)
		with rest_settings_env(app_config_path):
			# Act:
			response = _create_symbol_app().test_client().get(
				'/api/symbol/blocks?limit=3&fromHeight=1&sort=asc')

	# Assert:
	assert 200 == response.status_code
	assert [
		_expected_block_list_item(1, is_finalized=True, block_reward=None),
		_expected_block_list_item(2, is_finalized=False, block_reward=0.0),
		_expected_block_list_item(3, is_finalized=False, block_reward=1.234567)
	] == response.json


def test_uses_xym_divisibility(symbol_database_config):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=symbol_database_config)
		app_config_path = _create_app_config(
			temp_directory,
			db_config_path)

		_seed_symbol_block_tables(
			symbol_database_config,
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[create_symbol_block(1, total_fee=1234567)])
		with PullerSymbolDatabase(symbol_database_config) as database:
			database.upsert_receipts_for_height(1, [], 2345678)
		with rest_settings_env(app_config_path):
			# Act:
			response = _create_symbol_app().test_client().get(
				'/api/symbol/blocks?limit=1&fromHeight=1&sort=asc')

	# Assert:
	assert 200 == response.status_code
	assert 1.234567 == response.json[0]['totalFee']
	assert 2.345678 == response.json[0]['blockReward']


def test_receipts_read_complete_json(symbol_database_config):
	# Arrange: include another-height receipt to verify block-owned filtering.
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		_seed_symbol_block_tables(
			symbol_database_config,
			create_symbol_sync_state(last_synced_height=2, finalized_height=1),
			[create_symbol_block(1), create_symbol_block(2)])
		with PullerSymbolDatabase(symbol_database_config) as database:
			target_address = bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')
			database.upsert_receipts_for_height(1, [create_symbol_receipt(1)], 0)
			database.upsert_receipts_for_height(
				2,
				[
					create_symbol_receipt(
						2, 'lockHashCreated', 'balanceChange', target_address=target_address,
						mosaic_id=NATIVE_MOSAIC_INFO.id, amount=1234567),
					create_symbol_receipt(
						2, 'lockHashCompleted', 'balanceChange', target_address=target_address,
						mosaic_id=NATIVE_MOSAIC_INFO.id, amount=2000000),
					create_symbol_receipt(2, 'inflation', 'inflation', mosaic_id=NATIVE_MOSAIC_INFO.id, amount=3000000)
				],
				0)
		with rest_settings_env(app_config_path):
			client = _create_symbol_app().test_client()

			# Act:
			response = client.get(
				'/api/symbol/receipts?limit=2&group=balanceChange'
				'&includedReceiptTypes=12616&includedReceiptTypes=8776'
				'&targetAddress=TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI')
			block_response = client.get('/api/symbol/block/2/receipts')

	# Assert:
	expected_target = 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI'
	assert 200 == response.status_code
	assert [
		_expected_receipt('lockHashCompleted', 'balanceChange', expected_target, NATIVE_MOSAIC_INFO.id, 2.0),
		_expected_receipt('lockHashCreated', 'balanceChange', expected_target, NATIVE_MOSAIC_INFO.id, 1.234567)
	] == response.json
	assert 200 == block_response.status_code
	assert [
		_expected_receipt('inflation', 'inflation', mosaic_id=NATIVE_MOSAIC_INFO.id, expected_amount=3.0),
		_expected_receipt('lockHashCompleted', 'balanceChange', expected_target, NATIVE_MOSAIC_INFO.id, 2.0),
		_expected_receipt('lockHashCreated', 'balanceChange', expected_target, NATIVE_MOSAIC_INFO.id, 1.234567)
	] == block_response.json


def test_block_receipts_empty_or_missing(symbol_database_config):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		_seed_symbol_block_tables(
			symbol_database_config,
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[create_symbol_block(1)])
		with rest_settings_env(app_config_path):
			client = _create_symbol_app().test_client()

			# Act:
			empty_response = client.get('/api/symbol/block/1/receipts')
			missing_response = client.get('/api/symbol/block/2/receipts')

	# Assert:
	assert (200, []) == (empty_response.status_code, empty_response.json)
	assert 404 == missing_response.status_code


def test_dirty_receipts_offset_503(symbol_database_config):
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
				finalized_height=2,
				dirty_state_from_height=3),
			[create_symbol_block(2), create_symbol_block(3)])
		with PullerSymbolDatabase(symbol_database_config) as database:
			database.upsert_receipts_for_height(2, [create_symbol_receipt(2)], 0)
			database.upsert_receipts_for_height(3, [create_symbol_receipt(3)], 0)
		with rest_settings_env(app_config_path):
			client = _create_symbol_app().test_client()

			# Act:
			implicit_response = client.get('/api/symbol/receipts?limit=1')
			offset_page_response = client.get('/api/symbol/receipts?limit=1&offset=1')
			dirty_block_response = client.get('/api/symbol/block/3/receipts')
			safe_block_response = client.get('/api/symbol/block/2/receipts')

	# Assert:
	_assert_request_unavailable(implicit_response)
	_assert_request_unavailable(offset_page_response)
	_assert_request_unavailable(dirty_block_response)
	assert 200 == safe_block_response.status_code
	assert [2] == [item['height'] for item in safe_block_response.json]


def test_dirty_receipts_missing_503_json(symbol_database_config):
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
				finalized_height=2,
				dirty_state_from_height=3),
			[create_symbol_block(2), create_symbol_block(3)])
		with PullerSymbolDatabase(symbol_database_config) as database:
			database.upsert_receipts_for_height(2, [create_symbol_receipt(2)], 0)
		with rest_settings_env(app_config_path):
			# Act:
			response = _create_symbol_app().test_client().get('/api/symbol/receipts?limit=1')

	# Assert:
	assert (503, {
		'status': 503,
		'message': 'Symbol backend data is unavailable'
	}) == (response.status_code, response.json)


def test_repairing_receipts_safe_block(symbol_database_config):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		_seed_symbol_block_tables(
			symbol_database_config,
			create_symbol_sync_state(
				last_synced_height=2,
				finalized_height=1,
				status='repairing',
				dirty_state_from_height=2),
			[create_symbol_block(1), create_symbol_block(2)])
		with PullerSymbolDatabase(symbol_database_config) as database:
			database.upsert_receipts_for_height(1, [create_symbol_receipt(1)], 0)
			database.upsert_receipts_for_height(2, [create_symbol_receipt(2)], 0)
		with rest_settings_env(app_config_path):
			client = _create_symbol_app().test_client()

			# Act:
			safe_response = client.get('/api/symbol/block/1/receipts')
			unsafe_response = client.get('/api/symbol/block/2/receipts')

	# Assert:
	assert 200 == safe_response.status_code
	assert [1] == [item['height'] for item in safe_response.json]
	assert 503 == unsafe_response.status_code


def _assert_request_unavailable(response):
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def _assert_dirty_request_unavailable(database_config, path):
	# Arrange:
	sync_state = create_symbol_sync_state(
		last_synced_height=30,
		finalized_height=10,
		dirty_state_from_height=20)
	blocks = [create_symbol_block(height) for height in range(10, 25)]

	# Act:
	response = _get_symbol_response(database_config, sync_state, blocks, path)

	# Assert:
	_assert_request_unavailable(response)


def test_dirty_crossing_ascending(symbol_database_config):
	_assert_dirty_request_unavailable(symbol_database_config, '/api/symbol/blocks?fromHeight=15&limit=10&sort=asc')


def test_dirty_descending_below_boundary(symbol_database_config):
	# Arrange + Act:
	response = _get_symbol_response(
		symbol_database_config,
		create_symbol_sync_state(last_synced_height=30, finalized_height=10, dirty_state_from_height=20),
		[create_symbol_block(height) for height in range(10, 25)],
		'/api/symbol/blocks?fromHeight=19&limit=10&sort=desc')

	# Assert:
	assert 200 == response.status_code
	assert [
		_expected_block_list_item(height, is_finalized=height <= 10)
		for height in range(19, 9, -1)
	] == response.json


def test_dirty_descending_without_cursor(symbol_database_config):
	_assert_dirty_request_unavailable(symbol_database_config, '/api/symbol/blocks?limit=10&sort=desc')


def test_dirty_boundary_detail(symbol_database_config):
	_assert_dirty_request_unavailable(symbol_database_config, '/api/symbol/block/20')


def test_repairing_safe_detail(symbol_database_config):
	# Arrange + Act:
	response = _get_symbol_response(
		symbol_database_config,
		create_symbol_sync_state(last_synced_height=1, finalized_height=1, status='repairing'),
		[create_symbol_block(1)],
		'/api/symbol/block/1')

	# Assert:
	assert 200 == response.status_code
	assert _expected_block_detail(1, is_finalized=True) == response.json


def test_repairing_safe_list(symbol_database_config):
	# Arrange + Act:
	response = _get_symbol_response(
		symbol_database_config,
		create_symbol_sync_state(last_synced_height=1, finalized_height=1, status='repairing'),
		[create_symbol_block(1)],
		'/api/symbol/blocks?fromHeight=1&limit=1&sort=asc')

	# Assert:
	assert 200 == response.status_code
	assert [_expected_block_list_item(1, is_finalized=True)] == response.json


def _assert_repairing_request_unavailable(database_config, path):
	# Arrange:
	sync_state = create_symbol_sync_state(
		last_synced_height=1,
		finalized_height=1,
		status='repairing')
	blocks = [create_symbol_block(1)]

	# Act:
	response = _get_symbol_response(database_config, sync_state, blocks, path)

	# Assert:
	_assert_request_unavailable(response)


def test_repairing_crossing_head(symbol_database_config):
	_assert_repairing_request_unavailable(symbol_database_config, '/api/symbol/blocks?fromHeight=1&limit=2&sort=asc')


def test_repairing_asc_without_cursor(symbol_database_config):
	_assert_repairing_request_unavailable(symbol_database_config, '/api/symbol/blocks?limit=2&sort=asc')


def test_repairing_above_head_detail(symbol_database_config):
	_assert_repairing_request_unavailable(symbol_database_config, '/api/symbol/block/2')


def test_repairing_ascending_above_head(symbol_database_config):
	_assert_repairing_request_unavailable(symbol_database_config, '/api/symbol/blocks?fromHeight=2&limit=1&sort=asc')


def test_repairing_descending_above_head(symbol_database_config):
	_assert_repairing_request_unavailable(symbol_database_config, '/api/symbol/blocks?fromHeight=2&limit=1&sort=desc')


def test_above_watermark_list(symbol_database_config):
	# Arrange + Act:
	response = _get_symbol_response(
		symbol_database_config,
		create_symbol_sync_state(last_synced_height=3, finalized_height=2),
		[create_symbol_block(height) for height in range(1, 4)],
		'/api/symbol/blocks?fromHeight=4&limit=10&sort=asc')

	# Assert:
	assert 200 == response.status_code
	assert [] == response.json


def test_above_watermark_detail(symbol_database_config):
	# Arrange + Act:
	response = _get_symbol_response(
		symbol_database_config,
		create_symbol_sync_state(last_synced_height=3, finalized_height=2),
		[create_symbol_block(height) for height in range(1, 4)],
		'/api/symbol/block/4')

	# Assert:
	assert 404 == response.status_code
	assert {'status': 404, 'message': 'Resource not found'} == response.json


def test_symbol_clean_short_asc_page(symbol_database_config):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=symbol_database_config)
		app_config_path = _create_app_config(temp_directory, db_config_path)
		_seed_symbol_block_tables(
			symbol_database_config,
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[create_symbol_block(1)])
		with rest_settings_env(app_config_path):
			# Act:
			response = _create_symbol_app().test_client().get(
				'/api/symbol/blocks?fromHeight=1&limit=2&sort=asc')

	# Assert:
	assert 200 == response.status_code
	assert [_expected_block_list_item(1, is_finalized=True)] == response.json


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
				_create_symbol_app()


@pytest.mark.parametrize(('path', 'status', 'expected_json'), [
	('/api/symbol/health', 200, create_symbol_health(errors=[{'type': 'database', 'message': 'Symbol database is unavailable'}])),
	('/api/symbol/receipts', 503, {'status': 503, 'message': 'Symbol backend data is unavailable'}),
	('/api/symbol/block/1/receipts', 503, {'status': 503, 'message': 'Symbol backend data is unavailable'})
])
def test_initial_db_failure_responses(path, status, expected_json):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=create_unreachable_db_configuration())
		app_config_path = _create_app_config(temp_directory, db_config_path)

		with rest_settings_env(app_config_path):
			# Act:
			response = _create_symbol_app().test_client().get(path)

	# Assert:
	assert status == response.status_code
	assert expected_json == response.json


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
				_create_symbol_app()


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
				_create_symbol_app()


def test_symbol_facade_config(symbol_database_config):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=symbol_database_config)
		app_config_path = _create_app_config(
			temp_directory,
			db_config_path,
			native_mosaic_id="0x72c0'212e'67a0'8bce")
		app = Flask(__name__)
		app.config.from_pyfile(app_config_path)

		# Act:
		facade = setup_symbol_facade(app)

	# Assert:
	assert isinstance(facade, SymbolRestFacade)
	assert facade.is_configured()
	assert 'http://localhost:3000' == facade.node_config.base_url
	assert NATIVE_MOSAIC_INFO == facade.native_mosaic_info


@pytest.mark.parametrize('native_mosaic_id,exception_type,error_message', [
	(None, ValueError, 'SYMBOL_NATIVE_MOSAIC_ID is required'),
	('', NativeMosaicValidationError, 'Mosaic id must be 16 hex digits'),
	('not-a-mosaic-id', NativeMosaicValidationError, 'Mosaic id must be 16 hex digits')
])
def test_symbol_setup_bad_native_config(
	native_mosaic_id,
	exception_type,
	error_message
):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=create_unreachable_db_configuration())
		app_config_path = _create_app_config(
			temp_directory,
			db_config_path,
			native_mosaic_id=native_mosaic_id)

		with rest_settings_env(app_config_path):
			# Act + Assert:
			with pytest.raises(exception_type, match=error_message):
				_create_symbol_app()


def test_bad_native_id_skips_database():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = _create_config_file(
			temp_directory,
			database_config=create_unreachable_db_configuration())
		app_config_path = _create_app_config(
			temp_directory,
			db_config_path,
			native_mosaic_id='not-a-mosaic-id')

		with patch('rest.db.DatabaseConnection.pool.SimpleConnectionPool') as create_pool:
			with rest_settings_env(app_config_path):
				# Act:
				with pytest.raises(NativeMosaicValidationError, match='Mosaic id must be 16 hex digits'):
					_create_symbol_app()

	# Assert:
	assert 0 == create_pool.call_count


def test_native_info_is_app_scoped():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		first_config_dir = Path(temp_directory) / 'first'
		second_config_dir = Path(temp_directory) / 'second'
		first_config_dir.mkdir()
		second_config_dir.mkdir()
		first_db_config_path = _create_config_file(
			first_config_dir,
			database_config=create_unreachable_db_configuration())
		second_db_config_path = _create_config_file(
			second_config_dir,
			database_config=create_unreachable_db_configuration())
		first_app_config_path = _create_app_config(
			first_config_dir,
			first_db_config_path,
			native_mosaic_id='0000000000000001')
		second_app_config_path = _create_app_config(
			second_config_dir,
			second_db_config_path,
			native_mosaic_id='0000000000000002')

		first_app = Flask(__name__)
		first_app.config.from_pyfile(first_app_config_path)
		second_app = Flask(__name__)
		second_app.config.from_pyfile(second_app_config_path)

		# Act:
		first_facade = setup_symbol_facade(first_app)
		second_facade = setup_symbol_facade(second_app)

	# Assert:
	assert NativeMosaicInfo('0000000000000001', 6) == first_facade.native_mosaic_info
	assert NativeMosaicInfo('0000000000000002', 6) == second_facade.native_mosaic_info


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


def test_native_setup_list_skips_get(symbol_database_config):
	# Arrange:
	with _running_http_server(_create_json_handler()) as node_server:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = _create_config_file(
				temp_directory,
				database_config=symbol_database_config)
			app_config_path = _create_app_config(
				temp_directory,
				db_config_path,
				symbol_node_url=f'http://127.0.0.1:{node_server.server_port}')
			_seed_symbol_block_tables(
				symbol_database_config,
				create_symbol_sync_state(last_synced_height=1, finalized_height=1),
				[create_symbol_block(1)])
			app = Flask(__name__)
			app.config.from_pyfile(app_config_path)
			app.config['SYMBOL_NODE_ALLOWED_HOSTS'] = f'127.0.0.1:{node_server.server_port}'

			# Act: setup and block-list conversion use native mosaic info without an HTTP GET to the configured node.
			facade = setup_symbol_facade(app)
			setup_symbol_routes(app, facade)
			response = app.test_client().get('/api/symbol/blocks?limit=1&fromHeight=1&sort=asc')

	# Assert:
	assert 200 == response.status_code
	assert [_expected_block_list_item(1, is_finalized=True)] == response.json
	# The recording server tracks GET requests only; this proves the configured node received zero GETs.
	assert not node_server.request_paths
