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
		assert isinstance(item['supply'], int) and not isinstance(item['supply'], bool)
		assert isinstance(item['value'], float)


def _expected_finite_mosaic():
	return {
		'id': '1234567890ABCDEF', 'creator': 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI', 'aliasNames': [],
		'mosaicRegisteredHeight': 2, 'mosaicRegisteredTimestamp': '2026-01-02 00:00:00', 'supply': 1234567, 'value': 1.234567,
		'divisibility': 6, 'supplyMutable': True, 'transferable': False, 'restrictable': True, 'revokable': False,
		'mosaicExpirationHeight': 12, 'unlimitedDuration': False
	}


def _expected_unlimited_mosaic():
	return {
		'id': '2234567890ABCDEF', 'creator': 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI', 'aliasNames': [],
		'mosaicRegisteredHeight': 1, 'mosaicRegisteredTimestamp': '2026-01-01 00:00:00',
		'supply': 7654321, 'value': 7654321.0, 'divisibility': 0, 'supplyMutable': False, 'transferable': True,
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
	unlimited = create_symbol_mosaic('2234567890ABCDEF', 0)
	unlimited.update({
		'start_height': 1, 'updated_at_height': 1, 'supply': 7654321, 'flags': 10,
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
		assert [_expected_finite_mosaic(), _expected_unlimited_mosaic()] == response.json
		_assert_mosaic_types(*response.json)

	@staticmethod
	def test_mosaic_detail_returns_contract(mosaic_client):
		# Act:
		response = mosaic_client.get('/api/symbol/mosaic/1234567890ABCDEF')

		# Assert:
		assert 200 == response.status_code
		assert _expected_finite_mosaic() == response.json
		_assert_mosaic_types(response.json)

	@staticmethod
	def test_mosaic_list_paginates(mosaic_client):
		# Act:
		first = mosaic_client.get('/api/symbol/mosaics?limit=1&offset=0&sort=desc')
		second = mosaic_client.get('/api/symbol/mosaics?limit=1&offset=1&sort=desc')

		# Assert:
		assert 200 == first.status_code
		assert 200 == second.status_code
		assert [_expected_finite_mosaic()] == first.json
		assert [_expected_unlimited_mosaic()] == second.json

	@staticmethod
	def test_mosaic_list_after_end_is_empty(mosaic_client):
		# Act:
		response = mosaic_client.get('/api/symbol/mosaics?limit=1&offset=2&sort=desc')

		# Assert:
		assert 200 == response.status_code
		assert [] == response.json

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
		assert _expected_finite_mosaic() == response.json
		_assert_mosaic_types(response.json)


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
		'mosaicRegisteredHeight': 1, 'mosaicRegisteredTimestamp': None, 'supply': 1234567, 'value': 1.234567,
		'divisibility': 6, 'supplyMutable': False, 'transferable': False, 'restrictable': False, 'revokable': False,
		'mosaicExpirationHeight': None, 'unlimitedDuration': True
	}
	assert 200 == missing_list.status_code
	assert 200 == missing_detail.status_code
	assert [expected] == missing_list.json
	assert expected == missing_detail.json
