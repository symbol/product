from prometheus_client import Gauge
from symbollightapi.model.Exceptions import NodeException


async def _try_read(awaitable):
	"""Awaits a vault read, returning None instead of raising, so an unreachable vault cannot fail the scrape."""

	try:
		return await awaitable
	except NodeException:
		return None


class VaultCollector:
	"""Collects the health of the vault named in configuration."""

	def __init__(self, context, timeout_seconds):
		"""Creates a vault collector."""

		self.context = context
		self.timeout_seconds = timeout_seconds

	async def collect(self, registry):
		"""Adds vault metrics to the registry."""

		up_gauge = Gauge(
			'bridge_vault_up',
			'vault configured for the bridge can serve the signing key; zero covers unreachable, sealed, standby and uninitialized',
			['endpoint'],
			registry=registry)
		token_ttl_gauge = Gauge(
			'bridge_vault_token_ttl_seconds',
			'seconds left before the access token the bridge signs with expires',
			['endpoint'],
			registry=registry)

		if not self.context.is_vault_used:
			return

		vault_connector = self.context.create_vault_connector()
		vault_connector.timeout_seconds = self.timeout_seconds
		endpoint = str(vault_connector.endpoint)

		is_up = await _try_read(vault_connector.read_health()) is not None
		up_gauge.labels(endpoint).set(1 if is_up else 0)

		if not is_up:
			return

		token_ttl = await _try_read(vault_connector.read_token_ttl())
		if token_ttl is not None:
			token_ttl_gauge.labels(endpoint).set(token_ttl)
