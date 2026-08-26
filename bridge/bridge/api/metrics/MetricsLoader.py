from .ChainCollector import ChainCollector
from .WrapRequestCollector import WrapRequestCollector

DEFAULT_TIMEOUT_SECONDS = 3


def load_collectors(context, timeout_seconds=DEFAULT_TIMEOUT_SECONDS):
	"""Loads every metric collector that applies to a bridge configuration."""

	return [ChainCollector(context, timeout_seconds), WrapRequestCollector(context)]
