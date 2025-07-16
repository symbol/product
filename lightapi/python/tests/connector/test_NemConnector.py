import json
from binascii import unhexlify

import pytest
from aiohttp import web
from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.facade.NemFacade import NemFacade
from symbolchain.nc import Signature
from symbolchain.nem.Network import Address, Network

from symbollightapi.connector.NemConnector import NemConnector
from symbollightapi.model.Endpoint import Endpoint
from symbollightapi.model.Exceptions import NodeException
from symbollightapi.model.NodeInfo import NodeInfo

from ..test.LightApiTestUtils import HASHES, NEM_ADDRESSES, PUBLIC_KEYS

# region test data


NODE_INFO_1 = {  # ACCOUNT_INFO_1 (main, active), ACCOUNT_INFO_3 (remote)
	'metaData': {
		'features': 1,
		'application': None,
		'networkId': 104,
		'version': '0.6.100',
		'platform': 'Oracle Corporation (1.8.0_281) on Linux'
	},
	'endpoint': {
		'protocol': 'http',
		'port': 7890,
		'host': 'jusan.nem.ninja'
	},
	'identity': {
		'name': '[c=#e9c086]jusan[/c]',
		'public-key': '733b57bfa43d66af6f0caebfee97284a768afa880a4ad2cef66f2ca5442ed206'
	}
}

NODE_INFO_2 = {
	'metaData': {
		'features': 1,
		'application': None,
		'networkId': 104,
		'version': '0.6.100',
		'platform': 'Private Build (1.8.0_292) on Linux'
	},
	'endpoint': {
		'protocol': 'http',
		'port': 7890,
		'host': 'xem11.allnodes.me'
	},
	'identity': {
		'name': 'Allnodes11',
		'public-key': '2c24860f5d2faa159732cc6478e5d2d24cf1cf7c60456e48ff9b283086c962d5'
	}
}

NODE_INFO_3 = {
	'metaData': {
		'features': 1,
		'application': None,
		'networkId': 104,
		'version': '0.6.100',
		'platform': 'Ubuntu (11.0.16) on Linux'
	},
	'endpoint': {
		'protocol': 'http',
		'port': 7890,
		'host': 'san.nem.ninja'
	},
	'identity': {
		'name': '[c=#c08686]san[/c]',
		'public-key': '7195f4d7a40ad7e31958ae96c4afed002962229675a4cae8dc8a18e290618981'
	}
}

NODE_INFO_4 = {  # ACCOUNT_INFO_4 (main, inactive)
	'metaData': {
		'features': 1,
		'application': None,
		'networkId': 104,
		'version': '0.6.100',
		'platform': 'Oracle Corporation (1.8.0_151) on Linux'
	},
	'endpoint': {
		'protocol': 'http',
		'port': 7890,
		'host': '176.9.20.180'
	},
	'identity': {
		'name': 'Hi, I am Huge Alice 3',
		'public-key': '18e030c32665e792a35c5fdd7fa5689fbbeb922958f1760a81978dd39e1d8512'
	}
}


ACCOUNT_INFO_1 = {
	'meta': {
		'cosignatories': [],
		'cosignatoryOf': [],
		'status': 'LOCKED',
		'remoteStatus': 'ACTIVE'
	},
	'account': {
		'address': 'NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT',
		'harvestedBlocks': 54553,
		'balance': 20612823531967,
		'importance': 0.0019854120211438703,
		'vestedBalance': 20612759119203,
		'publicKey': '107051c28a2c009a83ae0861cdbff7c1cbab387c964cc433f7d191d9c3115ed7',
		'label': None,
		'multisigInfo': {}
	}
}

ACCOUNT_INFO_2 = {
	'meta': {
		'cosignatories': [],
		'cosignatoryOf': [],
		'status': 'LOCKED',
		'remoteStatus': 'INACTIVE'
	},
	'account': {
		'address': 'NADP63FUUAOS2LDXY75SJ4TOLW4S7YXEAGT25IXG',
		'harvestedBlocks': 0,
		'balance': 2250000000000,
		'importance': 0.00022692560084412516,
		'vestedBalance': 2250000000000,
		'publicKey': None,  # intentionally has no public key to maximize coverage
		'label': None,
		'multisigInfo': {}
	}
}

