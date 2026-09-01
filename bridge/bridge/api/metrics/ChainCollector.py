import asyncio
from collections import namedtuple

from prometheus_client import Gauge
from symbollightapi.model.Exceptions import NodeException

NETWORK_ROLES = ('native', 'wrapped')

# what a single scrape learned about one network; balances is None exactly when the node could not be read
NetworkReading = namedtuple('NetworkReading', ['role', 'endpoint', 'address', 'balances', 'chain_height', 'finalized_height'])


async def _try_read(awaitable):
	"""Awaits a node read, returning None instead of raising, so one bad node cannot fail the scrape."""

	try:
		return await awaitable
	except NodeException:
		return None


async def _read_network(role, facade, timeout_seconds):
	"""Reads every balance and height for one network. Never raises."""

	connector = facade.create_connector()
	connector.timeout_seconds = timeout_seconds

	# fees are always paid in the chain's native currency; a mosaic id of None means the bridge moves
	# that currency itself, so the first balance already covers them and there is nothing more to read
	mosaic_ids = [facade.extract_mosaic_id()]
	if mosaic_ids[0].id:
		mosaic_ids.append(facade.extract_native_currency_mosaic_id())

	*balances, chain_height, finalized_height = await asyncio.gather(
		*[_try_read(facade.read_balance(connector, mosaic_id)) for mosaic_id in mosaic_ids],
		_try_read(connector.chain_height()),
		_try_read(connector.finalized_chain_height()))

	# a failed read of the configured token means the node could not be read, so nothing else is published for it
	if balances[0] is None:
		return NetworkReading(role, facade.config.endpoint, str(facade.bridge_address), None, None, None)

	return NetworkReading(
		role,
		facade.config.endpoint,
		str(facade.bridge_address),
		{mosaic_id.formatted: balance for (mosaic_id, balance) in zip(mosaic_ids, balances) if balance is not None},
		chain_height,
		finalized_height)


class ChainCollector:
	"""Collects heights and balances read from the nodes named in configuration."""

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

		chain_height_gauge = Gauge(
			'bridge_chain_height',
			'height of the newest block the node knows about',
			['network'],
			registry=registry)
		finalized_height_gauge = Gauge(
			'bridge_finalized_height',
			'height of the newest finalized block the node knows about',
			['network'],
			registry=registry)

		for reading in await self._read_all():
			# balances are published only when they were actually read, so that a failed read
			# can never be mistaken for a drained account
			up_gauge.labels(reading.role, reading.endpoint).set(0 if reading.balances is None else 1)

			for (token, balance) in (reading.balances or {}).items():
				balance_gauge.labels(reading.role, token, reading.address).set(balance)

			if reading.chain_height is not None:
				chain_height_gauge.labels(reading.role).set(reading.chain_height)

			if reading.finalized_height is not None:
				finalized_height_gauge.labels(reading.role).set(reading.finalized_height)

	async def _read_all(self):
		"""Reads both networks concurrently."""

		facades = (self.context.native_facade, self.context.wrapped_facade)
		return await asyncio.gather(*[
			_read_network(role, facade, self.timeout_seconds)
			for (role, facade) in zip(NETWORK_ROLES, facades)
		])
