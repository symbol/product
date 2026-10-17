from unittest.mock import create_autospec

import pytest
from flask import Flask
from psycopg2 import OperationalError

from rest import setup_error_handlers
from rest.db.SymbolDatabase import SortOrder, SymbolDataUnavailable
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.routes.symbol import setup_symbol_routes


@pytest.fixture(name='mosaic_route')
def fixture_mosaic_route():
	app = Flask(__name__)
	facade = create_autospec(SymbolRestFacade, instance=True, spec_set=True)
	facade.get_mosaics.return_value = []
	setup_error_handlers(app)
	setup_symbol_routes(app, facade)
	return app.test_client(), facade


def _assert_bad_request_response(response, expected_message):
	assert 400 == response.status_code
	assert {'status': 400, 'message': expected_message} == response.json


def _assert_symbol_backend_unavailable_response(response):
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_mosaics_uses_defaults(mosaic_route):
	# Arrange:
	client, facade = mosaic_route

	# Act:
	response = client.get('/api/symbol/mosaics')

	# Assert:
	assert 200 == response.status_code
	facade.get_mosaics.assert_called_once_with(10, 0, SortOrder.DESC)


def test_mosaics_forwards_page_query(mosaic_route):
	# Arrange:
	client, facade = mosaic_route

	# Act:
	response = client.get('/api/symbol/mosaics?limit=5&offset=0&sort=asc')

	# Assert:
	assert 200 == response.status_code
	facade.get_mosaics.assert_called_once_with(5, 0, SortOrder.ASC)


@pytest.mark.parametrize('query,expected', [
	('limit=1', (1, 0, SortOrder.DESC)),
	('limit=100', (100, 0, SortOrder.DESC)),
	('offset=0', (10, 0, SortOrder.DESC)),
	('offset=100000', (10, 100000, SortOrder.DESC))
])
def test_mosaics_numeric_boundaries(mosaic_route, query, expected):
	# Arrange:
	client, facade = mosaic_route

	# Act:
	response = client.get(f'/api/symbol/mosaics?{query}')

	# Assert:
	assert 200 == response.status_code
	facade.get_mosaics.assert_called_once_with(*expected)


@pytest.mark.parametrize('sort,expected', [
	('ASC', SortOrder.ASC), ('asc', SortOrder.ASC), ('aSc', SortOrder.ASC),
	('DESC', SortOrder.DESC), ('desc', SortOrder.DESC), ('dEsC', SortOrder.DESC)
])
def test_mosaics_sort_case_insensitive(mosaic_route, sort, expected):
	# Arrange:
	client, facade = mosaic_route

	# Act:
	response = client.get('/api/symbol/mosaics', query_string={'sort': sort})

	# Assert:
	assert 200 == response.status_code
	facade.get_mosaics.assert_called_once_with(10, 0, expected)


@pytest.mark.parametrize('query,message', [
	('limit=0', 'limit must be between 1 and 100'),
	('limit=-1', 'limit must be between 1 and 100'),
	('limit=101', 'limit must be between 1 and 100'),
	('limit=', 'limit must be an integer'),
	('limit=abc', 'limit must be an integer'),
	('limit=1.5', 'limit must be an integer'),
	('offset=-1', 'offset must be between 0 and 100000'),
	('offset=100001', 'offset must be between 0 and 100000'),
	('offset=', 'offset must be an integer'),
	('offset=abc', 'offset must be an integer'),
	('offset=1.5', 'offset must be an integer')
])
def test_mosaics_rejects_bad_numeric(mosaic_route, query, message):
	# Arrange:
	client, facade = mosaic_route

	# Act:
	response = client.get(f'/api/symbol/mosaics?{query}')

	# Assert:
	_assert_bad_request_response(response, message)
	facade.get_mosaics.assert_not_called()


@pytest.mark.parametrize('sort', ['', 'height', ' ASC', 'DESC '])
def test_mosaics_rejects_invalid_sort(mosaic_route, sort):
	# Arrange:
	client, facade = mosaic_route

	# Act:
	response = client.get('/api/symbol/mosaics', query_string={'sort': sort})

	# Assert:
	_assert_bad_request_response(response, 'Sort must be either ASC or DESC')
	facade.get_mosaics.assert_not_called()