ACCOUNT_INFO_3 = {
	'meta': {
		'cosignatories': [],
		'cosignatoryOf': [],
		'status': 'LOCKED',
		'remoteStatus': 'REMOTE'
	},
	'account': {
		'address': 'NA7HZVREMOJWCYQOHQYTMVVXOYFOFF4WX46FP65U',
		'harvestedBlocks': 0,
		'balance': 0,
		'importance': 0.0,
		'vestedBalance': 0,
		'publicKey': '733b57bfa43d66af6f0caebfee97284a768afa880a4ad2cef66f2ca5442ed206',
		'label': None,
		'multisigInfo': {}
	}
}

ACCOUNT_INFO_4 = {
	'meta': {
		'cosignatories': [],
		'cosignatoryOf': [],
		'status': 'LOCKED',
		'remoteStatus': 'INACTIVE'
	},
	'account': {
		'address': 'NALICE3JX3N72HZ3IODXCO2HWQIWSTCPC5FVGW7I',
		'harvestedBlocks': 16295,
		'balance': 3002820325262,
		'importance': 0.0002990180894117962,
		'vestedBalance': 3002816164282,
		'publicKey': '18e030c32665e792a35c5fdd7fa5689fbbeb922958f1760a81978dd39e1d8512',
		'label': None,
		'multisigInfo': {}
	}
}


# endregion


# region server fixture

