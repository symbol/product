import json

from aiohttp import web


class PytestAsserter:
	"""Adapter for mapping unittest-style asserts to pytest asserts."""

	@staticmethod
	def assertEqual(expected, actual):  # pylint: disable=invalid-name
		assert expected == actual


async def create_symbol_client_with_network_properties(aiohttp_client, currency_mosaic_id):  # pylint: disable=invalid-name
	"""Creates a symbol client with a single /network/properties endpoint."""

	class MockSymbolServer:
		@staticmethod
		async def network_properties(request):
			return await MockSymbolServer._process(request, {
				'chain': {'currencyMosaicId': currency_mosaic_id}
			})

		@staticmethod
		async def _process(_request, response_body, status_code=200):
			return web.Response(body=json.dumps(response_body), headers={'Content-Type': 'application/json'}, status=status_code)

	# create a mock server
	mock_server = MockSymbolServer()

	# create an app using the server
	app = web.Application()
	app.router.add_get('/network/properties', mock_server.network_properties)
	server = await aiohttp_client(app)  # pylint: disable=redefined-outer-name

	server.mock = mock_server
	return server
