import json

import pytest
from aiohttp import web
from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address, Network

from symbollightapi.connector.NemConnector import NemConnector
from symbollightapi.model.Block import Block
from symbollightapi.model.Endpoint import Endpoint
from symbollightapi.model.NodeInfo import NodeInfo
from symbollightapi.model.Transaction import ConvertAccountToMultisigTransaction, ImportanceTransferTransaction, TransferTransaction

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


CHAIN_BLOCK_1 = {  # Added ConvertAccountToMultisigTransaction, ImportanceTransferTransaction, TransferTransaction
	'difficulty': 100000000000000,
	'txes': [
		{
			'tx': {
				'timeStamp': 73397,
				'mode': 1,
				'signature': (
					'1b81379847241e45da86b27911e5c9a9192ec04f644d98019657d32838b49c14'
					'3eaa4815a3028b80f9affdbf0b94cd620f7a925e02783dda67b8627b69ddf70e'
				),
				'fee': 8000000,
				'remoteAccount': '7195f4d7a40ad7e31958ae96c4afed002962229675a4cae8dc8a18e290618981',
				'type': 2049,
				'deadline': 83397,
				'version': 1744830465,
				'signer': '22df5f43ee3739a10c346b3ec2d3878668c5514696be425f9067d3a11c777f1d'
			},
			'hash': '306f20260a1b7af692834809d3e7d53edd41616d5076ac0fac6cfa75982185df'
		},
		{
			'tx': {
				'timeStamp': 73397,
				'amount': 180000040000000,
				'signature': (
					'e0cc7f71e353ca0aaf2f009d74aeac5f97d4796b0f08c009058fb33d93c2e8ca'
					'68c0b63e46ff125f43314014d324ac032d2c82996a6e47068b251f1d71fdd001'
				),
				'fee': 9000000,
				'recipient': 'NCOPERAWEWCD4A34NP5UQCCKEX44MW4SL3QYJYS5',
				'type': 257,
				'deadline': 83397,
				'message': {
					'payload': '476f6f64206c75636b21',
					'type': 1
				},
				'version': 1744830465,
				'signer': '8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9'
			},
			'hash': 'd6c9902cfa23dbbdd212d720f86391dd91d215bf77d806f03a6c2dd2e730628a'
		},
		{
			'tx': {
				'timeStamp': 73397,
				'signature': (
					'81ff2235f9ad6f3f8adbc16051bf8691a45ee5ddcace4d6260ce9a2ae63dba59'
					'4f2b486f25451a1f90da7f0e312d9e8570e4bc03798e58d19dec86feb4152307'
				),
				'fee': 40000000,
				"minCosignatories": {
					"relativeChange": 2
				},
				'type': 4097,
				'deadline': 83397,
				'version': 1744830465,
				'signer': 'f41b99320549741c5cce42d9e4bb836d98c50ed5415d0c3c2912d1bb50e6a0e5',
				'modifications': [
					{
						'modificationType': 1,
						'cosignatoryAccount': '1fbdbdde28daf828245e4533765726f0b7790e0b7146e2ce205df3e86366980b'
					},
					{
						'modificationType': 1,
						'cosignatoryAccount': 'f94e8702eb1943b23570b1b83be1b81536df35538978820e98bfce8f999e2d37'
					}
				]
			},
			'hash': 'cc64ca69bfa95db2ff7ac1e21fe6d27ece189c603200ebc9778d8bb80ca25c3c'
		},
	],
	'block': {
		'timeStamp': 73976,
		'signature': (
			'fdf6a9830e9320af79123f467fcb03d6beab735575ff50eab363d812c5581436'
			'2ad7be0503db2ee70e60ac3408d83cdbcbd941067a6df703e0c21c7bf389f105'
		),
		'prevBlockHash': {
			'data': '438cf6375dab5a0d32f9b7bf151d4539e00a590f7c022d5572c7d41815a24be4'
		},
		'type': 1,
		'transactions': [],
		'version': 1744830465,
		'signer': 'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
		'height': 2
	},
	'hash': '1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4'
}

CHAIN_BLOCK_2 = {
	'difficulty': 90250000000000,
	'txes': [],
	'block': {
		'timeStamp': 78976,
		'signature': (
			'919ae66a34119b49812b335827b357f86884ab08b628029fd6e8db3572faeb4f'
			'323a7bf9488c76ef8faa5b513036bbcce2d949ba3e41086d95a54c0007403c0b'
		),
		'prevBlockHash': {
			'data': '1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4'
		},
		'type': 1,
		'transactions': [],
		'version': 1744830465,
		'signer': '45c1553fb1be7f25b6f79278b9ede1129bb9163f3b85883ea90f1c66f497e68b',
		'height': 3
	},
	'hash': '9708256e8a8dfb76eed41dcfa2e47f4af520b7b3286afb7f60dca02851f8a53e'
}


# endregion


# region server fixture

