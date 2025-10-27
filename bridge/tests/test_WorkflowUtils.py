import datetime
import tempfile
from collections import namedtuple
from decimal import Decimal

import pytest
from symbolchain.CryptoTypes import Hash256
from symbolchain.nem.Network import Network
from symbollightapi.model.Constants import TimeoutSettings, TransactionStatus
from symbollightapi.model.Exceptions import NodeException, NodeTransientException

from bridge.ConversionRateCalculatorFactory import ConversionRateCalculatorFactory
from bridge.db.Databases import Databases
from bridge.ethereum.EthereumConnector import ConfirmedTransactionExecutionFailure
from bridge.models.BridgeConfiguration import GlobalConfiguration
from bridge.models.Constants import ExecutionContext, PrintableMosaicId
from bridge.models.WrapRequest import WrapRequest
from bridge.WorkflowUtils import (
	NativeConversionRateCalculatorFactory,
	calculate_search_range,
	check_expiry,
	check_pending_sent_request,
	create_conversion_rate_calculator_factory,
	is_native_to_native_conversion,
	prepare_send,
	validate_global_configuration
)

from .test.MockNetworkFacade import MockNemNetworkFacade

# pylint: disable=invalid-name


# region calculate_search_range

class MockConnector:
	def __init__(self, chain_height, finalized_chain_height):
		self._chain_height = chain_height
		self._finalized_chain_height = finalized_chain_height

	async def chain_height(self):
		return self._chain_height

	async def finalized_chain_height(self):
		return self._finalized_chain_height


class MockDatabase:
	def __init__(self, max_processed_height):
		self._max_processed_height = max_processed_height

	def max_processed_height(self):
		return self._max_processed_height


async def _assert_calculate_search_range_returns_correct_range(expected_range, config_extensions, start_height_override_property_name):
	# Arrange:
	connector = MockConnector(2000, 1982)
	database = MockDatabase(777)

	# Act:
	search_range = await calculate_search_range(connector, database, config_extensions, start_height_override_property_name)

	# Assert:
	assert expected_range == search_range


async def test_calculate_search_range_returns_correct_range_with_no_adjustments():
	await _assert_calculate_search_range_returns_correct_range((778, 1983), {}, None)


async def test_calculate_search_range_returns_correct_range_with_start_height_adjustments():
	# Assert: calculated start height used because it is higher
	await _assert_calculate_search_range_returns_correct_range((778, 1983), {
		'start_height_override': 345
	}, 'start_height_override')

	# Assert: override start height used because it is higher
	await _assert_calculate_search_range_returns_correct_range((997, 1983), {
		'start_height_override': 997
	}, 'start_height_override')


async def test_calculate_search_range_returns_correct_range_with_end_height_adjustments():
	await _assert_calculate_search_range_returns_correct_range((778, 2033), {
		'finalization_lookahead': 50
	}, None)


async def test_calculate_search_range_returns_correct_range_with_start_height_and_end_height_adjustments():
	await _assert_calculate_search_range_returns_correct_range((997, 2033), {
		'finalization_lookahead': 50,
		'start_height_override': 997
	}, 'start_height_override')

# endregion


# region NativeConversionRateCalculatorFactory

def _create_databases(database_directory):
	# only wrap_request database is used or checked, so facades can be the same without any loss of generality
	return Databases(database_directory, MockNemNetworkFacade(), MockNemNetworkFacade())


def test_cannot_create_native_calculator_when_max_processed_height_is_less_than_target_height():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		with _create_databases(temp_directory) as databases:
			databases.create_tables()
			databases.wrap_request.set_max_processed_height(1002)

			factory = NativeConversionRateCalculatorFactory(databases, Decimal('2.5'))

			# Act + Assert:
			assert factory.try_create_calculator(1003) is None
			assert factory.try_create_calculator(2000) is None


