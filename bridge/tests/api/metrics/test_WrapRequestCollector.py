import tempfile
from collections import namedtuple
from pathlib import Path

import pytest
from prometheus_client import CollectorRegistry

from bridge.api.metrics.WrapRequestCollector import WrapRequestCollector
from bridge.db.Databases import Databases

from ...test.BridgeTestUtils import SYMBOL_ADDRESSES, assert_timestamp_within_last_second
from ...test.DatabaseTestUtils import make_request, make_request_error, seed_database_with_simple_requests
from ...test.MockNetworkFacade import MockNemNetworkFacade, MockSymbolNetworkFacade

# pylint: disable=invalid-name


_NetworkConfiguration = namedtuple('_NetworkConfiguration', ['extensions'])


class _Facade:
	"""Stands in for a network facade, which only supplies the payout limit configuration here."""

	def __init__(self, max_daily_transfer_amount=None):
		extensions = {} if max_daily_transfer_amount is None else {'max_daily_transfer_amount': str(max_daily_transfer_amount)}
		self.config = _NetworkConfiguration(extensions)


class _Context:
	"""Stands in for BridgeContext, which only supplies the database parameters and the payout facades here."""

	def __init__(self, database_directory, wrap_limit=None, unwrap_limit=None):  # pylint: disable=redefined-outer-name
		self.database_params = [database_directory, MockNemNetworkFacade(), MockSymbolNetworkFacade(), True]
		self.wrapped_facade = _Facade(wrap_limit)
		self.native_facade = _Facade(unwrap_limit)


@pytest.fixture
def database_directory():
	with tempfile.TemporaryDirectory() as temp_directory:
		directory = Path(temp_directory) / 'db'
		directory.mkdir()

		with Databases(directory, MockNemNetworkFacade(), MockSymbolNetworkFacade()) as databases:
			databases.create_tables()

		yield directory


def _seed_wrap_requests(directory):
	with Databases(directory, MockNemNetworkFacade(), MockSymbolNetworkFacade()) as databases:
		seed_database_with_simple_requests(databases.wrap_request)


def _seed_rejection(directory):
	# index 4 keeps this error clear of every hash the request seed uses, so that it has no matching request
	with Databases(directory, MockNemNetworkFacade(), MockSymbolNetworkFacade()) as databases:
		databases.wrap_request.add_error(make_request_error(4, 'destination address is invalid', height=777))


def _seed_transient_failure(directory):
	with Databases(directory, MockNemNetworkFacade(), MockSymbolNetworkFacade()) as databases:
		request = make_request(0, height=777, amount=4321, destination_address=SYMBOL_ADDRESSES[0])
		databases.wrap_request.add_request(request)
		databases.wrap_request.set_block_timestamp(777, 1020)
		databases.wrap_request.mark_payout_failed_transient(request, 'node unavailable')


async def _collect(directory, wrap_limit=None, unwrap_limit=None):
	registry = CollectorRegistry()
	await WrapRequestCollector(_Context(directory, wrap_limit, unwrap_limit)).collect(registry)
	return registry


def _failed_permanent(registry, direction):
	return registry.get_sample_value('bridge_requests_failed_permanent', {'direction': direction})


def _age(registry, name, direction):
	return registry.get_sample_value(name, {'direction': direction})


def _rejected(registry, direction):
	return registry.get_sample_value('bridge_requests_rejected', {'direction': direction})


def _remaining(registry, direction):
	return registry.get_sample_value('bridge_daily_transfer_remaining', {'direction': direction})


async def test_permanent_failures_are_counted(database_directory):  # pylint: disable=redefined-outer-name
	# Arrange: the seed marks two of its five requests as permanently failed
	_seed_wrap_requests(database_directory)

	# Act:
	registry = await _collect(database_directory)

	# Assert:
	assert 2 == _failed_permanent(registry, 'wrap')


