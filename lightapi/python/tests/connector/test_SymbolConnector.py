import json

import pytest
from aiohttp import web
from symbolchain.CryptoTypes import Hash256, PublicKey

from symbollightapi.connector.SymbolConnector import SymbolConnector
from symbollightapi.model.Endpoint import Endpoint
from symbollightapi.model.NodeInfo import NodeInfo

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
				'height': '1234',
				'scoreHigh': '888999',
				'scoreLow': '222111',
				'latestFinalizedBlock': {
					'finalizationEpoch': 222,
					'finalizationPoint': 10,
					'height': '1198',
					'hash': 'C49C566E4CF60856BC127C9E4748C89E3D38566DE0DAFE1A491012CC27A1C043'
				}
			})

		async def node_time(self, request):
			return await self._process(request, {
				'communicationTimestamps': {
					'sendTimestamp': '68414660756',
					'receiveTimestamp': '68414660780'
				}
			})

		async def node_info(self, request):
			return await self._process(request, NODE_INFO_1)

		async def node_peers(self, request):
			return await self._process(request, [NODE_INFO_2, NODE_INFO_3])

		async def accounts_by_id(self, request):
			account_id = request.match_info['account_id']
			if 'error' == account_id:
				return await self._process(request, {'code': 'InvalidArgument', 'message': 'accountId has an invalid format'})

			json_supplemental_public_keys = {}
			if account_id in ('linked', 'all'):
				json_supplemental_public_keys['linked'] = {'publicKey': 'BCC8F27E4CF085FB4668EE787E76308DED7C4B811C8B8188CE4452A916F8378F'}

			if account_id in ('vrf', 'all'):
				json_supplemental_public_keys['vrf'] = {'publicKey': '5BD25262153603172A79677DC2703984D1249F43186BB970D2B70C88C78C0724'}

			if account_id in ('voting', 'all'):
				json_supplemental_public_keys['voting'] = {
					'publicKeys': [
						{
							'publicKey': '833D02CBB3502F11D80AA77CF3C9CC7056DBBD0C52EFD3CB8387004CBF41A273',
							'startEpoch': 1133,
							'endEpoch': 1492
						},
						{
							'publicKey': 'B339999D60A38E43605C26CC868C4631FF6ACB6FB275A320CA9793A98FA00441',
							'startEpoch': 1493,
							'endEpoch': 1852
						}
					]
				}

			return await self._process(request, {
				'account': {
					'supplementalPublicKeys': json_supplemental_public_keys
				}
			})

		async def _process(self, request, response_body):
			self.urls.append(str(request.url))
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'})

	# create a mock server
	mock_server = MockSymbolServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/network/properties', mock_server.network_properties)
	app.router.add_get('/chain/info', mock_server.chain_info)
	app.router.add_get('/node/time', mock_server.node_time)
	app.router.add_get('/node/info', mock_server.node_info)
	app.router.add_get('/node/peers', mock_server.node_peers)
	app.router.add_get(r'/accounts/{account_id}', mock_server.accounts_by_id)
	server = event_loop.run_until_complete(aiohttp_client(app))  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server

# endregion

# pylint: disable=invalid-name


# region GET (currency_mosaic_id)

