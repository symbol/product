from decimal import Decimal

from symbollightapi.connector.BasicConnector import BasicConnector


class CoinGeckoConnector(BasicConnector):
	"""Async connector for interacting with CoinGecko."""

	async def price(self, ticker):
		"""Gets spot price for ticker."""

		result_json = await self.get(f'api/v3/simple/price?vs_currencies=usd&ids={ticker}')
		return Decimal(result_json[ticker]['usd'])

	async def conversion_rate(self, ticker1, ticker2):
		"""Gets spot conversion rate between two tickers."""

		price1 = await self.price(ticker1)
		price2 = await self.price(ticker2)
		return price1 / price2
