from decimal import Decimal

from symbollightapi.connector.BasicConnector import BasicConnector


class CoinMarketCapConnector(BasicConnector):
	"""Async connector for interacting with CoinMarketCap."""

	def __init__(self, endpoint, access_token):
		"""Creates a CoinMarketCap connector."""

		super().__init__(endpoint)

		self.access_token = access_token

	async def price(self, ticker):
		"""Gets spot price for ticker."""

		# since there is limited number of supported blockchains, map friendly names to coinmarketcap ids here directly per best practices
		# (https://coinmarketcap.com/api/documentation/v1/#section/Best-Practices)
		ticker_to_id_map = {
			'ethereum': '1027',
			'nem': '873',
			'symbol': '8677'
		}

		token_id = ticker_to_id_map.get(ticker, None)
		if not token_id:
			raise ValueError(f'price lookup for ticker "{ticker}" is not supported')

		result_json = await self._dispatch(
			'get',
			f'v2/cryptocurrency/quotes/latest?convert=USD&id={token_id}',
			None,
			True,
			headers={'X-CMC_PRO_API_KEY': self.access_token})

		return Decimal(result_json['data'][token_id]['quote']['USD']['price'])

	async def conversion_rate(self, ticker1, ticker2):
		"""Gets spot conversion rate between two tickers."""

		price1 = await self.price(ticker1)
		price2 = await self.price(ticker2)
		return price1 / price2