@pytest.fixture
def server(event_loop, aiohttp_client):
	class MockNemServer:
		def __init__(self):
			self.urls = []
			self.node_info_payload = None

		async def chain_height(self, request):
			return await self._process(request, {'height': 1234})

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

		async def local_chain_blocks_after(self, request):
			return await self._process(request, {'data': [CHAIN_BLOCK_1, CHAIN_BLOCK_2]})

		async def local_block_at(self, request):
			return await self._process(request, CHAIN_BLOCK_1)

		async def _process(self, request, response_body):
			self.urls.append(str(request.url))
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'})

	# create a mock server
	mock_server = MockNemServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/chain/height', mock_server.chain_height)
	app.router.add_get('/node/info', mock_server.node_info)
	app.router.add_get('/node/peer-list/reachable', mock_server.node_peers_reachable)
	app.router.add_get('/account/get', mock_server.account_info)
	app.router.add_get('/account/get/forwarded', mock_server.account_info_forwarded)
	app.router.add_post('/local/chain/blocks-after', mock_server.local_chain_blocks_after)
	app.router.add_post('/local/block/at', mock_server.local_block_at)

	server = event_loop.run_until_complete(aiohttp_client(app))  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server

# endregion

# pylint: disable=invalid-name


# region GET (chain_height)

async def test_can_query_chain_height(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	height = await connector.chain_height()

	# Assert:
	assert [f'{server.make_url("")}/chain/height'] == server.mock.urls
	assert 1234 == height

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


# region GET (account_info)

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


# region local chain blocks after

EXPECTED_BLOCK_2 = Block(
	2,
	73976,
	[
		ImportanceTransferTransaction(
			'306f20260a1b7af692834809d3e7d53edd41616d5076ac0fac6cfa75982185df',
			2,
			'22df5f43ee3739a10c346b3ec2d3878668c5514696be425f9067d3a11c777f1d',
			8000000,
			73397,
			83397,
			'1b81379847241e45da86b27911e5c9a9192ec04f644d98019657d32838b49c14'
			'3eaa4815a3028b80f9affdbf0b94cd620f7a925e02783dda67b8627b69ddf70e',
			2049,
			1,
			'7195f4d7a40ad7e31958ae96c4afed002962229675a4cae8dc8a18e290618981'
		),
		TransferTransaction(
			'd6c9902cfa23dbbdd212d720f86391dd91d215bf77d806f03a6c2dd2e730628a',
			2,
			'8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9',
			9000000,
			73397,
			83397,
			'e0cc7f71e353ca0aaf2f009d74aeac5f97d4796b0f08c009058fb33d93c2e8ca'
			'68c0b63e46ff125f43314014d324ac032d2c82996a6e47068b251f1d71fdd001',
			257,
			180000040000000,
			'NCOPERAWEWCD4A34NP5UQCCKEX44MW4SL3QYJYS5',
			('476f6f64206c75636b21', 1),
			None
		),
		ConvertAccountToMultisigTransaction(
			'cc64ca69bfa95db2ff7ac1e21fe6d27ece189c603200ebc9778d8bb80ca25c3c',
			2,
			'f41b99320549741c5cce42d9e4bb836d98c50ed5415d0c3c2912d1bb50e6a0e5',
			40000000,
			73397,
			83397,
			'81ff2235f9ad6f3f8adbc16051bf8691a45ee5ddcace4d6260ce9a2ae63dba59'
			'4f2b486f25451a1f90da7f0e312d9e8570e4bc03798e58d19dec86feb4152307',
			4097,
			2,
			[
				(1, '1fbdbdde28daf828245e4533765726f0b7790e0b7146e2ce205df3e86366980b'),
				(1, 'f94e8702eb1943b23570b1b83be1b81536df35538978820e98bfce8f999e2d37')
			]
		)
	],
	100000000000000,
	'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
	'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
	(
		'fdf6a9830e9320af79123f467fcb03d6beab735575ff50eab363d812c5581436'
		'2ad7be0503db2ee70e60ac3408d83cdbcbd941067a6df703e0c21c7bf389f105'
	)
)


async def test_can_query_blocks_after(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	blocks = await connector.get_blocks_after(1)

	# Assert:
	assert [f'{server.make_url("")}/local/chain/blocks-after'] == server.mock.urls
	assert 2 == len(blocks)
	assert EXPECTED_BLOCK_2 == blocks[0]
	assert Block(
		3,
		78976,
		[],
		90250000000000,
		'9708256e8a8dfb76eed41dcfa2e47f4af520b7b3286afb7f60dca02851f8a53e',
		'45c1553fb1be7f25b6f79278b9ede1129bb9163f3b85883ea90f1c66f497e68b',
		(
			'919ae66a34119b49812b335827b357f86884ab08b628029fd6e8db3572faeb4f'
			'323a7bf9488c76ef8faa5b513036bbcce2d949ba3e41086d95a54c0007403c0b'
		)
	) == blocks[1]

# endregion


# region local block at public

async def test_can_query_block_at(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = NemConnector(server.make_url(''))

	# Act:
	block = await connector.get_block(2)

	# Assert:
	assert [f'{server.make_url("")}/local/block/at'] == server.mock.urls
	assert EXPECTED_BLOCK_2 == block

# endregion
