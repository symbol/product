import json
from contextlib import contextmanager

import pytest
from common.symbol.NativeMosaic import NativeMosaicInfo
from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from flask import Flask
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Network

from rest import setup_error_handlers
from rest.db.SymbolDatabase import SymbolDatabase
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.routes.symbol import setup_symbol_routes

from .test.SymbolBlockTestUtils import create_symbol_block, create_symbol_sync_state
from .test.SymbolDatabaseTestUtils import create_safe_repairing_sync_state, symbol_test_database
from .test.SymbolMosaicTestUtils import create_symbol_mosaic
from .test.SymbolTransactionTestUtils import create_symbol_mosaic_transfer, create_symbol_namespace, create_symbol_transaction

NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)
TESTNET_SENDER = bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')
TESTNET_RECIPIENT = bytes.fromhex('98534F7E1D0A26CA4E316F901E23E55C8701DB20DF11A7B2')
ALIAS_ID = '887E5DB6BB0B21F5'
ALIAS_TARGET_MOSAIC_ID = '1234567890ABCDEF'


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

		# Act:
		with _create_transaction_test_client(db_config) as client:
			response = client.get('/api/symbol/transactions?embedded=true')

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
		with _create_transaction_test_client(db_config) as client:
			# Act:
			response = client.get(f'/api/symbol/transactions?type={TransactionType.MOSAIC_METADATA.value}')

	# Assert:
	assert 200 == response.status_code
	assert [] == response.json


@pytest.mark.parametrize('mosaic_input', ['daoka.coin', ALIAS_ID.lower(), ALIAS_TARGET_MOSAIC_ID.lower()])
def test_alias_inputs_return_same_json(mosaic_input):
	# Arrange:
	with _alias_search_fixture() as client:
		# Act:
		response = client.get('/api/symbol/transactions', query_string={'transferMosaicId': mosaic_input, 'height': 8})

	# Assert:
	assert 200 == response.status_code
	assert [_expected_alias_transaction('00' * 31 + '07', 8, 777.77)] == response.json


def test_alias_search_uses_current_link_at_requested_historical_height():  # pylint: disable=invalid-name
	# Arrange: the fixture overwrites old A at height 4 with current B observed at height 8.
	with _alias_search_fixture() as client:
		# Act: both A and B have transfers at height 4; only B is searched.
		response = client.get('/api/symbol/transactions?transferMosaicId=daoka.coin&height=4')

	# Assert:
	assert 200 == response.status_code
	assert [
		_expected_alias_transaction('00' * 31 + '04', 4, 444.44),
		_expected_alias_transaction(
			'00' * 31 + '03', 4, 333.33,
			sender='TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI', recipient='TBJU67Q5BITMUTRRN6IB4I7FLSDQDWZA34I2PMQ'),
		_expected_alias_transaction('00' * 31 + '02', 4, 222.22)
	] == response.json


def test_alias_filters_use_and():
	# Arrange:
	with _alias_search_fixture() as client:
		# Act:
		response = client.get(
			f'/api/symbol/transactions?transferMosaicId=daoka.coin&height=4&type={TransactionType.TRANSFER.value}'
			'&address=NCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ7HNAPI')
		wrong_type_response = client.get(
			f'/api/symbol/transactions?transferMosaicId=daoka.coin&type={TransactionType.MOSAIC_SUPPLY_CHANGE.value}'
			'&address=NCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ7HNAPI')

	# Assert:
	assert 200 == response.status_code
	assert [
		_expected_alias_transaction('00' * 31 + '04', 4, 444.44),
		_expected_alias_transaction('00' * 31 + '02', 4, 222.22)
	] == response.json
	assert 200 == wrong_type_response.status_code
	assert [] == wrong_type_response.json


def test_alias_embedded_opt_in():
	# Arrange:
	with _alias_search_fixture() as client:
		# Act:
		response = client.get(
			'/api/symbol/transactions?transferMosaicId=daoka.coin&height=4&embedded=true'
			'&address=NCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ7HNAPI')

	# Assert: default exclusion is checked by the preceding historical/address queries.
	assert 200 == response.status_code
	assert [
		_expected_alias_transaction(None, 4, 555.55, isEmbedded=True, aggregateHash='AA' * 32, embeddedIndex=0, fee=None),
		_expected_alias_transaction('00' * 31 + '04', 4, 444.44),
		_expected_alias_transaction('00' * 31 + '02', 4, 222.22)
	] == response.json


