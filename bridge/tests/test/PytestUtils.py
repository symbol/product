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
	"""Creates a symbol client with support for looking up a network currency and account balances ."""

	class MockSymbolServer:
		@staticmethod
		async def network_properties(request):
			return await MockSymbolServer._process(request, {
				'chain': {'currencyMosaicId': currency_mosaic_id}
			})

		@staticmethod
		async def accounts_by_id(request):
			balance = 0
			if address_to_balance_map:
				account_id = request.match_info['account_id']
				balance = address_to_balance_map.get(account_id, 0)

			return await MockSymbolServer._process(request, {
				'account': {
					'mosaics': [
						{'id': currency_mosaic_id[2:].replace('\'', ''), 'amount': str(balance)},
					]
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
	"""Creates a nem client with support for looking up account balances ."""

	class MockNemServer:
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
		async def _process(_request, response_body, status_code=200):
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'}, status=status_code)

	# create a mock server
	mock_server = MockNemServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/account/get', mock_server.account_info)
	server = await aiohttp_client(app)  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server

# endregion