@pytest.fixture
async def server(aiohttp_client):  # pylint: disable=too-many-statements
	class MockNemServer:
		def __init__(self):
			self.urls = []
			self.node_info_payload = None
			self.request_json_payloads = []
			self.simulate_network_error = False
			self.simulate_validation_error = False
			self.exclude_mosaic_divisibility_property = False

		async def chain_height(self, request):
			return await self._process(request, {'height': 1234})

		async def network_time(self, request):
			return await self._process(request, {'sendTimeStamp': 322666792999, 'receiveTimeStamp': 322666799999})

		async def block_at(self, request):
			request_json = json.loads(await request.text())
			block = {
				'type': 1,
				'signer': PUBLIC_KEYS[0],
				'timeStamp': 200000 + request_json['height'],
				'transactions': []
			}

			return await self._process(request, block)

		async def node_info(self, request):
			return await self._process(request, self.node_info_payload)

		async def node_peers_reachable(self, request):
			return await self._process(request, {'data': [NODE_INFO_2, NODE_INFO_3]})

		async def account_info(self, request):
			return await self._process(request, ACCOUNT_INFO_1)

		async def account_info_forwarded(self, request):
			address = Address(request.url.query['address'])

			account_info = ACCOUNT_INFO_1
			if Address('NADP63FUUAOS2LDXY75SJ4TOLW4S7YXEAGT25IXG') == address:
				account_info = ACCOUNT_INFO_2
			if Address('NALICE3JX3N72HZ3IODXCO2HWQIWSTCPC5FVGW7I') == address:
				account_info = ACCOUNT_INFO_4

			return await self._process(request, account_info)

		async def account_mosaic_owned(self, request):
			return await self._process(request, {
				'data': [
					{'quantity': 51890200000, 'mosaicId': {'namespaceId': 'nem', 'name': 'xem'}},
					{'quantity': 99887766000, 'mosaicId': {'namespaceId': 'foo', 'name': 'bar'}},
					{'quantity': 800000000000, 'mosaicId': {'namespaceId': 'foo', 'name': 'baz'}}
				]
			})

		async def mosaic_supply(self, request):
			mosaic_id_parts = request.rel_url.query['mosaicId'].split(':')
			return await self._process(request, {
				'mosaicId': {'namespaceId': mosaic_id_parts[0], 'name': mosaic_id_parts[1]},
				'supply': 1234_000000
			})

		async def mosaic_definition(self, request):
			mosaic_id_parts = request.rel_url.query['mosaicId'].split(':')

			mosaic_properties = [
				('initialSupply', '1000'),
				('divisibility', '3'),
				('supplyMutable', 'true'),
				('transferable', 'false')
			]

			if self.exclude_mosaic_divisibility_property:
				mosaic_properties.remove(mosaic_properties[1])

			return await self._process(request, {
				'id': {'namespaceId': mosaic_id_parts[0], 'name': mosaic_id_parts[1]},
				'properties': [
					{
						'name': mosaic_property[0],
						'value': mosaic_property[1]
					} for mosaic_property in mosaic_properties
				]
			})

		async def transaction_confirmed(self, request):
			transaction_hash_str = request.rel_url.query['hash']
			transaction_hash_to_height_mapping = {
				HASHES[0]: 10001,
				HASHES[1]: 10003
			}

			height = transaction_hash_to_height_mapping.get(transaction_hash_str)
			if not height:
				self.urls.append(str(request.url))

				# simulate 400 not found
				raise NodeException('not found')

			return await self._process(request, {
				'meta': {
					'hash': {'data': transaction_hash_str},
					'height': height
				},
				'transaction': {'message': 'foo'}
			})

		async def transfers(self, request):
			address = Address(request.rel_url.query['address'])

			data = []
			if Address(NEM_ADDRESSES[0]) == address:
				data = [{'transaction': {'name': name}} for name in ['alpha', 'beta', 'zeta']]

			return await self._process(request, {'data': data})

		async def announce_transaction(self, request):
			request_json = await request.json()
			self.request_json_payloads.append(request_json)

			if self.simulate_network_error:
				return await self._process(request, {
					'error': 'Internal Server Error',
					'message': 'expected value for property data, but none was found',
					'status': 500
				}, 500)

			if self.simulate_validation_error:
				return await self._process(request, {'code': 17, 'type': 1, 'message': 'FAILURE_INSUFFICIENT_FEE'})

			return await self._process(request, {'code': 1, 'type': 1, 'message': 'SUCCESS'})

		async def _process(self, request, response_body, status_code=200):
			self.urls.append(str(request.url))
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'}, status=status_code)

	# create a mock server
	mock_server = MockNemServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/chain/height', mock_server.chain_height)
	app.router.add_get('/time-sync/network-time', mock_server.network_time)
	app.router.add_get('/node/info', mock_server.node_info)
	app.router.add_get('/node/peer-list/reachable', mock_server.node_peers_reachable)
	app.router.add_get('/account/get', mock_server.account_info)
	app.router.add_get('/account/get/forwarded', mock_server.account_info_forwarded)
	app.router.add_get('/account/mosaic/owned', mock_server.account_mosaic_owned)
	app.router.add_get('/mosaic/supply', mock_server.mosaic_supply)
	app.router.add_get('/mosaic/definition', mock_server.mosaic_definition)
	app.router.add_get('/transaction/get', mock_server.transaction_confirmed)
	app.router.add_get('/account/transfers/incoming', mock_server.transfers)
	app.router.add_post('/block/at/public', mock_server.block_at)
	app.router.add_post('/transaction/announce', mock_server.announce_transaction)
	server = await aiohttp_client(app)  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server

# endregion

# pylint: disable=invalid-name


# region extract_transaction_id, extract_block_timestamp

def test_can_extract_transaction_id():
	# Act:
	transaction_id = NemConnector.extract_transaction_id({
		'id': 1234,
		'meta': {'id': 5577}
	})

	# Assert:
	assert 5577 == transaction_id


def test_can_extract_block_timestamp():
	# Act:
	timestamp = NemConnector.extract_block_timestamp({
		'timeStamp': 1234,
		'meta': {'timeStamp': 5577}
	})

	# Assert:
	assert 1234 == timestamp

# endregion


# region GET (chain_height, finalized_chain_height, network_time)

