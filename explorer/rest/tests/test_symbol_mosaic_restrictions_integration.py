import configparser
import tempfile
from pathlib import Path

import pytest
from common.tests.PostgresTestUtils import PostgresTestDatabase
from symbolchain.symbol.Network import Address

from rest import REST_CHAIN_HANDLERS, create_app

from .test.EnvTestUtils import rest_settings_env
from .test.SymbolBlockTestUtils import create_symbol_sync_state
from .test.SymbolDatabaseTestUtils import symbol_test_database
from .test.SymbolMosaicRestrictionTestUtils import (
	ADDRESS,
	EMPTY_ID,
	FIRST_ADDRESS,
	LAST_ADDRESS,
	MOSAIC_ID,
	NATIVE,
	OTHER_ID,
	insert_restriction,
	seed_restriction_rows
)
from .test.SymbolMosaicTestUtils import create_symbol_mosaic

SYNC = create_symbol_sync_state(last_synced_height=10, finalized_height=10)


def _create_client(database_config):
	with tempfile.TemporaryDirectory() as directory:
		db_path = Path(directory) / 'db.ini'
		database_settings = configparser.ConfigParser(interpolation=None)
		database_settings['symbol_db'] = {
			'database': str(database_config.database),
			'user': str(database_config.user),
			'password': '',
			'host': str(database_config.host),
			'port': str(database_config.port)
		}
		with db_path.open('w', encoding='utf8') as config_file:
			database_settings.write(config_file)

		app_path = Path(directory) / 'app.config'
		app_path.write_text(
			'REST_CHAIN="symbol"\nNETWORK_NAME="testnet"\n'
			f'DATABASE_CONFIG_FILEPATH="{db_path}"\n'
			f'SYMBOL_NATIVE_MOSAIC_ID={NATIVE.id!r}\n'
			'SYMBOL_ACCOUNT_REFRESH_MAX_AGE_SECONDS=7200\nSYMBOL_HARVESTING_ACTIVE_WINDOW_DAYS=7\n'
			'SYMBOL_HARVESTING_MIN_BALANCE=0\nSYMBOL_HARVESTING_MAX_BALANCE=18446744073709551615\n'
			'SYMBOL_NODE_URL="http://127.0.0.1:1"\nSYMBOL_NODE_ALLOWED_HOSTS="127.0.0.1:1"\n'
			'SYMBOL_NODE_ALLOW_LOOPBACK="true"\nSYMBOL_NODE_ALLOW_PRIVATE="false"\n', encoding='utf8')
		with rest_settings_env(app_path):
			app = create_app()

	return app.test_client()


def test_http_returns_full_dtos():
	# Arrange:
	with symbol_test_database(SYNC, mosaics=[create_symbol_mosaic(MOSAIC_ID, 0)]) as (config, puller):
		seed_restriction_rows(puller)
		client = _create_client(config)
		try:
			# Act:
			response = client.get(f'/api/symbol/mosaic/{MOSAIC_ID}/restrictions')
		finally:
			client.application.extensions['symbol_database'].close()

	# Assert:
	assert 200 == response.status_code
	assert [{
		'compositeHash': '28' * 32,
		'mosaicId': MOSAIC_ID,
		'entryType': 'Mosaic Address Restriction',
		'targetAddress': FIRST_ADDRESS,
		'restrictions': ''
	}, {
		'compositeHash': '1E' * 32,
		'mosaicId': MOSAIC_ID,
		'entryType': 'Mosaic Address Restriction',
		'targetAddress': ADDRESS,
		'restrictions': '18446744073709551615: 18446744073709551614, 3: 9'
	}, {
		'compositeHash': '0A' * 32,
		'mosaicId': MOSAIC_ID,
		'entryType': 'Mosaic Address Restriction',
		'targetAddress': LAST_ADDRESS,
		'restrictions': ''
	}, {
		'compositeHash': '14' * 32,
		'mosaicId': MOSAIC_ID,
		'entryType': 'Mosaic Global Restriction',
		'targetAddress': None,
		'restrictions': (
			f'{MOSAIC_ID} Key 1 Equal 18446744073709551615, '
			f'{OTHER_ID} Key 2 Not Equal 18446744073709551615, '
			f'{OTHER_ID} Key 3 Less Than 18446744073709551615, '
			f'{OTHER_ID} Key 4 Less Than Or Equal 18446744073709551615, '
			f'{OTHER_ID} Key 5 Greater Than 18446744073709551615, '
			f'{OTHER_ID} Key 6 Greater Than Or Equal 18446744073709551615')
	}] == response.json


