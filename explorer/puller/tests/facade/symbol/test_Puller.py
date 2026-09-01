import asyncio
import tempfile
from unittest import TestCase
from unittest.mock import AsyncMock, MagicMock, patch

from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from symbolchain.sc import AliasAction, TransactionType
from symbollightapi.model.Exceptions import NodeException

from puller.facade.SymbolPuller import SymbolPuller
from puller.model.symbol.Receipt import MOSAIC_EXPIRED_RECEIPT_TYPE, NAMESPACE_EXPIRED_RECEIPT_TYPE
from tests.test.PerformanceTestUtils import ScriptedClock
from tests.test.SymbolMosaicTestUtils import MOSAIC_ID, create_expected_mosaic_row, create_mosaic_item

from .puller_test_utils import NODE_URL, ResponseConnector, create_db_config, create_symbol_puller, temporary_symbol_puller


class CountingRateLimiter:
	def __init__(self):
		self.call_count = 0

	async def wait_for_turn(self):
		self.call_count += 1


class SymbolPullerTest(TestCase):  # pylint: disable=too-many-public-methods
	def test_collect_dirty_mosaic_ids_for_batch_returns_unique_ids_in_first_encounter_order(self):
		# Arrange:
		transaction_rows_by_height = {
			1: [
				{'type': TransactionType.MOSAIC_DEFINITION.value, 'body': {'id': MOSAIC_ID}},
				{
					'type': TransactionType.MOSAIC_SUPPLY_CHANGE.value,
					'body': {'mosaicId': '0000000000000002'},
					'mosaic_rows': [{'mosaic_id': '0000000000000002'}]
				},
				{'type': TransactionType.MOSAIC_SUPPLY_REVOCATION.value, 'body': {'mosaicId': 'ignored'}},
				{'type': TransactionType.TRANSFER.value, 'body': {'mosaics': [{'id': 'ignored'}]}},
				{'type': TransactionType.MOSAIC_ALIAS.value, 'body': {'mosaicId': 'ignored'}}
			],
			2: [
				{
					'is_embedded': True,
					'type': TransactionType.MOSAIC_DEFINITION.value,
					'body': {'id': '0000000000000004'}
				},
				{
					'type': TransactionType.MOSAIC_SUPPLY_CHANGE.value,
					'body': {'mosaicId': MOSAIC_ID},
					'mosaic_rows': [{'mosaic_id': MOSAIC_ID}]
				},
				{'type': TransactionType.MOSAIC_DEFINITION.value, 'body': {'id': '0000000000000002'}}
			]
		}
		receipt_rows_by_height = {
			1: [
				{'receipt_type': MOSAIC_EXPIRED_RECEIPT_TYPE, 'artifact_id': '0000000000000003'},
				{'receipt_type': NAMESPACE_EXPIRED_RECEIPT_TYPE, 'artifact_id': 'ignored'}
			]
		}

		# Act:
		mosaic_ids = SymbolPuller._collect_dirty_mosaic_ids_for_batch(  # pylint: disable=protected-access
			transaction_rows_by_height,
			receipt_rows_by_height)

		# Assert:
		self.assertEqual([MOSAIC_ID, '0000000000000002', '0000000000000004', '0000000000000003'], mosaic_ids)

	def test_collect_dirty_mosaic_ids_for_batch_returns_empty_list_for_empty_batch(self):
		# Arrange:
		transaction_rows_by_height = {}
		receipt_rows_by_height = {}

		# Act:
		mosaic_ids = SymbolPuller._collect_dirty_mosaic_ids_for_batch(  # pylint: disable=protected-access
			transaction_rows_by_height,
			receipt_rows_by_height)

		# Assert:
		self.assertEqual([], mosaic_ids)

	def test_collect_dirty_mosaic_ids_for_batch_returns_empty_list_without_mosaic_state_changes(self):
		# Arrange:
		transaction_rows_by_height = {
			1: [
				{'type': TransactionType.MOSAIC_SUPPLY_REVOCATION.value, 'body': {'mosaicId': 'ignored'}},
				{'type': TransactionType.TRANSFER.value, 'body': {'mosaics': [{'id': 'ignored'}]}},
				{'type': TransactionType.HASH_LOCK.value, 'body': {'mosaicId': 'ignored', 'amount': '1'}},
				{'type': TransactionType.SECRET_LOCK.value, 'body': {'mosaicId': 'ignored', 'amount': '1'}},
				{'type': TransactionType.MOSAIC_ADDRESS_RESTRICTION.value, 'body': {'mosaicId': 'ignored'}},
				{'type': TransactionType.MOSAIC_GLOBAL_RESTRICTION.value, 'body': {'mosaicId': 'ignored'}},
				{
					'type': TransactionType.MOSAIC_ALIAS.value,
					'body': {'namespaceId': 'ignored', 'aliasAction': AliasAction.UNLINK.value}
				}
			]
		}
		receipt_rows_by_height = {1: [{'receipt_type': NAMESPACE_EXPIRED_RECEIPT_TYPE, 'artifact_id': 'ignored'}]}

		# Act:
		mosaic_ids = SymbolPuller._collect_dirty_mosaic_ids_for_batch(  # pylint: disable=protected-access
			transaction_rows_by_height,
			receipt_rows_by_height)

		# Assert:
		self.assertEqual([], mosaic_ids)

	def _assert_collects_mosaic_supply_change(self, unresolved_mosaic_id, resolved_mosaic_id):
		# Arrange:
		transaction_rows_by_height = {
			1: [{
				'type': TransactionType.MOSAIC_SUPPLY_CHANGE.value,
				'body': {'mosaicId': unresolved_mosaic_id},
				'mosaic_rows': [{'mosaic_id': resolved_mosaic_id}]
			}]
		}

		# Act:
		mosaic_ids = SymbolPuller._collect_dirty_mosaic_ids_for_batch(  # pylint: disable=protected-access
			transaction_rows_by_height,
			{})

		# Assert:
		self.assertEqual([resolved_mosaic_id], mosaic_ids)

	def test_collect_dirty_mosaic_ids_for_batch_uses_resolved_mosaic_id_for_alias_supply_change(self):
		self._assert_collects_mosaic_supply_change('A95F1F8A96159516', MOSAIC_ID)

	def test_collect_dirty_mosaic_ids_for_batch_keeps_direct_mosaic_id_for_supply_change(self):
		self._assert_collects_mosaic_supply_change(MOSAIC_ID, MOSAIC_ID)

	def test_collect_dirty_mosaic_ids_for_batch_raises_when_alias_supply_change_has_no_normalized_mosaic_row(self):
		# Arrange:
		transaction_rows_by_height = {
			1: [{
				'type': TransactionType.MOSAIC_SUPPLY_CHANGE.value,
				'body': {'mosaicId': 'A95F1F8A96159516'},
				'mosaic_rows': []
			}]
		}

		# Act / Assert:
		with self.assertRaises(IndexError):
			SymbolPuller._collect_dirty_mosaic_ids_for_batch(  # pylint: disable=protected-access
				transaction_rows_by_height,
				{})

	def test_fetch_dirty_mosaics_returns_ordered_upsert_and_delete_entries(self):
		# Arrange:
		mosaic_ids = ['0000000000000001', '0000000000000002', MOSAIC_ID]
		connector = MagicMock()
		connector.post = AsyncMock(return_value=[
			create_mosaic_item(mosaic_id=mosaic_ids[2]),
			create_mosaic_item(mosaic_id=mosaic_ids[0])
		])
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			entries = asyncio.run(puller._fetch_dirty_mosaics(  # pylint: disable=protected-access
				mosaic_ids,
				123))

		# Assert:
		self.assertEqual([
			{'row': create_expected_mosaic_row(create_mosaic_item(mosaic_id=mosaic_ids[0]), 123)},
			{'mosaic_id': mosaic_ids[1]},
			{'row': create_expected_mosaic_row(create_mosaic_item(mosaic_id=mosaic_ids[2]), 123)}
		], entries)
		self.assertEqual(1, connector.post.await_count)
		connector.post.assert_awaited_once_with(
			'mosaics',
			{'mosaicIds': mosaic_ids},
			None,
			True)

	def test_fetch_dirty_mosaics_chunks_post_requests_at_max_page_size(self):
		# Arrange:
		mosaic_ids = [f'{index:016X}' for index in range(101)]
		items = [create_mosaic_item(
			mosaic_id=mosaic_id,
			supply=str(1000 + index),
			item_id=f'{index:024X}'
		) for index, mosaic_id in enumerate(mosaic_ids)]
		connector = MagicMock()
		connector.post = AsyncMock(side_effect=[list(reversed(items[:100])), list(reversed(items[100:]))])
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			entries = asyncio.run(puller._fetch_dirty_mosaics(mosaic_ids, 123))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([
			{'row': create_expected_mosaic_row(item, 123)} for item in items
		], entries)
		self.assertEqual(2, connector.post.await_count)
		self.assertEqual([
			{'mosaicIds': mosaic_ids[:100]},
			{'mosaicIds': mosaic_ids[100:]}
		], [call.args[1] for call in connector.post.await_args_list])

	def test_fetch_dirty_mosaics_uses_one_request_for_exactly_max_page_size_ids(self):
		# Arrange:
		mosaic_ids = [f'{index:016X}' for index in range(100)]
		connector = MagicMock()
		connector.post = AsyncMock(return_value=[
			create_mosaic_item(mosaic_id=mosaic_id)
			for mosaic_id in reversed(mosaic_ids)
		])
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			entries = asyncio.run(puller._fetch_dirty_mosaics(mosaic_ids, 123))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(mosaic_ids, [entry['row']['mosaic_id'] for entry in entries])
		self.assertEqual(1, connector.post.await_count)
		connector.post.assert_awaited_once_with(
			'mosaics',
			{'mosaicIds': mosaic_ids},
			None,
			True)

	def test_fetch_dirty_mosaics_raises_when_response_is_malformed(self):
		# Arrange:
		connector = MagicMock()
		connector.post = AsyncMock(return_value={'data': []})
		with temporary_symbol_puller(connector=connector) as puller:
			# Act / Assert:
			with self.assertRaisesRegex(ValueError, 'Malformed Symbol mosaics batch response'):
				asyncio.run(puller._fetch_dirty_mosaics([MOSAIC_ID], 123))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(1, connector.post.await_count)

	def test_fetch_dirty_mosaics_makes_no_node_request_for_empty_ids(self):
		# Arrange:
		connector = MagicMock()
		connector.post = AsyncMock()
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			entries = asyncio.run(puller._fetch_dirty_mosaics([], 123))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([], entries)
		self.assertEqual(0, connector.post.await_count)

	def test_create_default_puller_instance(self):
		# Arrange / Act:
		with temporary_symbol_puller() as puller:
			# Assert:
			self.assertEqual('mainnet', puller.symbol_facade.network.name)
			self.assertEqual('symbol', puller.symbol_db.db_config.database)
			self.assertIsNone(puller.symbol_db.connection)

	def test_create_testnet_puller_instance(self):
		# Arrange / Act:
		with temporary_symbol_puller(
			'testnet',
			request_timeout_seconds=15
		) as puller:
			# Assert:
			self.assertEqual(NODE_URL, puller.node_config.base_url)
			self.assertEqual('testnet', puller.symbol_facade.network.name)
			self.assertEqual('symbol', puller.symbol_db.db_config.database)
			self.assertIsNone(puller.symbol_db.connection)

	def test_initializes_with_custom_request_timeout(self):
		# Arrange / Act:
		connector = MagicMock()
		with temporary_symbol_puller(
			'testnet',
			request_timeout_seconds=15,
			connector=connector
		) as puller:
			# Assert:
			self.assertEqual(15, puller.node_config.timeout_seconds)
			self.assertEqual(puller.node_config.timeout_seconds, connector.timeout_seconds)

	def test_preserves_legacy_positional_max_requests_per_second(self):
		# Arrange:
		connector = ResponseConnector({'chain/info': {'ok': True}})
		clock = ScriptedClock([0, 0, 0.1, 0.1])
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = create_db_config(temp_directory)
			node_config = SymbolNodeConfiguration.from_url(
				NODE_URL,
				allow_loopback=True,
				timeout_seconds=17)

			# Act:
			puller = SymbolPuller(
				NODE_URL,
				db_config_path,
				'testnet',
				node_config,
				connector,
				2,
				time_source=clock)

			async def request_twice():
				first_response = await puller.get_symbol_node('chain/info')
				second_request_task = asyncio.create_task(puller.get_symbol_node('chain/info'))
				await asyncio.sleep(0)
				paths_before_cancellation = list(connector.paths)
				second_request_task.cancel()
				with self.assertRaises(asyncio.CancelledError):
					await second_request_task
				return first_response, paths_before_cancellation

			first_response, paths_before_cancellation = asyncio.run(request_twice())

			# Assert:
			self.assertEqual({'ok': True}, first_response)
			self.assertEqual(['chain/info'], paths_before_cancellation)
			self.assertEqual(17, connector.timeout_seconds)

	def test_rejects_unsupported_network_type(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = create_db_config(temp_directory)

			# Act / Assert:
			with self.assertRaisesRegex(
				ValueError,
				'Unsupported Symbol network "main". '
				'Supported values: mainnet, testnet'
			):
				create_symbol_puller(db_config_path, 'main')

	def test_requires_symbol_db_config_section(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = create_db_config(
				temp_directory,
				include_symbol_db=False
			)

			# Act / Assert:
			with self.assertRaisesRegex(KeyError, 'symbol_db'):
				create_symbol_puller(db_config_path)

	def test_initializes_from_node_url_when_node_config_is_omitted(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			db_config_path = create_db_config(temp_directory)
			with patch(
				'common.symbol.NodeConfiguration.socket.getaddrinfo',
				return_value=[
					(None, None, None, None, ('93.184.216.34', 3000))
				]
			):
				# Act:
				puller = SymbolPuller(
					'http://example.com:3000',
					db_config_path,
					'testnet'
				)

			# Assert:
			self.assertEqual(
				'http://example.com:3000',
				puller.node_config.base_url
			)
			self.assertEqual(
				frozenset({'example.com:3000'}),
				puller.node_config.allowed_hosts
			)
			self.assertEqual('testnet', puller.symbol_facade.network.name)

	def test_get_symbol_node_validates_target(self):
		# Arrange:
		connector = ResponseConnector({
			'blocks?pageNumber=1&pageSize=100': {'ok': True}
		})
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			result = asyncio.run(puller.get_symbol_node(
				'/blocks?pageNumber=1&pageSize=100',
				'data',
				False
			))

		# Assert:
		self.assertEqual({'ok': True}, result)
		self.assertEqual(['blocks?pageNumber=1&pageSize=100'], connector.paths)

	def test_post_symbol_node_validates_target(self):
		# Arrange:
		connector = MagicMock()
		connector.post = AsyncMock(return_value={'ok': True})
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			result = asyncio.run(puller.post_symbol_node(
				'path',
				{'payload': 1},
				'data',
				False
			))

		# Assert:
		self.assertEqual({'ok': True}, result)
		connector.post.assert_awaited_once_with('path', {'payload': 1}, 'data', False)

	def test_get_symbol_node_waits_for_rate_limiter_turn(self):
		# Arrange:
		connector = ResponseConnector({'chain/info': {'ok': True}})
		rate_limiter = CountingRateLimiter()
		with temporary_symbol_puller(connector=connector, rate_limiter=rate_limiter) as puller:
			# Act:
			asyncio.run(puller.get_symbol_node('/chain/info'))

		# Assert:
		self.assertEqual(1, rate_limiter.call_count)

	def test_post_symbol_node_waits_for_rate_limiter_turn(self):
		# Arrange:
		connector = MagicMock()
		connector.post = AsyncMock(return_value={'ok': True})
		rate_limiter = CountingRateLimiter()
		with temporary_symbol_puller(connector=connector, rate_limiter=rate_limiter) as puller:
			# Act:
			asyncio.run(puller.post_symbol_node('/transactions', {'payload': 'ABCD'}))

		# Assert:
		self.assertEqual(1, rate_limiter.call_count)

	def test_get_symbol_node_waits_for_rate_limiter_turn_on_each_retry(self):
		# Arrange:
		connector = MagicMock()
		connector.get = AsyncMock(side_effect=[
			NodeException('Connection refused'),
			{'ok': True}
		])
		rate_limiter = CountingRateLimiter()
		with temporary_symbol_puller(connector=connector, rate_limiter=rate_limiter) as puller:
			# Act:
			result = asyncio.run(puller.get_symbol_node('/chain/info'))

		# Assert:
		self.assertEqual({'ok': True}, result)
		self.assertEqual(2, rate_limiter.call_count)

	def test_post_symbol_node_retries_api_error_response(self):
		# Arrange:
		connector = MagicMock()
		connector.post = AsyncMock(side_effect=[
			{
				'code': 'InvalidArgument',
				'message': 'payload has an invalid format'
			},
			{'ok': True}
		])
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			result = asyncio.run(puller.post_symbol_node(
				'/transactions',
				{'payload': 'ABCD'}
			))

		# Assert:
		self.assertEqual({'ok': True}, result)
		self.assertEqual(2, connector.post.await_count)

	def test_get_symbol_node_retries_node_exception(self):
		# Arrange:
		connector = MagicMock()
		connector.get = AsyncMock(side_effect=[
			NodeException('Connection refused'),
			{'ok': True}
		])
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			result = asyncio.run(puller.get_symbol_node('/chain/info'))

		# Assert:
		self.assertEqual({'ok': True}, result)
		self.assertEqual(2, connector.get.await_count)

	def test_get_symbol_node_raises_after_max_retries(self):
		# Arrange:
		connector = MagicMock()
		connector.get = AsyncMock(
			side_effect=NodeException('Connection refused')
		)
		with temporary_symbol_puller(connector=connector) as puller:
			# Act / Assert:
			with self.assertRaisesRegex(NodeException, 'Connection refused'):
				asyncio.run(puller.get_symbol_node('/chain/info'))

		# Assert:
		self.assertEqual(3, connector.get.await_count)

	def test_get_symbol_node_retries_api_error_response(self):
		# Arrange:
		connector = MagicMock()
		connector.get = AsyncMock(side_effect=[
			{
				'code': 'InvalidArgument',
				'message': 'offset has an invalid format'
			},
			{'data': [], 'pagination': {'pageNumber': 1, 'pageSize': 100}}
		])
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			result = asyncio.run(puller.get_symbol_node(
				'/blocks?pageSize=100&offset=bad&orderBy=height'
			))

		# Assert:
		self.assertEqual(
			{'data': [], 'pagination': {'pageNumber': 1, 'pageSize': 100}},
			result
		)
		self.assertEqual(2, connector.get.await_count)

	def test_get_symbol_node_retries_non_not_found_api_error_when_not_found_is_allowed(self):
		# Arrange:
		connector = MagicMock()
		connector.get = AsyncMock(side_effect=[
			{
				'code': 'InvalidArgument',
				'message': 'offset has an invalid format'
			},
			{'data': []}
		])
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			result = asyncio.run(puller.get_symbol_node(
				'/blocks?pageSize=100&offset=bad&orderBy=height',
				not_found_as_error=False
			))

		# Assert:
		self.assertEqual({'data': []}, result)
		self.assertEqual(2, connector.get.await_count)

	def test_get_symbol_node_does_not_retry_resource_not_found_when_not_found_is_allowed(self):
		# Arrange:
		connector = MagicMock()
		connector.get = AsyncMock(return_value={
			'code': 'ResourceNotFound',
			'message': 'no resource exists with id foo'
		})
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			result = asyncio.run(puller.get_symbol_node('/account/foo/multisig', not_found_as_error=False))

		# Assert:
		self.assertEqual({'code': 'ResourceNotFound', 'message': 'no resource exists with id foo'}, result)
		self.assertEqual(1, connector.get.await_count)

	def test_symbol_node_path_must_be_relative(self):
		# Arrange:
		connector = MagicMock()
		with temporary_symbol_puller(connector=connector) as puller:
			# Act / Assert:
			with self.assertRaisesRegex(
				ValueError,
				'Symbol node connector paths must be relative'
			):
				asyncio.run(puller.get_symbol_node('http://example.com/path'))

		# Assert:
		connector.get.assert_not_called()

	def test_symbol_node_path_must_not_include_fragments(self):
		# Arrange:
		connector = MagicMock()
		with temporary_symbol_puller(connector=connector) as puller:
			# Act / Assert:
			with self.assertRaisesRegex(
				ValueError,
				'Symbol node connector paths must not include fragments'
			):
				asyncio.run(puller.get_symbol_node('blocks#fragment'))

		# Assert:
		connector.get.assert_not_called()
