from .ChainCollector import ChainCollector

DEFAULT_TIMEOUT_SECONDS = 3


def load_collectors(config, context, timeout_seconds=DEFAULT_TIMEOUT_SECONDS):
	"""Loads every metric collector that applies to a bridge configuration."""

	return [ChainCollector(config, context, timeout_seconds)]
