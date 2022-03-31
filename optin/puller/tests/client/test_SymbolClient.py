import asyncio
import json
from binascii import hexlify

import pytest
from aiohttp import web
from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nem.Network import Address as NemAddress
from symbolchain.sc import MosaicId
from symbolchain.symbol.Network import Address, Network
from symbolchain.symbol.NetworkTimestamp import NetworkTimestamp

from puller.client.SymbolClient import SymbolClient, filter_finalized_transactions

from ..test.OptinRequestTestUtils import HASHES, PUBLIC_KEYS, SYMBOL_ADDRESSES

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
			self.middle_mosaic_id = 'AABBCCFF00112244'

		async def accounts_known(self, request):
			return await self._process(request, {'account': {
				'mosaics': [
					{'id': '00BBCCFF00112244', 'amount': '11223344'},
					{'id': self.middle_mosaic_id, 'amount': '9988776655'},
					{'id': 'FFBBCCFF00112244', 'amount': '123'}
				]
			}})

		async def accounts_unknown(self, request):
			return await self._process(request, {'code': 'ResourceNotFound', 'message': 'no resource exists'})

		async def chain_info(self, request):
			return await self._process(request, {'height': '123456', 'latestFinalizedBlock': {'height': str(self.finalized_height)}})

		async def node_time(self, request):
			return await self._process(request, {'communicationTimestamps': {'receiveTimestamp': '30469876543'}})

		async def node_info(self, request):
			return await self._process(request, {'networkIdentifier': 152})

		async def network_properties(self, request):
			return await self._process(request, {'chain': {'currencyMosaicId': '0xABCD\'EF09\'5678\'1234'}})

		async def transactions(self, request):
			request_json = json.loads(await request.text())
			payload = request_json['payload']
			return await self._process(request, {'message': f'hex payload length {len(payload)}'})

		async def transaction_statuses(self, request):
			request_json = json.loads(await request.text())
			return await self._process(request, generate_transaction_statuses(self.status_start_height, request_json['hashes']))

		async def transactions_confirmed(self, request):
			messages = [
				'\0{ "nisAddress": "NA3IMF22S2GAHQQCL7FJKA2XWDQLK3FXFHR5SVXV" }',
				'\0{ "nisAddress": "NAEBRWDBDHWRDPEV4YGTF2YFA4DSDQTWKNXUCZWX" }',
				'\0{ "nisAddress": "NDMK7CQLJYRXGJNQXELM4OG2NTZAC2C4YFFGWDIS" }'
			]
			return await self._process(request, {
				'data': [
					{
						'meta': {'hash': HASHES[i]},
						'transaction': {'message': hexlify(message.encode('utf8')).decode('utf8')}
					} for i, message in enumerate(messages)
				]
			})

		async def _process(self, request, response_body):
			self.urls.append(str(request.url))
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'})

	# create a mock server
	mock_server = MockSymbolServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get(f'/accounts/{SYMBOL_ADDRESSES[0]}', mock_server.accounts_known)
	app.router.add_get(f'/accounts/{SYMBOL_ADDRESSES[1]}', mock_server.accounts_unknown)
	app.router.add_get('/chain/info', mock_server.chain_info)
	app.router.add_get('/node/time', mock_server.node_time)
	app.router.add_get('/node/info', mock_server.node_info)
	app.router.add_get('/network/properties', mock_server.network_properties)
	app.router.add_put('/transactions', mock_server.transactions)
	app.router.add_post('/transactionStatus', mock_server.transaction_statuses)
	app.router.add_get('/transactions/confirmed', mock_server.transactions_confirmed)
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


# region node_time

