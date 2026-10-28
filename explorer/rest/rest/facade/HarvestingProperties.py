import asyncio
import ipaddress
import re
import socket
from collections import namedtuple

from aiohttp import ClientError, ClientSession, ClientTimeout, TCPConnector
from aiohttp.abc import AbstractResolver
from aiohttp.resolver import AsyncResolver
from zenlog import log

HarvestingProperties = namedtuple('HarvestingProperties', ['minimum_balance', 'maximum_balance'])
_AMOUNT_PATTERN = re.compile(r"(?:[0-9]+|[0-9]{1,3}(?:'[0-9]{3})+)", re.ASCII)


class HarvestingPropertiesUnavailable(Exception):
	"""Raised when the configured node cannot supply valid harvesting properties."""


class ValidatedNodeResolver(AbstractResolver):
	"""Validates the actual DNS answers that the HTTP connector will use."""

	def __init__(self, node_config, resolver):
		self.node_config = node_config
		self.resolver = resolver

	async def resolve(self, host, port=0, family=socket.AF_INET):
		addresses = await self.resolver.resolve(host, port, family)
		for address in addresses:
			resolved_ip = ipaddress.ip_address(address['host'])
			ip_address = str(getattr(resolved_ip, 'ipv4_mapped', None) or resolved_ip)
			self.node_config.assert_resolved_address_allowed(ip_address)
		return addresses

	async def close(self):
		"""Closes the owned underlying DNS resolver."""

		await self.resolver.close()


def _parse_amount(value):
	if not isinstance(value, str) or not _AMOUNT_PATTERN.fullmatch(value):
		raise ValueError('Invalid harvesting balance')
	amount = int(value.replace("'", ''))
	if amount > 2 ** 64 - 1:
		raise ValueError('Harvesting balance out of range')
	return amount


async def _fetch_properties(node_config, resolver_factory):
	base_url = node_config.assert_request_target_allowed(node_config.base_url)
	try:
		address = ipaddress.ip_address(node_config.host)
	except ValueError:
		address = None
	if address is not None:
		node_config.assert_resolved_address_allowed(str(getattr(address, 'ipv4_mapped', None) or address))

	resolver = ValidatedNodeResolver(node_config, resolver_factory())
	try:
		async with TCPConnector(resolver=resolver) as connector:
			async with ClientSession(
				connector=connector, connector_owner=False, timeout=ClientTimeout(total=node_config.timeout_seconds, ceil_threshold=float('inf'))
			) as session:
				async with session.get(f'{base_url}/network/properties', allow_redirects=False) as response:
					if response.status != 200:
						raise HarvestingPropertiesUnavailable('Symbol node returned an unexpected status')
					properties = await response.json(content_type=None)
	except BaseException:  # pylint: disable=broad-exception-caught  # Cleanup must also run on cancellation.
		try:
			await resolver.close()
		except Exception as error:  # pylint: disable=broad-exception-caught  # Preserve the original error.
			log.error(f'Failed to close Symbol node DNS resolver: {error}')
		raise

	await resolver.close()
	return properties


def load_harvesting_properties(node_config, resolver_factory=AsyncResolver):
	"""Fetches and validates harvesting properties from the configured Symbol node."""

	try:
		properties = asyncio.run(_fetch_properties(node_config, resolver_factory))
		chain = properties['chain']
		minimum = _parse_amount(chain['minHarvesterBalance'])
		maximum = _parse_amount(chain['maxHarvesterBalance'])
		if minimum > maximum:
			raise ValueError('Harvesting balance bounds are reversed')
		return HarvestingProperties(minimum, maximum)
	except (ClientError, OSError, TimeoutError, ValueError, TypeError, KeyError) as error:
		raise HarvestingPropertiesUnavailable('Symbol harvesting properties are unavailable') from error