def _assert_can_create_native_calculator_at_height(height):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		with _create_databases(temp_directory) as databases:
			databases.create_tables()
			databases.wrap_request.set_max_processed_height(1002)

			factory = NativeConversionRateCalculatorFactory(databases, Decimal('2.5'))

			# Act:
			calculator = factory.try_create_calculator(height)

			# Assert:
			assert 400000 == calculator.to_wrapped_amount(1000000)

			assert Decimal('2.5') == calculator.native_balance
			assert 1 == calculator.wrapped_balance
			assert 0 == calculator.unwrapped_balance


def test_can_create_native_calculator_when_max_processed_height_is_at_least_target_height():
	_assert_can_create_native_calculator_at_height(1)
	_assert_can_create_native_calculator_at_height(1001)
	_assert_can_create_native_calculator_at_height(1002)


def _assert_is_native_calculator_best_calculator(calculator, expected_height):
	assert 400000 == calculator.to_wrapped_amount(1000000)

	assert expected_height == calculator.height
	assert Decimal('2.5') == calculator.native_balance
	assert 1 == calculator.wrapped_balance
	assert 0 == calculator.unwrapped_balance


def test_can_create_native_calculator_best_calculator_empty():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		with _create_databases(temp_directory) as databases:
			databases.create_tables()

			factory = NativeConversionRateCalculatorFactory(databases, Decimal('2.5'))

			# Act:
			calculator = factory.create_best_calculator()

			# Assert:
			_assert_is_native_calculator_best_calculator(calculator, 0)

			# Sanity:
			assert not factory.try_create_calculator(1)
			assert factory.try_create_calculator(0)


def test_can_create_native_calculator_best_calculator_not_empty():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		with _create_databases(temp_directory) as databases:
			databases.create_tables()
			databases.wrap_request.set_max_processed_height(1002)

			factory = NativeConversionRateCalculatorFactory(databases, Decimal('2.5'))

			# Act:
			calculator = factory.create_best_calculator()

			# Assert:
			_assert_is_native_calculator_best_calculator(calculator, 1002)

			# Sanity:
			assert not factory.try_create_calculator(1003)
			assert factory.try_create_calculator(1002)

# endregion


# region is_native_to_native_conversion, validate_global_configuration

class MockNetworkFacade:
	def __init__(self, mosaic_id):
		self._mosaic_id = mosaic_id

		self.network = Network.TESTNET

	def extract_mosaic_id(self):
		return PrintableMosaicId(self._mosaic_id, self._mosaic_id)


def test_is_native_to_native_conversion_when_network_facade_uses_currency_mosaic():
	assert is_native_to_native_conversion(MockNetworkFacade(''))


def test_is_not_native_to_native_conversion_when_network_facade_does_not_use_currency_mosaic():
	assert not is_native_to_native_conversion(MockNetworkFacade('alpha'))


def test_validate_global_configuration_validates_strategy_mode_against_wrapped_token():
	# Assert: swap mode and native wrapped token   => allowed
	validate_global_configuration(GlobalConfiguration('swap'), MockNetworkFacade(None))

	# - other mode and not native wrapped token    => allowed
	validate_global_configuration(GlobalConfiguration('stake'), MockNetworkFacade(12345))

	# native mode and not native wrapped token     => disallowed
	with pytest.raises(ValueError, match='wrapped token is not native but swap mode is selected'):
		validate_global_configuration(GlobalConfiguration('swap'), MockNetworkFacade(12345))

	# - other mode and native wrapped token        => disallowed
	with pytest.raises(ValueError, match='wrapped token is native but swap mode is not selected'):
		validate_global_configuration(GlobalConfiguration('stake'), MockNetworkFacade(None))

# endregion


# region create_conversion_rate_calculator_factory

def _set_max_processed_height(databases, height):
	databases.balance_change.set_max_processed_height(height)

	databases.wrap_request.set_max_processed_height(height)
	databases.wrap_request.set_block_timestamp(height, 2222)

	databases.unwrap_request.set_max_processed_height(height)
	databases.unwrap_request.set_block_timestamp(height, 2222)