async def test_can_query_node_time(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	time = await client.node_time()

	# Assert:
	assert [f'{server.make_url("")}/node/time'] == server.mock.urls
	assert NetworkTimestamp(30469876543) == time

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


async def test_can_query_network_cached(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act: query multiple times
	networks = [await client.node_network() for _ in range(3)]

	# Assert: only a single server call was made
	assert [f'{server.make_url("")}/node/info'] == server.mock.urls
	for network in networks:
		assert Network.TESTNET == network

# endregion


# region balance

async def _assert_can_query_balance(server, mosaic_id, expected_balance):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))
	server.mock.middle_mosaic_id = mosaic_id

	# Act:
	balance = await client.balance(Address(SYMBOL_ADDRESSES[0]))

	# Assert:
	assert [f'{server.make_url("")}/accounts/{SYMBOL_ADDRESSES[0]}'] == server.mock.urls
	assert expected_balance == balance


async def test_can_query_balance_mainnet(server):  # pylint: disable=redefined-outer-name
	await _assert_can_query_balance(server, '6BED913FA20223F8', 9988776655)


async def test_can_query_balance_testnet(server):  # pylint: disable=redefined-outer-name
	await _assert_can_query_balance(server, '3A8416DB2D53B6C8', 9988776655)


async def test_can_query_balance_unknown(server):  # pylint: disable=redefined-outer-name
	await _assert_can_query_balance(server, 'AABBCCFF00112244', 0)

# endregion


# region network currency

async def test_can_query_network_currency(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	currency = await client.network_currency()

	# Assert:
	assert [f'{server.make_url("")}/network/properties'] == server.mock.urls
	assert MosaicId(0xABCD_EF09_5678_1234) == currency

# endregion


# region transactions

async def test_can_put_transactions(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	status_message = await client.announce(b'12345')

	# Assert:
	assert [f'{server.make_url("")}/transactions'] == server.mock.urls
	assert 'hex payload length 10' == status_message['message']

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


# region outgoing_transactions

def assert_message(message, transaction):
	assert message == transaction['transaction']['message']


async def test_outgoing_transactions(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	transactions = await client.outgoing_transactions(PublicKey(PUBLIC_KEYS[0]))

	# Assert:
	assert [
		f'{server.make_url("")}/transactions/confirmed?signerPublicKey={PublicKey(PUBLIC_KEYS[0])}&embedded=true&fromHeight=2&pageSize=100'
	] == server.mock.urls
	assert 3 == len(transactions)

	prefix = '007b20226e697341646472657373223a20224e'
	assert_message(f'{prefix}4133494d46323253324741485151434c37464a4b4132585744514c4b334658464852355356585622207d', transactions[0])
	assert_message(f'{prefix}414542525744424448575244504556345947544632594641344453445154574b4e5855435a575822207d', transactions[1])
	assert_message(f'{prefix}444d4b3743514c4a595258474a4e5158454c4d344f47324e545a4143324334594646475744495322207d', transactions[2])

# endregion


# region find_payout_transactions

async def test_can_find_payout_transactions(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	optin_transaction_infos = await client.find_payout_transactions(PublicKey(PUBLIC_KEYS[0]), Address(SYMBOL_ADDRESSES[0]))

	# Assert:
	assert [
		f'{server.make_url("")}/transactions/confirmed?signerPublicKey={PublicKey(PUBLIC_KEYS[0])}' + (
			f'&recipientAddress={Address(SYMBOL_ADDRESSES[0])}'
		)
	] == server.mock.urls
	assert 3 == len(optin_transaction_infos)

	assert NemAddress('NA3IMF22S2GAHQQCL7FJKA2XWDQLK3FXFHR5SVXV') == optin_transaction_infos[0].address
	assert Hash256(HASHES[0]) == optin_transaction_infos[0].transaction_hash

	assert NemAddress('NAEBRWDBDHWRDPEV4YGTF2YFA4DSDQTWKNXUCZWX') == optin_transaction_infos[1].address
	assert Hash256(HASHES[1]) == optin_transaction_infos[1].transaction_hash

	assert NemAddress('NDMK7CQLJYRXGJNQXELM4OG2NTZAC2C4YFFGWDIS') == optin_transaction_infos[2].address
	assert Hash256(HASHES[2]) == optin_transaction_infos[2].transaction_hash


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