def _assert_http_status(path, state, expected_status, expected_body):
	# Arrange:
	with symbol_test_database(state, mosaics=[create_symbol_mosaic(EMPTY_ID, 0)]) as (config, _):
		client = _create_client(config)
		try:
			# Act:
			response = client.get(path)
		finally:
			client.application.extensions['symbol_database'].close()

	# Assert:
	assert expected_status == response.status_code
	assert expected_body == response.json


def test_missing_parent_returns_404():
	# Arrange: an orphan restriction must not establish the parent mosaic's existence.
	with symbol_test_database(SYNC) as (config, puller):
		insert_restriction(puller, 1, OTHER_ID, 'address', ADDRESS, [], 10)
		client = _create_client(config)
		try:
			# Act:
			response = client.get(f'/api/symbol/mosaic/{OTHER_ID}/restrictions')
		finally:
			client.application.extensions['symbol_database'].close()

	# Assert:
	assert 404 == response.status_code
	assert {'status': 404, 'message': 'Resource not found'} == response.json


def test_parent_without_rules_is_empty():
	_assert_http_status(f'/api/symbol/mosaic/{EMPTY_ID}/restrictions', SYNC, 200, [])


def test_offset_past_matches_is_empty():
	# Arrange: a published match makes an ignored offset observable.
	with symbol_test_database(SYNC) as (config, puller):
		insert_restriction(puller, 1, MOSAIC_ID, 'address', ADDRESS, [], 10)
		client = _create_client(config)
		try:
			# Act:
			response = client.get('/api/symbol/mosaic-restrictions?offset=10000')
		finally:
			client.application.extensions['symbol_database'].close()

	# Assert:
	assert 200 == response.status_code
	assert [] == response.json


def test_unavailable_precedes_parent():
	_assert_http_status(
		f'/api/symbol/mosaic/{OTHER_ID}/restrictions', {**SYNC, 'status': 'unhealthy'}, 503,
		{'status': 503, 'message': 'Symbol backend data is unavailable'})


def test_search_returns_503_if_unhealthy():
	# Arrange:
	with symbol_test_database({**SYNC, 'status': 'unhealthy'}) as (config, puller):
		insert_restriction(puller, 1, MOSAIC_ID, 'address', ADDRESS, [], 10)
		client = _create_client(config)
		try:
			# Act:
			response = client.get('/api/symbol/mosaic-restrictions')
		finally:
			client.application.extensions['symbol_database'].close()

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_symbol_chain_excludes_nem():
	# Arrange:
	with symbol_test_database(SYNC) as (config, _):
		client = _create_client(config)
		try:
			# Act:
			response = client.get('/api/nem/health')
		finally:
			client.application.extensions['symbol_database'].close()

	# Assert:
	assert 404 == response.status_code


def test_http_child_address_filter():
	# Arrange: the seed includes a global entry on this mosaic and another mosaic's addresses.
	with symbol_test_database(SYNC, mosaics=[create_symbol_mosaic(MOSAIC_ID, 0)]) as (config, puller):
		seed_restriction_rows(puller)
		client = _create_client(config)
		try:
			# Act:
			response = client.get(f'/api/symbol/mosaic/{MOSAIC_ID}/restrictions?type=0')
		finally:
			client.application.extensions['symbol_database'].close()

	# Assert:
	assert 200 == response.status_code
	assert [
		{'compositeHash': '28' * 32, 'mosaicId': MOSAIC_ID, 'entryType': 'Mosaic Address Restriction',
			'targetAddress': FIRST_ADDRESS, 'restrictions': ''},
		{'compositeHash': '1E' * 32, 'mosaicId': MOSAIC_ID, 'entryType': 'Mosaic Address Restriction',
			'targetAddress': ADDRESS, 'restrictions': '18446744073709551615: 18446744073709551614, 3: 9'},
		{'compositeHash': '0A' * 32, 'mosaicId': MOSAIC_ID, 'entryType': 'Mosaic Address Restriction',
			'targetAddress': LAST_ADDRESS, 'restrictions': ''}
	] == response.json


