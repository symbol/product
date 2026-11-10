from unittest.mock import create_autospec

import pytest
from flask import Flask
from psycopg2 import OperationalError
from symbolchain.symbol.Network import Address, Network

from rest import setup_error_handlers
from rest.db.SymbolDatabase import MosaicRestrictionQuery
from rest.db.SymbolDatabaseCommon import SymbolDataUnavailable
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.model.symbol.MosaicRestriction import MosaicRestrictionEntryType
from rest.routes.symbol import setup_symbol_routes

MOSAIC_ID = '1234567890ABCDEF'
ADDRESS = 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI'


@pytest.fixture(name='restriction_route')
def fixture_restriction_route():
	app = Flask(__name__)
	facade = create_autospec(SymbolRestFacade, instance=True)
	facade.network = Network.TESTNET
	facade.try_get_mosaic_restrictions.return_value = []
	setup_error_handlers(app)
	setup_symbol_routes(app, facade)
	return app.test_client(), facade


@pytest.mark.parametrize('path,expected', [
	('/api/symbol/mosaic-restrictions', MosaicRestrictionQuery()),
	('/api/symbol/mosaic/1234567890abcdef/restrictions', MosaicRestrictionQuery(mosaic_id=MOSAIC_ID, should_check_parent=True)),
	('/api/symbol/mosaic-restrictions?mosaicId=1234567890abcdef&type=1&limit=100&offset=10000',
		MosaicRestrictionQuery(100, 10000, MOSAIC_ID, None, MosaicRestrictionEntryType.GLOBAL, False)),
	(f'/api/symbol/mosaic-restrictions?targetAddress={ADDRESS}&type=0&limit=1&offset=0',
		MosaicRestrictionQuery(1, 0, None, Address(ADDRESS).bytes, MosaicRestrictionEntryType.ADDRESS, False)),
	(f'/api/symbol/mosaic-restrictions?targetAddress={ADDRESS}',
		MosaicRestrictionQuery(10, 0, None, Address(ADDRESS).bytes, MosaicRestrictionEntryType.ADDRESS, False))
])
def test_routes_normalize_parameters(restriction_route, path, expected):
	# Arrange:
	client, facade = restriction_route

	# Act:
	response = client.get(path)

	# Assert:
	assert 200 == response.status_code
	assert [] == response.json
	facade.try_get_mosaic_restrictions.assert_called_once_with(expected)


@pytest.mark.parametrize('path,expected_message', [
	('/api/symbol/mosaic-restrictions?unknown=1', 'Unsupported query parameter: unknown'),
	('/api/symbol/mosaic-restrictions?entryType=0', 'Unsupported query parameter: entryType'),
	('/api/symbol/mosaic-restrictions?pageNumber=1', 'Unsupported query parameter: pageNumber'),
	('/api/symbol/mosaic-restrictions?pageSize=10', 'Unsupported query parameter: pageSize'),
	('/api/symbol/mosaic-restrictions?sort=ASC', 'Unsupported query parameter: sort'),
	('/api/symbol/mosaic-restrictions?limit=1&limit=2', 'limit must not be repeated'),
	('/api/symbol/mosaic-restrictions?offset=0&offset=1', 'offset must not be repeated'),
	('/api/symbol/mosaic-restrictions?mosaicId=1234567890ABCDEF&mosaicId=1234567890ABCDEF', 'mosaicId must not be repeated'),
	(f'/api/symbol/mosaic-restrictions?targetAddress={ADDRESS}&targetAddress={ADDRESS}', 'targetAddress must not be repeated'),
	('/api/symbol/mosaic-restrictions?type=0&type=1', 'type must not be repeated'),
	('/api/symbol/mosaic-restrictions?limit=', 'limit must be an integer'),
	('/api/symbol/mosaic-restrictions?offset=', 'offset must be an integer'),
	('/api/symbol/mosaic-restrictions?mosaicId=', 'Invalid mosaicId'),
	('/api/symbol/mosaic-restrictions?targetAddress=', 'Invalid address'),
	('/api/symbol/mosaic-restrictions?type=', 'Invalid restriction type'),
	('/api/symbol/mosaic-restrictions?limit=0', 'limit must be between 1 and 100'),
	('/api/symbol/mosaic-restrictions?limit=-1', 'limit must be between 1 and 100'),
	('/api/symbol/mosaic-restrictions?limit=101', 'limit must be between 1 and 100'),
	('/api/symbol/mosaic-restrictions?offset=10001', 'offset must be between 0 and 10000'),
	('/api/symbol/mosaic-restrictions?offset=-1', 'offset must be between 0 and 10000'),
	('/api/symbol/mosaic-restrictions?limit=1.0', 'limit must be an integer'),
	('/api/symbol/mosaic-restrictions?mosaicId=foo.bar', 'Invalid mosaicId'),
	('/api/symbol/mosaic-restrictions?mosaicId=E74B99BA41F4AFEE', 'Invalid mosaicId'),
	('/api/symbol/mosaic-restrictions?mosaicId=１２３４５６７８９０１２３４５６', 'Invalid mosaicId'),
	('/api/symbol/mosaic/foo.bar/restrictions', 'Invalid mosaicId'),
	('/api/symbol/mosaic/E74B99BA41F4AFEE/restrictions', 'Invalid mosaicId'),
	('/api/symbol/mosaic/1234567890ABCDEF/restrictions?mosaicId=1234567890ABCDEF', 'Unsupported query parameter: mosaicId'),
	(f'/api/symbol/mosaic/1234567890ABCDEF/restrictions?targetAddress={ADDRESS}', 'Unsupported query parameter: targetAddress'),
	('/api/symbol/mosaic-restrictions?type=2', 'Invalid restriction type'),
	('/api/symbol/mosaic-restrictions?targetAddress=invalid', 'Invalid address'),
	(f'/api/symbol/mosaic-restrictions?type=1&targetAddress={ADDRESS}', 'targetAddress cannot be combined with global type')
])
def test_bad_input_does_not_search(restriction_route, path, expected_message):
	# Arrange:
	client, facade = restriction_route

	# Act:
	response = client.get(path)

	# Assert:
	assert 400 == response.status_code
	assert {'status': 400, 'message': expected_message} == response.json
	facade.try_get_mosaic_restrictions.assert_not_called()


