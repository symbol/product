import asyncio
from collections import namedtuple

from prometheus_client import Gauge
from symbollightapi.model.Exceptions import NodeException

NETWORK_ROLES = ('native', 'wrapped')

# what a single scrape learned about one network; balances is None exactly when the node could not be read
NetworkReading = namedtuple('NetworkReading', ['role', 'endpoint', 'address', 'balances'])


async def _try_read(awaitable):
	"""Awaits a node read, returning None instead of raising, so one bad node cannot fail the scrape."""

	try:
		return await awaitable
	except NodeException:
		return None


async def _read_network(role, facade, timeout_seconds):
	"""Reads every balance for one network. Never raises."""

	connector = facade.create_connector()
	connector.timeout_seconds = timeout_seconds

	mosaic_id = facade.extract_mosaic_id()

	balance = await _try_read(facade.read_balance(connector, mosaic_id))
	if balance is None:
		return NetworkReading(role, facade.config.endpoint, str(facade.bridge_address), None)

	balances = {mosaic_id.formatted: balance}

	# fees are always paid in the chain's native currency; a mosaic id of None means the bridge moves
	# that currency itself, so the balance above already covers them and there is nothing more to read
	if mosaic_id.id:
		native_mosaic_id = facade.extract_native_currency_mosaic_id()
		native_balance = await _try_read(facade.read_balance(connector, native_mosaic_id))
		if native_balance is not None:
			balances[native_mosaic_id.formatted] = native_balance

	return NetworkReading(role, facade.config.endpoint, str(facade.bridge_address), balances)


class ChainCollector:
	"""Collects balances read from the nodes named in configuration."""

	def __init__(self, context, timeout_seconds):
		"""Creates a chain collector."""

		self.context = context
		self.timeout_seconds = timeout_seconds

	async def collect(self, registry):
		"""Adds chain metrics to the registry."""

		up_gauge = Gauge(
			'bridge_node_up',
			'node configured for the bridge is reachable',
			['network', 'endpoint'],
			registry=registry)
		balance_gauge = Gauge('bridge_balance', 'bridge account balance', ['network', 'token', 'address'], registry=registry)

		for reading in await self._read_all():
			# balances are published only when they were actually read, so that a failed read
			# can never be mistaken for a drained account
			up_gauge.labels(reading.role, reading.endpoint).set(0 if reading.balances is None else 1)

			for (token, balance) in (reading.balances or {}).items():
				balance_gauge.labels(reading.role, token, reading.address).set(balance)

	async def _read_all(self):
		"""Reads both networks concurrently."""

		facades = (self.context.native_facade, self.context.wrapped_facade)
		return await asyncio.gather(*[
			_read_network(role, facade, self.timeout_seconds)
			for (role, facade) in zip(NETWORK_ROLES, facades)
		])