def _assert_can_create_default_calculator_factory_when_wrapped_facade_does_not_use_currency_mosaic(is_unwrap_mode):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		with _create_databases(temp_directory) as databases:
			databases.create_tables()
			_set_max_processed_height(databases, 1000)

			# Act:
			factory = create_conversion_rate_calculator_factory(
				ExecutionContext(is_unwrap_mode, 'stake'),
				databases,
				MockNetworkFacade('alpha'),
				MockNetworkFacade('beta'),
				Decimal('2.5'))

			# Assert:
			assert isinstance(factory, ConversionRateCalculatorFactory)
			assert 'alpha' == factory._mosaic_id  # pylint: disable=protected-access
			assert is_unwrap_mode == factory._is_unwrap_mode  # pylint: disable=protected-access

			assert 1000000 == factory.try_create_calculator(1000).to_wrapped_amount(1000000)


def test_can_create_default_calculator_factory_when_wrapped_facade_does_not_use_currency_mosaic_wrap_mode():
	_assert_can_create_default_calculator_factory_when_wrapped_facade_does_not_use_currency_mosaic(False)


def test_can_create_default_calculator_factory_when_wrapped_facade_does_not_use_currency_mosaic_unwrap_mode():
	_assert_can_create_default_calculator_factory_when_wrapped_facade_does_not_use_currency_mosaic(True)


def test_can_create_native_calculator_factory_when_wrapped_facade_uses_currency_mosaic():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		with _create_databases(temp_directory) as databases:
			databases.create_tables()
			_set_max_processed_height(databases, 1000)

			# Act:
			factory = create_conversion_rate_calculator_factory(
				ExecutionContext(False, 'stake'),
				databases,
				MockNetworkFacade('alpha'),
				MockNetworkFacade(''),
				Decimal('2.5'))

			# Assert:
			assert isinstance(factory, NativeConversionRateCalculatorFactory)
			assert Decimal('2.5') == factory._fee_multiplier  # pylint: disable=protected-access

			assert 400000 == factory.try_create_calculator(1000).to_wrapped_amount(1000000)


def test_cannot_create_native_calculator_factory_when_wrapped_facade_uses_currency_mosaic_unwrap_mode():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		with _create_databases(temp_directory) as databases:
			databases.create_tables()

			# Act + Assert:
			with pytest.raises(ValueError, match='native to native conversions do not support unwrap mode'):
				create_conversion_rate_calculator_factory(
					ExecutionContext(True, 'stake'),
					databases,
					MockNetworkFacade('alpha'),
					MockNetworkFacade(''),
					Decimal('2.5'))


def _assert_can_create_native_calculator_factory_when_strategy_mode_wrapped(is_unwrap_mode):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		with _create_databases(temp_directory) as databases:
			databases.create_tables()
			_set_max_processed_height(databases, 1000)

			# Act:
			factory = create_conversion_rate_calculator_factory(
				ExecutionContext(is_unwrap_mode, 'wrap'),
				databases,
				MockNetworkFacade('alpha'),
				MockNetworkFacade('beta'),
				Decimal('2.5'))

			# Assert:
			assert isinstance(factory, NativeConversionRateCalculatorFactory)
			assert Decimal('1') == factory._fee_multiplier  # pylint: disable=protected-access

			assert 1000000 == factory.try_create_calculator(1000).to_wrapped_amount(1000000)


def test_can_create_native_calculator_factory_when_strategy_mode_wrapped_and_wrap_mode():
	_assert_can_create_native_calculator_factory_when_strategy_mode_wrapped(False)


def test_can_create_native_calculator_factory_when_strategy_mode_wrapped_and_unwrap_mode():
	_assert_can_create_native_calculator_factory_when_strategy_mode_wrapped(True)

# endregion


# region prepare_send