def test_alias_orders_height_before_id():
	# Arrange:
	with _alias_search_fixture() as client:
		# Act:
		response = client.get(
			'/api/symbol/transactions?transferMosaicId=daoka.coin&address=NCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ7HNAPI')

	# Assert:
	assert 200 == response.status_code
	assert [
		_expected_alias_transaction('00' * 31 + '07', 8, 777.77),
		_expected_alias_transaction('00' * 31 + '04', 4, 444.44),
		_expected_alias_transaction('00' * 31 + '02', 4, 222.22)
	] == response.json


def test_alias_pages_after_filters():
	# Arrange:
	with _alias_search_fixture() as client:
		# Act:
		response = client.get(
			'/api/symbol/transactions?transferMosaicId=daoka.coin&limit=1&offset=2&embedded=true'
			'&address=NCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ7HNAPI')

	# Assert:
	assert 200 == response.status_code
	assert [_expected_alias_transaction('00' * 31 + '04', 4, 444.44)] == response.json


@pytest.mark.parametrize('end_height, expected_status, expected_body', [
	(None, 200, []),
	(4, 200, []),
	(3, 404, {'status': 404, 'message': 'Resource not found'}),
	(2, 404, {'status': 404, 'message': 'Resource not found'})
])
def test_alias_expiry_uses_latest_height(end_height, expected_status, expected_body):
	# Arrange:
	with symbol_test_database(create_symbol_sync_state(last_synced_height=3, finalized_height=2)) as (db_config, puller_database):
		puller_database.upsert_namespace(create_symbol_namespace(end_height=end_height), [])
		with _create_transaction_test_client(db_config) as client:
			# Act:
			response = client.get('/api/symbol/transactions?transferMosaicId=daoka.coin&height=1')

	# Assert:
	assert expected_status == response.status_code
	assert expected_body == response.json


@pytest.mark.parametrize('namespace_overrides', [
	None,
	{'alias_type': 'none', 'alias_mosaic_id': None},
	{'alias_type': 'address', 'alias_mosaic_id': None, 'alias_address': bytes(24)},
	{'end_height': 3}
])
def test_unresolved_alias_returns_404(namespace_overrides):
	# Arrange:
	with symbol_test_database(
		create_symbol_sync_state(last_synced_height=3, finalized_height=2),
		[create_symbol_block(3)]) as (db_config, puller_database):
		if namespace_overrides is not None:
			puller_database.upsert_namespace(create_symbol_namespace(**namespace_overrides), [])
		with _create_transaction_test_client(db_config) as client:
			# Act:
			response = client.get('/api/symbol/transactions?transferMosaicId=daoka.coin')

	# Assert:
	assert 404 == response.status_code
	assert {'status': 404, 'message': 'Resource not found'} == response.json


@pytest.mark.parametrize('overrides', [
	{'alias_mosaic_id': 'not-a-mosaic-id'},
	{'alias_mosaic_id': None, 'end_height': 2},
	{'alias_mosaic_id': ALIAS_ID},
	{'start_height': 0},
	{'end_height': 1}
])
def test_corrupt_alias_data_returns_503(overrides):
	# Arrange:
	with symbol_test_database(
		create_symbol_sync_state(last_synced_height=3, finalized_height=2),
		[create_symbol_block(3)]) as (db_config, puller_database):
		puller_database.upsert_namespace(create_symbol_namespace(**overrides), [])
		with _create_transaction_test_client(db_config) as client:
			# Act:
			response = client.get('/api/symbol/transactions?transferMosaicId=daoka.coin')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


