import asyncio
import json

import pytest
from aiohttp import web
from symbolchain.nem.Network import Address, Network

from puller.client.NemClient import NemClient, get_incoming_transactions_from

from ..test.OptinRequestTestUtils import NEM_ADDRESSES

# region server fixture


@pytest.fixture
def server(event_loop, aiohttp_client):
	class MockNemServer:
		def __init__(self):
			self.urls = []

		async def height(self, request):
			return await self._process_get(request, {'height': 123456})

		async def node_info(self, request):
			return await self._process_get(request, {'metaData': {'networkId': -104}})

		async def account(self, request):
			address = Address(request.rel_url.query['address'])
			return await self._process_get(request, {
				'meta': {'cosignatories': NEM_ADDRESSES},
				'account': {'balance': 0}
			})

		async def historical_account(self, request):
			return await self._process_get(request, {'data': [{'address': NEM_ADDRESSES[0], 'balance':1234567890}]})

		async def transfers(self, request):
			address = Address(request.rel_url.query['address'])

			data = []
			if Address(NEM_ADDRESSES[0]) == address:
				data = [{'transaction': {'name': name}} for name in ['alpha', 'beta', 'zeta']]

			return await self._process_get(request, {'data': data})

		async def _process_get(self, request, response_body):
			self.urls.append(str(request.url))
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'})

	# create a mock server
	mock_server = MockNemServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/chain/height', mock_server.height)
	app.router.add_get('/node/info', mock_server.node_info)
	app.router.add_get('/account/get', mock_server.account)
	app.router.add_get('/account/historical/get', mock_server.historical_account)
	app.router.add_get('/account/transfers/incoming', mock_server.transfers)
	server = event_loop.run_until_complete(aiohttp_client(app))  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server

# endregion


# pylint: disable=invalid-name

# region NemClient - is_known_address

async def test_can_query_known_account(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = NemClient(server.make_url(''))

	# Act:
	is_known = await client.is_known_address(Address(NEM_ADDRESSES[0]))

	# Assert:
	assert [f'{server.make_url("")}/account/transfers/incoming?address={NEM_ADDRESSES[0]}'] == server.mock.urls
	assert is_known


async def test_can_query_unknown_account(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = NemClient(server.make_url(''))

	# Act:
	is_known = await client.is_known_address(Address(NEM_ADDRESSES[1]))

	# Assert:
	assert [f'{server.make_url("")}/account/transfers/incoming?address={NEM_ADDRESSES[1]}'] == server.mock.urls
	assert not is_known


# endregion

# region NemClient - height / finalized_height

async def test_can_query_height(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = NemClient(server.make_url(''))

	# Act:
	height = await client.height()

	# Assert:
	assert [f'{server.make_url("")}/chain/height'] == server.mock.urls
	assert 123456 == height


async def test_can_query_finalized_height(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = NemClient(server.make_url(''))

	# Act:
	height = await client.finalized_height()

	# Assert:
	assert [f'{server.make_url("")}/chain/height'] == server.mock.urls
	assert 123096 == height


# endregion

# region node_network

async def test_can_query_network(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = NemClient(server.make_url(''))

	# Act:
	network = await client.node_network()

	# Assert:
	assert [f'{server.make_url("")}/node/info'] == server.mock.urls
	assert Network.TESTNET == network


async def test_can_query_network_cached(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = NemClient(server.make_url(''))

	# Act: query multiple times
	networks = [await client.node_network() for _ in range(3)]

	# Assert: only a single server call was made
	assert [f'{server.make_url("")}/node/info'] == server.mock.urls
	for network in networks:
		assert Network.TESTNET == network


# endregion

# region account

async def test_can_query_account(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = NemClient(server.make_url(''))

	# Act:
	account = await client.account(NEM_ADDRESSES[0])

	# Assert:
	assert [f'{server.make_url("")}/account/get?address={NEM_ADDRESSES[0]}'] == server.mock.urls
	assert {'meta': {'cosignatories': NEM_ADDRESSES}, 'account': {'balance': 0}} == account


# endregion

# region historical balance

async def test_can_get_historical_balance(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = NemClient(server.make_url(''))

	# Act:
	account_balance = await client.historical_balance('NADDRESS123', 1234)

	# Assert:
	uri_path = '/account/historical/get?address=NADDRESS123&startHeight=1234&endHeight=1234&increment=1'
	assert [f'{server.make_url("")}{uri_path}'] == server.mock.urls
	assert (Address(NEM_ADDRESSES[0]), 1234567890) == account_balance


# endregion

# region NemClient - incoming_transactions

async def test_can_query_incoming_transactions_from_beginning(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = NemClient(server.make_url(''))

	# Act:
	transactions = await client.incoming_transactions(NEM_ADDRESSES[0])

	# Assert:
	assert [f'{server.make_url("")}/account/transfers/incoming?address={NEM_ADDRESSES[0]}'] == server.mock.urls
	assert [{'transaction': {'name': 'alpha'}}, {'transaction': {'name': 'beta'}}, {'transaction': {'name': 'zeta'}}] == transactions


async def test_can_query_incoming_transactions_with_custom_start_id(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = NemClient(server.make_url(''))

	# Act:
	transactions = await client.incoming_transactions(NEM_ADDRESSES[0], 98765)

	# Assert:
	assert [f'{server.make_url("")}/account/transfers/incoming?address={NEM_ADDRESSES[0]}&id=98765'] == server.mock.urls
	assert [{'transaction': {'name': 'alpha'}}, {'transaction': {'name': 'beta'}}, {'transaction': {'name': 'zeta'}}] == transactions


# endregion

# region get_incoming_transactions_from

class MockNemClient:
	def __init__(self, incoming_transactions_map):
		self.incoming_transactions_map = incoming_transactions_map

	async def incoming_transactions(self, address, start_id=None):
		await asyncio.sleep(0.01)
		return self.incoming_transactions_map[(address, start_id)]


async def test_get_incoming_transactions_from_can_return_none():
	# Arrange:
	client = MockNemClient({
		('foo_address', None): []
	})

	# Act:
	transactions = [transaction async for transaction in get_incoming_transactions_from(client, 'foo_address', 100)]

	# Assert:
	assert [] == transactions


async def test_get_incoming_transactions_from_can_complete_in_single_remote_call():
	# Arrange:
	client = MockNemClient({
		('foo_address', None): [{'meta': {'height': height}} for height in [175, 125, 101, 100, 99, 75]]
	})

	# Act:
	transactions = [transaction async for transaction in get_incoming_transactions_from(client, 'foo_address', 100)]

	# Assert:
	assert [{'meta': {'height': height}} for height in [175, 125, 101, 100]] == transactions


async def test_get_incoming_transactions_from_can_complete_in_multiple_remote_calls():
	# Arrange:
	client = MockNemClient({
		('foo_address', None): [{'meta': {'height': 175}}, {'meta': {'height': 125, 'id': 4}}],
		('foo_address', 4): [{'meta': {'height': 101}}, {'meta': {'height': 100, 'id': 9}}],
		('foo_address', 9): [{'meta': {'height': 99}}, {'meta': {'height': 75}}]
	})

	# Act:
	transactions = [transaction async for transaction in get_incoming_transactions_from(client, 'foo_address', 100)]

	# Assert:
	assert [
		{'meta': {'height': 175}}, {'meta': {'height': 125, 'id': 4}}, {'meta': {'height': 101}}, {'meta': {'height': 100, 'id': 9}}
	] == transactions

# endregion
