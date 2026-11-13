from unittest.mock import create_autospec

import pytest
from flask import Flask
from symbolchain.symbol.Network import Address, Network

from rest import setup_error_handlers
from rest.db.SymbolDatabase import MetadataQuery
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.routes.symbol import setup_symbol_routes

ADDRESS = 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY'


@pytest.fixture(name='metadata_route')
def fixture_metadata_route():
	app = Flask(__name__)
	facade = create_autospec(SymbolRestFacade, instance=True)
	facade.network = Network.TESTNET
	facade.try_get_related_metadata.return_value = []
	setup_error_handlers(app)
	setup_symbol_routes(app, facade)
	return app.test_client(), facade


@pytest.mark.parametrize('path,kind,target,metadata_type', [
	(f'/api/symbol/account/{ADDRESS}/metadata', 'account', Address(ADDRESS).bytes, None),
	('/api/symbol/mosaic/00000000000000af/metadata', 'mosaic', '00000000000000AF', 'mosaic'),
	('/api/symbol/namespace/00000000000000af/metadata', 'namespace', '00000000000000AF', 'namespace'),
	('/api/symbol/namespace/foo/metadata', 'namespace', '82A9D1AC587EC054', 'namespace')
])
def test_metadata_defaults_and_path(metadata_route, path, kind, target, metadata_type):
	# Arrange:
	client, facade = metadata_route

	# Act:
	response = client.get(path)

	# Assert:
	assert 200 == response.status_code
	assert [] == response.json
	facade.try_get_related_metadata.assert_called_once_with(MetadataQuery(kind, target, metadata_type, 10, 0))


@pytest.mark.parametrize('number,label', [(0, 'account'), (1, 'mosaic'), (2, 'namespace')])
def test_account_metadata_type(metadata_route, number, label):
	# Arrange:
	client, facade = metadata_route

	# Act:
	response = client.get(f'/api/symbol/account/{ADDRESS}/metadata?metadataType={number}&limit=100&offset=100000')

	# Assert:
	assert 200 == response.status_code
	facade.try_get_related_metadata.assert_called_once_with(MetadataQuery('account', Address(ADDRESS).bytes, label, 100, 100000))


@pytest.mark.parametrize('path,query', [
	(f'/api/symbol/account/{ADDRESS}/metadata', 'limit=0'),
	(f'/api/symbol/account/{ADDRESS}/metadata', 'limit=101'),
	(f'/api/symbol/account/{ADDRESS}/metadata', 'offset=-1'),
	(f'/api/symbol/account/{ADDRESS}/metadata', 'offset=100001'),
	(f'/api/symbol/account/{ADDRESS}/metadata', 'limit='),
	(f'/api/symbol/account/{ADDRESS}/metadata', 'offset='),
	(f'/api/symbol/account/{ADDRESS}/metadata', 'offset=1&offset=2'),
	('/api/symbol/mosaic/0000000000000001/metadata', 'limit=0'),
	('/api/symbol/mosaic/0000000000000001/metadata', 'limit=101'),
	('/api/symbol/mosaic/0000000000000001/metadata', 'offset=100001'),
	('/api/symbol/mosaic/0000000000000001/metadata', 'offset=1&offset=1'),
	('/api/symbol/namespace/foo/metadata', 'limit=0'),
	('/api/symbol/namespace/foo/metadata', 'limit=101'),
	('/api/symbol/namespace/foo/metadata', 'limit=1&limit=1'),
	('/api/symbol/namespace/foo/metadata', 'offset=100001'),
	(f'/api/symbol/account/{ADDRESS}/metadata', 'limit=1_0'),
	(f'/api/symbol/account/{ADDRESS}/metadata', 'limit=%201'),
	(f'/api/symbol/account/{ADDRESS}/metadata', 'offset=%D9%A1'),
	(f'/api/symbol/account/{ADDRESS}/metadata', 'metadataType=%2B1'),
	(f'/api/symbol/account/{ADDRESS}/metadata', 'metadataType='),
	(f'/api/symbol/account/{ADDRESS}/metadata', 'metadataType=3'),
	(f'/api/symbol/account/{ADDRESS}/metadata', 'metadataType=0&metadataType=1'),
	(f'/api/symbol/account/{ADDRESS}/metadata', 'limit=1&limit=1'),
	(f'/api/symbol/account/{ADDRESS}/metadata', 'targetAddress=other'),
	('/api/symbol/mosaic/0000000000000001/metadata', 'metadataType=1'),
	('/api/symbol/namespace/foo/metadata', 'targetId=0000000000000001'),
	('/api/symbol/mosaic/foo/metadata', ''),
	('/api/symbol/namespace/INVALID/metadata', ''),
	('/api/symbol/account/invalid/metadata', '')
])
def test_invalid_metadata_no_dispatch(metadata_route, path, query):
	# Arrange:
	client, facade = metadata_route

	# Act:
	response = client.get(f'{path}?{query}')

	# Assert:
	assert 400 == response.status_code
	facade.try_get_related_metadata.assert_not_called()


def test_missing_metadata_parent(metadata_route):
	# Arrange:
	client, facade = metadata_route
	facade.try_get_related_metadata.return_value = None

	# Act:
	response = client.get('/api/symbol/mosaic/0000000000000001/metadata')

	# Assert:
	assert 404 == response.status_code
	assert {'status': 404, 'message': 'Resource not found'} == response.json


@pytest.mark.parametrize('path', [
	f'/api/symbol/account/{ADDRESS}/metadata',
	'/api/symbol/mosaic/0000000000000001/metadata',
	'/api/symbol/namespace/foo/metadata'
])
def test_metadata_minimum_pagination(metadata_route, path):
	# Arrange:
	client, facade = metadata_route

	# Act:
	response = client.get(f'{path}?limit=1&offset=0')

	# Assert:
	assert 200 == response.status_code
	query = facade.try_get_related_metadata.call_args.args[0]
	assert 1 == query.limit and 0 == query.offset


def test_account_metadata_wrong_network(metadata_route):
	# Arrange: ADDRESS is a valid testnet address, but the facade is configured for mainnet.
	client, facade = metadata_route
	facade.network = Network.MAINNET

	# Act:
	response = client.get(f'/api/symbol/account/{ADDRESS}/metadata')

	# Assert:
	assert 400 == response.status_code
	assert {'status': 400, 'message': 'Invalid address'} == response.json
	facade.try_get_related_metadata.assert_not_called()
