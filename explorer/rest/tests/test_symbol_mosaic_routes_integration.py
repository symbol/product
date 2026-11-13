import json
from decimal import Decimal

import pytest
from common.symbol.NativeMosaic import NativeMosaicInfo
from flask import Flask
from symbolchain.symbol.Network import Network

from rest import setup_error_handlers
from rest.db.SymbolDatabase import SymbolDatabase
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.routes.symbol import setup_symbol_routes

from .test.SymbolBlockTestUtils import create_symbol_block, create_symbol_sync_state
from .test.SymbolDatabaseTestUtils import symbol_test_database
from .test.SymbolMosaicTestUtils import create_symbol_mosaic
from .test.SymbolTransactionTestUtils import create_symbol_namespace


def _client(database):
	app = Flask(__name__)
	facade = SymbolRestFacade(database, object(), NativeMosaicInfo('72C0212E67A08BCE', 6), Network.TESTNET)
	setup_error_handlers(app)
	setup_symbol_routes(app, facade)
	return app.test_client()


def _json(response):
	return json.loads(response.get_data(as_text=True), parse_float=Decimal)


def _assert_mosaic_types(*items):
	for item in items:
		for field in ('supplyMutable', 'transferable', 'restrictable', 'revokable', 'unlimitedDuration'):
			assert isinstance(item[field], bool)
		for field in ('mosaicRegisteredHeight', 'divisibility'):
			assert isinstance(item[field], int) and not isinstance(item[field], bool)
		assert item['mosaicExpirationHeight'] is None or isinstance(item['mosaicExpirationHeight'], int)
		assert isinstance(item['id'], str)
		assert isinstance(item['creator'], str)
		assert isinstance(item['aliasNames'], list)
		assert isinstance(item['mosaicRegisteredTimestamp'], str)
		assert isinstance(item['totalSupply'], (int, Decimal)) and not isinstance(item['totalSupply'], bool)


def _expected_finite_mosaic():
	return {
		'id': '1234567890ABCDEF', 'creator': 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI', 'aliasNames': [],
		'mosaicRegisteredHeight': 2, 'mosaicRegisteredTimestamp': '2026-01-02 00:00:00', 'totalSupply': Decimal('1.234567'),
		'divisibility': 6, 'supplyMutable': True, 'transferable': False, 'restrictable': True, 'revokable': False,
		'mosaicExpirationHeight': 12, 'unlimitedDuration': False
	}


def _expected_unlimited_mosaic():
	return {
		'id': '2234567890ABCDEF', 'creator': 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI', 'aliasNames': [],
		'mosaicRegisteredHeight': 1, 'mosaicRegisteredTimestamp': '2026-01-01 00:00:00',
		'totalSupply': Decimal('8999999999.999999'), 'divisibility': 6, 'supplyMutable': False, 'transferable': True,
		'restrictable': False, 'revokable': True, 'mosaicExpirationHeight': None, 'unlimitedDuration': True
	}


@pytest.fixture(scope='class', name='mosaic_client')
def fixture_mosaic_client():
	# Two distinct registration heights, flag sets and expiry modes reveal ordering and DTO differences.
	finite = create_symbol_mosaic('1234567890ABCDEF', 6)
	finite.update({
		'start_height': 2, 'updated_at_height': 2, 'duration': 10, 'expiration_height': 12,
		'supply': 1234567, 'flags': 5, 'supply_mutable': True, 'transferable': False, 'restrictable': True, 'revokable': False
	})
	unlimited = create_symbol_mosaic('2234567890ABCDEF', 6)
	unlimited.update({
		'start_height': 1, 'updated_at_height': 1, 'supply': 8999999999999999, 'flags': 10,
		'supply_mutable': False, 'transferable': True, 'restrictable': False, 'revokable': True
	})
	with symbol_test_database(
		create_symbol_sync_state(2, 1), [create_symbol_block(1), create_symbol_block(2)], [finite, unlimited]
	) as (db_config, puller_database):
		puller_database.upsert_namespace(create_symbol_namespace(alias_mosaic_id='1234567890ABCDEF'), [])
		with SymbolDatabase(db_config) as database:
			yield _client(database)


