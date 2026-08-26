import tempfile
from pathlib import Path

import pytest
from prometheus_client import CollectorRegistry

from bridge.api.metrics.WrapRequestCollector import WrapRequestCollector
from bridge.db.Databases import Databases

from ...test.BridgeTestUtils import SYMBOL_ADDRESSES
from ...test.DatabaseTestUtils import make_request, seed_database_with_simple_requests
from ...test.MockNetworkFacade import MockNemNetworkFacade, MockSymbolNetworkFacade

# pylint: disable=invalid-name


class _Context:
	"""Stands in for BridgeContext, which only supplies the database parameters here."""

	def __init__(self, database_directory):  # pylint: disable=redefined-outer-name
		self.database_params = [database_directory, MockNemNetworkFacade(), MockSymbolNetworkFacade(), True]


@pytest.fixture
def database_directory():
	with tempfile.TemporaryDirectory() as temp_directory:
		directory = Path(temp_directory) / 'db'
		directory.mkdir()

		with Databases(directory, MockNemNetworkFacade(), MockSymbolNetworkFacade()) as databases:
			databases.create_tables()

		yield directory


def _seed_permanent_failures(directory):
	# the seed marks two of its five requests as permanently failed
	with Databases(directory, MockNemNetworkFacade(), MockSymbolNetworkFacade()) as databases:
		seed_database_with_simple_requests(databases.wrap_request)


def _seed_transient_failure(directory):
	with Databases(directory, MockNemNetworkFacade(), MockSymbolNetworkFacade()) as databases:
		request = make_request(0, height=777, amount=4321, destination_address=SYMBOL_ADDRESSES[0])
		databases.wrap_request.add_request(request)
		databases.wrap_request.mark_payout_failed_transient(request, 'node unavailable')


async def _collect(directory):
	registry = CollectorRegistry()
	await WrapRequestCollector(_Context(directory)).collect(registry)
	return registry


def _failed_permanent(registry, direction):
	return registry.get_sample_value('bridge_requests_failed_permanent', {'direction': direction})


async def test_permanent_failures_are_counted(database_directory):  # pylint: disable=redefined-outer-name
	# Arrange:
	_seed_permanent_failures(database_directory)

	# Act:
	registry = await _collect(database_directory)

	# Assert:
	assert 2 == _failed_permanent(registry, 'wrap')


async def test_transient_failures_are_not_counted(database_directory):  # pylint: disable=redefined-outer-name
	# Arrange: a transient failure carries the same failed status and is told apart only by is_retried
	_seed_transient_failure(database_directory)

	# Act:
	registry = await _collect(database_directory)

	# Assert:
	assert 0 == _failed_permanent(registry, 'wrap')


async def test_both_directions_are_reported(database_directory):  # pylint: disable=redefined-outer-name
	# Arrange: nothing was seeded into the unwrap database
	_seed_permanent_failures(database_directory)

	# Act:
	registry = await _collect(database_directory)

	# Assert: a direction with no failures reports zero rather than being omitted
	assert 2 == _failed_permanent(registry, 'wrap')
	assert 0 == _failed_permanent(registry, 'unwrap')
