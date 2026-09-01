import datetime
from collections import namedtuple

from prometheus_client import Gauge
from symbollightapi.model.Exceptions import NodeException

DEFAULT_REFRESH_RATE_SECONDS = 300

# what a single probe learned about the oracle; credits_left is None when the provider reports no quota
OracleReading = namedtuple('OracleReading', ['is_up', 'credits_left'])


class PriceOracleCollector:
	"""Collects the availability and remaining quota of the price oracle named in configuration."""

	def __init__(self, context, timeout_seconds, refresh_rate_seconds=DEFAULT_REFRESH_RATE_SECONDS):
		"""Creates a price oracle collector."""

		self.context = context
		self.timeout_seconds = timeout_seconds
		self.refresh_rate_seconds = refresh_rate_seconds

		self._reading = None
		self._last_probe_time = None

	async def collect(self, registry):
		"""Adds price oracle metrics to the registry."""

		up_gauge = Gauge(
			'bridge_price_oracle_up',
			'price oracle configured for the bridge is reachable',
			['endpoint'],
			registry=registry)
		credits_left_gauge = Gauge(
			'bridge_price_oracle_credits_left',
			'requests left in the quota reported by the price oracle',
			['endpoint'],
			registry=registry)

		price_oracle = self.context.create_price_oracle()
		price_oracle.timeout_seconds = self.timeout_seconds

		endpoint = str(price_oracle.endpoint)
		reading = await self._probe(price_oracle)

		up_gauge.labels(endpoint).set(1 if reading.is_up else 0)

		# a provider that reports no quota, and an unreachable one, both leave the quota unknown;
		# publishing a zero would read as an exhausted plan
		if reading.credits_left is not None:
			credits_left_gauge.labels(endpoint).set(reading.credits_left)

	async def _probe(self, price_oracle):
		"""Probes the oracle at most once per refresh period, so that the scrape rate cannot drive provider traffic."""

		now = datetime.datetime.now()
		if self._reading and (now - self._last_probe_time).total_seconds() < self.refresh_rate_seconds:
			return self._reading

		try:
			self._reading = OracleReading(True, await price_oracle.check_health())
		except NodeException:
			self._reading = OracleReading(False, None)

		self._last_probe_time = now
		return self._reading
