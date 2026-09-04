# pylint: disable=protected-access,too-many-lines,too-many-public-methods
import asyncio

from symbolchain.sc import TransactionType

from puller.facade.SymbolPuller import (
	MAX_PAGE_SIZE,
	RESOLUTION_FETCH_CONCURRENCY,
	TRANSACTION_PAGE_FETCH_CONCURRENCY,
	TransactionCountExpectation
)
from tests.test.SymbolTestConstants import SIGNER_ADDRESS

from .puller_test_utils import (
	FakeConnector,
	SymbolPullerTestBase,
	create_embedded_node_transaction,
	create_node_block,
	create_node_transaction,
	create_resolution_statement,
	create_sync_state,
	create_transaction_page,
	resolution_path,
	set_symbol_connector,
	transaction_path
)

ALIAS_ADDRESS = '99065A28385EB5AE88000000000000000000000000000000'
SECOND_ALIAS_ADDRESS = '9958E1C2A3ABC3CAF6000000000000000000000000000000'
DECOY_RESOLVED_ADDRESS = SIGNER_ADDRESS
RESOLVED_ADDRESS = '9887EE8C9843958C84E0F25FEAF403D880B3D323133972F2'
ALIAS_MOSAIC_ID = 'E74B99BA41F4AFEE'
RESOLVED_MOSAIC_ID = '72C0212E67A08BCE'
CONCURRENCY_TEST_TIMEOUT_SECONDS = 5


def _resolution_entry(primary_id, secondary_id, resolved):
	return {
		'source': {'primaryId': primary_id, 'secondaryId': secondary_id},
		'resolved': resolved
	}


class MalformedResolutionConnector(FakeConnector):
	def __init__(self, *args, resolution_kind='address', **kwargs):
		super().__init__(*args, **kwargs)
		self.resolution_kind = resolution_kind

	async def get(self, url_path, *args):
		if url_path.startswith(f'statements/resolutions/{self.resolution_kind}?'):
			self.paths.append(url_path)
			return {'pagination': {'pageNumber': 1}}

		return await super().get(url_path, *args)


class NonDictResolutionConnector(FakeConnector):
	def __init__(self, *args, resolution_kind='address', **kwargs):
		super().__init__(*args, **kwargs)
		self.resolution_kind = resolution_kind

	async def get(self, url_path, *args):
		if url_path.startswith(f'statements/resolutions/{self.resolution_kind}?'):
			self.paths.append(url_path)
			return None

		return await super().get(url_path, *args)


class ResolutionConcurrencyConnector(FakeConnector):
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.active_resolution_requests = 0
		self.max_resolution_requests = 0
		self._resolution_requests_released = asyncio.Event()

	async def get(self, url_path, *args):
		if not url_path.startswith('statements/resolutions/'):
			return await super().get(url_path, *args)

		self.active_resolution_requests += 1
		self.max_resolution_requests = max(self.max_resolution_requests, self.active_resolution_requests)
		try:
			if self.active_resolution_requests == RESOLUTION_FETCH_CONCURRENCY:
				self._resolution_requests_released.set()
			await asyncio.wait_for(
				self._resolution_requests_released.wait(),
				CONCURRENCY_TEST_TIMEOUT_SECONDS)
			return await super().get(url_path, *args)
		finally:
			self.active_resolution_requests -= 1


class TransactionPageConcurrencyConnector(FakeConnector):  # pylint: disable=too-many-instance-attributes
	"""Tracks transaction-page overlap and deterministically gates individual pages."""

	def __init__(self, *args, gated_pages=(), failed_page=None, cleanup_failure_page=None, **kwargs):
		super().__init__(*args, **kwargs)
		self.failed_page = failed_page
		self.cleanup_failure_page = cleanup_failure_page
		self.page_release_events = {page: asyncio.Event() for page in gated_pages}
		self.page_started_events = {page: asyncio.Event() for page in gated_pages}
		self.page_completed_events = {page: asyncio.Event() for page in gated_pages}
		self.active_transaction_requests = 0
		self.max_transaction_requests = 0
		self.started_pages = []
		self.completed_pages = []
		self.cancelled_pages = []
		self.started_before_page_two_completion = []
		self.page_two_completed = False

	async def wait_for_started(self, *page_numbers):
		await asyncio.wait_for(
			asyncio.gather(*(self.page_started_events[page_number].wait() for page_number in page_numbers)),
			CONCURRENCY_TEST_TIMEOUT_SECONDS)

	async def wait_for_completed(self, *page_numbers):
		await asyncio.wait_for(
			asyncio.gather(*(self.page_completed_events[page_number].wait() for page_number in page_numbers)),
			CONCURRENCY_TEST_TIMEOUT_SECONDS)

	def release_page(self, page_number):
		self.page_release_events[page_number].set()

	async def fetch_serial_pages(self, fetch_operation, page_numbers):
		fetch_task = asyncio.create_task(fetch_operation())
		try:
			await self.wait_for_started(page_numbers[0])
			probe_event = asyncio.Event()
			# Give already-scheduled workers one event-loop turn while the first gated page is held.
			asyncio.get_running_loop().call_soon(probe_event.set)
			await asyncio.wait_for(probe_event.wait(), CONCURRENCY_TEST_TIMEOUT_SECONDS)
			for index, page_number in enumerate(page_numbers):
				self.release_page(page_number)
				await self.wait_for_completed(page_number)
				if index + 1 < len(page_numbers):
					await self.wait_for_started(page_numbers[index + 1])

			return await fetch_task
		finally:
			for page_number in page_numbers:
				self.release_page(page_number)
			if not fetch_task.done():
				fetch_task.cancel()
			await asyncio.gather(fetch_task, return_exceptions=True)

	async def get(self, url_path, *args):
		if not url_path.startswith('transactions/confirmed?'):
			return await super().get(url_path, *args)

		page_number = int(url_path.rsplit('&pageNumber=', 1)[1].split('&', 1)[0])
		self.started_pages.append(page_number)
		if not self.page_two_completed:
			self.started_before_page_two_completion.append(page_number)
		self.active_transaction_requests += 1
		self.max_transaction_requests = max(self.max_transaction_requests, self.active_transaction_requests)
		try:
			if page_number in self.page_started_events:
				self.page_started_events[page_number].set()
				await asyncio.wait_for(
					self.page_release_events[page_number].wait(),
					CONCURRENCY_TEST_TIMEOUT_SECONDS)
			if page_number == self.failed_page:
				raise ValueError(f'transaction page {page_number} failed')
			response = await super().get(url_path, *args)
			self.completed_pages.append(page_number)
			if page_number == 2:
				self.page_two_completed = True
			if page_number in self.page_completed_events:
				self.page_completed_events[page_number].set()

			return response
		except asyncio.CancelledError as cancellation_error:
			self.cancelled_pages.append(page_number)
			if page_number == self.cleanup_failure_page:
				raise RuntimeError(f'transaction page {page_number} cleanup failed') from cancellation_error
			raise
		finally:
			self.active_transaction_requests -= 1


def _create_transaction_pages(page_items_by_number, start_height=1, end_height=1):
	"""Creates only the explicitly supplied Symbol transaction page fixtures."""

	return {
		transaction_path(start_height, end_height, page_number): create_transaction_page(items, page_number)
		for page_number, items in page_items_by_number.items()
	}


def _create_transfer_items(count, height=1, first_index=1):
	return [
		create_node_transaction(
			height,
			transaction_hash=f'{first_index + index:064X}',
			transaction_id=f'transaction-{height}-{first_index + index}')
		for index in range(count)
	]


class FakeTransactionDatabase:
	def __init__(self):
		self.block_calls = []
		self.calls = []

	def __exit__(self, *_):
		return None

	def upsert_blocks(self, block_rows):
		self.block_calls.append(block_rows)

	def upsert_transactions_for_height(self, height, transaction_rows):
		self.calls.append((height, transaction_rows))

	def upsert_receipts_for_height(self, height, receipt_rows, block_reward):
		pass


