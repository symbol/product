from prometheus_client import Gauge

from ...db.Databases import Databases


class WrapRequestCollector:
	"""Collects the state of bridge requests from the databases on the bridge host."""

	def __init__(self, context):
		"""Creates a wrap request collector."""

		self.context = context

	async def collect(self, registry):
		"""Adds request metrics to the registry."""

		failed_gauge = Gauge(
			'bridge_requests_failed_permanent',
			'requests that failed and were not retried; each one is potentially lost user funds',
			['direction'],
			registry=registry)

		with Databases(*self.context.database_params) as databases:
			for (direction, database) in (('wrap', databases.wrap_request), ('unwrap', databases.unwrap_request)):
				failed_gauge.labels(direction).set(database.count_permanent_failures())
