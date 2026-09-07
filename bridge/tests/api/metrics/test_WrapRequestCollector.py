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


def _retries(registry, direction):
	return registry.get_sample_value('bridge_request_retries', {'direction': direction})


def _rejected(registry, direction):
	return registry.get_sample_value('bridge_requests_rejected', {'direction': direction})


def _remaining(registry, direction):
	return registry.get_sample_value('bridge_daily_transfer_remaining', {'direction': direction})


def _age(registry, name, direction):
	return registry.get_sample_value(name, {'direction': direction})


def _processed_height(registry, network):
	return registry.get_sample_value('bridge_processed_height', {'network': network})


def _seed_processed_heights(directory, wrap_height, unwrap_height):
	with Databases(directory, MockNemNetworkFacade(), MockSymbolNetworkFacade()) as databases:
		databases.wrap_request.set_max_processed_height(wrap_height)
		databases.unwrap_request.set_max_processed_height(unwrap_height)


async def test_aggregate_counters_for_a_database_with_permanent_failures(database_directory):
	# pylint: disable=redefined-outer-name
	# Arrange: the seed marks two of its five requests as permanently failed, retries none of them, and writes
	# an error alongside each failed payout that must not be mistaken for a rejected deposit
	_seed_wrap_requests(database_directory)

	# Act:
	registry = await _collect(database_directory)

	# Assert:
	assert 2 == _failed_permanent(registry, 'wrap')
	assert 0 == _retries(registry, 'wrap')
	assert 0 == _rejected(registry, 'wrap')

	# a direction with nothing to report still reports zero rather than being omitted
	assert 0 == _failed_permanent(registry, 'unwrap')
	assert 0 == _retries(registry, 'unwrap')
	assert 0 == _rejected(registry, 'unwrap')


async def test_aggregate_counters_for_a_database_with_a_retried_request(database_directory):
	# pylint: disable=redefined-outer-name
	# Arrange: a transient failure carries the same failed status as a permanent one and is told apart only by
	# is_retried, and it writes an error against the request it retried
	_seed_transient_failure(database_directory)

	# Act:
	registry = await _collect(database_directory)

	# Assert:
	assert 0 == _failed_permanent(registry, 'wrap')
	assert 1 == _retries(registry, 'wrap')
	assert 0 == _rejected(registry, 'wrap')


async def test_aggregate_counters_for_a_database_with_a_rejected_deposit(database_directory):
	# pylint: disable=redefined-outer-name
	# Arrange: a deposit rejected on download never became a request, unlike the errors the seed writes
	_seed_wrap_requests(database_directory)
	_seed_rejection(database_directory)

	# Act:
	registry = await _collect(database_directory)

	# Assert:
	assert 2 == _failed_permanent(registry, 'wrap')
	assert 0 == _retries(registry, 'wrap')
	assert 1 == _rejected(registry, 'wrap')


async def test_aggregate_counters_for_an_empty_database(database_directory):  # pylint: disable=redefined-outer-name
	# Act: nothing was seeded into either database
	registry = await _collect(database_directory)

	# Assert:
	for direction in ('wrap', 'unwrap'):
		assert 0 == _failed_permanent(registry, direction), direction
		assert 0 == _retries(registry, direction), direction
		assert 0 == _rejected(registry, direction), direction


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
	# Arrange: seeding payouts means there is an amount to report, so the omission cannot pass for an empty database
	_seed_wrap_requests(database_directory)

	# Act: neither direction configures max_daily_transfer_amount
	registry = await _collect(database_directory)

	# Assert:
	assert _remaining(registry, 'wrap') is None
	assert _remaining(registry, 'unwrap') is None


async def test_oldest_unprocessed_age_is_reported_for_a_waiting_request(database_directory):
	# pylint: disable=redefined-outer-name
	# Arrange: the seed leaves exactly one request unprocessed
	_seed_wrap_requests(database_directory)

	with Databases(database_directory, MockNemNetworkFacade(), MockSymbolNetworkFacade()) as databases:
		unprocessed_timestamp = databases.wrap_request.oldest_unprocessed_request_timestamp()

	# Act:
	registry = await _collect(database_directory)

	# Assert: adding the reported age back onto the timestamp the database holds must land on now
	assert_timestamp_within_last_second(unprocessed_timestamp + _age(registry, 'bridge_oldest_unprocessed_age_seconds', 'wrap'))


async def test_oldest_unprocessed_age_includes_a_retried_request(database_directory):
	# pylint: disable=redefined-outer-name
	# Arrange: a transient failure puts the request it retried back into the queue
	_seed_transient_failure(database_directory)

	with Databases(database_directory, MockNemNetworkFacade(), MockSymbolNetworkFacade()) as databases:
		unprocessed_timestamp = databases.wrap_request.oldest_unprocessed_request_timestamp()

	# Act:
	registry = await _collect(database_directory)

	# Assert: the failure counter looks away from a retry on purpose, so this metric must not do the same
	assert_timestamp_within_last_second(unprocessed_timestamp + _age(registry, 'bridge_oldest_unprocessed_age_seconds', 'wrap'))


async def test_oldest_unprocessed_age_is_omitted_for_an_idle_bridge(database_directory):
	# pylint: disable=redefined-outer-name
	# Act: nothing was seeded into either database
	registry = await _collect(database_directory)

	# Assert: a missing sample keeps an idle bridge off the alert, where zero would put it on
	for direction in ('wrap', 'unwrap'):
		assert _age(registry, 'bridge_oldest_unprocessed_age_seconds', direction) is None, direction


async def test_oldest_sent_age_is_reported_for_an_unconfirmed_payout(database_directory):
	# pylint: disable=redefined-outer-name
	# Arrange: the seed leaves exactly one payout awaiting confirmation
	_seed_wrap_requests(database_directory)

	with Databases(database_directory, MockNemNetworkFacade(), MockSymbolNetworkFacade()) as databases:
		sent_timestamp = databases.wrap_request.oldest_payout_sent_timestamp()

	# Act:
	registry = await _collect(database_directory)

	# Assert: adding the reported age back onto the timestamp the database holds must land on now
	assert_timestamp_within_last_second(sent_timestamp + _age(registry, 'bridge_oldest_sent_age_seconds', 'wrap'))


async def test_oldest_sent_age_is_omitted_for_an_idle_bridge(database_directory):
	# pylint: disable=redefined-outer-name
	# Act: nothing was seeded into either database
	registry = await _collect(database_directory)

	# Assert: a missing sample keeps an idle bridge off the alert, where zero would put it on
	for direction in ('wrap', 'unwrap'):
		assert _age(registry, 'bridge_oldest_sent_age_seconds', direction) is None, direction


async def test_processed_height_is_reported_for_the_network_requests_are_read_from(database_directory):
	# pylint: disable=redefined-outer-name
	# Arrange: wrap requests are downloaded from the native network, unwrap requests from the wrapped one
	_seed_processed_heights(database_directory, 1234, 5678)

	# Act:
	registry = await _collect(database_directory)

	# Assert:
	assert 1234 == _processed_height(registry, 'native')
	assert 5678 == _processed_height(registry, 'wrapped')


async def test_processed_height_is_zero_for_a_bridge_that_downloaded_nothing(database_directory):
	# pylint: disable=redefined-outer-name
	# Act: nothing was seeded into either database
	registry = await _collect(database_directory)

	# Assert: zero is a real state - it says the bridge has not read a single block yet
	assert 0 == _processed_height(registry, 'native')
	assert 0 == _processed_height(registry, 'wrapped')
