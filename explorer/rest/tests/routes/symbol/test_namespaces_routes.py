from unittest.mock import create_autospec

import pytest
from flask import Flask
from symbolchain.symbol.Network import Address

from rest import setup_error_handlers
from rest.db.SymbolDatabase import NamespaceQuery, SortOrder, SymbolDataUnavailable
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.routes.symbol import setup_symbol_routes

OWNER_ADDRESS = 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI'


@pytest.fixture(name='namespace_route')
def fixture_namespace_route():
	app = Flask(__name__)
	facade = create_autospec(SymbolRestFacade, instance=True, spec_set=True)
	facade.get_namespaces.return_value = []
	setup_error_handlers(app)
	setup_symbol_routes(app, facade)
	return app.test_client(), facade


def _assert_bad_request(response, message):
	assert 400 == response.status_code
	assert {'status': 400, 'message': message} == response.json


def test_namespaces_use_defaults(namespace_route):
	# Arrange:
	client, facade = namespace_route

	# Act:
	response = client.get('/api/symbol/namespaces')

	# Assert:
	assert 200 == response.status_code
	facade.get_namespaces.assert_called_once_with(NamespaceQuery())


def test_namespace_filters(namespace_route):
	# Arrange:
	client, facade = namespace_route

	# Act:
	response = client.get(
		'/api/symbol/namespaces?limit=3&offset=7&sort=asc&aliasType=2&registrationType=1'
		f'&ownerAddress={OWNER_ADDRESS}'
	)

	# Assert:
	assert 200 == response.status_code
	facade.get_namespaces.assert_called_once_with(NamespaceQuery(
		limit=3,
		offset=7,
		sort=SortOrder.ASC,
		alias_type='address',
		registration_type='child',
		owner_address=Address(OWNER_ADDRESS).bytes))


@pytest.mark.parametrize('query,field,expected', [
	('limit=1', 'limit', 1), ('limit=100', 'limit', 100), ('offset=0', 'offset', 0),
	('offset=100000', 'offset', 100000)
])
def test_namespace_boundaries(query, field, expected, namespace_route):
	# Arrange:
	client, facade = namespace_route

	# Act:
	response = client.get(f'/api/symbol/namespaces?{query}')

	# Assert:
	assert 200 == response.status_code
	assert expected == getattr(facade.get_namespaces.call_args.args[0], field)


@pytest.mark.parametrize('query,message', [
	('limit=0', 'limit must be between 1 and 100'),
	('limit=101', 'limit must be between 1 and 100'),
	('offset=-1', 'offset must be between 0 and 100000'),
	('offset=100001', 'offset must be between 0 and 100000'),
	('sort=sideways', 'Sort must be either ASC or DESC'),
	('aliasType=3', 'aliasType must be between 0 and 2'),
	('registrationType=2', 'registrationType must be between 0 and 1'),
	('ownerAddress=invalid', 'Invalid ownerAddress'),
	('limit=', 'limit must be an integer'),
	('offset=', 'offset must be an integer'),
	('sort=', 'Sort must be either ASC or DESC'),
	('aliasType=', 'aliasType must be an integer'),
	('registrationType=', 'registrationType must be an integer'),
	('ownerAddress=', 'Invalid ownerAddress'),
	('pageNumber=1', 'Unsupported query parameter: pageNumber'),
	('pageSize=1', 'Unsupported query parameter: pageSize'),
	('aliasType=0&aliasType=0', 'aliasType must not be repeated')
])
def test_namespace_invalid(namespace_route, query, message):
	# Arrange:
	client, facade = namespace_route

	# Act:
	response = client.get(f'/api/symbol/namespaces?{query}')

	# Assert:
	_assert_bad_request(response, message)
	facade.get_namespaces.assert_not_called()


@pytest.mark.parametrize('parameter,value', [
	('limit', '1'),
	('offset', '0'),
	('sort', 'ASC'),
	('aliasType', '0'),
	('registrationType', '0'),
	('ownerAddress', OWNER_ADDRESS)
])
def test_namespace_duplicates(parameter, value, namespace_route):
	# Arrange:
	client, facade = namespace_route

	# Act:
	response = client.get(f'/api/symbol/namespaces?{parameter}={value}&{parameter}={value}')

	# Assert:
	_assert_bad_request(response, f'{parameter} must not be repeated')
	facade.get_namespaces.assert_not_called()


@pytest.mark.parametrize('query,field,expected', [
	('aliasType=0', 'alias_type', 'none'), ('aliasType=1', 'alias_type', 'mosaic'),
	('aliasType=2', 'alias_type', 'address'), ('registrationType=0', 'registration_type', 'root'),
	('registrationType=1', 'registration_type', 'child')
])
def test_namespace_enum(query, field, expected, namespace_route):
	# Arrange:
	client, facade = namespace_route

	# Act:
	response = client.get(f'/api/symbol/namespaces?{query}')

	# Assert:
	assert 200 == response.status_code
	assert expected == getattr(facade.get_namespaces.call_args.args[0], field)


def test_namespace_unavailable(namespace_route):
	# Arrange:
	client, facade = namespace_route
	facade.get_namespaces.side_effect = SymbolDataUnavailable('unsafe')

	# Act:
	response = client.get('/api/symbol/namespaces')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json
	facade.get_namespaces.assert_called_once_with(NamespaceQuery())
