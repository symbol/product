from decimal import Decimal

from symbollightapi.connector.BasicConnector import BasicConnector


class CoinMarketCapConnector(BasicConnector):
	"""Async connector for interacting with CoinMarketCap API."""

	def __init__(self, endpoint, api_key):
		"""Creates an CoinMarketCap async connector."""
		super().__init__(endpoint)
		self.api_key = api_key

	async def price(self, ticker):
		"""Gets spot USD price for ticker."""

		result_json = await self.get(f'v2/cryptocurrency/quotes/latest?convert=USD&symbol={ticker}', headers={
			"X-CMC_PRO_API_KEY": self.api_key}
		)
		try:
			price = result_json['data'][ticker][0]['quote']['USD']['price']
			return Decimal(price)
		except (KeyError, IndexError, TypeError) as ex:
			raise ValueError(f'Price not available for ticker {ticker}') from ex

	async def conversion_rate(self, ticker1, ticker2):
		"""Gets spot conversion rate between two tickers."""

		price1 = await self.price(ticker1)
		price2 = await self.price(ticker2)
		return price1 / price2
