import json

from aiohttp import web

NODEWATCH_PEER_NODES = [
	{
		'mainPublicKey': '776B597C1C80782224A3DA9A19FD5D23A3281CF866B9F4720A4414568447A92A',
		'endpoint': 'http://ik1-432-48199.vs.sakura.ne.jp:3333',
		'name': '',
		'version': '1.0.3.5',
		'height': 2001840,
		'finalizedHeight': 2001776,
		'balance': 268094.851405,
		'roles': 3
	},
	{
		'mainPublicKey': '677397AC8E505579CBF843485D416E61460FA3CD2BC76A64970E3138CFE3BBAB',
		'endpoint': '',
		'name': '! symplanet2',
		'version': '1.0.3.4',
		'height': 2001807,
		'finalizedHeight': 2001776,
		'balance': 22060545.783227,
		'roles': 5
	},
	{
		'mainPublicKey': '50C16D3DAA2A708E3781ED201F15AEF23F0B3989584DF832284A67F14372B104',
		'endpoint': 'http://0-0-5symbol.open-nodes.com:3000',
		'name': 'Thank you !',
		'version': '1.0.3.5',
		'height': 2001840,
		'finalizedHeight': 2001776,
		'balance': 0,
		'roles': 7
	},
	{
		'mainPublicKey': 'D8F4FE47F1F5B1046748067E52725AEBAA1ED9F3CE45D02054011A39671DD9AA',
		'endpoint': 'http://wolf.importance.jp:3000',
		'name': 'The Wolf Farm owned by Tresto(@TrendStream)',
		'version': '1.0.3.5',
		'height': 2001840,
		'finalizedHeight': 2001776,
		'balance': 98.995728,
		'roles': 3
	},
	{
		'mainPublicKey': '3DC99526E1149E3D2581563B2C7A963908A1A0044509240F139A86331C986884',
		'endpoint': 'http://149.102.132.10:7900',
		'name': '! symplanet1',
		'version': '1.0.3.4',
		'height': 2001807,
		'finalizedHeight': 2001776,
		'balance': 22355876.766456,
		'roles': 5
	}
]

NODEWATCH_API_NODES = [
	{
		'mainPublicKey': '529BF60BB1011FCAE51C8D798E23224ACBA29D18B5054830F83E4E8E9A3BE526',
		'endpoint': 'http://symbol.harvest-monitor.com:3000',
		'name': '150C8CE',
		'version': '1.0.3.4',
		'height': 2001807,
		'finalizedHeight': 2001776,
		'balance': 100,
		'roles': 2
	},
	{
		'mainPublicKey': '3E8846B17079F7A1AB2FC99F7033A70188CEBAEC15704C5EFA107044F1B74FA7',
		'endpoint': '',
		'name': '3E8846B',
		'version': '1.0.3.5',
		'height': 2001807,
		'finalizedHeight': 2001776,
		'balance': 0,
		'roles': 2
	}
]


def setup_mock_nodewatch_server(event_loop, aiohttp_client, redirect_network_requests=False):
	class MockNodewatchServer:
		def __init__(self):
			self.urls = []
			self.endpoint = ''

		async def api_symbol_height(self, request):
			return await self._process(request, {
				'finalizedHeight': 2033136,
				'height': 2033194
			})

		async def peer_nodes(self, request):
			return await self._process(request, NODEWATCH_PEER_NODES if not redirect_network_requests else [
				{
					'mainPublicKey': '6CEB918020E9701C664F46FEDD73A969EE4927FEF1DF6B6CBAEAC817CA7CBF34',
					'endpoint': str(self.endpoint),
					'name': '3E8846B',
					'version': '1.0.3.7',
					'height': 2000200,
					'finalizedHeight': 2000000,
					'balance': 1000000,
					'roles': 7
				}
			])

		async def api_nodes(self, request):
			return await self._process(request, NODEWATCH_API_NODES if not redirect_network_requests else [])

		async def accounts_by_id(self, request):
			return await self._process(request, {
				'code': 'ResourceNotFound',
				'message': 'no resource exists with id \'NC5RFPFQGYFGNDOHRL7TXVKJWUBNMJCB4P3TA5X\''
			})

		async def node_time(self, request):
			return await self._process(request, {
				'communicationTimestamps': {
					'sendTimestamp': 123456789
				}
			})

		async def _process(self, request, response_body):
			self.urls.append(str(request.url))
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'})

	# create a mock server
	mock_server = MockNodewatchServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/api/symbol/height', mock_server.api_symbol_height)
	app.router.add_get('/api/symbol/nodes/peer', mock_server.peer_nodes)
	app.router.add_get('/api/symbol/nodes/api', mock_server.api_nodes)

	if redirect_network_requests:
		app.router.add_get(r'/accounts/{account_id}', mock_server.accounts_by_id)
		app.router.add_get('/node/time', mock_server.node_time)

	server = event_loop.run_until_complete(aiohttp_client(app))  # pylint: disable=redefined-outer-name

	mock_server.endpoint = server.make_url('')
	server.mock = mock_server
	return server
