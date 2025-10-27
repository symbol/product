import json

from aiohttp import web


async def create_simple_symbol_client(aiohttp_client, currency_mosaic_id, address_to_balance_map=None):  # pylint: disable=invalid-name
	"""Creates a symbol client with support for basic operations ."""

	class MockSymbolServer:
		def __init__(self):
			self.status_group = 'unconfirmed'

			self.request_json_payloads = []
			self.simulate_transaction_status_not_found = False  # pylint: disable=invalid-name

		@staticmethod
		async def network_properties(request):
			return await MockSymbolServer._process(request, {
				'chain': {'currencyMosaicId': currency_mosaic_id}
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

		@staticmethod
		async def node_time(request):
			return await MockSymbolServer._process(request, {
				'communicationTimestamps': {
					'sendTimestamp': '68414660756',
					'receiveTimestamp': '68414660780'
				}
			})

		@staticmethod
		async def accounts_by_id(request):
			balances = []
			if address_to_balance_map:
				account_id = request.match_info['account_id']
				for mosaic_id, amount in address_to_balance_map.get(account_id, []):
					balances.append((currency_mosaic_id[2:].replace('\'', '') if 'currency' == mosaic_id else mosaic_id, amount))

			return await MockSymbolServer._process(request, {
				'account': {
					'mosaics': [{'id': mosaic_id, 'amount': amount} for mosaic_id, amount in balances]
				}
			})

		async def transaction_status(self, request):
			if self.simulate_transaction_status_not_found:
				return await self._process(request, {'code': 'ResourceNotFound', 'message': 'no resource exists with id'}, 404)

			transaction_hash = request.match_info['transaction_hash']
			return await self._process(request, {'hash': transaction_hash, 'code': 'Success', 'group': self.status_group})

		async def announce_transaction(self, request):
			request_json = await request.json()
			self.request_json_payloads.append(request_json)
			return await self._process(request, {'message': 'packet 9 was pushed to the network via /transactions'})

		@staticmethod
		async def _process(_request, response_body, status_code=200):
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'}, status=status_code)

	# create a mock server
	mock_server = MockSymbolServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/network/properties', mock_server.network_properties)
	app.router.add_get('/chain/info', mock_server.chain_info)
	app.router.add_get('/node/time', mock_server.node_time)
	app.router.add_get(r'/accounts/{account_id}', mock_server.accounts_by_id)
	app.router.add_get(r'/transactionStatus/{transaction_hash}', mock_server.transaction_status)
	app.router.add_put('/transactions', mock_server.announce_transaction)
	server = await aiohttp_client(app)  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server
