import json

import pytest
from common.symbol.NativeMosaic import NativeMosaicInfo
from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from flask import Flask
from symbolchain.sc import TransactionType

from rest import setup_error_handlers
from rest.db.SymbolDatabase import SymbolDatabase
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.routes.symbol import setup_symbol_routes

from .test.SymbolBlockTestUtils import create_symbol_block, create_symbol_sync_state
from .test.SymbolDatabaseTestUtils import create_safe_repairing_sync_state, symbol_test_database
from .test.SymbolMosaicTestUtils import create_symbol_mosaic
from .test.SymbolTransactionTestUtils import create_symbol_mosaic_transfer, create_symbol_transaction

NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)
TESTNET_SENDER = bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')
TESTNET_RECIPIENT = bytes.fromhex('98534F7E1D0A26CA4E316F901E23E55C8701DB20DF11A7B2')


def test_parent_child_full_json():
	# Arrange:
	with symbol_test_database(
		create_symbol_sync_state(last_synced_height=1, finalized_height=1),
		[create_symbol_block(1)]) as (db_config, puller_database):
		parent = create_symbol_transaction(
			1,
			10,
			type=TransactionType.AGGREGATE_COMPLETE.value,
			hash=bytes.fromhex('AA' * 32),
			recipient_address=None,
			signer_address=TESTNET_SENDER)
		child = create_symbol_transaction(
			1,
			0,
			is_embedded=True,
			signer_address=TESTNET_SENDER,
			recipient_address=TESTNET_RECIPIENT,
			message_type='plain',
			message_payload='48656C6C6F',
			raw_payload={'mosaics': [{'id': '8000000000000001', 'amount': '12345'}]},
			mosaic_rows=[{
				'mosaic_id': '1234567890ABCDEF',
				'amount': 12345,
				'role': 'transfer',
				'position': 0
			}])
		puller_database.upsert_transactions_for_height(1, [parent, child])
		puller_database.upsert_mosaic(create_symbol_mosaic('1234567890ABCDEF', 2))

		database = SymbolDatabase(db_config, NATIVE_MOSAIC_INFO)
		app = Flask(__name__)
		setup_error_handlers(app)
		facade = SymbolRestFacade(
			database,
			SymbolNodeConfiguration.from_url('http://127.0.0.1:3000', allow_loopback=True),
			NATIVE_MOSAIC_INFO)
		setup_symbol_routes(app, facade)

		# Act:
		try:
			client = app.test_client()
			response = client.get('/api/symbol/transactions?embedded=true')
		finally:
			database.close()

	# Assert:
	assert 200 == response.status_code
	assert [
		{
			'hash': None,
			'isEmbedded': True,
			'aggregateHash': 'AA' * 32,
			'embeddedIndex': 0,
			'height': 1,
			'type': 'TRANSFER',
			'sender': 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
			'recipient': 'TBJU67Q5BITMUTRRN6IB4I7FLSDQDWZA34I2PMQ',
			'value': [{'id': '1234567890ABCDEF', 'name': '1234567890ABCDEF', 'amount': 123.45}],
			'amount': 0,
			'fee': None,
			'timestamp': '2026-01-01T00:00:01Z',
			'message': {'type': 'plain', 'text': 'Hello'}
		},
		{
			'hash': 'AA' * 32,
			'isEmbedded': False,
			'aggregateHash': None,
			'embeddedIndex': None,
			'height': 1,
			'type': 'AGGREGATE_COMPLETE',
			'sender': 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
			'recipient': None,
			'value': [],
			'amount': 0,
			'fee': 0.000001,
			'timestamp': '2026-01-01T00:00:01Z',
			'message': None
		}
	] == response.json


def test_no_match_returns_200_empty():
	# Arrange:
	with symbol_test_database(
		create_symbol_sync_state(last_synced_height=1, finalized_height=1),
		[create_symbol_block(1)]) as (db_config, _puller_database):
		_puller_database.upsert_transactions_for_height(1, [create_symbol_transaction(1, 1)])
		database, client = _create_transaction_test_client(db_config)
		try:
			# Act:
			response = client.get(f'/api/symbol/transactions?type={TransactionType.MOSAIC_METADATA.value}')
		finally:
			database.close()

	# Assert:
	assert 200 == response.status_code
	assert [] == response.json


