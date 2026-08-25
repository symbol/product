from .ChainCollector import ChainCollector


def load_collectors(config, context, timeout_seconds):
	"""Loads every metric collector that applies to a bridge configuration."""

	return [ChainCollector(config, context, timeout_seconds)]
