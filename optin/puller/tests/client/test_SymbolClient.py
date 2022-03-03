import asyncio
import json

import pytest
from aiohttp import web
from symbolchain.CryptoTypes import Hash256
from symbolchain.symbol.Network import Address, Network

from puller.client.SymbolClient import SymbolClient, filter_finalized_transactions

from ..test.OptinRequestTestUtils import HASHES, SYMBOL_ADDRESSES

# region server fixture


def generate_transaction_statuses(status_start_height, transaction_hashes):
	return [
		{
			'group': 'confirmed' if 0 == i % 2 else 'unconfirmed',
			'code': 'Success',
			'hash': str(transaction_hash),
			'height': str(status_start_height + i)
		}
		for i, transaction_hash in enumerate(transaction_hashes)
	]


@pytest.fixture
def server(event_loop, aiohttp_client):
	class MockSymbolServer:
		def __init__(self):
			self.urls = []
			self.finalized_height = 111001
			self.status_start_height = 111001

		async def accounts_known(self, request):
			return await self._process_get(request, {'account': {}})

		async def accounts_unknown(self, request):
			return await self._process_get(request, {'code': 'ResourceNotFound', 'message': 'no resource exists'})

		async def chain_info(self, request):
			return await self._process_get(request, {'height': 123456, 'latestFinalizedBlock': {'height': self.finalized_height}})

		async def node_info(self, request):
			return await self._process_get(request, {'networkIdentifier': 152})

		async def transaction_statuses(self, request):
			request_json = json.loads(await request.text())
			return await self._process_post(request, generate_transaction_statuses(self.status_start_height, request_json['hashes']))

		async def _process_get(self, request, response_body):
			self.urls.append(str(request.url))
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'})

		async def _process_post(self, request, response_body):
			self.urls.append(str(request.url))
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'})

	# create a mock server
	mock_server = MockSymbolServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get(f'/accounts/{SYMBOL_ADDRESSES[0]}', mock_server.accounts_known)
	app.router.add_get(f'/accounts/{SYMBOL_ADDRESSES[1]}', mock_server.accounts_unknown)
	app.router.add_get('/chain/info', mock_server.chain_info)
	app.router.add_get('/node/info', mock_server.node_info)
	app.router.add_post('/transactionStatus', mock_server.transaction_statuses)
	server = event_loop.run_until_complete(aiohttp_client(app))  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server


# endregion

# pylint: disable=invalid-name

# region SymbolClient - is_known_address

async def test_can_query_known_account(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	is_known = await client.is_known_address(Address(SYMBOL_ADDRESSES[0]))

	# Assert:
	assert [f'{server.make_url("")}/accounts/{SYMBOL_ADDRESSES[0]}'] == server.mock.urls
	assert is_known


async def test_can_query_unknown_account(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	is_known = await client.is_known_address(Address(SYMBOL_ADDRESSES[1]))

	# Assert:
	assert [f'{server.make_url("")}/accounts/{SYMBOL_ADDRESSES[1]}'] == server.mock.urls
	assert not is_known


# endregion

# region SymbolClient - height / finalized_height

async def test_can_query_height(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	height = await client.height()

	# Assert:
	assert [f'{server.make_url("")}/chain/info'] == server.mock.urls
	assert 123456 == height


async def test_can_query_finalized_height(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	height = await client.finalized_height()

	# Assert:
	assert [f'{server.make_url("")}/chain/info'] == server.mock.urls
	assert 111001 == height


# endregion

# region node_network

async def test_can_query_network(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	network = await client.node_network()

	# Assert:
	assert [f'{server.make_url("")}/node/info'] == server.mock.urls
	assert Network.TESTNET == network


# endregion

# region transaction_statuses

async def test_can_query_transaction_statuses(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	transaction_statuses = await client.transaction_statuses([HASHES[0], HASHES[2], HASHES[1]])

	# Assert:
	assert [f'{server.make_url("")}/transactionStatus'] == server.mock.urls
	assert 3 == len(transaction_statuses)

	assert 'confirmed' == transaction_statuses[0]['group']
	assert 'Success' == transaction_statuses[0]['code']
	assert str(HASHES[0]) == transaction_statuses[0]['hash']
	assert '111001' == transaction_statuses[0]['height']

	assert 'unconfirmed' == transaction_statuses[1]['group']
	assert 'Success' == transaction_statuses[1]['code']
	assert str(HASHES[2]) == transaction_statuses[1]['hash']
	assert '111002' == transaction_statuses[1]['height']

	assert 'confirmed' == transaction_statuses[2]['group']
	assert 'Success' == transaction_statuses[2]['code']
	assert str(HASHES[1]) == transaction_statuses[2]['hash']
	assert '111003' == transaction_statuses[2]['height']


# endregion

# region filter_finalized_transactions

class MockSymbolClient:
	def __init__(self, finalized_height, status_start_height):
		self._finalized_height = finalized_height
		self.status_start_height = status_start_height

	async def finalized_height(self):
		await asyncio.sleep(0.01)
		return self._finalized_height

	async def transaction_statuses(self, transaction_hashes):
		await asyncio.sleep(0.01)
		return generate_transaction_statuses(self.status_start_height, transaction_hashes)


async def test_filter_finalized_transactions_can_return_none():
	# Arrange: no confirmed transactions are finalized
	client = MockSymbolClient(10000, 10100)

	# Act:
	transaction_hashes = await filter_finalized_transactions(client, [Hash256(HASHES[0]), Hash256(HASHES[2]), Hash256(HASHES[1])])

	# Assert:
	assert [] == transaction_hashes


async def test_filter_finalized_transactions_can_return_some():
	# Arrange: some confirmed transactions are finalized
	client = MockSymbolClient(10000, 9999)

	# Act:
	transaction_hashes = await filter_finalized_transactions(client, [Hash256(HASHES[0]), Hash256(HASHES[2]), Hash256(HASHES[1])])

	# Assert:
	assert 1 == len(transaction_hashes)
	assert Hash256(HASHES[0]) == transaction_hashes[0]


async def test_filter_finalized_transactions_can_return_all():
	# Arrange: all confirmed transactions are finalized
	client = MockSymbolClient(10000, 9998)

	# Act:
	transaction_hashes = await filter_finalized_transactions(client, [Hash256(HASHES[0]), Hash256(HASHES[2]), Hash256(HASHES[1])])

	# Assert:
	assert 2 == len(transaction_hashes)
	assert Hash256(HASHES[0]) == transaction_hashes[0]
	assert Hash256(HASHES[1]) == transaction_hashes[1]


# endregion
