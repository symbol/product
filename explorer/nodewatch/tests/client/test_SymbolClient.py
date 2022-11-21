import json

import pytest
from aiohttp import web
from symbolchain.CryptoTypes import Hash256, PublicKey

from puller.client.SymbolClient import SymbolClient
from puller.model.Endpoint import Endpoint
from puller.model.NodeInfo import NodeInfo

# region test data


NODE_INFO_1 = {
	'friendlyName': 'The Wolf Farm owned by Tresto(@TrendStream)',
	'host': 'wolf.importance.jp',
	'networkGenerationHashSeed': '57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6',
	'networkIdentifier': 104,
	'nodePublicKey': 'A4714451910AF026AF7A3960FF87EDCA0BA4E80CABCB350FA2B69439E1CB0B97',
	'port': 7900,
	'publicKey': 'D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA',
	'roles': 3,
	'version': 16777988
}

NODE_INFO_2 = {
	'friendlyName': 'Allnodes619',
	'host': 'xym619.allnodes.me',
	'networkGenerationHashSeed': '57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6',
	'networkIdentifier': 104,
	'nodePublicKey': 'A19C14033EB508EF6AD48A3E5D1E7DEDF0B1DCBAD1978CD61797017749A1B999',
	'port': 7900,
	'publicKey': 'FB744B408D392E0F99701432E0BC8A0D38BEFDEA8019826CCE91458C6E734ADB',
	'roles': 3,
	'version': 16777989
}

NODE_INFO_3 = {
	'friendlyName': 'tiger',
	'host': 'tiger.catapult.ninja',
	'networkGenerationHashSeed': '57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6',
	'networkIdentifier': 104,
	'port': 7900,
	'publicKey': 'C807BE28855D0C87A8A2C032E51790CCB9158C15CBACB8B222E27DFFFEB3697D',
	'roles': 5,
	'version': 16777989
}

# endregion


# region server fixture

@pytest.fixture
def server(event_loop, aiohttp_client):
	class MockSymbolServer:
		def __init__(self):
			self.urls = []

		async def network_properties(self, request):
			return await self._process(request, {
				'chain': {'currencyMosaicId': '0x72C0\'212E\'67A0\'8BCE'}
			})

		async def chain_info(self, request):
			return await self._process(request, {
				'height': 1234,
				'scoreHigh': 888999,
				'scoreLow': 222111,
				'latestFinalizedBlock': {
					'finalizationEpoch': 222,
					'finalizationPoint': 10,
					'height': 1198,
					'hash': 'C49C566E4CF60856BC127C9E4748C89E3D38566DE0DAFE1A491012CC27A1C043'
				}
			})

		async def node_info(self, request):
			return await self._process(request, NODE_INFO_1)

		async def node_peers(self, request):
			return await self._process(request, [NODE_INFO_2, NODE_INFO_3])

		async def _process(self, request, response_body):
			self.urls.append(str(request.url))
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'})

	# create a mock server
	mock_server = MockSymbolServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/network/properties', mock_server.network_properties)
	app.router.add_get('/chain/info', mock_server.chain_info)
	app.router.add_get('/node/info', mock_server.node_info)
	app.router.add_get('/node/peers', mock_server.node_peers)
	server = event_loop.run_until_complete(aiohttp_client(app))  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server

# endregion

# pylint: disable=invalid-name


# region GET (currency_mosaic_id)

async def test_can_query_currency_mosaic_id(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	currency_mosaic_id = await client.currency_mosaic_id()

	# Assert:
	assert [f'{server.make_url("")}/network/properties'] == server.mock.urls
	assert 0x72C0212E67A08BCE == currency_mosaic_id


async def test_can_cache_currency_mosaic_id(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	currency_mosaic_id = None
	for _ in range(4):
		currency_mosaic_id = await client.currency_mosaic_id()

	# Assert: only one network call
	assert [f'{server.make_url("")}/network/properties'] == server.mock.urls
	assert 0x72C0212E67A08BCE == currency_mosaic_id

# endregion


# region GET (chain_height, chain_statistics, finalization_statistics)

async def test_can_query_chain_height(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	height = await client.chain_height()

	# Assert:
	assert [f'{server.make_url("")}/chain/info'] == server.mock.urls
	assert 1234 == height


async def test_can_query_chain_statistics(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	chain_statistics = await client.chain_statistics()

	# Assert:
	assert [f'{server.make_url("")}/chain/info'] == server.mock.urls
	assert 1234 == chain_statistics.height
	assert 888999 == chain_statistics.score_high
	assert 222111 == chain_statistics.score_low


async def test_can_query_finalization_statistics(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	finalization_statistics = await client.finalization_statistics()

	# Assert:
	assert [f'{server.make_url("")}/chain/info'] == server.mock.urls
	assert 222 == finalization_statistics.epoch
	assert 10 == finalization_statistics.point
	assert 1198 == finalization_statistics.height
	assert Hash256('C49C566E4CF60856BC127C9E4748C89E3D38566DE0DAFE1A491012CC27A1C043') == finalization_statistics.hash

# endregion


# region GET (node_info)

async def test_can_query_node_info(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	node_info = await client.node_info()

	# Assert:
	assert [f'{server.make_url("")}/node/info'] == server.mock.urls
	assert NodeInfo(
		104,
		Hash256('57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6'),
		PublicKey('D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA'),
		PublicKey('A4714451910AF026AF7A3960FF87EDCA0BA4E80CABCB350FA2B69439E1CB0B97'),
		Endpoint('http', 'wolf.importance.jp', 3000),
		'The Wolf Farm owned by Tresto(@TrendStream)',
		'1.0.3.4',
		3) == node_info

# endregion


# region GET (peers)

async def test_can_query_peers(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	client = SymbolClient(server.make_url(''))

	# Act:
	peers = await client.peers()

	# Assert:
	assert [f'{server.make_url("")}/node/peers'] == server.mock.urls
	assert 2 == len(peers)
	assert NodeInfo(
		104,
		Hash256('57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6'),
		PublicKey('FB744B408D392E0F99701432E0BC8A0D38BEFDEA8019826CCE91458C6E734ADB'),
		PublicKey('A19C14033EB508EF6AD48A3E5D1E7DEDF0B1DCBAD1978CD61797017749A1B999'),
		Endpoint('http', 'xym619.allnodes.me', 3000),
		'Allnodes619',
		'1.0.3.5',
		3) == peers[0]
	assert NodeInfo(
		104,
		Hash256('57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6'),  # pylint: disable=duplicate-code
		PublicKey('C807BE28855D0C87A8A2C032E51790CCB9158C15CBACB8B222E27DFFFEB3697D'),
		None,
		Endpoint('http', 'tiger.catapult.ninja', 7900),
		'tiger',
		'1.0.3.5',
		5) == peers[1]

# endregion