class SymbolPullerTransactionSyncTest(SymbolPullerTestBase):
	def _assert_transaction_page_rejected(self, response, expected_count, error_message):
		# Arrange:
		connector = FakeConnector(1, {}, transactions_by_path={transaction_path(1, 1): response})
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(ValueError, error_message):
			asyncio.run(self.puller._get_transaction_rows_by_height(
				1, 1, 100, {1: TransactionCountExpectation(expected_count, expected_count)}, 1))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([transaction_path(1, 1)], connector.paths)

	def test_get_transaction_rows_by_height_requests_exact_pages_at_count_boundaries(self):
		# Arrange:
		cases = (
			(0, (1,)),
			(99, (1,)),
			(100, (1,)),
			(199, (1, 2)),
			(200, (1, 2)),
			(201, (1, 2, 3))
		)

		for expected_count, expected_page_numbers in cases:
			with self.subTest(expected_count=expected_count):
				items = _create_transfer_items(expected_count)
				page_items = {
					page_number: items[(page_number - 1) * MAX_PAGE_SIZE:page_number * MAX_PAGE_SIZE]
					for page_number in expected_page_numbers
				}
				connector = FakeConnector(
					1,
					{},
					transactions_by_path=_create_transaction_pages(page_items))
				set_symbol_connector(self.puller, connector)

				# Act:
				rows_by_height = asyncio.run(self.puller._get_transaction_rows_by_height(
					1, 1, 100, {1: TransactionCountExpectation(expected_count, expected_count)}, 1))  # pylint: disable=protected-access

				# Assert:
				self.assertEqual(len(expected_page_numbers), len(connector.paths))
				self.assertEqual(
					[transaction_path(1, 1, page_number) for page_number in expected_page_numbers],
					connector.paths)
				self.assertEqual(expected_count, len(rows_by_height.get(1, [])))

	def test_get_transaction_rows_by_height_rejects_page_number_mismatch(self):
		self._assert_transaction_page_rejected(
			{'data': [], 'pagination': {'pageNumber': 2, 'pageSize': MAX_PAGE_SIZE}},
			0,
			'page number')

	def test_get_transaction_rows_by_height_rejects_page_size_mismatch(self):
		self._assert_transaction_page_rejected(
			{'data': [], 'pagination': {'pageNumber': 1, 'pageSize': 99}},
			0,
			'page size')

	def test_get_transaction_rows_by_height_rejects_malformed_transaction_page_responses(self):
		# Arrange:
		cases = (
			('non-dict response', None, 'Malformed Symbol transaction page response'),
			('missing data', {
				'pagination': {'pageNumber': 1, 'pageSize': MAX_PAGE_SIZE}
			}, 'Malformed Symbol transaction page response'),
			('missing pagination', {'data': []}, 'Malformed Symbol transaction page response'),
			('non-list data', {
				'data': {}, 'pagination': {'pageNumber': 1, 'pageSize': MAX_PAGE_SIZE}
			}, 'Malformed Symbol transaction page response'),
			('non-dict pagination', {'data': [], 'pagination': []}, 'Malformed Symbol transaction page response'),
			('missing page number', {
				'data': [], 'pagination': {'pageSize': MAX_PAGE_SIZE}
			}, 'Malformed Symbol transaction pagination'),
			('missing page size', {
				'data': [], 'pagination': {'pageNumber': 1}
			}, 'Malformed Symbol transaction pagination'),
			('boolean page number', {
				'data': [], 'pagination': {'pageNumber': True, 'pageSize': MAX_PAGE_SIZE}
			}, 'Invalid Symbol transaction pagination'),
			('boolean page size', {
				'data': [], 'pagination': {'pageNumber': 1, 'pageSize': True}
			}, 'Invalid Symbol transaction pagination')
		)

		# Act / Assert:
		for case_name, response, error_message in cases:
			with self.subTest(case_name=case_name):
				self._assert_transaction_page_rejected(response, 0, error_message)

	def test_get_transaction_rows_by_height_rejects_non_dict_transaction_item(self):
		self._assert_transaction_page_rejected(
			{'data': [None], 'pagination': {'pageNumber': 1, 'pageSize': MAX_PAGE_SIZE}},
			1,
			'Malformed Symbol transaction item')

	def test_get_transaction_rows_by_height_rejects_short_intermediate_page(self):
		# Arrange:
		items = _create_transfer_items(MAX_PAGE_SIZE - 1)
		connector = FakeConnector(
			1,
			{},
			transactions_by_path=_create_transaction_pages({1: items}))
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(ValueError, 'Expected 100 transactions on Symbol transaction page 1'):
			asyncio.run(self.puller._get_transaction_rows_by_height(
				1, 1, 100, {1: TransactionCountExpectation(MAX_PAGE_SIZE + 1, MAX_PAGE_SIZE + 1)}, 1))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([transaction_path(1, 1)], connector.paths)

	def test_get_transaction_rows_by_height_rejects_page_larger_than_requested_page_size(self):
		# Arrange:
		items = _create_transfer_items(MAX_PAGE_SIZE + 1)
		connector = FakeConnector(
			1,
			{},
			transactions_by_path=_create_transaction_pages({1: items}))
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(ValueError, 'exceeds requested page size'):
			asyncio.run(self.puller._get_transaction_rows_by_height(
				1, 1, 100, {1: TransactionCountExpectation(MAX_PAGE_SIZE + 1, MAX_PAGE_SIZE + 1)}, 1))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([transaction_path(1, 1)], connector.paths)

	def test_get_transaction_rows_by_height_rejects_short_final_page(self):
		# Arrange:
		items = _create_transfer_items(MAX_PAGE_SIZE)
		pages = _create_transaction_pages({1: items})
		pages[transaction_path(1, 1, 2)] = {
			'data': [],
			'pagination': {'pageNumber': 2, 'pageSize': MAX_PAGE_SIZE}
		}
		connector = FakeConnector(1, {}, transactions_by_path=pages)
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(ValueError, 'Expected 1 transactions on Symbol transaction page 2'):
			asyncio.run(self.puller._get_transaction_rows_by_height(
				1, 1, 100, {1: TransactionCountExpectation(MAX_PAGE_SIZE + 1, MAX_PAGE_SIZE + 1)}, 1))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([
			transaction_path(1, 1),
			transaction_path(1, 1, 2)
		], connector.paths)

	def test_get_transaction_rows_by_height_rejects_extra_final_page_items(self):
		# Arrange:
		items = _create_transfer_items(MAX_PAGE_SIZE + 2)
		pages = _create_transaction_pages({
			1: items[:MAX_PAGE_SIZE],
			2: items[MAX_PAGE_SIZE:]
		})
		pages[transaction_path(1, 1, 2)]['data'].append(create_node_transaction(
			1, transaction_hash='F' * 64, transaction_id='extra'))
		connector = FakeConnector(1, {}, transactions_by_path=pages)
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(ValueError, 'Expected 2 transactions on Symbol transaction page 2'):
			asyncio.run(self.puller._get_transaction_rows_by_height(
				1, 1, 100, {1: TransactionCountExpectation(MAX_PAGE_SIZE + 2, MAX_PAGE_SIZE + 2)}, 1))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([
			transaction_path(1, 1),
			transaction_path(1, 1, 2)
		], connector.paths)

	def test_get_transaction_rows_by_height_restores_page_order_after_reverse_completion(self):
		# Arrange:
		items = _create_transfer_items(MAX_PAGE_SIZE * 3 + 1)
		connector = TransactionPageConcurrencyConnector(
			1,
			{},
			transactions_by_path=_create_transaction_pages({
				1: items[:MAX_PAGE_SIZE],
				2: items[MAX_PAGE_SIZE:MAX_PAGE_SIZE * 2],
				3: items[MAX_PAGE_SIZE * 2:MAX_PAGE_SIZE * 3],
				4: items[MAX_PAGE_SIZE * 3:]
			}),
			gated_pages=(2, 3, 4))
		set_symbol_connector(self.puller, connector)

		# Act:
		async def fetch_in_reverse_completion_order():
			fetch_task = asyncio.create_task(self.puller._get_transaction_rows_by_height(
				1, 1, 100, {1: TransactionCountExpectation(MAX_PAGE_SIZE * 3 + 1, MAX_PAGE_SIZE * 3 + 1)}, 1))  # pylint: disable=protected-access
			await connector.wait_for_started(2, 3, 4)
			for page_number in (4, 3, 2):
				connector.release_page(page_number)
				await connector.wait_for_completed(page_number)

			return await fetch_task

		rows_by_height = asyncio.run(fetch_in_reverse_completion_order())

		# Assert:
		self.assertEqual([4, 3, 2], [page for page in connector.completed_pages if page > 1])
		self.assertEqual(
			[bytes.fromhex(f'{index:064X}') for index in range(1, MAX_PAGE_SIZE * 3 + 2)],
			[row['hash'] for row in rows_by_height[1]])

	def test_get_transaction_rows_by_height_keeps_parallel_workers_bounded_and_reuses_free_workers(self):
		# Arrange:
		items = _create_transfer_items(MAX_PAGE_SIZE * 12)
		connector = TransactionPageConcurrencyConnector(
			1,
			{},
			transactions_by_path=_create_transaction_pages({
				1: items[:MAX_PAGE_SIZE],
				2: items[MAX_PAGE_SIZE:MAX_PAGE_SIZE * 2],
				3: items[MAX_PAGE_SIZE * 2:MAX_PAGE_SIZE * 3],
				4: items[MAX_PAGE_SIZE * 3:MAX_PAGE_SIZE * 4],
				5: items[MAX_PAGE_SIZE * 4:MAX_PAGE_SIZE * 5],
				6: items[MAX_PAGE_SIZE * 5:MAX_PAGE_SIZE * 6],
				7: items[MAX_PAGE_SIZE * 6:MAX_PAGE_SIZE * 7],
				8: items[MAX_PAGE_SIZE * 7:MAX_PAGE_SIZE * 8],
				9: items[MAX_PAGE_SIZE * 8:MAX_PAGE_SIZE * 9],
				10: items[MAX_PAGE_SIZE * 9:MAX_PAGE_SIZE * 10],
				11: items[MAX_PAGE_SIZE * 10:MAX_PAGE_SIZE * 11],
				12: items[MAX_PAGE_SIZE * 11:MAX_PAGE_SIZE * 12]
			}),
			gated_pages=range(2, 13))
		set_symbol_connector(self.puller, connector)

		# Act:
		async def fetch_with_reused_worker():
			fetch_task = asyncio.create_task(self.puller._get_transaction_rows_by_height(
				1, 1, 100, {1: TransactionCountExpectation(MAX_PAGE_SIZE * 12, MAX_PAGE_SIZE * 12)}, 1))  # pylint: disable=protected-access
			await connector.wait_for_started(*range(2, 12))
			connector.release_page(11)
			await connector.wait_for_started(12)
			for page_number in range(3, 13):
				connector.release_page(page_number)
			connector.release_page(2)

			return await fetch_task

		rows_by_height = asyncio.run(fetch_with_reused_worker())

		# Assert:
		self.assertEqual(TRANSACTION_PAGE_FETCH_CONCURRENCY, connector.max_transaction_requests)
		self.assertEqual(list(range(2, 13)), sorted(page for page in connector.started_pages if page > 1))
		self.assertEqual(True, 11 in connector.started_before_page_two_completion)
		self.assertEqual(MAX_PAGE_SIZE * 12, len(rows_by_height[1]))

	def test_get_transaction_rows_by_height_uses_serial_pages_after_finalized_boundary(self):
		# Arrange:
		items = _create_transfer_items(MAX_PAGE_SIZE * 3)
		pages = _create_transaction_pages({
			1: items[:MAX_PAGE_SIZE],
			2: items[MAX_PAGE_SIZE:MAX_PAGE_SIZE * 2],
			3: items[MAX_PAGE_SIZE * 2:MAX_PAGE_SIZE * 3]
		})
		pages[transaction_path(1, 1, 4)] = create_transaction_page([], 4)
		connector = TransactionPageConcurrencyConnector(
			1,
			{},
			transactions_by_path=pages,
			gated_pages=(2, 3, 4))
		set_symbol_connector(self.puller, connector)

		# Act:
		async def fetch_rows():
			return await self.puller._get_transaction_rows_by_height(
				1, 1, 100, {1: TransactionCountExpectation(MAX_PAGE_SIZE * 3, MAX_PAGE_SIZE * 3)}, 0)  # pylint: disable=protected-access

		rows_by_height = asyncio.run(connector.fetch_serial_pages(fetch_rows, (2, 3, 4)))

		# Assert:
		self.assertEqual(1, connector.max_transaction_requests)
		self.assertEqual([1, 2], connector.started_before_page_two_completion)
		self.assertEqual([1, 2, 3, 4], connector.started_pages)
		self.assertEqual([1, 2, 3, 4], connector.completed_pages)
		self.assertEqual(MAX_PAGE_SIZE * 3, len(rows_by_height[1]))

	def test_get_transaction_rows_by_height_uses_parallel_pages_at_finalized_end_height(self):
		# Arrange:
		items = _create_transfer_items(MAX_PAGE_SIZE * 3)
		connector = TransactionPageConcurrencyConnector(
			1,
			{},
			transactions_by_path=_create_transaction_pages({
				1: items[:MAX_PAGE_SIZE],
				2: items[MAX_PAGE_SIZE:MAX_PAGE_SIZE * 2],
				3: items[MAX_PAGE_SIZE * 2:]
			}),
			gated_pages=(2, 3))
		set_symbol_connector(self.puller, connector)

		# Act:
		async def fetch_after_finalized_page_one():
			fetch_task = asyncio.create_task(self.puller._get_transaction_rows_by_height(
				1, 1, 100, {1: TransactionCountExpectation(MAX_PAGE_SIZE * 3, MAX_PAGE_SIZE * 3)}, 1))  # pylint: disable=protected-access
			await connector.wait_for_started(2, 3)
			connector.release_page(2)
			connector.release_page(3)
			return await fetch_task

		asyncio.run(fetch_after_finalized_page_one())

		# Assert:
		self.assertEqual(2, connector.max_transaction_requests)

	def test_get_transaction_rows_by_height_uses_serial_pages_when_finalized_height_is_unavailable(self):
		# Arrange:
		items = _create_transfer_items(MAX_PAGE_SIZE * 3)
		pages = _create_transaction_pages({
			1: items[:MAX_PAGE_SIZE],
			2: items[MAX_PAGE_SIZE:MAX_PAGE_SIZE * 2],
			3: items[MAX_PAGE_SIZE * 2:MAX_PAGE_SIZE * 3]
		})
		pages[transaction_path(1, 1, 4)] = create_transaction_page([], 4)
		connector = TransactionPageConcurrencyConnector(
			1,
			{},
			transactions_by_path=pages,
			gated_pages=(2, 3, 4))
		set_symbol_connector(self.puller, connector)

		# Act:
		async def fetch_rows():
			return await self.puller._get_transaction_rows_by_height(
				1, 1, 100, {1: TransactionCountExpectation(MAX_PAGE_SIZE * 3, MAX_PAGE_SIZE * 3)}, None)  # pylint: disable=protected-access

		asyncio.run(connector.fetch_serial_pages(fetch_rows, (2, 3, 4)))

		# Assert:
		self.assertEqual(1, connector.max_transaction_requests)
		self.assertEqual([1, 2], connector.started_before_page_two_completion)
		self.assertEqual([1, 2, 3, 4], connector.started_pages)
		self.assertEqual([1, 2, 3, 4], connector.completed_pages)

	def test_get_transaction_rows_by_height_uses_serial_pages_when_finalized_height_is_invalid(self):
		# Arrange:
		items = _create_transfer_items(MAX_PAGE_SIZE * 3)
		pages = _create_transaction_pages({
			1: items[:MAX_PAGE_SIZE],
			2: items[MAX_PAGE_SIZE:MAX_PAGE_SIZE * 2],
			3: items[MAX_PAGE_SIZE * 2:]
		})
		pages[transaction_path(1, 1, 4)] = create_transaction_page([], 4)
		connector = TransactionPageConcurrencyConnector(
			1,
			{},
			transactions_by_path=pages,
			gated_pages=(2, 3, 4))
		set_symbol_connector(self.puller, connector)

		# Act:
		async def fetch_rows():
			return await self.puller._get_transaction_rows_by_height(
				1, 1, 100, {1: TransactionCountExpectation(MAX_PAGE_SIZE * 3, MAX_PAGE_SIZE * 3)}, True)  # pylint: disable=protected-access

		rows_by_height = asyncio.run(connector.fetch_serial_pages(fetch_rows, (2, 3, 4)))

		# Assert:
		self.assertEqual(1, connector.max_transaction_requests)
		self.assertEqual([1, 2], connector.started_before_page_two_completion)
		self.assertEqual([1, 2, 3, 4], connector.started_pages)
		self.assertEqual([1, 2, 3, 4], connector.completed_pages)
		self.assertEqual(MAX_PAGE_SIZE * 3, len(rows_by_height[1]))

	def test_get_transaction_rows_by_height_uses_serial_pages_when_range_straddles_finalized_height(self):
		# Arrange:
		items = _create_transfer_items(MAX_PAGE_SIZE, height=1)
		items.extend(_create_transfer_items(MAX_PAGE_SIZE + 1, height=2, first_index=MAX_PAGE_SIZE + 1))
		connector = TransactionPageConcurrencyConnector(
			2,
			{},
			transactions_by_path=_create_transaction_pages({
				1: items[:MAX_PAGE_SIZE],
				2: items[MAX_PAGE_SIZE:MAX_PAGE_SIZE * 2],
				3: items[MAX_PAGE_SIZE * 2:]
			}, 1, 2),
			gated_pages=(2, 3))
		set_symbol_connector(self.puller, connector)

		# Act:
		async def fetch_rows():
			return await self.puller._get_transaction_rows_by_height(
				1, 2, 100, {
					1: TransactionCountExpectation(MAX_PAGE_SIZE, MAX_PAGE_SIZE),
					2: TransactionCountExpectation(MAX_PAGE_SIZE + 1, MAX_PAGE_SIZE + 1)
				}, 1)  # pylint: disable=protected-access

		rows_by_height = asyncio.run(connector.fetch_serial_pages(fetch_rows, (2, 3)))

		# Assert:
		self.assertEqual([1, 2], connector.started_before_page_two_completion)
		self.assertEqual(1, connector.max_transaction_requests)
		self.assertEqual([1, 2, 3], connector.started_pages)
		self.assertEqual([1, 2, 3], connector.completed_pages)
		self.assertEqual([
			transaction_path(1, 2),
			transaction_path(1, 2, 2),
			transaction_path(1, 2, 3)
		], connector.paths)
		self.assertEqual([1, 2], list(rows_by_height))
		self.assertEqual(MAX_PAGE_SIZE, len(rows_by_height[1]))
		self.assertEqual(MAX_PAGE_SIZE + 1, len(rows_by_height[2]))
		self.assertEqual(
			[bytes.fromhex(f'{index:064X}') for index in range(1, MAX_PAGE_SIZE * 2 + 2)],
			[row['hash'] for height in (1, 2) for row in rows_by_height[height]])

	def test_get_transaction_rows_by_height_preserves_parallel_page_failure_and_cancels_workers(self):
		# Arrange:
		items = _create_transfer_items(MAX_PAGE_SIZE * 2 + 1)
		connector = TransactionPageConcurrencyConnector(
			1,
			{},
			transactions_by_path=_create_transaction_pages({
				1: items[:MAX_PAGE_SIZE],
				2: items[MAX_PAGE_SIZE:MAX_PAGE_SIZE * 2],
				3: items[MAX_PAGE_SIZE:]
			}),
			gated_pages=(2, 3),
			failed_page=2,
			cleanup_failure_page=3)
		set_symbol_connector(self.puller, connector)

		# Act:
		async def fetch_with_failed_page():
			fetch_task = asyncio.create_task(self.puller._get_transaction_rows_by_height(
				1, 1, 100, {1: TransactionCountExpectation(MAX_PAGE_SIZE * 2 + 1, MAX_PAGE_SIZE * 2 + 1)}, 1))  # pylint: disable=protected-access
			await connector.wait_for_started(2, 3)
			connector.release_page(2)
			return await fetch_task

		with self.assertRaisesRegex(ValueError, 'transaction page 2 failed'):
			asyncio.run(fetch_with_failed_page())

		# Assert:
		self.assertEqual([2, 3], sorted(page for page in connector.started_pages if page > 1))
		self.assertEqual([3], connector.cancelled_pages)
		self.assertEqual(0, connector.active_transaction_requests)

	def test_get_transaction_rows_by_height_propagates_external_cancellation_after_worker_cleanup(self):
		# Arrange:
		items = _create_transfer_items(MAX_PAGE_SIZE * 2 + 1)
		connector = TransactionPageConcurrencyConnector(
			1,
			{},
			transactions_by_path=_create_transaction_pages({
				1: items[:MAX_PAGE_SIZE],
				2: items[MAX_PAGE_SIZE:MAX_PAGE_SIZE * 2],
				3: items[MAX_PAGE_SIZE * 2:]
			}),
			gated_pages=(2, 3))
		set_symbol_connector(self.puller, connector)

		# Act:
		async def cancel_fetch():
			fetch_task = asyncio.create_task(self.puller._get_transaction_rows_by_height(
				1, 1, 100, {1: TransactionCountExpectation(MAX_PAGE_SIZE * 2 + 1, MAX_PAGE_SIZE * 2 + 1)}, 1))  # pylint: disable=protected-access
			await connector.wait_for_started(2, 3)
			fetch_task.cancel()
			with self.assertRaises(asyncio.CancelledError):
				await fetch_task

		asyncio.run(cancel_fetch())

		# Assert:
		self.assertEqual([2, 3], sorted(connector.cancelled_pages))
		self.assertEqual(0, connector.active_transaction_requests)

	def test_get_transaction_rows_by_height_rejects_transaction_duplicates(self):
		# Arrange:
		duplicate = create_node_transaction(1, transaction_hash='A' * 64, transaction_id='duplicate')
		items = [duplicate, {**duplicate, 'id': 'duplicate-copy'}]
		connector = FakeConnector(1, {}, transactions_by_path=_create_transaction_pages({1: items}))
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(ValueError, 'Duplicate Symbol transaction'):
			asyncio.run(self.puller._get_transaction_rows_by_height(
				1, 1, 100, {1: TransactionCountExpectation(2, 2)}, 1))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(transaction_path(1, 1), connector.paths[-1])

	def test_get_transaction_rows_by_height_rejects_embedded_transaction_duplicates(self):
		# Arrange:
		aggregate_hash = 'A' * 64
		duplicate = create_embedded_node_transaction(1, aggregate_hash, 0, 'embedded-1')
		items = [duplicate, {**duplicate, 'id': 'embedded-2'}]
		connector = FakeConnector(1, {}, transactions_by_path=_create_transaction_pages({1: items}))
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(ValueError, 'Duplicate Symbol transaction'):
			asyncio.run(self.puller._get_transaction_rows_by_height(
				1, 1, 100, {1: TransactionCountExpectation(2, 2)}, 1))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([transaction_path(1, 1)], connector.paths)

	def test_get_transaction_rows_by_height_rejects_out_of_range_transaction_height(self):
		# Arrange:
		connector = FakeConnector(1, {}, transactions_by_path=_create_transaction_pages({1: [create_node_transaction(2)]}))
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(ValueError, 'outside requested range'):
			asyncio.run(self.puller._get_transaction_rows_by_height(
				1, 1, 100, {1: TransactionCountExpectation(1, 1)}, 1))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([transaction_path(1, 1)], connector.paths)

	def test_get_transaction_rows_by_height_accepts_interleaved_transaction_heights(self):
		# Arrange:
		items = [
			create_node_transaction(2, transaction_hash='B' * 64, transaction_id='height-2-first'),
			create_node_transaction(1, transaction_hash='A' * 64, transaction_id='height-1-first'),
			create_node_transaction(2, transaction_hash='D' * 64, transaction_id='height-2-second'),
			create_node_transaction(1, transaction_hash='C' * 64, transaction_id='height-1-second')
		]
		connector = FakeConnector(2, {}, transactions_by_path=_create_transaction_pages({1: items}, 1, 2))
		set_symbol_connector(self.puller, connector)

		# Act:
		rows_by_height = asyncio.run(self.puller._get_transaction_rows_by_height(
			1, 2, 100, {
				1: TransactionCountExpectation(2, 2),
				2: TransactionCountExpectation(2, 2)
			}, 2))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([2, 1], list(rows_by_height))
		self.assertEqual(
			[bytes.fromhex('B' * 64), bytes.fromhex('D' * 64)],
			[row['hash'] for row in rows_by_height[2]])
		self.assertEqual(
			[bytes.fromhex('A' * 64), bytes.fromhex('C' * 64)],
			[row['hash'] for row in rows_by_height[1]])

	def test_cancel_transaction_page_workers_awaits_cleanup_when_cancelled(self):
		async def run_cancelled_cleanup():
			# Arrange:
			worker_cancelled = asyncio.Event()
			release_worker = asyncio.Event()

			async def worker_body():
				try:
					await asyncio.wait_for(asyncio.Event().wait(), CONCURRENCY_TEST_TIMEOUT_SECONDS)
				except asyncio.CancelledError:
					worker_cancelled.set()
					await asyncio.wait_for(release_worker.wait(), CONCURRENCY_TEST_TIMEOUT_SECONDS)
					raise

			worker = asyncio.create_task(worker_body())
			cleanup_task = asyncio.create_task(self.puller._cancel_transaction_page_workers([worker]))  # pylint: disable=protected-access
			await asyncio.wait_for(worker_cancelled.wait(), CONCURRENCY_TEST_TIMEOUT_SECONDS)

			# Act:
			cleanup_task.cancel()
			release_worker.set()
			await cleanup_task

			# Assert:
			return worker.done()

		# Act:
		cleanup_completed = asyncio.run(run_cancelled_cleanup())

		# Assert:
		self.assertEqual(True, cleanup_completed)

	def test_get_transaction_rows_by_height_stops_after_short_page_when_unfinalized(self):
		# Arrange:
		connector = FakeConnector(1, {}, transactions_by_path={
			transaction_path(1, 1): create_transaction_page([create_node_transaction(1)])
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		rows_by_height = asyncio.run(self.puller._get_transaction_rows_by_height(
			1, 1, 100, {1: TransactionCountExpectation(1, 1)}, 0))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([transaction_path(1, 1)], connector.paths)
		self.assertEqual([1], list(rows_by_height.keys()))
		self.assertEqual(1, len(rows_by_height[1]))

	def test_get_transaction_rows_by_height_uses_empty_terminator_for_unfinalized_exact_multiples(self):
		# Arrange:
		cases = (
			(100, (1, 2)),
			(200, (1, 2, 3))
		)

		for expected_count, expected_page_numbers in cases:
			with self.subTest(expected_count=expected_count):
				items = _create_transfer_items(expected_count)
				page_items = {
					page_number: items[(page_number - 1) * MAX_PAGE_SIZE:page_number * MAX_PAGE_SIZE]
					for page_number in expected_page_numbers
				}
				connector = FakeConnector(
					1,
					{},
					transactions_by_path=_create_transaction_pages(page_items))
				set_symbol_connector(self.puller, connector)

				# Act:
				rows_by_height = asyncio.run(self.puller._get_transaction_rows_by_height(
					1, 1, 100, {1: TransactionCountExpectation(expected_count, expected_count)}, 0))  # pylint: disable=protected-access

				# Assert:
				self.assertEqual(len(expected_page_numbers), len(connector.paths))
				self.assertEqual(
					[transaction_path(1, 1, page_number) for page_number in expected_page_numbers],
					connector.paths)
				self.assertEqual(expected_count, len(rows_by_height[1]))

	def test_get_transaction_rows_by_height_continues_after_full_page(self):
		# Arrange:
		first_page = [
			create_node_transaction(1, transaction_hash=f'{index:064X}', transaction_id=f'transaction-{index}')
			for index in range(MAX_PAGE_SIZE)
		]
		connector = FakeConnector(1, {}, transactions_by_path={
			transaction_path(1, 1): create_transaction_page(first_page),
			transaction_path(1, 1, 2): create_transaction_page([
				create_node_transaction(1, transaction_hash='F' * 64, transaction_id='last')], 2)
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		rows_by_height = asyncio.run(self.puller._get_transaction_rows_by_height(
			1, 1, 100, {1: TransactionCountExpectation(MAX_PAGE_SIZE + 1, MAX_PAGE_SIZE + 1)}, 1))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([
			transaction_path(1, 1),
			transaction_path(1, 1, 2)
		], connector.paths)
		self.assertEqual(MAX_PAGE_SIZE + 1, len(rows_by_height[1]))

	def test_get_transaction_rows_by_height_groups_rows_across_page_boundaries(self):
		# Arrange:
		aggregate_hash = 'A' * 64
		first_page = [
			create_node_transaction(1, transaction_hash=f'{index:064X}', transaction_id=f'height-1-{index}')
			for index in range(MAX_PAGE_SIZE - 1)
		]
		first_page.append(create_node_transaction(
			2,
			transaction_hash=aggregate_hash,
			transaction_id='aggregate',
			type=16705,
			transactionsHash='9' * 64,
			cosignatures=[]
		))
		second_page = [
			create_embedded_node_transaction(2, aggregate_hash, 0, 'embedded'),
			create_node_transaction(3, transaction_hash='C' * 64, transaction_id='height-3')
		]
		connector = FakeConnector(3, {}, transactions_by_path={
			transaction_path(1, 3): create_transaction_page(first_page),
			transaction_path(1, 3, 2): create_transaction_page(second_page, 2)
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		rows_by_height = asyncio.run(self.puller._get_transaction_rows_by_height(
			1, 3, 100, {
				1: TransactionCountExpectation(MAX_PAGE_SIZE - 1, MAX_PAGE_SIZE - 1),
				2: TransactionCountExpectation(1, 2),
				3: TransactionCountExpectation(1, 1)
			}, 3))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([1, 2, 3], sorted(rows_by_height.keys()))
		self.assertEqual(MAX_PAGE_SIZE - 1, len(rows_by_height[1]))
		self.assertEqual([
			(bytes.fromhex('A' * 64), None, None),
			(None, bytes.fromhex('A' * 64), 0)
		], [(row['hash'], row['aggregate_hash'], row['embedded_index']) for row in rows_by_height[2]])
		self.assertEqual([
			(bytes.fromhex('C' * 64), None, None)
		], [(row['hash'], row['aggregate_hash'], row['embedded_index']) for row in rows_by_height[3]])

	def test_get_transaction_rows_by_height_rejects_top_level_count_mismatch(self):
		# Arrange:
		items = [
			create_node_transaction(1, transaction_hash='A' * 64),
			create_node_transaction(1, transaction_hash='B' * 64)
		]
		connector = FakeConnector(1, {}, transactions_by_path=_create_transaction_pages({1: items}))
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(ValueError, 'Expected 1 top-level Symbol transactions at height 1, received 2'):
			asyncio.run(self.puller._get_transaction_rows_by_height(
				1, 1, 100, {1: TransactionCountExpectation(1, 2)}, 1))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([transaction_path(1, 1)], connector.paths)

	def test_get_transaction_rows_by_height_rejects_total_count_mismatch_after_top_level_match(self):
		# Arrange:
		aggregate_hash = 'B' * 64
		items = [
			create_node_transaction(1, transaction_hash='A' * 64),
			create_embedded_node_transaction(2, aggregate_hash, 0, 'embedded-0'),
			create_embedded_node_transaction(2, aggregate_hash, 1, 'embedded-1')
		]
		connector = FakeConnector(2, {}, transactions_by_path=_create_transaction_pages({1: items}, 1, 2))
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(ValueError, 'Expected 2 total Symbol transactions at height 1, received 1'):
			asyncio.run(self.puller._get_transaction_rows_by_height(
				1, 2, 100, {
					1: TransactionCountExpectation(1, 2),
					2: TransactionCountExpectation(0, 1)
				}, 2))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([transaction_path(1, 2)], connector.paths)

	def test_get_transaction_rows_by_height_rejects_height_composition_swap(self):
		# Arrange:
		items = [
			create_embedded_node_transaction(1, 'A' * 64, 0, 'embedded-height-1'),
			create_node_transaction(2, transaction_hash='B' * 64, transaction_id='top-level-height-2')
		]
		connector = FakeConnector(2, {}, transactions_by_path=_create_transaction_pages({1: items}, 1, 2))
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(ValueError, 'Expected 1 top-level Symbol transactions at height 1, received 0'):
			asyncio.run(self.puller._get_transaction_rows_by_height(
				1, 2, 100, {
					1: TransactionCountExpectation(1, 1),
					2: TransactionCountExpectation(0, 1)
				}, 2))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([transaction_path(1, 2)], connector.paths)

	def test_sync_block_batch_calls_upsert_for_every_height_even_without_transactions(self):
		# Arrange: height 2 has no transactions, but must still be passed to upsert_transactions_for_height
		# so that any stale data from a previously-synced (since-replaced) block at that height is cleared.
		# See test_upsert_transactions_for_height_clears_existing_rows_when_replaced_with_empty_list.
		transaction_database = FakeTransactionDatabase()
		self.puller.symbol_db = transaction_database
		block_rows = [{'height': 1}, {'height': 2}, {'height': 3}]
		transaction_rows_by_height = {
			1: [{'hash': bytes.fromhex(f'{1:064X}')}],
			3: [{'hash': bytes.fromhex('C' * 64)}]
		}

		# Act:
		self.puller._sync_block_batch(block_rows, transaction_rows_by_height, {})  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([
			(1, [bytes.fromhex(f'{1:064X}')]),
			(2, []),
			(3, [bytes.fromhex('C' * 64)])
		], [
			(height, [row['hash'] for row in transaction_rows])
			for height, transaction_rows in transaction_database.calls
		])

	def test_sync_block_batch_writes_previously_fetched_transactions_for_exact_batch_rows(self):
		# Arrange:
		transaction_database = FakeTransactionDatabase()
		self.puller.symbol_db = transaction_database
		block_rows = [{'height': 10}, {'height': 11}, {'height': 12}]
		transaction_rows_by_height = {
			10: [{'hash': bytes.fromhex('A' * 64)}],
			12: [{'hash': bytes.fromhex('C' * 64)}]
		}

		# Act:
		self.puller._sync_block_batch(block_rows, transaction_rows_by_height, {})  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([block_rows], transaction_database.block_calls)
		self.assertEqual([
			(10, [bytes.fromhex('A' * 64)]),
			(11, []),
			(12, [bytes.fromhex('C' * 64)])
		], [
			(height, [row['hash'] for row in transaction_rows])
			for height, transaction_rows in transaction_database.calls
		])

	def test_sync_block_headers_keeps_existing_watermark_when_transaction_fetch_fails(self):
		# Arrange:
		connector = FakeConnector(
			2,
			{1: [create_node_block(2)]},
			{1: create_node_block(1)},
			transactions_by_path={
				transaction_path(2, 2): ValueError('transaction fetch failed')
			}
		)
		self._seed_blocks(self.puller.symbol_db, [1])
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=1,
			last_synced_height=1,
			last_synced_block_hash=bytes.fromhex(f'{1:064X}')
		))
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(ValueError, 'transaction fetch failed'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		sync_state = self.puller.symbol_db.get_sync_state()

		self.assertEqual(1, sync_state['last_synced_height'])
		self.assertEqual(bytes.fromhex(f'{1:064X}'), bytes(sync_state['last_synced_block_hash']))

	def test_sync_block_headers_rejects_top_level_transaction_count_mismatch_before_related_fetches(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=2)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([
					create_node_transaction(1, transaction_hash='A' * 64),
					create_node_transaction(1, transaction_hash='B' * 64)
				])
			})
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(ValueError, 'Expected 1 top-level Symbol transactions at height 1, received 2'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([], self._fetch_block_heights(self.puller.symbol_db))
		self.assertIsNone(self.puller.symbol_db.get_sync_state())
		self.assertEqual([], [path for path in connector.paths if path.startswith('statements/')])
		self.assertEqual([], [path for path in connector.paths if path.startswith('statements/resolutions/')])
		self.assertEqual([], [path for path in connector.paths if path.startswith('account')])
		self.assertEqual([], [path for path in connector.paths if path.startswith('accounts')])
		self.assertTrue(all(not rows for rows in self._fetch_complete_batch_state().values()))

	def test_sync_block_headers_rejects_transaction_count_mismatch_before_related_fetches(self):
		# Arrange:
		items = _create_transfer_items(MAX_PAGE_SIZE)
		connector = FakeConnector(
			1,
			{0: [create_node_block(
				1,
				transactions_count=MAX_PAGE_SIZE,
				total_transactions_count=MAX_PAGE_SIZE)]},
			finalized_height=0,
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page(items),
				transaction_path(1, 1, 2): create_transaction_page([
					create_node_transaction(1, transaction_hash='E' * 64, transaction_id='extra')
				], 2)
			})
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(ValueError, 'Expected 100 Symbol transactions, received 101'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([], self._fetch_block_heights(self.puller.symbol_db))
		self.assertIsNone(self.puller.symbol_db.get_sync_state())
		self.assertEqual([], [path for path in connector.paths if path.startswith('statements/')])
		self.assertEqual([], [path for path in connector.paths if path.startswith('account')])
		self.assertEqual([], [path for path in connector.paths if path.startswith('accounts')])

	def test_sync_block_headers_rejects_transaction_count_deficit_after_unfinalized_terminator(self):
		# Arrange:
		items = _create_transfer_items(MAX_PAGE_SIZE)
		connector = FakeConnector(
			1,
			{0: [create_node_block(
				1,
				transactions_count=MAX_PAGE_SIZE + 1,
				total_transactions_count=MAX_PAGE_SIZE + 1)]},
			finalized_height=0,
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page(items),
				transaction_path(1, 1, 2): create_transaction_page([], 2)
			})
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(ValueError, 'Expected 101 Symbol transactions, received 100'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([
			transaction_path(1, 1),
			transaction_path(1, 1, 2)
		], connector.paths[-2:])
		self.assertEqual([], self._fetch_block_heights(self.puller.symbol_db))
		self.assertIsNone(self.puller.symbol_db.get_sync_state())


class SymbolPullerTransactionAliasResolutionTest(SymbolPullerTestBase):
	def _fetch_transaction_resolution_state(self):
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'''
			SELECT encode(transaction.hash, 'hex'), encode(transaction.aggregate_hash, 'hex'), transaction.embedded_index,
				encode(transaction.recipient_address, 'hex'), encode(transaction.target_address, 'hex'),
				address.role, encode(address.address, 'hex')
			FROM symbol_transactions transaction
			JOIN symbol_transaction_addresses address ON address.transaction_id = transaction.id
			ORDER BY transaction.is_embedded, transaction.hash, transaction.embedded_index, address.role, address.address
			''')

		return cursor.fetchall()

	@staticmethod
	def _resolution_paths(connector):
		return [path for path in connector.paths if path.startswith('statements/resolutions/')]

	def test_sync_block_headers_selects_top_level_resolution_entry_from_block_index(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=2, total_transactions_count=2)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([
					create_node_transaction(
						1,
						transaction_hash='A' * 64,
						transaction_id='transaction-1-index-0',
						block_index=0),
					create_node_transaction(
						1,
						transaction_hash='B' * 64,
						transaction_id='transaction-1-index-1',
						block_index=1,
						recipientAddress=ALIAS_ADDRESS)
				])
			},
			address_resolutions_by_height={
				1: [create_resolution_statement(
					1,
					ALIAS_ADDRESS,
					[
						_resolution_entry(1, 0, DECOY_RESOLVED_ADDRESS),
						_resolution_entry(2, 0, RESOLVED_ADDRESS)
					])]
			})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'''
			SELECT encode(transaction.recipient_address, 'hex'), encode(address.address, 'hex'), address.role
			FROM symbol_transactions transaction
			JOIN symbol_transaction_addresses address ON address.transaction_id = transaction.id
			WHERE transaction.hash = decode(%s, 'hex') AND address.role = 'recipient'
			''', ('B' * 64,))
		self.assertEqual((RESOLVED_ADDRESS.lower(), RESOLVED_ADDRESS.lower(), 'recipient'), cursor.fetchone())
		self.assertEqual([resolution_path('address', 1)], self._resolution_paths(connector))

	def test_sync_block_headers_resolves_embedded_metadata_target_address_from_parent_source(self):
		# Arrange:
		aggregate_hash = 'A' * 64
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=2)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([
					create_node_transaction(
						1,
						transaction_hash=aggregate_hash,
						block_index=0,
						type=TransactionType.AGGREGATE_COMPLETE.value,
						transactionsHash='9' * 64,
						cosignatures=[]),
					create_embedded_node_transaction(
						1,
						aggregate_hash,
						0,
						type=TransactionType.ACCOUNT_METADATA.value,
						targetAddress=ALIAS_ADDRESS,
						targetPublicKey='0' * 64,
						scopedMetadataKey='0000000000000001',
						valueSizeDelta=1,
						value='AA')
				])
			},
			address_resolutions_by_height={
				1: [create_resolution_statement(
					1,
					ALIAS_ADDRESS,
					[
						_resolution_entry(1, 0, DECOY_RESOLVED_ADDRESS),
						_resolution_entry(1, 1, RESOLVED_ADDRESS)
					])]
			})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'''
			SELECT encode(transaction.target_address, 'hex'), encode(address.address, 'hex'), address.role
			FROM symbol_transactions transaction
			JOIN symbol_transaction_addresses address ON address.transaction_id = transaction.id
			WHERE transaction.is_embedded
				AND transaction.aggregate_hash = decode('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'hex')
				AND transaction.embedded_index = 0
				AND address.role = 'target'
			''')
		self.assertEqual((RESOLVED_ADDRESS.lower(), RESOLVED_ADDRESS.lower(), 'target'), cursor.fetchone())
		self.assertEqual([resolution_path('address', 1)], self._resolution_paths(connector))

	def test_sync_block_headers_resolves_alias_mosaic_without_fetching_address_resolutions(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([create_node_transaction(
					1,
					mosaics=[{'id': ALIAS_MOSAIC_ID, 'amount': '123'}])])
			},
			mosaic_resolutions_by_height={
				1: [create_resolution_statement(
					1,
					ALIAS_MOSAIC_ID,
					[_resolution_entry(1, 0, RESOLVED_MOSAIC_ID)])]
			})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT mosaic_id, amount, role FROM symbol_transaction_mosaics')
		self.assertEqual((RESOLVED_MOSAIC_ID, 123, 'transfer'), cursor.fetchone())
		self.assertEqual([resolution_path('mosaic', 1)], self._resolution_paths(connector))

	def test_sync_block_headers_resolves_address_and_mosaic_aliases_from_same_transaction(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([create_node_transaction(
					1,
					recipientAddress=ALIAS_ADDRESS,
					mosaics=[{'id': ALIAS_MOSAIC_ID, 'amount': '123'}])]),
			},
			address_resolutions_by_height={
				1: [create_resolution_statement(
					1, ALIAS_ADDRESS, [_resolution_entry(1, 0, RESOLVED_ADDRESS)])]},
			mosaic_resolutions_by_height={
				1: [create_resolution_statement(
					1, ALIAS_MOSAIC_ID, [_resolution_entry(1, 0, RESOLVED_MOSAIC_ID)])]})
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'''
			SELECT encode(transaction.recipient_address, 'hex'), mosaic.mosaic_id, mosaic.amount, mosaic.role
			FROM symbol_transactions transaction
			JOIN symbol_transaction_mosaics mosaic ON mosaic.transaction_id = transaction.id
			''')
		self.assertEqual((RESOLVED_ADDRESS.lower(), RESOLVED_MOSAIC_ID, 123, 'transfer'), cursor.fetchone())
		self.assertEqual([
			resolution_path('address', 1),
			resolution_path('mosaic', 1)
		], self._resolution_paths(connector))

	def test_sync_block_headers_skips_resolution_requests_when_batch_has_no_aliases(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([create_node_transaction(1)])})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([], self._resolution_paths(connector))

	def test_sync_block_headers_fetches_resolutions_only_for_height_containing_alias(self):
		# Arrange:
		connector = FakeConnector(
			2,
			{0: [
				create_node_block(1, transactions_count=1, total_transactions_count=1),
				create_node_block(2, transactions_count=1, total_transactions_count=1)
			]},
			transactions_by_path={
				transaction_path(1, 2): create_transaction_page([
					create_node_transaction(1),
					create_node_transaction(2, recipientAddress=ALIAS_ADDRESS)
				])
			},
			address_resolutions_by_height={
				2: [create_resolution_statement(2, ALIAS_ADDRESS, [_resolution_entry(1, 0, RESOLVED_ADDRESS)])]
			})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([resolution_path('address', 2)], self._resolution_paths(connector))

	def test_sync_block_headers_resolves_all_aliases_across_bounded_resolution_batches(self):
		# Arrange:
		heights = list(range(1, RESOLUTION_FETCH_CONCURRENCY + 2))
		connector = ResolutionConcurrencyConnector(
			heights[-1],
			{0: [create_node_block(height, transactions_count=1, total_transactions_count=1) for height in heights]},
			transactions_by_path={transaction_path(1, heights[-1]): create_transaction_page([
				create_node_transaction(height, recipientAddress=ALIAS_ADDRESS)
				for height in heights
			])},
			address_resolutions_by_height={
				height: [create_resolution_statement(
					height, ALIAS_ADDRESS, [_resolution_entry(1, 0, RESOLVED_ADDRESS)])]
				for height in heights
			})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute("SELECT height, encode(recipient_address, 'hex') FROM symbol_transactions ORDER BY height")
		self.assertEqual([(height, RESOLVED_ADDRESS.lower()) for height in heights], cursor.fetchall())
		self.assertEqual(
			sorted(resolution_path('address', height) for height in heights),
			sorted(self._resolution_paths(connector)))
		self.assertEqual(RESOLUTION_FETCH_CONCURRENCY, connector.max_resolution_requests)

	def test_sync_block_headers_writes_nothing_when_address_alias_statement_is_missing(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([create_node_transaction(1, recipientAddress=ALIAS_ADDRESS)])
			})

		# Act:
		with self.assertRaisesRegex(ValueError, f'height 1.*{ALIAS_ADDRESS}'):
			self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_transactions')
		transaction_count = cursor.fetchone()[0]
		cursor.execute('SELECT COUNT(*) FROM symbol_accounts')
		account_count = cursor.fetchone()[0]
		self.assertEqual([], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(0, transaction_count)
		self.assertEqual(0, account_count)

	def test_sync_block_headers_applies_resolution_statements_from_second_page(self):
		# Arrange:
		first_page_statements = [
			create_resolution_statement(1, ALIAS_ADDRESS, [_resolution_entry(1, 0, RESOLVED_ADDRESS)])
		]
		first_page_statements.extend(
			create_resolution_statement(1, f'99{index:046X}', [_resolution_entry(1, 0, RESOLVED_ADDRESS)])
			for index in range(1, MAX_PAGE_SIZE)
		)
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=2, total_transactions_count=2)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([
					create_node_transaction(1, transaction_hash='A' * 64, block_index=0, recipientAddress=ALIAS_ADDRESS),
					create_node_transaction(1, transaction_hash='B' * 64, block_index=1, recipientAddress=SECOND_ALIAS_ADDRESS)
				])
			},
			address_resolutions_by_height={
				1: [
					*first_page_statements,
					create_resolution_statement(1, SECOND_ALIAS_ADDRESS, [_resolution_entry(2, 0, DECOY_RESOLVED_ADDRESS)])
				]
			})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'''
			SELECT encode(transaction.hash, 'hex'), transaction.body->>'recipientAddress',
				encode(transaction.recipient_address, 'hex')
			FROM symbol_transactions transaction
			WHERE transaction.hash IN (decode(%s, 'hex'), decode(%s, 'hex'))
			ORDER BY transaction.hash
			''', ('A' * 64, 'B' * 64))
		self.assertEqual([
			('a' * 64, ALIAS_ADDRESS, RESOLVED_ADDRESS.lower()),
			('b' * 64, SECOND_ALIAS_ADDRESS, DECOY_RESOLVED_ADDRESS.lower())
		], cursor.fetchall())
		self.assertEqual([
			resolution_path('address', 1),
			resolution_path('address', 1, 2)
		], self._resolution_paths(connector))

	def test_sync_block_headers_deduplicates_address_rows_collapsed_by_resolution(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([create_node_transaction(
					1,
					type=TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value,
					restrictionFlags=1,
					restrictionAdditions=[ALIAS_ADDRESS, RESOLVED_ADDRESS],
					restrictionDeletions=[])])
			},
			address_resolutions_by_height={
				1: [create_resolution_statement(1, ALIAS_ADDRESS, [_resolution_entry(1, 0, RESOLVED_ADDRESS)])]
			})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			"SELECT encode(address, 'hex'), role FROM symbol_transaction_addresses WHERE role = 'target'")
		self.assertEqual([(RESOLVED_ADDRESS.lower(), 'target')], cursor.fetchall())

	def test_sync_block_headers_preserves_original_alias_in_transaction_body_and_raw_payload(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([create_node_transaction(1, recipientAddress=ALIAS_ADDRESS)])
			},
			address_resolutions_by_height={
				1: [create_resolution_statement(1, ALIAS_ADDRESS, [_resolution_entry(1, 0, RESOLVED_ADDRESS)])]
			})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'''
			SELECT body->>'recipientAddress', raw_payload#>>'{transaction,recipientAddress}'
			FROM symbol_transactions
			''')
		self.assertEqual((ALIAS_ADDRESS, ALIAS_ADDRESS), cursor.fetchone())

	def test_sync_block_headers_converges_to_same_resolved_rows_after_sync_state_reset(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([create_node_transaction(1, recipientAddress=ALIAS_ADDRESS)])
			},
			address_resolutions_by_height={
				1: [create_resolution_statement(1, ALIAS_ADDRESS, [_resolution_entry(1, 0, RESOLVED_ADDRESS)])]
			})
		self._sync_with_connector(connector)
		first_state = self._fetch_transaction_resolution_state()
		cursor = self.puller.symbol_db.connection.cursor()
		# Deleting sync state simulates a restart/watermark reset and forces the same height to be re-synced.
		cursor.execute('DELETE FROM symbol_sync_state')
		self.puller.symbol_db.connection.commit()

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(first_state, self._fetch_transaction_resolution_state())
		self.assertEqual([
			resolution_path('address', 1),
			resolution_path('address', 1)
		], self._resolution_paths(connector))

	def test_sync_block_headers_rejects_address_resolution_without_applicable_entry(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([create_node_transaction(1, recipientAddress=ALIAS_ADDRESS)])
			},
			address_resolutions_by_height={
				1: [create_resolution_statement(1, ALIAS_ADDRESS, [
					_resolution_entry(2, 0, RESOLVED_ADDRESS),
					_resolution_entry(5, 6, RESOLVED_ADDRESS)
				])]
			})

		# Act:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			f'entry at height 1.*{ALIAS_ADDRESS}')

		# Assert:
		self.assertIsNone(self.puller.symbol_db.get_sync_state())

	def test_sync_block_headers_rejects_mosaic_resolution_without_applicable_entry_and_writes_nothing(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([create_node_transaction(
					1,
					mosaics=[{'id': ALIAS_MOSAIC_ID, 'amount': '123'}])])
			},
			mosaic_resolutions_by_height={
				1: [create_resolution_statement(1, ALIAS_MOSAIC_ID, [
					_resolution_entry(2, 0, RESOLVED_MOSAIC_ID),
					_resolution_entry(5, 6, RESOLVED_MOSAIC_ID)
				])]
			})

		# Act:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			f'entry at height 1.*{ALIAS_MOSAIC_ID}')

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_transactions')
		transaction_count = cursor.fetchone()[0]
		cursor.execute('SELECT COUNT(*) FROM symbol_transaction_mosaics')
		mosaic_count = cursor.fetchone()[0]
		cursor.execute('SELECT COUNT(*) FROM symbol_receipts')
		receipt_count = cursor.fetchone()[0]
		cursor.execute('SELECT COUNT(*) FROM symbol_accounts')
		account_count = cursor.fetchone()[0]
		self.assertEqual(0, transaction_count)
		self.assertEqual(0, mosaic_count)
		self.assertEqual(0, receipt_count)
		self.assertEqual(0, account_count)
		self.assertEqual([resolution_path('mosaic', 1)], self._resolution_paths(connector))

	def test_sync_block_headers_rejects_embedded_alias_without_parent_transaction(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1, transactions_count=0, total_transactions_count=1)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([create_embedded_node_transaction(
					1,
					'A' * 64,
					0,
					recipientAddress=ALIAS_ADDRESS)])
			},
			address_resolutions_by_height={
				1: [create_resolution_statement(1, ALIAS_ADDRESS, [_resolution_entry(1, 1, RESOLVED_ADDRESS)])]
			})

		# Act:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Missing aggregate transaction.*height 1')

		# Assert:
		self.assertIsNone(self.puller.symbol_db.get_sync_state())

	def test_sync_block_headers_rejects_malformed_address_resolution_page(self):
		# Arrange:
		connector = MalformedResolutionConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([create_node_transaction(1, recipientAddress=ALIAS_ADDRESS)])
			})

		# Act:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Malformed Symbol address resolution page response')

		# Assert:
		self.assertEqual([resolution_path('address', 1)], self._resolution_paths(connector))

	def test_sync_block_headers_rejects_non_dict_address_resolution_page(self):
		# Arrange:
		connector = NonDictResolutionConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([create_node_transaction(1, recipientAddress=ALIAS_ADDRESS)])
			})

		# Act:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Malformed Symbol address resolution page response')

		# Assert:
		self.assertEqual([resolution_path('address', 1)], self._resolution_paths(connector))

	def test_sync_block_headers_rejects_malformed_mosaic_resolution_page(self):
		# Arrange:
		connector = MalformedResolutionConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([create_node_transaction(
					1,
					mosaics=[{'id': ALIAS_MOSAIC_ID, 'amount': '123'}])])
			},
			resolution_kind='mosaic')

		# Act:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Malformed Symbol mosaic resolution page response')

		# Assert:
		self.assertEqual([resolution_path('mosaic', 1)], self._resolution_paths(connector))

	def test_sync_block_headers_rejects_non_dict_mosaic_resolution_page(self):
		# Arrange:
		connector = NonDictResolutionConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([create_node_transaction(
					1,
					mosaics=[{'id': ALIAS_MOSAIC_ID, 'amount': '123'}])])
			},
			resolution_kind='mosaic')

		# Act:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Malformed Symbol mosaic resolution page response')

		# Assert:
		self.assertEqual([resolution_path('mosaic', 1)], self._resolution_paths(connector))