def run_prepare_send_test(config_extensions, amount, fee_multiplier=None):
	PrepareSendMockNetworkFacade = namedtuple('PrepareSendMockNetworkFacade', ['config'])
	PrepareSendMockNetwork = namedtuple('PrepareSendMockNetwork', ['extensions'])

	def conversion_function(amount):
		return amount ** 2

	# Arrange:
	network = PrepareSendMockNetworkFacade(PrepareSendMockNetwork(config_extensions))
	request = WrapRequest(None, None, None, None, amount, None)

	# Act:
	return prepare_send(network, request, conversion_function, fee_multiplier)


def test_can_prepare_send_without_fee_multiplier():
	# Act:
	result = run_prepare_send_test({}, 88888888)

	# Assert:
	assert not result.error_message
	assert Decimal('1') == result.fee_multiplier
	assert Decimal('88888888') * Decimal('88888888') == result.transfer_amount


def test_can_prepare_send_with_fee_multiplier():
	# Act:
	result = run_prepare_send_test({}, 88888888, Decimal('7.8'))

	# Assert:
	assert not result.error_message
	assert Decimal('7.8') * Decimal(10 ** 12) == result.fee_multiplier
	assert Decimal('88888888') * Decimal('88888888') == result.transfer_amount


def test_cannot_prepare_send_with_negative_fee_multiplier():
	# Act + Assert:
	with pytest.raises(ValueError, match='fee_multiplier must be non-negative'):
		run_prepare_send_test({}, 88888888, Decimal('-7.8'))


def test_can_prepare_send_with_max_transfer_amount():
	# Act:
	result = run_prepare_send_test({'max_transfer_amount': '1000000'}, 1000)

	# Assert:
	assert not result.error_message
	assert Decimal('1') == result.fee_multiplier
	assert Decimal('1000000') == result.transfer_amount


def test_cannot_prepare_send_with_greater_than_max_transfer_amount():
	# Act:
	result = run_prepare_send_test({'max_transfer_amount': '1000000'}, 1001)

	# Assert:
	assert 'gross transfer amount 1002001 exceeds max transfer amount 1000000' == result.error_message
	assert not result.fee_multiplier
	assert not result.transfer_amount

# endregion


# region check_expiry

def run_check_expiry_test(config_extensions, block_timestamp):
	class CheckExpiryMockDatabase:
		@staticmethod
		def lookup_block_timestamp(height):
			return block_timestamp if 1234 == height else None

	# Arrange:
	database = CheckExpiryMockDatabase()
	request = WrapRequest(1234, None, None, None, None, None)

	# Act:
	return check_expiry(config_extensions, database, request)


def test_can_check_expiry_disabled():
	# Act:
	block_datetime = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=25))
	error_message = run_check_expiry_test({}, block_timestamp=block_datetime.timestamp())

	# Assert:
	assert not error_message


def test_can_check_expiry_not_expired():
	# Act:
	block_datetime = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=23))
	error_message = run_check_expiry_test({'request_lifetime_hours': '24'}, block_timestamp=block_datetime.timestamp())

	# Assert:
	assert not error_message


def test_can_check_expiry_expired():
	# Act:
	block_datetime = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=25))
	error_message = run_check_expiry_test({'request_lifetime_hours': '24'}, block_timestamp=block_datetime.timestamp())

	# Assert:
	assert f'request timestamp {block_datetime} is more than 24 in the past' == error_message

# endregion


# region check_pending_sent_request

