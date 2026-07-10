import asyncio
import tempfile
from unittest import TestCase
from unittest.mock import AsyncMock, MagicMock, patch

from symbolchain.sc import TransactionType
from symbollightapi.model.Exceptions import NodeException

from puller.facade.SymbolPuller import SymbolPuller
from puller.model.symbol.Receipt import NAMESPACE_DELETED_RECEIPT_TYPE, NAMESPACE_EXPIRED_RECEIPT_TYPE
from tests.test.SymbolNamespaceTestUtils import (
	NAMESPACE_ROOT_ID,
	NAMESPACE_SUB_ID,
	create_expected_root_namespace_row,
	create_namespace_item
)

from .puller_test_utils import NODE_URL, ResponseConnector, create_db_config, create_symbol_puller, temporary_symbol_puller


class CountingRateLimiter:
	def __init__(self):
		self.call_count = 0

	async def wait_for_turn(self):
		self.call_count += 1


class SymbolPullerTest(TestCase):  # pylint: disable=too-many-public-methods
	def test_fetch_dirty_namespaces_returns_ordered_upsert_and_delete_entries(self):
		# Arrange:
		connector = MagicMock()
		connector.get = AsyncMock(side_effect=[
			{'code': 'ResourceNotFound', 'message': 'no resource exists with id 0000000000000001'},
			create_namespace_item()
		])
		connector.post = AsyncMock(return_value=[
			{'id': NAMESPACE_ROOT_ID, 'name': 'root'},
			{'id': NAMESPACE_ROOT_ID, 'name': 'root'}
		])
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			entries = asyncio.run(puller._fetch_dirty_namespaces(  # pylint: disable=protected-access
				['0000000000000001', NAMESPACE_ROOT_ID],
				123))

		# Assert:
		self.assertEqual([
			{'namespace_id': '0000000000000001'},
			{
				'row': create_expected_root_namespace_row(
					NAMESPACE_ROOT_ID,
					'root',
					'9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95',
					create_namespace_item(),
					123),
				'alias_rows': [{
					'artifact_type': 'namespace',
					'artifact_id': NAMESPACE_ROOT_ID,
					'name': 'root',
					'updated_at_height': 123
				}]
			}
		], entries)
		self.assertEqual(2, connector.get.await_count)
		connector.post.assert_awaited_once_with('namespaces/names', {'namespaceIds': [NAMESPACE_ROOT_ID]}, None, True)

	def test_fetch_dirty_namespaces_makes_no_node_request_when_namespace_ids_are_empty(self):
		# Arrange:
		connector = MagicMock()
		connector.get = AsyncMock()
		connector.post = AsyncMock()
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			entries = asyncio.run(puller._fetch_dirty_namespaces([], 123))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([], entries)
		self.assertEqual(0, connector.get.await_count)
		self.assertEqual(0, connector.post.await_count)

	def test_fetch_dirty_namespaces_chunks_unique_level_ids_when_resolving_names(self):
		# Arrange:
		namespace_ids = [f'{index:016X}' for index in range(1, 102)]
		connector = MagicMock()
		connector.get = AsyncMock(side_effect=[
			create_namespace_item(namespace_id=namespace_id, root_id=namespace_id)
			for namespace_id in namespace_ids
		])

		async def resolve_names(_, request_payload, *__):
			return [{'id': namespace_id, 'name': f'name-{namespace_id}'} for namespace_id in request_payload['namespaceIds']]

		connector.post = AsyncMock(side_effect=resolve_names)
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			entries = asyncio.run(puller._fetch_dirty_namespaces(namespace_ids, 123))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(namespace_ids, [entry['row']['namespace_id'] for entry in entries])
		self.assertEqual(101, connector.get.await_count)
		self.assertEqual([
			list(namespace_ids[:100]),
			list(namespace_ids[100:])
		], [call.args[1]['namespaceIds'] for call in connector.post.await_args_list])

	def test_fetch_dirty_namespaces_raises_when_names_response_is_malformed(self):
		# Arrange:
		connector = MagicMock()
		connector.get = AsyncMock(return_value=create_namespace_item())
		connector.post = AsyncMock(return_value={'data': []})
		with temporary_symbol_puller(connector=connector) as puller:
			# Act / Assert:
			with self.assertRaisesRegex(ValueError, 'Malformed Symbol namespace names response'):
				asyncio.run(puller._fetch_dirty_namespaces([NAMESPACE_ROOT_ID], 123))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(1, connector.get.await_count)
		self.assertEqual(1, connector.post.await_count)

	def test_fetch_dirty_namespaces_resolves_duplicate_ancestor_name_entries(self):
		# Arrange:
		connector = MagicMock()
		connector.get = AsyncMock(return_value=create_namespace_item(
			namespace_id=NAMESPACE_SUB_ID,
			root_id=NAMESPACE_ROOT_ID,
			parent_id=NAMESPACE_ROOT_ID))
		connector.post = AsyncMock(return_value=[
			{'id': NAMESPACE_ROOT_ID, 'name': 'root'},
			{'id': NAMESPACE_SUB_ID, 'name': 'sub', 'parentId': NAMESPACE_ROOT_ID},
			{'id': NAMESPACE_ROOT_ID, 'name': 'root'}
		])
		with temporary_symbol_puller(connector=connector) as puller:
			# Act:
			entries = asyncio.run(puller._fetch_dirty_namespaces([NAMESPACE_SUB_ID], 123))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual('root.sub', entries[0]['row']['full_name'])
		self.assertEqual('sub', entries[0]['row']['name'])
		self.assertEqual([
			{'namespaceIds': [NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID]}
		], [call.args[1] for call in connector.post.await_args_list])

	def test_collect_dirty_namespace_ids_for_batch_returns_sorted_unique_namespace_ids_from_supported_artifacts(self):
		# Arrange:
		transaction_rows_by_height = {
			1: [
				{'type': TransactionType.NAMESPACE_REGISTRATION.value, 'body': {'id': '0000000000000002'}},
				{'type': TransactionType.ADDRESS_ALIAS.value, 'body': {'namespaceId': '0000000000000003', 'aliasAction': 1}},
				{'type': TransactionType.MOSAIC_ALIAS.value, 'body': {'namespaceId': '0000000000000003', 'aliasAction': 0}},
				{'type': TransactionType.TRANSFER.value, 'body': {'id': 'ignored'}}
			],
			2: [
				{'type': TransactionType.NAMESPACE_REGISTRATION.value, 'is_embedded': True, 'body': {'id': '0000000000000001'}}
			]
		}
		receipt_rows_by_height = {
			1: [
				{'receipt_type': NAMESPACE_EXPIRED_RECEIPT_TYPE, 'artifact_id': '0000000000000004'},
				{'receipt_type': NAMESPACE_DELETED_RECEIPT_TYPE, 'artifact_id': '0000000000000001'},
				{'receipt_type': 'mosaicExpired', 'artifact_id': 'ignored'}
			]
		}

		# Act:
		namespace_ids = SymbolPuller._collect_dirty_namespace_ids_for_batch(  # pylint: disable=protected-access
			transaction_rows_by_height,
			receipt_rows_by_height)

		# Assert:
		self.assertEqual([
			'0000000000000001',
			'0000000000000002',
			'0000000000000003',
			'0000000000000004'
		], namespace_ids)

	def test_collect_dirty_namespace_ids_for_batch_returns_empty_list_when_batch_contains_no_namespace_artifacts(self):
		# Arrange:
		transaction_rows_by_height = {1: [{'type': TransactionType.TRANSFER.value, 'body': {}}]}
		receipt_rows_by_height = {1: [{'receipt_type': 'mosaicExpired', 'artifact_id': '0000000000000001'}]}

		# Act:
		namespace_ids = SymbolPuller._collect_dirty_namespace_ids_for_batch(  # pylint: disable=protected-access
			transaction_rows_by_height,
			receipt_rows_by_height)

		# Assert:
		self.assertEqual([], namespace_ids)

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