async def test_can_query_chain_height(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	height = await connector.chain_height()

	# Assert:
	assert [f'{server.make_url("")}/chain/height'] == server.mock.urls
	assert 1234 == height


async def test_can_query_finalized_chain_height(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	height = await connector.finalized_chain_height()

	# Assert:
	assert [f'{server.make_url("")}/chain/height'] == server.mock.urls
	assert 874 == height


async def test_can_query_network_time(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	timestamp = await connector.network_time()

	# Assert:
	assert [f'{server.make_url("")}/time-sync/network-time'] == server.mock.urls
	assert 322666792 == timestamp.timestamp

# endregion


# region POST (block_headers)

async def test_can_get_block_headers(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	headers = await connector.block_headers(1000)

	# Assert:
	assert [f'{server.make_url("")}/block/at/public'] == server.mock.urls
	assert {'type': 1, 'signer': PUBLIC_KEYS[0], 'timeStamp': 201000} == headers

# endregion


# region GET (node_info)

async def test_can_query_node_info_when_node_has_remote_harvester(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''), Network.MAINNET)
	server.mock.node_info_payload = NODE_INFO_1

	# Act:
	node_info = await connector.node_info()

	# Assert:
	assert [
		f'{server.make_url("")}/node/info',
		f'{server.make_url("")}/account/get/forwarded?address=NA7HZVREMOJWCYQOHQYTMVVXOYFOFF4WX46FP65U'
	] == server.mock.urls
	assert NodeInfo(
		104,
		None,
		PublicKey('107051C28A2C009A83AE0861CDBFF7C1CBAB387C964CC433F7D191D9C3115ED7'),
		PublicKey('733B57BFA43D66AF6F0CAEBFEE97284A768AFA880A4AD2CEF66F2CA5442ED206'),
		Endpoint('http', 'jusan.nem.ninja', 7890),
		'[c=#e9c086]jusan[/c]',
		'0.6.100',
		2) == node_info


async def test_can_query_node_info_when_node_has_main_harvester(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''), Network.MAINNET)
	server.mock.node_info_payload = NODE_INFO_4

	# Act:
	node_info = await connector.node_info()

	# Assert:
	assert [
		f'{server.make_url("")}/node/info',
		f'{server.make_url("")}/account/get/forwarded?address=NALICE3JX3N72HZ3IODXCO2HWQIWSTCPC5FVGW7I'
	] == server.mock.urls
	assert NodeInfo(
		104,
		None,
		PublicKey('18E030C32665E792A35C5FDD7FA5689FBBEB922958F1760A81978DD39E1D8512'),
		PublicKey('18E030C32665E792A35C5FDD7FA5689FBBEB922958F1760A81978DD39E1D8512'),
		Endpoint('http', '176.9.20.180', 7890),
		'Hi, I am Huge Alice 3',
		'0.6.100',
		2) == node_info

# endregion


# region GET (peers)

async def test_can_query_peers(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	peers = await connector.peers()

	# Assert:
	assert [f'{server.make_url("")}/node/peer-list/reachable'] == server.mock.urls
	assert 2 == len(peers)
	assert NodeInfo(
		104,
		None,
		None,
		PublicKey('2C24860F5D2FAA159732CC6478E5D2D24CF1CF7C60456E48FF9B283086C962D5'),
		Endpoint('http', 'xem11.allnodes.me', 7890),
		'Allnodes11',
		'0.6.100',
		2) == peers[0]
	assert NodeInfo(
		104,
		None,
		None,
		PublicKey('7195F4D7A40AD7E31958AE96C4AFED002962229675A4CAE8DC8A18E290618981'),
		Endpoint('http', 'san.nem.ninja', 7890),
		'[c=#c08686]san[/c]',
		'0.6.100',
		2) == peers[1]

# endregion


# region GET (balance, account_info)

async def test_can_query_balance(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	balance = await connector.balance(Address('NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT'))

	# Assert:
	assert [f'{server.make_url("")}/account/get?address=NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT'] == server.mock.urls
	assert 20612823_531967 == balance


async def test_can_query_balance_custom_mosaic_with_balance(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	balance = await connector.balance(Address('NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT'), ('foo', 'bar'))

	# Assert:
	assert [f'{server.make_url("")}/account/mosaic/owned?address=NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT'] == server.mock.urls
	assert 99887766000 == balance


async def test_can_query_balance_custom_mosaic_with_zero_balance(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	balance = await connector.balance(Address('NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT'), ('bar', 'foo'))

	# Assert:
	assert [f'{server.make_url("")}/account/mosaic/owned?address=NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT'] == server.mock.urls
	assert 0 == balance


def _assert_account_info_1(account_info):
	assert Address('NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT') == account_info.address
	assert 20612759.119203 == account_info.vested_balance
	assert 20612823.531967 == account_info.balance
	assert PublicKey('107051C28A2C009A83AE0861CDBFF7C1CBAB387C964CC433F7D191D9C3115ED7') == account_info.public_key
	assert 0.0019854120211438703 == account_info.importance
	assert 54553 == account_info.harvested_blocks
	assert 'ACTIVE' == account_info.remote_status


async def test_can_query_account_info(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	account_info = await connector.account_info(Address('NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT'))

	# Assert:
	assert [f'{server.make_url("")}/account/get?address=NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT'] == server.mock.urls
	_assert_account_info_1(account_info)


async def test_can_query_account_info_with_forwarding(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	account_info = await connector.account_info(Address('NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT'), forwarded=True)

	# Assert:
	assert [f'{server.make_url("")}/account/get/forwarded?address=NCXIQA4FF5JB6AMQ53NQ3ZMRD3X3PJEWDJJJIGHT'] == server.mock.urls
	_assert_account_info_1(account_info)


async def test_can_query_account_info_without_public_key(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	account_info = await connector.account_info(Address('NADP63FUUAOS2LDXY75SJ4TOLW4S7YXEAGT25IXG'), forwarded=True)

	# Assert:
	assert [f'{server.make_url("")}/account/get/forwarded?address=NADP63FUUAOS2LDXY75SJ4TOLW4S7YXEAGT25IXG'] == server.mock.urls
	assert Address('NADP63FUUAOS2LDXY75SJ4TOLW4S7YXEAGT25IXG') == account_info.address
	assert 2250000.000000 == account_info.vested_balance
	assert 2250000.000000 == account_info.balance
	assert account_info.public_key is None
	assert 0.00022692560084412516 == account_info.importance
	assert 0 == account_info.harvested_blocks
	assert 'INACTIVE' == account_info.remote_status

# endregion


# region GET (mosaic_fee_information)

async def test_can_query_mosaic_fee_information_with_explicit_divisibility(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	fee_information = await connector.mosaic_fee_information(('foo', 'bar'))

	# Assert:
	assert [
		f'{server.make_url("")}/mosaic/supply?mosaicId=foo:bar',
		f'{server.make_url("")}/mosaic/definition?mosaicId=foo:bar'
	] == server.mock.urls
	assert 1234_000000 == fee_information.supply
	assert 3 == fee_information.divisibility


async def test_can_query_mosaic_fee_information_without_divisibility(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))
	server.mock.exclude_mosaic_divisibility_property = True

	# Act:
	fee_information = await connector.mosaic_fee_information(('foo', 'bar'))

	# Assert:
	assert [
		f'{server.make_url("")}/mosaic/supply?mosaicId=foo:bar',
		f'{server.make_url("")}/mosaic/definition?mosaicId=foo:bar'
	] == server.mock.urls
	assert 1234_000000 == fee_information.supply
	assert 0 == fee_information.divisibility  # default divisibility is zero

# endregion


# region GET (filter_confirmed_transactions)

async def test_can_filter_confirmed_transactions(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	transaction_hash_height_pairs = await connector.filter_confirmed_transactions([HASHES[0], HASHES[2], HASHES[1]])

	# Assert:
	assert [
		f'{server.make_url("")}/transaction/get?hash={HASHES[0]}',
		f'{server.make_url("")}/transaction/get?hash={HASHES[2]}',
		f'{server.make_url("")}/transaction/get?hash={HASHES[1]}'
	] == server.mock.urls
	assert 2 == len(transaction_hash_height_pairs)

	assert (Hash256(HASHES[0]), 10001) == transaction_hash_height_pairs[0]
	assert (Hash256(HASHES[1]), 10003) == transaction_hash_height_pairs[1]

# endregion


# region GET (transaction_confirmed)

async def test_transaction_confirmed(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	transaction = await connector.transaction_confirmed(Hash256(HASHES[0]))

	# Assert:
	assert [f'{server.make_url("")}/transaction/get?hash={HASHES[0]}'] == server.mock.urls
	assert {
		'meta': {
			'hash': {'data': HASHES[0]},
			'height': 10001
		},
		'transaction': {'message': 'foo'}
	} == transaction

# endregion


# region GET (incoming_transactions)

async def test_can_query_incoming_transactions_from_beginning(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	transactions = await connector.incoming_transactions(NEM_ADDRESSES[0])

	# Assert:
	assert [f'{server.make_url("")}/account/transfers/incoming?address={NEM_ADDRESSES[0]}'] == server.mock.urls
	assert [{'transaction': {'name': 'alpha'}}, {'transaction': {'name': 'beta'}}, {'transaction': {'name': 'zeta'}}] == transactions


async def test_can_query_incoming_transactions_with_custom_start_id(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	transactions = await connector.incoming_transactions(NEM_ADDRESSES[0], 98765)

	# Assert:
	assert [f'{server.make_url("")}/account/transfers/incoming?address={NEM_ADDRESSES[0]}&id=98765'] == server.mock.urls
	assert [{'transaction': {'name': 'alpha'}}, {'transaction': {'name': 'beta'}}, {'transaction': {'name': 'zeta'}}] == transactions

# endregion


# region POST (announce_transaction)

EXAMPLE_TRANSACTION_SIGNING_PAYLOAD_HEX = ''.join([
	'01010000010000988C90650B20000000A59277D56E9F4FA46854F5EFAAA253B0',
	'9F8AE69A473565E01FD9E6A738E4AB74A0860100000000000CE2660B28000000',
	'54414C494345355646364A3546594D5443423741335147364F49524452555844',
	'574A474656584E57E0D14D000000000000000000'
])

EXAMPLE_TRANSACTION_SIGNATURE_HEX = ''.join([
	'DAB0488FEFA42D0680F68548EBBD587C57B22E01D6A60B8EF396C5588E445C44',
	'C08B275209B00D0F2ED95E0D686DF70A34EA7E3B80F20837353574D5716AEC42'
])


def _create_example_transfer_transaction():
	facade = NemFacade('testnet')
	transaction = facade.transaction_factory.create({
		'type': 'transfer_transaction_v1',
		'signer_public_key': 'A59277D56E9F4FA46854F5EFAAA253B09F8AE69A473565E01FD9E6A738E4AB74',
		'fee': 0x186A0,
		'timestamp': 191205516,
		'deadline': 191291916,
		'recipient_address': 'TALICE5VF6J5FYMTCB7A3QG6OIRDRUXDWJGFVXNW',
		'amount': 5100000
	})
	transaction.signature = Signature(EXAMPLE_TRANSACTION_SIGNATURE_HEX)
	return transaction


async def test_can_announce_transaction_object(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))
	transaction = _create_example_transfer_transaction()

	# Act:
	await connector.announce_transaction(transaction)

	# Assert:
	assert [f'{server.make_url("")}/transaction/announce'] == server.mock.urls
	assert [{
		'data': EXAMPLE_TRANSACTION_SIGNING_PAYLOAD_HEX,
		'signature': EXAMPLE_TRANSACTION_SIGNATURE_HEX
	}] == server.mock.request_json_payloads


async def test_can_announce_transaction_buffer(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))
	transaction_buffer = unhexlify(EXAMPLE_TRANSACTION_SIGNATURE_HEX + EXAMPLE_TRANSACTION_SIGNING_PAYLOAD_HEX)

	# Act:
	await connector.announce_transaction(transaction_buffer)

	# Assert:
	assert [f'{server.make_url("")}/transaction/announce'] == server.mock.urls
	assert [{
		'data': EXAMPLE_TRANSACTION_SIGNING_PAYLOAD_HEX,
		'signature': EXAMPLE_TRANSACTION_SIGNATURE_HEX
	}] == server.mock.request_json_payloads


async def test_cannot_announce_transaction_with_network_error(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.simulate_network_error = True

	connector = NemConnector(server.make_url(''))

	# Act + Assert:
	with pytest.raises(NodeException, match='expected value for property data'):
		await connector.announce_transaction(_create_example_transfer_transaction())


async def test_cannot_announce_transaction_with_validation_error(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	server.mock.simulate_validation_error = True

	connector = NemConnector(server.make_url(''))

	# Act + Assert:
	with pytest.raises(NodeException, match='announce transaction failed'):
		await connector.announce_transaction(_create_example_transfer_transaction())


# endregion
