from unittest.mock import AsyncMock, Mock, create_autospec

import pytest
from common.symbol.NativeMosaic import NativeMosaicInfo
from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from flask import Flask
from psycopg2 import OperationalError
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Network
from symbollightapi.model.Exceptions import HttpException, NodeException

from rest import setup_error_handlers
from rest.db.SymbolDatabase import SymbolDatabase, SymbolDataUnavailable
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.model.symbol.validation import SymbolDataInvalid
from rest.routes.symbol import setup_symbol_routes

from ...test.SymbolUnconfirmedTransactionTestUtils import get_unconfirmed_transaction


@pytest.fixture(name='unconfirmed_route')
def fixture_unconfirmed_route():
	app = Flask(__name__)
	facade = create_autospec(SymbolRestFacade, instance=True, spec_set=True)
	facade.get_unconfirmed_transactions.return_value = []
	setup_error_handlers(app)
	setup_symbol_routes(app, facade)
	return app.test_client(), facade


def test_returns_unconfirmed_list(unconfirmed_route):
	# Arrange:
	client, facade = unconfirmed_route
	facade.get_unconfirmed_transactions.return_value = [{'transactionHash': 'AB' * 32, 'transactionType': 'TRANSFER'}]

	# Act:
	response = client.get('/api/symbol/transactions/unconfirmed')

	# Assert:
	assert 200 == response.status_code
	assert [{'transactionHash': 'AB' * 32, 'transactionType': 'TRANSFER'}] == response.json
	facade.get_unconfirmed_transactions.assert_awaited_once_with()


def test_returns_empty_unconfirmed_list(unconfirmed_route):
	# Arrange:
	client, _ = unconfirmed_route

	# Act:
	response = client.get('/api/symbol/transactions/unconfirmed')

	# Assert:
	assert 200 == response.status_code
	assert [] == response.json


def test_node_failure_returns_503(unconfirmed_route):
	# Arrange:
	client, facade = unconfirmed_route
	facade.get_unconfirmed_transactions.side_effect = NodeException()

	# Act:
	response = client.get('/api/symbol/transactions/unconfirmed')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol node data is unavailable'} == response.json


def test_rejects_unsupported_query(unconfirmed_route):
	# Arrange:
	client, facade = unconfirmed_route

	# Act:
	response = client.get('/api/symbol/transactions/unconfirmed?height=1')

	# Assert:
	assert 400 == response.status_code
	assert {'status': 400, 'message': 'Unsupported query parameter: height'} == response.json
	facade.get_unconfirmed_transactions.assert_not_awaited()
