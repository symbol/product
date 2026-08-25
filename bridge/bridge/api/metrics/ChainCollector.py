import asyncio
from collections import namedtuple

from prometheus_client import Gauge

NETWORK_ROLES = ('native', 'wrapped')

# what a single scrape learned about one network; balance is None exactly when the node could not be read
NetworkReading = namedtuple('NetworkReading', ['role', 'token', 'balance', 'gas_balance'])


async def _try_read(awaitable):
	"""Awaits a node read, returning None instead of raising, so one bad node cannot fail the scrape."""

	try:
		return await awaitable
	except Exception:  # pylint: disable=broad-except
		return None


async def _read_network(role, facade, timeout_seconds):
	"""Reads every balance for one network. Never raises."""

	connector = facade.create_connector()
	connector.timeout_seconds = timeout_seconds

	token = facade.extract_mosaic_id().formatted

	balance = await _try_read(facade.read_bridge_balance(connector))
	if balance is None:
		return NetworkReading(role, token, None, None)

	# fees are always paid in the chain's native currency; a mosaic id of None means the bridge moves
	# that currency itself, so the balance above already covers them and there is nothing separate to report
	gas_balance = None
	if facade.extract_mosaic_id().id:
		gas_balance = await _try_read(facade.read_native_currency_balance(connector))

	return NetworkReading(role, token, balance, gas_balance)


class ChainCollector:
	"""Collects balances read from the nodes named in configuration."""

	def __init__(self, context, timeout_seconds):
		"""Creates a chain collector."""

		self.context = context
		self.timeout_seconds = timeout_seconds

	async def collect(self, registry):
		"""Adds chain metrics to the registry."""

		up_gauge = Gauge('bridge_node_up', 'node configured for the bridge is reachable', ['network'], registry=registry)
		balance_gauge = Gauge('bridge_balance', 'bridge account balance', ['network', 'token'], registry=registry)
		gas_gauge = Gauge('bridge_gas_balance', 'native currency balance available for fees', ['network'], registry=registry)

		for reading in await self._read_all():
			up_gauge.labels(reading.role).set(0 if reading.balance is None else 1)

			# a balance is published only when it was actually read, so that a failed read
			# can never be mistaken for a drained account
			if reading.balance is not None:
				balance_gauge.labels(reading.role, reading.token).set(reading.balance)

			if reading.gas_balance is not None:
				gas_gauge.labels(reading.role).set(reading.gas_balance)

	async def _read_all(self):
		"""Reads both networks concurrently."""

		try:
			await self.context.load()
		except Exception:  # pylint: disable=broad-except
			return [NetworkReading(role, None, None, None) for role in NETWORK_ROLES]

		facades = (self.context.native_facade, self.context.wrapped_facade)
		return await asyncio.gather(*[
			_read_network(role, facade, self.timeout_seconds)
			for (role, facade) in zip(NETWORK_ROLES, facades)
		])