@pytest.mark.parametrize('parameter', ['unknown', 'pageNumber', 'pageSize', 'fromHeight', 'order'])
def test_mosaics_rejects_unknown_params(mosaic_route, parameter):
	# Arrange:
	client, facade = mosaic_route

	# Act:
	response = client.get(f'/api/symbol/mosaics?{parameter}=1')

	# Assert:
	_assert_bad_request_response(response, f'Unsupported query parameter: {parameter}')
	facade.get_mosaics.assert_not_called()


@pytest.mark.parametrize('parameter,first,second', [
	('limit', '1', '2'), ('limit', '1', '1'),
	('offset', '0', '1'), ('offset', '0', '0'),
	('sort', 'ASC', 'DESC'), ('sort', 'ASC', 'ASC')
])
def test_mosaics_rejects_repeated_params(mosaic_route, parameter, first, second):
	# Arrange:
	client, facade = mosaic_route

	# Act:
	response = client.get(f'/api/symbol/mosaics?{parameter}={first}&{parameter}={second}')

	# Assert:
	_assert_bad_request_response(response, f'{parameter} must not be repeated')
	facade.get_mosaics.assert_not_called()


@pytest.mark.parametrize('error', [SymbolDataUnavailable(), OperationalError('database unavailable')])
def test_mosaics_backend_unavailable(mosaic_route, error):
	# Arrange:
	client, facade = mosaic_route
	facade.get_mosaics.side_effect = error

	# Act:
	response = client.get('/api/symbol/mosaics')

	# Assert:
	_assert_symbol_backend_unavailable_response(response)
	facade.get_mosaics.assert_called_once_with(10, 0, SortOrder.DESC)


@pytest.mark.parametrize('name,expected_id', [
	('72C0212E67A08BCE', '72C0212E67A08BCE'),
	('72c0212e67a08bce', '72C0212E67A08BCE'),
	('symbol.xym', 'E74B99BA41F4AFEE'),
])
def test_mosaic_returns_metadata(mosaic_route, name, expected_id):
	# Arrange:
	client, facade = mosaic_route
	mosaic_map = {'id': '72C0212E67A08BCE', 'aliasNames': ['symbol.xym'], 'supply': 1234567}
	facade.get_mosaic.return_value = mosaic_map

	# Act:
	response = client.get(f'/api/symbol/mosaic/{name}')

	# Assert:
	assert 200 == response.status_code
	assert mosaic_map == response.json
	facade.get_mosaic.assert_called_once_with(expected_id)


@pytest.mark.parametrize('name', [
	'symbol..xym', '.symbol', 'symbol.', 'Symbol.xym', 'symbol xym',
	'a.b.c.d', 'a' * 65, 'symbol.' + 'a' * 65, '72C0212E67A08BC!'
])
def test_mosaic_rejects_bad_identifier(mosaic_route, name):
	# Arrange:
	client, facade = mosaic_route

	# Act:
	response = client.get(f'/api/symbol/mosaic/{name}')

	# Assert:
	_assert_bad_request_response(response, 'Invalid mosaic')
	facade.get_mosaic.assert_not_called()


def test_mosaic_rejects_query_parameters(mosaic_route):
	# Arrange:
	client, facade = mosaic_route

	# Act:
	response = client.get('/api/symbol/mosaic/symbol.xym?limit=1')

	# Assert:
	_assert_bad_request_response(response, 'Unsupported query parameter: limit')
	facade.get_mosaic.assert_not_called()


@pytest.mark.parametrize('name', ['72C0212E67A08BCE', 'symbol.xym'])
def test_mosaic_returns_not_found(mosaic_route, name):
	# Arrange:
	client, facade = mosaic_route
	facade.get_mosaic.return_value = None

	# Act:
	response = client.get(f'/api/symbol/mosaic/{name}')

	# Assert:
	assert 404 == response.status_code
	assert {'status': 404, 'message': 'Resource not found'} == response.json


@pytest.mark.parametrize('error', [SymbolDataUnavailable(), OperationalError('database unavailable')])
def test_mosaic_backend_unavailable(mosaic_route, error):
	# Arrange:
	client, facade = mosaic_route
	facade.get_mosaic.side_effect = error

	# Act:
	response = client.get('/api/symbol/mosaic/symbol.xym')

	# Assert:
	_assert_symbol_backend_unavailable_response(response)
