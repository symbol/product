from urllib.parse import urlparse

from .CoinGeckoConnector import CoinGeckoConnector
from .CoinMarketCapConnector import CoinMarketCapConnector


def load_price_oracle(config):
	"""Loads a price oracle."""

	hostname = urlparse(config.url).hostname
	if hostname.endswith('.coingecko.com') or '127.0.0.1' == hostname:  # use CoinGeckoConnector for tests too (127.0.0.1)
		return CoinGeckoConnector(config.url)

	if hostname.endswith('.coinmarketcap.com'):
		return CoinMarketCapConnector(config.url, config.access_token)

	raise ValueError(f'price oracle "{config.url}" is unsupported')
