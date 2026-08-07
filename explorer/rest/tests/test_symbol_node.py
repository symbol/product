import pytest
from common.symbol.NativeMosaic import NativeMosaicInfo
from common.symbol.NodeConfiguration import SymbolNodeConfiguration

from rest.symbol_node import fetch_native_mosaic_info

NODE_URL = 'http://localhost:3000'


def _create_network_properties():
	return {'chain': {'currencyMosaicId': "0x72C0'212E'67A0'8BCE"}}


def _create_mosaic_definition(divisibility=3):
	return {'mosaic': {'divisibility': divisibility}}


class RecordingConnector:
	def __init__(self, endpoint, responses):
		self.endpoint = endpoint
		self.responses = responses
		self.timeout_seconds = None
		self.paths = []

	async def get(self, path):
		self.paths.append(path)
		return self.responses[path]


def _create_node_config():
	return SymbolNodeConfiguration.from_url(NODE_URL, allow_loopback=True)


def test_fetches_native_mosaic_in_order():
	# Arrange:
	responses = {
		'network/properties': _create_network_properties(),
		'mosaics/72C0212E67A08BCE': _create_mosaic_definition()
	}
	connector = None

	def connector_factory(endpoint):
		nonlocal connector
		connector = RecordingConnector(endpoint, responses)
		return connector

	# Act:
	result = fetch_native_mosaic_info(_create_node_config(), connector_factory)

	# Assert:
	assert NativeMosaicInfo('72C0212E67A08BCE', 3) == result
	assert NODE_URL == connector.endpoint
	assert ['network/properties', 'mosaics/72C0212E67A08BCE'] == connector.paths
	assert 2 == len(connector.paths)
	assert 10 == connector.timeout_seconds


def test_rejects_bad_mosaic_response():
	# Arrange:
	responses = {
		'network/properties': _create_network_properties(),
		'mosaics/72C0212E67A08BCE': {'mosaic': {}}
	}
	connector = None

	def connector_factory(endpoint):
		nonlocal connector
		connector = RecordingConnector(endpoint, responses)
		return connector

	# Act + Assert:
	with pytest.raises(ValueError, match='Mosaic response must include mosaic.divisibility'):
		fetch_native_mosaic_info(_create_node_config(), connector_factory)

	# Assert:
	assert NODE_URL == connector.endpoint
	assert ['network/properties', 'mosaics/72C0212E67A08BCE'] == connector.paths
	assert 2 == len(connector.paths)