def test_http_target_address_filter():
	# Arrange: other target addresses and global entries are deliberate decoys.
	with symbol_test_database(SYNC) as (config, puller):
		seed_restriction_rows(puller)
		client = _create_client(config)
		try:
			# Act:
			response = client.get(f'/api/symbol/mosaic-restrictions?targetAddress={ADDRESS}&type=0')
		finally:
			client.application.extensions['symbol_database'].close()

	# Assert:
	assert 200 == response.status_code
	assert [
		{'compositeHash': '1E' * 32, 'mosaicId': MOSAIC_ID, 'entryType': 'Mosaic Address Restriction',
			'targetAddress': ADDRESS, 'restrictions': '18446744073709551615: 18446744073709551614, 3: 9'},
		{'compositeHash': '32' * 32, 'mosaicId': OTHER_ID, 'entryType': 'Mosaic Address Restriction',
			'targetAddress': ADDRESS, 'restrictions': ''}
	] == response.json


def test_http_invalid_rules():
	# Arrange:
	with symbol_test_database(SYNC) as (config, puller):
		insert_restriction(puller, 1, MOSAIC_ID, 'address', ADDRESS, [{'key': 'bad', 'value': '1'}])
		client = _create_client(config)
		try:
			# Act:
			response = client.get('/api/symbol/mosaic-restrictions')
		finally:
			client.application.extensions['symbol_database'].close()

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_http_preserves_long_u64_strings():
	# Arrange:
	key = '0' * 5000 + '18446744073709551615'
	value = '0' * 5000 + '18446744073709551614'
	with symbol_test_database(SYNC) as (config, puller):
		insert_restriction(puller, 1, MOSAIC_ID, 'address', ADDRESS, [{'key': key, 'value': value}])
		client = _create_client(config)
		try:
			# Act:
			response = client.get('/api/symbol/mosaic-restrictions')
		finally:
			client.application.extensions['symbol_database'].close()

	# Assert:
	assert 200 == response.status_code
	assert [{
		'compositeHash': '01' * 32,
		'mosaicId': MOSAIC_ID,
		'entryType': 'Mosaic Address Restriction',
		'targetAddress': ADDRESS,
		'restrictions': f'{key}: {value}'
	}] == response.json


@pytest.mark.parametrize('value', [b'bad', Address('ND3I6ZLS22YLJIL7AIQHOAN34AOUSRNK6NTDVKQ').bytes])
def test_http_invalid_address(value):
	# Arrange:
	with symbol_test_database(SYNC) as (config, puller):
		insert_restriction(puller, 1, MOSAIC_ID, 'address', ADDRESS, [])
		with puller.connection.cursor() as cursor:
			cursor.execute('UPDATE symbol_mosaic_restrictions SET target_address = %s', (value,))

		puller.connection.commit()
		client = _create_client(config)
		try:
			# Act:
			response = client.get('/api/symbol/mosaic-restrictions')
		finally:
			client.application.extensions['symbol_database'].close()

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_nem_create_app_route():
	# Arrange:
	with PostgresTestDatabase() as config:
		with tempfile.TemporaryDirectory() as directory:
			db_path = Path(directory) / 'db.ini'
			db_path.write_text(
				f'[nem_db]\ndatabase = {config.database}\nuser = {config.user}\npassword = \n'
				f'host = {config.host}\nport = {config.port}\n', encoding='utf8')
			app_path = Path(directory) / 'app.config'
			app_path.write_text(
				f'REST_CHAIN="nem"\nNETWORK_NAME="testnet"\nDATABASE_CONFIG_FILEPATH="{db_path}"\n', encoding='utf8')
			facades = []
			nem_setup, nem_routes = REST_CHAIN_HANDLERS['nem']

			def setup_facade(app):
				facade = nem_setup(app)
				facades.append(facade)
				return facade

			with rest_settings_env(app_path):
				app = create_app({**REST_CHAIN_HANDLERS, 'nem': (setup_facade, nem_routes)})

			try:
				# Act:
				client = app.test_client()
				invalid = client.get('/api/nem/block/0')
				symbol = client.get('/api/symbol/mosaic-restrictions')
			finally:
				facades[0].nem_db._pool.closeall()  # pylint: disable=protected-access

	# Assert:
	assert 400 == invalid.status_code
	assert {'status': 400, 'message': 'Height must be greater than or equal to 1'} == invalid.json
	assert 404 == symbol.status_code
