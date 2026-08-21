import asyncio

from common.symbol.NativeMosaic import create_native_mosaic_info, extract_native_mosaic_id
from symbollightapi.connector.SymbolConnector import SymbolConnector


async def _fetch_native_mosaic_info(connector):
	network_properties = await connector.get('network/properties')
	native_mosaic_id = extract_native_mosaic_id(network_properties)
	mosaic_definition = await connector.get(f'mosaics/{native_mosaic_id}')
	return create_native_mosaic_info(network_properties, mosaic_definition)


def fetch_native_mosaic_info(node_config, connector_factory=SymbolConnector):
	"""Fetches and validates native mosaic information during REST setup."""

	endpoint = node_config.assert_request_allowed(node_config.base_url)
	connector = connector_factory(endpoint)
	connector.timeout_seconds = node_config.timeout_seconds
	return asyncio.run(_fetch_native_mosaic_info(connector))