@pytest.mark.parametrize('state_name', ['dirty', 'repairing'])
def test_native_only_no_mosaic_table_200(state_name):
	# Arrange:
	sync_state = _create_non_public_sync_state(state_name)
	transaction = create_symbol_mosaic_transfer(2, 1, NATIVE_MOSAIC_INFO.id, 12345678)
	with symbol_test_database(sync_state, [create_symbol_block(2)]) as (db_config, puller_database):
		puller_database.upsert_transactions_for_height(2, [transaction])
		puller_database.upsert_mosaic(create_symbol_mosaic(NATIVE_MOSAIC_INFO.id, 3))
		_save_mosaic_alias_names(puller_database, NATIVE_MOSAIC_INFO.id, ['unsafe-native-name'])
		database, client = _create_transaction_test_client(db_config)
		was_renamed = False
		try:
			with puller_database.connection.cursor() as cursor:
				cursor.execute('ALTER TABLE symbol_mosaics RENAME TO symbol_mosaics_hidden_for_test')
			puller_database.connection.commit()
			was_renamed = True

			# Act:
			response = client.get('/api/symbol/transactions?height=2')
		finally:
			if was_renamed:
				with puller_database.connection.cursor() as cursor:
					cursor.execute('ALTER TABLE symbol_mosaics_hidden_for_test RENAME TO symbol_mosaics')
				puller_database.connection.commit()
			database.close()

	# Assert:
	assert 200 == response.status_code
	assert [{
		'hash': '00' * 31 + '01',
		'isEmbedded': False,
		'aggregateHash': None,
		'embeddedIndex': None,
		'height': 2,
		'type': 'TRANSFER',
		'sender': 'NCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ7HNAPI',
		'recipient': 'ND3I6ZLS22YLJIL7AIQHOAN34AOUSRNK6NTDVKQ',
		'value': [{'id': NATIVE_MOSAIC_INFO.id, 'name': NATIVE_MOSAIC_INFO.id, 'amount': 12.345678}],
		'amount': 12.345678,
		'fee': 0.000002,
		'timestamp': '2026-01-01T00:00:02Z',
		'message': None
	}] == response.json


def test_clean_saved_native_name_and_div():
	# Arrange:
	transaction = create_symbol_mosaic_transfer(2, 1, NATIVE_MOSAIC_INFO.id, 12345678)
	with symbol_test_database(
		create_symbol_sync_state(last_synced_height=2, finalized_height=2),
		[create_symbol_block(2)]) as (db_config, puller_database):
		puller_database.upsert_transactions_for_height(2, [transaction])
		puller_database.upsert_mosaic(create_symbol_mosaic(NATIVE_MOSAIC_INFO.id, 3))
		_save_mosaic_alias_names(puller_database, NATIVE_MOSAIC_INFO.id, ['saved-native-name'])
		database, client = _create_transaction_test_client(db_config)
		try:
			# Act:
			response = client.get('/api/symbol/transactions?height=2')
		finally:
			database.close()

	# Assert:
	assert 200 == response.status_code
	assert 'saved-native-name' == response.json[0]['value'][0]['name']
	assert 12.345678 == response.json[0]['value'][0]['amount']
	assert 12.345678 == response.json[0]['amount']


@pytest.mark.parametrize('state_name', ['dirty', 'repairing'])
def test_non_native_unavailable_503(state_name):
	# Arrange:
	sync_state = _create_non_public_sync_state(state_name)
	transaction = create_symbol_mosaic_transfer(2, 1, '1234567890ABCDEF', 12345)
	with symbol_test_database(sync_state, [create_symbol_block(2)]) as (db_config, puller_database):
		puller_database.upsert_transactions_for_height(2, [transaction])
		puller_database.upsert_mosaic(create_symbol_mosaic('1234567890ABCDEF', 2))
		database, client = _create_transaction_test_client(db_config)
		try:
			# Act:
			response = client.get('/api/symbol/transactions?height=2')
		finally:
			database.close()

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def _create_non_public_sync_state(state_name):
	if 'dirty' == state_name:
		return create_symbol_sync_state(
			last_synced_height=3,
			finalized_height=2,
			dirty_state_from_height=3)

	return create_safe_repairing_sync_state()


def _save_mosaic_alias_names(puller_database, mosaic_id, alias_names):
	with puller_database.connection.cursor() as cursor:
		cursor.execute(
			'UPDATE symbol_mosaics SET alias_names = %s::jsonb WHERE mosaic_id = %s',
			(json.dumps(alias_names), mosaic_id))
	puller_database.connection.commit()


def _create_transaction_test_client(db_config):
	database = SymbolDatabase(db_config, NATIVE_MOSAIC_INFO)
	app = Flask(__name__)
	setup_error_handlers(app)
	facade = SymbolRestFacade(
		database,
		SymbolNodeConfiguration.from_url('http://127.0.0.1:3000', allow_loopback=True),
		NATIVE_MOSAIC_INFO)
	setup_symbol_routes(app, facade)
	return database, app.test_client()