@pytest.mark.parametrize('state_name', ['dirty', 'repairing'])
def test_alias_search_returns_503_for_unsafe_state_even_with_native_target_and_no_matches(state_name):  # pylint: disable=invalid-name
	# Arrange:
	with symbol_test_database(
		_create_non_public_sync_state(state_name),
		[create_symbol_block(2)]) as (db_config, puller_database):
		puller_database.upsert_namespace(create_symbol_namespace(alias_mosaic_id=NATIVE_MOSAIC_INFO.id), [])
		with _create_transaction_test_client(db_config) as client:
			# Act:
			response = client.get('/api/symbol/transactions?transferMosaicId=daoka.coin&height=1&limit=1')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_alias_search_prioritizes_unavailable_state_over_missing_namespace():  # pylint: disable=invalid-name
	# Arrange: historical height 1 remains readable, but current state is unsafe and no namespace is saved.
	with symbol_test_database(
		_create_non_public_sync_state('dirty'),
		[create_symbol_block(1), create_symbol_block(2)]) as (db_config, _):
		with _create_transaction_test_client(db_config) as client:
			# Act:
			historical_response = client.get('/api/symbol/transactions?height=1')
			alias_response = client.get('/api/symbol/transactions?transferMosaicId=daoka.coin&height=1')

	# Assert: current-state availability takes precedence over the missing namespace's 404.
	assert 200 == historical_response.status_code
	assert [] == historical_response.json
	assert 503 == alias_response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == alias_response.json


def test_direct_mosaic_search_succeeds_without_namespace_table():  # pylint: disable=invalid-name
	# Arrange:
	with symbol_test_database(
		create_symbol_sync_state(last_synced_height=2, finalized_height=1),
		[create_symbol_block(2)]) as (db_config, puller_database):
		puller_database.upsert_transactions_for_height(2, [create_symbol_mosaic_transfer(2, 1, NATIVE_MOSAIC_INFO.id, 12345678)])
		with puller_database.connection.cursor() as cursor:
			cursor.execute('ALTER TABLE symbol_namespaces RENAME TO symbol_namespaces_hidden_for_test')
		puller_database.connection.commit()
		try:
			# Act:
			with _create_transaction_test_client(db_config) as client:
				response = client.get(f'/api/symbol/transactions?transferMosaicId={NATIVE_MOSAIC_INFO.id}')
				alias_response = client.get('/api/symbol/transactions?transferMosaicId=daoka.coin')
		finally:
			with puller_database.connection.cursor() as cursor:
				cursor.execute('ALTER TABLE symbol_namespaces_hidden_for_test RENAME TO symbol_namespaces')
			puller_database.connection.commit()

	# Assert:
	assert 200 == response.status_code
	assert [_expected_alias_transaction(
		'00' * 31 + '01', 2, 12.345678,
		value=[{'id': NATIVE_MOSAIC_INFO.id, 'name': NATIVE_MOSAIC_INFO.id, 'amount': 12.345678}],
		amount=12.345678)] == response.json
	assert 503 == alias_response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == alias_response.json


@pytest.mark.parametrize('state_name', ['dirty', 'repairing'])
def test_native_only_no_mosaic_table_200(state_name):
	# Arrange:
	sync_state = _create_non_public_sync_state(state_name)
	transaction = create_symbol_mosaic_transfer(2, 1, NATIVE_MOSAIC_INFO.id, 12345678)
	with symbol_test_database(sync_state, [create_symbol_block(2)]) as (db_config, puller_database):
		puller_database.upsert_transactions_for_height(2, [transaction])
		puller_database.upsert_mosaic(create_symbol_mosaic(NATIVE_MOSAIC_INFO.id, 3))
		_save_mosaic_alias_names(puller_database, NATIVE_MOSAIC_INFO.id, ['unsafe-native-name'])
		with _create_transaction_test_client(db_config) as client:
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
		with _create_transaction_test_client(db_config) as client:
			# Act:
			response = client.get('/api/symbol/transactions?height=2')

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
		with _create_transaction_test_client(db_config) as client:
			# Act:
			response = client.get('/api/symbol/transactions?height=2')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_repair_markerless_list_503():
	# Arrange:
	sync_state = create_symbol_sync_state(last_synced_height=2, finalized_height=1, status='repairing')
	with symbol_test_database(sync_state, [create_symbol_block(2)]) as (db_config, puller_database):
		puller_database.upsert_transactions_for_height(2, [create_symbol_transaction(2, 1)])
		with _create_transaction_test_client(db_config) as client:
			# Act:
			response = client.get('/api/symbol/transactions')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_repairing_safe_list_200():
	# Arrange: Dirty marker is above the watermark; no current-state Mosaic data is required.
	sync_state = create_symbol_sync_state(
		last_synced_height=2,
		finalized_height=1,
		status='repairing',
		dirty_state_from_height=3)
	with symbol_test_database(sync_state, [create_symbol_block(2)]) as (db_config, puller_database):
		puller_database.upsert_transactions_for_height(2, [create_symbol_transaction(2, 1)])
		with _create_transaction_test_client(db_config) as client:
			# Act:
			response = client.get('/api/symbol/transactions')

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
		'value': [],
		'amount': 0,
		'fee': 0.000002,
		'timestamp': '2026-01-01T00:00:02Z',
		'message': None
	}] == response.json


