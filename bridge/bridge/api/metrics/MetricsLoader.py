from .ChainCollector import ChainCollector


def load_collectors(context, timeout_seconds):
	"""Loads every metric collector that applies to a bridge configuration."""

	return [ChainCollector(context, timeout_seconds)]