async def test_a_transiently_failed_request_is_not_counted_but_is_still_waiting(database_directory):
	# pylint: disable=redefined-outer-name
	# Arrange: a transient failure carries the same failed status and is told apart only by is_retried
	_seed_transient_failure(database_directory)

	# Act:
	registry = await _collect(database_directory)

	# Assert: the failure counter looks away from the retry on purpose, so the age metric must not do the same
	assert 0 == _failed_permanent(registry, 'wrap')
	assert _age(registry, 'bridge_oldest_unprocessed_age_seconds', 'wrap') is not None


async def test_both_directions_are_reported(database_directory):  # pylint: disable=redefined-outer-name
	# Arrange: the seed marks two requests as permanently failed and touches only the wrap database
	_seed_wrap_requests(database_directory)

	# Act:
	registry = await _collect(database_directory)

	# Assert: a direction with no failures reports zero rather than being omitted
	assert 2 == _failed_permanent(registry, 'wrap')
	assert 0 == _failed_permanent(registry, 'unwrap')


async def test_ages_are_reported_for_a_bridge_with_work_in_flight(database_directory):  # pylint: disable=redefined-outer-name
	# Arrange: the seed leaves one request unprocessed and one payout awaiting confirmation
	_seed_wrap_requests(database_directory)

	with Databases(database_directory, MockNemNetworkFacade(), MockSymbolNetworkFacade()) as databases:
		unprocessed_timestamp = databases.wrap_request.oldest_unprocessed_request_timestamp()
		sent_timestamp = databases.wrap_request.oldest_payout_sent_timestamp()

	# Act:
	registry = await _collect(database_directory)

	# Assert: adding the reported age back onto the timestamp the database holds must land on now
	assert_timestamp_within_last_second(unprocessed_timestamp + _age(registry, 'bridge_oldest_unprocessed_age_seconds', 'wrap'))
	assert_timestamp_within_last_second(sent_timestamp + _age(registry, 'bridge_oldest_sent_age_seconds', 'wrap'))


async def test_ages_are_omitted_for_an_idle_bridge(database_directory):  # pylint: disable=redefined-outer-name
	# Act: nothing was seeded into either database
	registry = await _collect(database_directory)

	# Assert: a missing sample keeps an idle bridge off the alert, where zero would put it on
	for name in ('bridge_oldest_unprocessed_age_seconds', 'bridge_oldest_sent_age_seconds'):
		for direction in ('wrap', 'unwrap'):
			assert _age(registry, name, direction) is None, f'{name} {direction}'


async def test_rejected_deposits_are_counted(database_directory):  # pylint: disable=redefined-outer-name
	# Arrange: the seed also writes an error for each of its two failed payouts, which must not be counted here
	_seed_wrap_requests(database_directory)
	_seed_rejection(database_directory)

	# Act:
	registry = await _collect(database_directory)

	# Assert:
	assert 1 == _rejected(registry, 'wrap')
	assert 0 == _rejected(registry, 'unwrap')


async def test_daily_transfer_remaining_is_reported(database_directory):  # pylint: disable=redefined-outer-name
	# Arrange: the seed sends payouts worth 4050 gross, and the directions are given different limits
	_seed_wrap_requests(database_directory)

	# Act:
	registry = await _collect(database_directory, wrap_limit=10000, unwrap_limit=7000)

	# Assert:
	assert 5950 == _remaining(registry, 'wrap')
	assert 7000 == _remaining(registry, 'unwrap')


async def test_daily_transfer_remaining_goes_negative_when_the_limit_is_exceeded(database_directory):
	# pylint: disable=redefined-outer-name
	# Arrange: the seed already sent more than the limit allows
	_seed_wrap_requests(database_directory)

	# Act:
	registry = await _collect(database_directory, wrap_limit=1000)

	# Assert: the overshoot is reported rather than clamped, so its size stays visible
	assert -3050 == _remaining(registry, 'wrap')


async def test_daily_transfer_remaining_is_omitted_without_a_configured_limit(database_directory):
	# pylint: disable=redefined-outer-name
	# Arrange:
	_seed_wrap_requests(database_directory)

	# Act: neither direction configures max_daily_transfer_amount
	registry = await _collect(database_directory)

	# Assert:
	assert _remaining(registry, 'wrap') is None
	assert _remaining(registry, 'unwrap') is None