def _expected_alias_transaction(hash_value, height, value_amount, **overrides):
	return {
		'hash': hash_value,
		'isEmbedded': False,
		'aggregateHash': None,
		'embeddedIndex': None,
		'height': height,
		'type': 'TRANSFER',
		'sender': 'NCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ7HNAPI',
		'recipient': 'ND3I6ZLS22YLJIL7AIQHOAN34AOUSRNK6NTDVKQ',
		'value': [{'id': ALIAS_TARGET_MOSAIC_ID, 'name': ALIAS_TARGET_MOSAIC_ID, 'amount': value_amount}],
		'amount': 0,
		'fee': height / 1000000,
		'timestamp': f'2026-01-01T00:00:{height:02d}Z',
		'message': None,
		**overrides
	}


@contextmanager
def _alias_search_fixture():
	old_mosaic_id = '234567890ABCDEF0'
	parent = create_symbol_transaction(4, 10, type=TransactionType.AGGREGATE_COMPLETE.value, hash=bytes.fromhex('AA' * 32))
	embedded = create_symbol_transaction(
		4, 0, is_embedded=True,
		mosaic_rows=[{'mosaic_id': ALIAS_TARGET_MOSAIC_ID, 'amount': 55555, 'role': 'transfer', 'position': 0}])
	other_address_transfer = create_symbol_transaction(
		4, 3, signer_address=TESTNET_SENDER, recipient_address=TESTNET_RECIPIENT,
		address_rows=[{'address': TESTNET_SENDER, 'role': 'signer'}, {'address': TESTNET_RECIPIENT, 'role': 'recipient'}],
		mosaic_rows=[{'mosaic_id': ALIAS_TARGET_MOSAIC_ID, 'amount': 33333, 'role': 'transfer', 'position': 0}])
	with symbol_test_database(
		create_symbol_sync_state(last_synced_height=8, finalized_height=7),
		[create_symbol_block(height) for height in (4, 8, 9)],
		[create_symbol_mosaic(ALIAS_TARGET_MOSAIC_ID, 2)]) as (db_config, puller_database):
		# Insert a newer height first so ID-only ordering cannot pass the height-order assertions.
		puller_database.upsert_transactions_for_height(8, [create_symbol_mosaic_transfer(8, 7, ALIAS_TARGET_MOSAIC_ID, 77777)])
		puller_database.upsert_transactions_for_height(4, [
			create_symbol_mosaic_transfer(4, 1, old_mosaic_id, 11111),
			create_symbol_mosaic_transfer(4, 2, ALIAS_TARGET_MOSAIC_ID, 22222),
			other_address_transfer,
			create_symbol_mosaic_transfer(4, 4, ALIAS_TARGET_MOSAIC_ID, 44444),
			parent, embedded])
		puller_database.upsert_transactions_for_height(9, [create_symbol_mosaic_transfer(9, 8, ALIAS_TARGET_MOSAIC_ID, 88888)])
		puller_database.upsert_namespace(create_symbol_namespace(alias_mosaic_id=old_mosaic_id, updated_at_height=4), [])
		puller_database.upsert_namespace(create_symbol_namespace(alias_mosaic_id=ALIAS_TARGET_MOSAIC_ID, updated_at_height=8), [])
		with _create_transaction_test_client(db_config) as client:
			yield client


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


@contextmanager
def _create_transaction_test_client(db_config):
	with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
		app = Flask(__name__)
		setup_error_handlers(app)
		facade = SymbolRestFacade(
			database,
			SymbolNodeConfiguration.from_url('http://127.0.0.1:3000', allow_loopback=True),
			NATIVE_MOSAIC_INFO,
			Network.TESTNET)
		setup_symbol_routes(app, facade)
		yield app.test_client()
