import json

import pytest
from aiohttp import web

from puller.client.NemClient import NemClient


@pytest.fixture
def server(event_loop, aiohttp_client):
	class MockServer:
		def __init__(self):
			self.urls = []

		async def transfers(self, request):
			self.urls.append(str(request.url))
			return web.Response(
				body=json.dumps({
					'data': [{'transaction': {'name': name}} for name in ['alpha', 'beta', 'zeta']]
				}),
				headers={'Content-Type': 'application/json'})

	# create a mock server
	mock_server = MockServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/account/transfers/incoming', mock_server.transfers)
	server = event_loop.run_until_complete(aiohttp_client(app))  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server


# pylint: disable=invalid-name

async def test_can_query_incoming_transactions_from_beginning(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = NemClient(server.make_url(''))

	# Act:
	transactions = await client.incoming_transactions('NADDRESS123')

	# Assert:
	assert [f'{server.make_url("")}/account/transfers/incoming?address=NADDRESS123'] == server.mock.urls
	assert [{'transaction': {'name': 'alpha'}}, {'transaction': {'name': 'beta'}}, {'transaction': {'name': 'zeta'}}] == transactions


async def test_can_query_incoming_transactions_with_custom_start_id(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = NemClient(server.make_url(''))

	# Act:
	transactions = await client.incoming_transactions('NADDRESS123', 98765)

	# Assert:
	assert [f'{server.make_url("")}/account/transfers/incoming?address=NADDRESS123&id=98765'] == server.mock.urls
	assert [{'transaction': {'name': 'alpha'}}, {'transaction': {'name': 'beta'}}, {'transaction': {'name': 'zeta'}}] == transactions
