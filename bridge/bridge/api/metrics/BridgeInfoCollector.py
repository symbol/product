from prometheus_client import Gauge


class BridgeInfoCollector:
	"""Collects the static description of the bridge that alert rules and dashboards need to tell instances apart."""

	def __init__(self, context):
		"""Creates a bridge info collector."""

		self.context = context

	async def collect(self, registry):
		"""Adds bridge information to the registry."""

		info_gauge = Gauge(
			'bridge_info',
			'configuration the bridge runs with; the value is always one and the labels carry the description',
			['mode', 'native_blockchain', 'wrapped_blockchain'],
			registry=registry)

		info_gauge.labels(
			self.context.strategy_mode.name.lower(),
			self.context.native_facade.config.blockchain,
			self.context.wrapped_facade.config.blockchain).set(1)
