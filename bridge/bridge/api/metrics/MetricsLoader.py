from .ChainCollector import ChainCollector
from .PriceOracleCollector import PriceOracleCollector
from .VaultCollector import VaultCollector
from .WrapRequestCollector import WrapRequestCollector

DEFAULT_TIMEOUT_SECONDS = 3


def load_collectors(context, timeout_seconds=DEFAULT_TIMEOUT_SECONDS):
	"""Loads every metric collector that applies to a bridge configuration."""

	return [
		ChainCollector(context, timeout_seconds),
		PriceOracleCollector(context, timeout_seconds),
		VaultCollector(context, timeout_seconds),
		WrapRequestCollector(context)
	]
