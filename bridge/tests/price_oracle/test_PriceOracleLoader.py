import unittest

from bridge.models.BridgeConfiguration import PriceOracleConfiguration
from bridge.price_oracle.CoinGeckoConnector import CoinGeckoConnector
from bridge.price_oracle.CoinMarketCapConnector import CoinMarketCapConnector
from bridge.price_oracle.PriceOracleLoader import load_price_oracle


class PriceOracleLoaderTests(unittest.TestCase):
	def test_can_load_coin_gecko_price_oracle(self):
		# Act:
		price_oracle = load_price_oracle(PriceOracleConfiguration('https://foo.coingecko.com:1234', '4643DDBAF'))

		# Assert:
		self.assertIsInstance(price_oracle, CoinGeckoConnector)
		self.assertEqual('https://foo.coingecko.com:1234', price_oracle.endpoint)

	def test_can_load_mock_coin_gecko_price_oracle(self):
		# Act:
		price_oracle = load_price_oracle(PriceOracleConfiguration('http://127.0.0.1:62553', '4643DDBAF'))

		# Assert:
		self.assertIsInstance(price_oracle, CoinGeckoConnector)
		self.assertEqual('http://127.0.0.1:62553', price_oracle.endpoint)

	def test_can_load_coin_market_cap_price_oracle(self):
		# Act:
		price_oracle = load_price_oracle(PriceOracleConfiguration('https://foo.coinmarketcap.com:1234', '4643DDBAF'))

		# Assert:
		self.assertIsInstance(price_oracle, CoinMarketCapConnector)
		self.assertEqual('https://foo.coinmarketcap.com:1234', price_oracle.endpoint)
		self.assertEqual('4643DDBAF', price_oracle.access_token)

	def test_cannot_load_unknown_price_oracle(self):
		# Act+ Assert:
		with self.assertRaisesRegex(ValueError, 'price oracle "https://foo.coinbase.com:1234" is unsupported'):
			load_price_oracle(PriceOracleConfiguration('https://foo.coinbase.com:1234', '4643DDBAF'))