async def test_can_query_currency_mosaic_id(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolConnector(server.make_url(''))

	# Act:
	currency_mosaic_id = await connector.currency_mosaic_id()

	# Assert:
	assert [f'{server.make_url("")}/network/properties'] == server.mock.urls
	assert 0x72C0212E67A08BCE == currency_mosaic_id


async def test_can_cache_currency_mosaic_id(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolConnector(server.make_url(''))

	# Act:
	currency_mosaic_id = None
	for _ in range(4):
		currency_mosaic_id = await connector.currency_mosaic_id()

	# Assert: only one network call
	assert [f'{server.make_url("")}/network/properties'] == server.mock.urls
	assert 0x72C0212E67A08BCE == currency_mosaic_id

# endregion


# region GET (chain_height, chain_statistics, finalization_statistics, network_time)

async def test_can_query_chain_height(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolConnector(server.make_url(''))

	# Act:
	height = await connector.chain_height()

	# Assert:
	assert [f'{server.make_url("")}/chain/info'] == server.mock.urls
	assert 1234 == height


async def test_can_query_chain_statistics(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolConnector(server.make_url(''))

	# Act:
	chain_statistics = await connector.chain_statistics()

	# Assert:
	assert [f'{server.make_url("")}/chain/info'] == server.mock.urls
	assert 1234 == chain_statistics.height
	assert 888999 == chain_statistics.score_high
	assert 222111 == chain_statistics.score_low


async def test_can_query_finalization_statistics(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolConnector(server.make_url(''))

	# Act:
	finalization_statistics = await connector.finalization_statistics()

	# Assert:
	assert [f'{server.make_url("")}/chain/info'] == server.mock.urls
	assert 222 == finalization_statistics.epoch
	assert 10 == finalization_statistics.point
	assert 1198 == finalization_statistics.height
	assert Hash256('C49C566E4CF60856BC127C9E4748C89E3D38566DE0DAFE1A491012CC27A1C043') == finalization_statistics.hash


async def test_can_query_network_time(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolConnector(server.make_url(''))

	# Act:
	timestamp = await connector.network_time()

	# Assert:
	assert [f'{server.make_url("")}/node/time'] == server.mock.urls
	assert 68414660756 == timestamp.timestamp

# endregion


# region GET (node_info)

async def test_can_query_node_info(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolConnector(server.make_url(''))

	# Act:
	node_info = await connector.node_info()

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
	connector = SymbolConnector(server.make_url(''))

	# Act:
	peers = await connector.peers()

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


# region GET (account_links)

def _assert_no_links(links):
	assert None is links.linked_public_key
	assert None is links.vrf_public_key
	assert 0 == len(links.voting_public_keys)


def _assert_voting_public_keys(links):
	assert 2 == len(links.voting_public_keys)
	assert PublicKey('833D02CBB3502F11D80AA77CF3C9CC7056DBBD0C52EFD3CB8387004CBF41A273') == links.voting_public_keys[0].public_key
	assert 1133 == links.voting_public_keys[0].start_epoch
	assert 1492 == links.voting_public_keys[0].end_epoch
	assert PublicKey('B339999D60A38E43605C26CC868C4631FF6ACB6FB275A320CA9793A98FA00441') == links.voting_public_keys[1].public_key
	assert 1493 == links.voting_public_keys[1].start_epoch
	assert 1852 == links.voting_public_keys[1].end_epoch


async def test_can_query_account_links_for_unknown_account(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolConnector(server.make_url(''))

	# Act:
	links = await connector.account_links('error')

	# Assert:
	assert [f'{server.make_url("")}/accounts/error'] == server.mock.urls
	_assert_no_links(links)


async def test_can_query_account_links_for_account_with_no_links(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolConnector(server.make_url(''))

	# Act:
	links = await connector.account_links('none')

	# Assert:
	assert [f'{server.make_url("")}/accounts/none'] == server.mock.urls
	_assert_no_links(links)


async def test_can_query_account_links_for_account_with_only_linked_public_key(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolConnector(server.make_url(''))

	# Act:
	links = await connector.account_links('linked')

	# Assert:
	assert [f'{server.make_url("")}/accounts/linked'] == server.mock.urls
	assert PublicKey('BCC8F27E4CF085FB4668EE787E76308DED7C4B811C8B8188CE4452A916F8378F') == links.linked_public_key
	assert None is links.vrf_public_key
	assert 0 == len(links.voting_public_keys)


async def test_can_query_account_links_for_account_with_only_vrf_public_key(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolConnector(server.make_url(''))

	# Act:
	links = await connector.account_links('vrf')

	# Assert:
	assert [f'{server.make_url("")}/accounts/vrf'] == server.mock.urls
	assert None is links.linked_public_key
	assert PublicKey('5BD25262153603172A79677DC2703984D1249F43186BB970D2B70C88C78C0724') == links.vrf_public_key
	assert 0 == len(links.voting_public_keys)


async def test_can_query_account_links_for_account_with_only_voting_public_keys(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolConnector(server.make_url(''))

	# Act:
	links = await connector.account_links('voting')

	# Assert:
	assert [f'{server.make_url("")}/accounts/voting'] == server.mock.urls
	assert None is links.linked_public_key
	assert None is links.vrf_public_key
	_assert_voting_public_keys(links)


async def test_can_query_account_links_for_account_with_all_links(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	connector = SymbolConnector(server.make_url(''))

	# Act:
	links = await connector.account_links('all')

	# Assert:
	assert [f'{server.make_url("")}/accounts/all'] == server.mock.urls
	assert PublicKey('BCC8F27E4CF085FB4668EE787E76308DED7C4B811C8B8188CE4452A916F8378F') == links.linked_public_key
	assert PublicKey('5BD25262153603172A79677DC2703984D1249F43186BB970D2B70C88C78C0724') == links.vrf_public_key
	_assert_voting_public_keys(links)

# endregion
