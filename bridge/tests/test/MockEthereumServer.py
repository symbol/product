import json

from aiohttp import web

from .BridgeTestUtils import HASHES


async def create_simple_ethereum_client(aiohttp_client):
	# pylint: disable=too-many-statements

	"""Creates an Ethereum client with support for basic operations ."""

	class MockEthereumServer:
		def __init__(self):
			self.urls = []
			self.request_json_payloads = []

			self.simulate_announce_error = False
			self.simulate_estimate_gas_error = False
			self.simulate_sync = False
			self.failed_transaction_execution_hash = None
			self.gas_price_override = None

		async def rpc_main(self, request):  # pylint: disable = too-many-return-statements
			request_json = await request.json()
			self.request_json_payloads.append(request_json)

			method = request_json['method']
			if 'eth_blockNumber' == method:
				return await self._handle_eth_block_number(request)

			if 'eth_estimateGas' == method:
				return await self._handle_eth_estimate_gas(request, request_json['params'][0])

			if 'eth_feeHistory' == method:
				return await self._handle_eth_fee_history(request)

			if 'eth_gasPrice' == method:
				return await self._handle_eth_gas_price(request)

			if 'eth_getBlockByNumber' == method:
				return await self._handle_eth_get_block_by_number(request, request_json['params'][0])

			if 'eth_getTransactionByHash' == method:
				return await self._handle_eth_get_transaction_by_hash(request, request_json['params'][0])

			if 'eth_getTransactionCount' == method:
				return await self._handle_eth_get_transaction_count(request, request_json['params'][1])

			if 'eth_getTransactionReceipt' == method:
				return await self._handle_eth_get_transaction_receipt(request, request_json['params'][0])

			if 'eth_sendRawTransaction' == method:
				return await self._handle_eth_send_raw_transaction(request)

			if 'eth_syncing' == method:
				return await self._handle_eth_syncing(request)

			if 'eth_call' == method:
				return await self._handle_eth_call(request, request_json['params'][0]['data'])

			if 'ots_searchTransactionsBefore' == method:
				return await self.handle_ots_search_transaction_before(request)

			raise ValueError(f'unknown ETH RPC method: {method}')

		async def _handle_eth_block_number(self, request):
			return await self._process(request, {
				'result': '0xAB123'
			})

		async def _handle_eth_estimate_gas(self, request, transaction_object):
			if self.simulate_estimate_gas_error:
				return await self._process(request, {
					'error': {'code': 3, 'message': 'execution reverted: ERC20: transfer amount exceeds balance'}
				})

			return await self._process(request, {
				'result': '0x5208' if 'data' in transaction_object else '0x4201'
			})

		async def _handle_eth_fee_history(self, request):
			return await self._process(request, {
				'result': {
					'reward': [
						['0x1ef87780'],
						['0x3b9aca00'],
						['0x239dbca0'],
						['0x29dbf809'],
						['0x2e21aecc'],
						['0x5f5e100'],
						['0x15c2e491'],
						['0x25254701'],
						['0xbebc200'],
						['0x2c9ffe7f']
					],
					'baseFeePerGas': [
						'0x9f37f0b8',
						'0xa0cb1a45',
						'0xa13892b9',
						'0x9af4a66e',
						'0x9ca43336',
						'0x9e0223ab',
						'0x8f85c1d3',
						'0x9dbe2da3',
						'0x96f72b02',
						'0x97b52923',
						'0x943704df'
					]
				}
			})

		async def _handle_eth_gas_price(self, request):
			return await self._process(request, {
				'result': hex(self.gas_price_override) if self.gas_price_override else '0x1DFD14000'
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

		async def _handle_eth_get_transaction_count(self, request, block_identifier):
			block_identifier_to_count_map = {
				'0xAABBCC': '0x9',
				'latest': '0xB',
				'pending': '0xE'
			}

			return await self._process(request, {
				'result': block_identifier_to_count_map[block_identifier]
			})

		async def _handle_eth_get_transaction_receipt(self, request, transaction_hash):
			status = '0x0' if self.failed_transaction_execution_hash == transaction_hash else '0x1'
			return await self._process(request, {
				'result': {'status': status}
			})

		async def _handle_eth_send_raw_transaction(self, request):
			if self.simulate_announce_error:
				error_message = 'INTERNAL_ERROR: IntrinsicGas'
				if isinstance(self.simulate_announce_error, str):
					error_message = self.simulate_announce_error

				return await self._process(request, {
					'error': {'code': -32000, 'message': error_message}
				})

			return await self._process(request, {
				'result': '0xe1f3095770633ab2b18081658bad475439f6a08c902d0915903bafff06e6febf'
			})

		async def _handle_eth_syncing(self, request):
			if self.simulate_sync:
				return await self._process(request, {
					'result': {
						'startingBlock': '0x0',
						'currentBlock': '0x1518'
					}
				})

			return await self._process(request, {
				'result': False
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
			hashes = [
				'0x12dfb8047ec57ba5a34a4ce8b8206e5020da409e06cdcf4ad02cc1034aa178ed',
				'0x7a184ca95fadc36f35bde72b4f042b281664c9db16e83a8d9ac10ee5b0491f77',
				'0x6f246476cff6570f9153cd4a463d4a25e6bf9ef1a1fc7b740523362fb391a45c'
			]
			return await self._process(request, {
				'result': {
					'txs': [
						{'blockNumber': '0x1d', 'nonce': '0x2', 'hash': hashes[0]},
						{'blockNumber': '0x1a', 'nonce': '0x3', 'hash': hashes[1]},
						{'blockNumber': '0x7', 'nonce': '0x1', 'hash': hashes[2]}
					],
					'receipts': [
						{'transactionHash': hashes[1], 'status': '0x1'},
						{'transactionHash': hashes[2], 'status': '0x0'}
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
