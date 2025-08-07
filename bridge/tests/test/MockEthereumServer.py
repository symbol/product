import json

from aiohttp import web

from .BridgeTestUtils import HASHES


async def create_simple_ethereum_client(aiohttp_client):
	"""Creates an Ethereum client with support for basic operations ."""

	class MockEthereumServer:
		def __init__(self):
			self.urls = []
			self.request_json_payloads = []

			self.simulate_announce_error = False

		async def rpc_main(self, request):  # pylint: disable = too-many-return-statements
			request_json = await request.json()
			self.request_json_payloads.append(request_json)

			method = request_json['method']
			if 'eth_blockNumber' == method:
				return await self._handle_eth_block_number(request)

			if 'eth_getBlockByNumber' == method:
				return await self._handle_eth_get_block_by_number(request, request_json['params'][0])

			if 'eth_getTransactionByHash' == method:
				return await self._handle_eth_get_transaction_by_hash(request, request_json['params'][0])

			if 'eth_getTransactionCount' == method:
				return await self._handle_eth_get_transaction_count(request)

			if 'eth_sendRawTransaction' == method:
				return await self._handle_eth_send_raw_transaction(request)

			if 'eth_call' == method:
				return await self._handle_eth_call(request, request_json['params'][0]['data'])

			if 'ots_searchTransactionsBefore' == method:
				return await self.handle_ots_search_transaction_before(request)

			raise ValueError(f'unknown ETH RPC method: {method}')

		async def _handle_eth_block_number(self, request):
			return await self._process(request, {
				'result': '0xAB123'
			})

		async def _handle_eth_get_block_by_number(self, request, block_identifier):
			result_json = {}
			if 'finalized' == block_identifier:
				result_json = {'number': '0x112233', 'timestamp': '0x66A8E3D3'}
			elif 'latest' == block_identifier:
				result_json = {'number': '0x112244', 'timestamp': '0x66AA3553'}
			elif '0x12345' == block_identifier:
				result_json = {'number': '0x12345', 'timestamp': '0xBA4563'}

			return await self._process(request, {'result': result_json})

		async def _handle_eth_get_transaction_by_hash(self, request, transaction_hash):
			hash_to_height_map = {
				HASHES[0]: '0xAF',  # confirmed
				HASHES[2]: '0xA8',

				HASHES[1]: None,  # unconfirmed
			}

			if transaction_hash[2:] in hash_to_height_map:
				return await self._process(request, {'result': {'blockNumber': hash_to_height_map[transaction_hash[2:]]}})

			return await self._process(request, {'result': None})  # unknown

		async def _handle_eth_get_transaction_count(self, request):
			return await self._process(request, {
				'result': '0xB'
			})

		async def _handle_eth_send_raw_transaction(self, request):
			if self.simulate_announce_error:
				return await self._process(request, {
					'error': {'code': -32000, 'message': 'INTERNAL_ERROR: IntrinsicGas'}
				})

			return await self._process(request, {
				'result': '0xe1f3095770633ab2b18081658bad475439f6a08c902d0915903bafff06e6febf'
			})

		async def _handle_eth_call(self, request, data):
			# balanceOf(address) [d8dA6BF26964aF9D7eEd9e03E53415D37aA96045]
			if '0x70a08231000000000000000000000000d8dA6BF26964aF9D7eEd9e03E53415D37aA96045' == data:
				return await self._process(request, {'result': '0x123456'})

			# decimals()
			if '0x313ce567' == data:
				return await self._process(request, {'result': '0x3'})

			raise ValueError(f'unknown eth_call data: {data}')

		async def handle_ots_search_transaction_before(self, request):
			return await self._process(request, {
				'result': {
					'txs': [
						{'blockNumber': '0x1d', 'nonce': '0x2'},
						{'blockNumber': '0x1a', 'nonce': '0x3'},
						{'blockNumber': '0x7', 'nonce': '0x1'}
					]
				}
			})

		async def _process(self, request, response_body, status_code=200):
			self.urls.append(str(request.url))
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'}, status=status_code)

	# create a mock server
	mock_server = MockEthereumServer()

	# create an app using the server
	app = web.Application()
	app.router.add_post('', mock_server.rpc_main)
	server = await aiohttp_client(app)  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server
