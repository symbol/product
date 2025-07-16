import json

from aiohttp import web

# region PytestAsserter


class PytestAsserter:
	"""Adapter for mapping unittest-style asserts to pytest asserts."""

	@staticmethod
	def assertEqual(expected, actual):  # pylint: disable=invalid-name
		assert expected == actual

# endregion


# region create_simple_symbol_client

async def create_simple_symbol_client(aiohttp_client, currency_mosaic_id, address_to_balance_map=None):  # pylint: disable=invalid-name
	"""Creates a symbol client with support for basic operations ."""

	class MockSymbolServer:
		@staticmethod
		async def network_properties(request):
			return await MockSymbolServer._process(request, {
				'chain': {'currencyMosaicId': currency_mosaic_id}
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

		@staticmethod
		async def _process(_request, response_body, status_code=200):
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'}, status=status_code)

	# create a mock server
	mock_server = MockSymbolServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/network/properties', mock_server.network_properties)
	app.router.add_get(r'/accounts/{account_id}', mock_server.accounts_by_id)
	server = await aiohttp_client(app)  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server

# endregion


# region create_simple_nem_client

async def create_simple_nem_client(aiohttp_client, address_to_balance_map=None):  # pylint: disable=invalid-name
	"""Creates a nem client with support for basic operations ."""

	class MockNemServer:
		def __init__(self):
			self.request_json_payloads = []

		@staticmethod
		async def network_time(request):
			return await MockNemServer._process(request, {'sendTimeStamp': 322666792999, 'receiveTimeStamp': 322666799999})

		@staticmethod
		async def account_info(request):
			balance = 0
			if address_to_balance_map:
				address = request.url.query['address']
				balance = address_to_balance_map.get(address, 0)

			return await MockNemServer._process(request, {
				'meta': {},
				'account': {
					'balance': balance
				}
			})

		@staticmethod
		async def account_mosaic_owned(request):
			balance = 0
			if address_to_balance_map:
				address = request.url.query['address']
				balance = address_to_balance_map.get(address, 0)

			return await MockNemServer._process(request, {
				'data': [
					{'quantity': 1 * balance, 'mosaicId': {'namespaceId': 'nem', 'name': 'xem'}},
					{'quantity': 2 * balance, 'mosaicId': {'namespaceId': 'foo', 'name': 'bar'}},
					{'quantity': 3 * balance, 'mosaicId': {'namespaceId': 'foo', 'name': 'baz'}}
				]
			})

		async def mosaic_supply(self, request):
			mosaic_id = request.rel_url.query['mosaicId']
			return await self._process(request, {
				'supply': 8999999999 if 'nem:xem' == mosaic_id else 123000000
			})

		async def mosaic_definition(self, request):
			mosaic_id = request.rel_url.query['mosaicId']
			return await self._process(request, {
				'properties': [
					{
						'name': 'divisibility',
						'value': '6' if 'nem:xem' == mosaic_id else '3'
					}
				]
			})

		async def announce_transaction(self, request):
			request_json = await request.json()
			self.request_json_payloads.append(request_json)
			return await self._process(request, {'code': 1, 'type': 1, 'message': 'SUCCESS'})

		@staticmethod
		async def _process(_request, response_body, status_code=200):
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'}, status=status_code)

	# create a mock server
	mock_server = MockNemServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/time-sync/network-time', mock_server.network_time)
	app.router.add_get('/account/get', mock_server.account_info)
	app.router.add_get('/account/mosaic/owned', mock_server.account_mosaic_owned)
	app.router.add_get('/mosaic/supply', mock_server.mosaic_supply)
	app.router.add_get('/mosaic/definition', mock_server.mosaic_definition)
	app.router.add_post('/transaction/announce', mock_server.announce_transaction)
	server = await aiohttp_client(app)  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server

# endregion