@pytest.mark.parametrize('base_url,base_query', [
	('/api/symbol/mosaic-restrictions', MosaicRestrictionQuery()),
	(f'/api/symbol/mosaic/{MOSAIC_ID}/restrictions', MosaicRestrictionQuery(
		mosaic_id=MOSAIC_ID, should_check_parent=True))
])
@pytest.mark.parametrize('query,expected', [
	('limit=%2B1', MosaicRestrictionQuery(limit=1)),
	('limit=%201%20', MosaicRestrictionQuery(limit=1)),
	('limit=1_0', MosaicRestrictionQuery(limit=10)),
	('limit=%D9%A1%D9%A0', MosaicRestrictionQuery(limit=10)),
	('offset=%2B1', MosaicRestrictionQuery(offset=1)),
	('offset=%201%20', MosaicRestrictionQuery(offset=1)),
	('offset=1_0', MosaicRestrictionQuery(offset=10)),
	('offset=%D9%A1%D9%A0', MosaicRestrictionQuery(offset=10))
])
def test_pagination_shared_int_parser(restriction_route, base_url, base_query, query, expected):
	# Arrange:
	client, facade = restriction_route
	expected = expected._replace(mosaic_id=base_query.mosaic_id, should_check_parent=base_query.should_check_parent)

	# Act:
	response = client.get(f'{base_url}?{query}')

	# Assert:
	assert 200 == response.status_code
	assert [] == response.json
	facade.try_get_mosaic_restrictions.assert_called_once_with(expected)


def test_rejects_valid_mainnet_address(restriction_route):
	# Arrange:
	client, facade = restriction_route
	address = 'ND3I6ZLS22YLJIL7AIQHOAN34AOUSRNK6NTDVKQ'
	assert Network.MAINNET.is_valid_address_string(address)
	assert not Network.TESTNET.is_valid_address_string(address)

	# Act:
	response = client.get(f'/api/symbol/mosaic-restrictions?targetAddress={address}')

	# Assert:
	assert 400 == response.status_code
	assert {'status': 400, 'message': 'Invalid address'} == response.json
	facade.try_get_mosaic_restrictions.assert_not_called()


@pytest.mark.parametrize('error', [SymbolDataUnavailable('unavailable'), OperationalError('unavailable')])
def test_unavailable_returns_generic_503(restriction_route, error):
	# Arrange:
	client, facade = restriction_route
	facade.try_get_mosaic_restrictions.side_effect = error

	# Act:
	response = client.get('/api/symbol/mosaic-restrictions')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_missing_parent_returns_404(restriction_route):
	# Arrange:
	client, facade = restriction_route
	facade.try_get_mosaic_restrictions.return_value = None

	# Act:
	response = client.get(f'/api/symbol/mosaic/{MOSAIC_ID}/restrictions')

	# Assert:
	assert 404 == response.status_code
	assert {'status': 404, 'message': 'Resource not found'} == response.json