async def run_check_pending_sent_request_test(block_timestamp, try_wait_result, asserter):
	# Arrange:
	payout_transaction_hash = Hash256('4D46C2CEC80FCAFCDA7F07C749E366416FC488FBEE448E4A5112916B49635661')

	class CheckPendingSentRequestMockDatabase:
		def __init__(self):
			self.failed_payouts = []

		@staticmethod
		def lookup_block_timestamp(height):
			return block_timestamp if 1234 == height else None

		@staticmethod
		def payout_transaction_hash_for_request(_request):
			return payout_transaction_hash

		def mark_payout_failed(self, request, message):
			self.failed_payouts.append(('failed', request, message))

		def mark_payout_failed_transient(self, request, message):
			self.failed_payouts.append(('failed-transient', request, message))

	class CheckPendingSentRequestMockConnector:
		def __init__(self):
			self.try_waits = []

		async def try_wait_for_announced_transaction(self, transaction_hash, desired_status, timeout_settings):
			self.try_waits.append((transaction_hash, desired_status, timeout_settings))
			if isinstance(try_wait_result, NodeException):
				raise try_wait_result

			return try_wait_result

	database = CheckPendingSentRequestMockDatabase()
	connector = CheckPendingSentRequestMockConnector()
	request = WrapRequest(1234, None, None, None, None, None)

	# Act:
	await check_pending_sent_request(request, database, connector, {'request_lifetime_hours': '24'})

	# Assert:
	assert [(payout_transaction_hash, TransactionStatus.UNCONFIRMED, TimeoutSettings(1, 0))] == connector.try_waits
	asserter(request, database)


async def test_check_pending_sent_request_not_marked_when_unconfirmed():
	# Arrange:
	block_datetime = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=23))

	def asserter(_request, database):
		# Assert:
		assert [] == database.failed_payouts

	# Act:
	await run_check_pending_sent_request_test(block_datetime.timestamp(), True, asserter)


async def test_check_pending_sent_request_mark_failed_when_non_transient_node_error():
	# Arrange:
	block_datetime = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=23))

	def asserter(request, database):
		# Assert:
		assert [('failed', request, 'node failure')] == database.failed_payouts

	# Act:
	await run_check_pending_sent_request_test(block_datetime.timestamp(), NodeException('node failure'), asserter)


async def test_check_pending_sent_request_not_marked_when_transient_node_error():
	# Arrange:
	block_datetime = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=23))

	def asserter(_request, database):
		# Assert:
		assert [] == database.failed_payouts

	# Act:
	await run_check_pending_sent_request_test(block_datetime.timestamp(), NodeTransientException('transient node failure'), asserter)


async def test_check_pending_sent_request_mark_failed_when_not_unconfirmed_and_expired():
	# Arrange:
	block_datetime = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=25))

	def asserter(request, database):
		# Assert:
		assert [('failed', request, f'request timestamp {block_datetime} is more than 24 in the past')] == database.failed_payouts

	# Act:
	await run_check_pending_sent_request_test(block_datetime.timestamp(), False, asserter)


async def test_check_pending_sent_request_mark_failed_transient_when_not_unconfirmed_and_not_expired():
	# Arrange:
	block_datetime = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=23))

	def asserter(request, database):
		# Assert:
		assert [('failed-transient', request, 'node dropped payout transaction')] == database.failed_payouts

	# Act:
	await run_check_pending_sent_request_test(block_datetime.timestamp(), False, asserter)


async def test_check_pending_sent_request_mark_failed_when_execution_failure_and_expired():
	# Arrange:
	block_datetime = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=25))

	def asserter(request, database):
		# Assert:
		assert [('failed', request, f'request timestamp {block_datetime} is more than 24 in the past')] == database.failed_payouts

	# Act:
	await run_check_pending_sent_request_test(block_datetime.timestamp(), ConfirmedTransactionExecutionFailure('exec failure'), asserter)


async def test_check_pending_sent_request_mark_failed_transient_when_execution_failure_and_not_expired():
	# Arrange:
	block_datetime = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=23))

	def asserter(request, database):
		# Assert:
		assert [('failed-transient', request, 'exec failure')] == database.failed_payouts

	# Act:
	await run_check_pending_sent_request_test(block_datetime.timestamp(), ConfirmedTransactionExecutionFailure('exec failure'), asserter)

# endregion