class TestMosaicHttpRead:
	@staticmethod
	def test_mosaic_list_returns_contract(mosaic_client):
		# Act:
		response = mosaic_client.get('/api/symbol/mosaics?sort=desc')

		# Assert: full responses exclude old fields and cover both expiry modes.
		assert 200 == response.status_code
		assert [_expected_finite_mosaic(), _expected_unlimited_mosaic()] == _json(response)
		_assert_mosaic_types(*_json(response))

	@staticmethod
	def test_mosaic_detail_returns_contract(mosaic_client):
		# Act:
		response = mosaic_client.get('/api/symbol/mosaic/1234567890ABCDEF')

		# Assert:
		assert 200 == response.status_code
		assert _expected_finite_mosaic() == _json(response)
		_assert_mosaic_types(_json(response))

	@staticmethod
	def test_mosaic_list_paginates(mosaic_client):
		# Act:
		first = mosaic_client.get('/api/symbol/mosaics?limit=1&offset=0&sort=desc')
		second = mosaic_client.get('/api/symbol/mosaics?limit=1&offset=1&sort=desc')

		# Assert:
		assert 200 == first.status_code
		assert 200 == second.status_code
		assert [_expected_finite_mosaic()] == _json(first)
		assert [_expected_unlimited_mosaic()] == _json(second)

	@staticmethod
	def test_mosaic_list_after_end_is_empty(mosaic_client):
		# Act:
		response = mosaic_client.get('/api/symbol/mosaics?limit=1&offset=2&sort=desc')

		# Assert:
		assert 200 == response.status_code
		assert [] == _json(response)

	@staticmethod
	@pytest.mark.parametrize('name', [
		pytest.param('887E5DB6BB0B21F5', id='alias-id'),
		pytest.param('daoka.coin', id='namespace-name')
	])
	def test_mosaic_alias_returns_contract(mosaic_client, name):
		# Act:
		response = mosaic_client.get(f'/api/symbol/mosaic/{name}')

		# Assert:
		assert 200 == response.status_code
		assert _expected_finite_mosaic() == _json(response)
		_assert_mosaic_types(_json(response))


def test_missing_mosaic_block_timestamp():
	# Arrange: the mosaic's registration block is absent before either request.
	mosaic = create_symbol_mosaic('1234567890ABCDEF', 6)
	mosaic['supply'] = 1234567
	with symbol_test_database(create_symbol_sync_state(2, 1), [create_symbol_block(2)], [mosaic]) as (db_config, _):
		with SymbolDatabase(db_config) as database:
			client = _client(database)
			# Act:
			missing_list = client.get('/api/symbol/mosaics')
			missing_detail = client.get('/api/symbol/mosaic/1234567890ABCDEF')

	# Assert:
	expected = {
		'id': '1234567890ABCDEF', 'creator': 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI', 'aliasNames': [],
		'mosaicRegisteredHeight': 1, 'mosaicRegisteredTimestamp': None, 'totalSupply': Decimal('1.234567'),
		'divisibility': 6, 'supplyMutable': False, 'transferable': False, 'restrictable': False, 'revokable': False,
		'mosaicExpirationHeight': None, 'unlimitedDuration': True
	}
	assert 200 == missing_list.status_code
	assert 200 == missing_detail.status_code
	assert [expected] == _json(missing_list)
	assert expected == _json(missing_detail)


@pytest.mark.parametrize('supply,divisibility,token', [
	(0, 6, '0'),
	(1000000, 6, '1'),
	(1234567, 6, '1.234567'),
	(1000001, 6, '1.000001'),
	(1, 6, '0.000001'),
	(1234567, 0, '1234567'),
	(8999999999999999, 6, '8999999999.999999')
])
def test_http_supply_number_is_exact(supply, divisibility, token):
	# Arrange:
	mosaic = create_symbol_mosaic('1234567890ABCDEF', divisibility)
	mosaic['supply'] = supply
	with symbol_test_database(create_symbol_sync_state(1, 1), [create_symbol_block(1)], [mosaic]) as (db_config, _):
		with SymbolDatabase(db_config) as database:
			client = _client(database)
			# Act:
			responses = [client.get('/api/symbol/mosaics'), client.get('/api/symbol/mosaic/1234567890ABCDEF')]

	# Assert: raw token and exact JSON parsing distinguish numbers, strings and rounded floats.
	for response in responses:
		assert 200 == response.status_code
		assert f'"totalSupply":{token}' in response.get_data(as_text=True)
		parsed = _json(response)
		item = parsed[0] if isinstance(parsed, list) else parsed
		assert Decimal(token) == item['totalSupply']
		assert isinstance(item['totalSupply'], int if '.' not in token else Decimal)
