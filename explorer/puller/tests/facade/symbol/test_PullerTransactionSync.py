import asyncio

from symbolchain.sc import TransactionType

from puller.facade.SymbolPuller import MAX_PAGE_SIZE, RESOLUTION_FETCH_CONCURRENCY
from tests.test.SymbolTestConstants import SIGNER_ADDRESS

from .puller_test_utils import (
	FakeConnector,
	SymbolPullerTestBase,
	create_embedded_node_transaction,
	create_node_block,
	create_node_transaction,
	create_resolution_statement,
	create_sync_state,
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

	async def get(self, url_path, *args):
		if not url_path.startswith('statements/resolutions/'):
			return await super().get(url_path, *args)

		self.active_resolution_requests += 1
		self.max_resolution_requests = max(self.max_resolution_requests, self.active_resolution_requests)
		try:
			await asyncio.sleep(0.01)
			return await super().get(url_path, *args)
		finally:
			self.active_resolution_requests -= 1


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

	def test_get_transaction_rows_by_height_stops_after_short_page(self):
		# Arrange:
		connector = FakeConnector(1, {}, transactions_by_path={
			transaction_path(1, 1): {
				'data': [create_node_transaction(1)]
			}
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		rows_by_height = asyncio.run(self.puller._get_transaction_rows_by_height(1, 1, 100))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([transaction_path(1, 1)], connector.paths)
		self.assertEqual([1], list(rows_by_height.keys()))
		self.assertEqual(1, len(rows_by_height[1]))

	def test_get_transaction_rows_by_height_rejects_malformed_page_response(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1)]}, transactions_by_path={
			transaction_path(1, 1): {
				'pagination': {'pageNumber': 1}
			}
		})

		# Act + Assert:
		self._assert_sync_rejects_node_response(connector, ValueError, 'Malformed Symbol transaction page response')

	def test_get_transaction_rows_by_height_continues_after_full_page(self):
		# Arrange:
		first_page = [
			create_node_transaction(1, transaction_hash=f'{index:064X}', transaction_id=f'transaction-{index}')
			for index in range(MAX_PAGE_SIZE)
		]
		connector = FakeConnector(1, {}, transactions_by_path={
			transaction_path(1, 1): {'data': first_page},
			transaction_path(1, 1, 2): {'data': [create_node_transaction(1, transaction_hash='F' * 64, transaction_id='last')]}
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		rows_by_height = asyncio.run(self.puller._get_transaction_rows_by_height(1, 1, 100))  # pylint: disable=protected-access

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
			transaction_path(1, 3): {'data': first_page},
			transaction_path(1, 3, 2): {'data': second_page}
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		rows_by_height = asyncio.run(self.puller._get_transaction_rows_by_height(1, 3, 100))  # pylint: disable=protected-access

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

		# Act + Assert:
		with self.assertRaisesRegex(ValueError, 'transaction fetch failed'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		sync_state = self.puller.symbol_db.get_sync_state()

		self.assertEqual(1, sync_state['last_synced_height'])
		self.assertEqual(bytes.fromhex(f'{1:064X}'), bytes(sync_state['last_synced_block_hash']))


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
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [
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
				]}
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
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [
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
						scopedMetadataKey='1',
						valueSizeDelta=1,
						value='AA')
				]}
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
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [create_node_transaction(
					1,
					mosaics=[{'id': ALIAS_MOSAIC_ID, 'amount': '123'}])]}
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
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [create_node_transaction(
					1,
					recipientAddress=ALIAS_ADDRESS,
					mosaics=[{'id': ALIAS_MOSAIC_ID, 'amount': '123'}])]}},
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
			{0: [create_node_block(1)]},
			transactions_by_path={transaction_path(1, 1): {'data': [create_node_transaction(1)]}})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([], self._resolution_paths(connector))

	def test_sync_block_headers_fetches_resolutions_only_for_height_containing_alias(self):
		# Arrange:
		connector = FakeConnector(
			2,
			{0: [create_node_block(1), create_node_block(2)]},
			transactions_by_path={
				transaction_path(1, 2): {'data': [
					create_node_transaction(1),
					create_node_transaction(2, recipientAddress=ALIAS_ADDRESS)
				]}
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
			{0: [create_node_block(height) for height in heights]},
			transactions_by_path={transaction_path(1, heights[-1]): {'data': [
				create_node_transaction(height, recipientAddress=ALIAS_ADDRESS)
				for height in heights
			]}},
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
		self.assertEqual([resolution_path('address', height) for height in heights], self._resolution_paths(connector))
		self.assertEqual(RESOLUTION_FETCH_CONCURRENCY, connector.max_resolution_requests)

	def test_sync_block_headers_writes_nothing_when_address_alias_statement_is_missing(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [create_node_transaction(1, recipientAddress=ALIAS_ADDRESS)]}
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
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [
					create_node_transaction(1, transaction_hash='A' * 64, block_index=0, recipientAddress=ALIAS_ADDRESS),
					create_node_transaction(1, transaction_hash='B' * 64, block_index=1, recipientAddress=SECOND_ALIAS_ADDRESS)
				]}
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
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [create_node_transaction(
					1,
					type=TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value,
					restrictionFlags=1,
					restrictionAdditions=[ALIAS_ADDRESS, RESOLVED_ADDRESS],
					restrictionDeletions=[])]}
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
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [create_node_transaction(1, recipientAddress=ALIAS_ADDRESS)]}
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
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [create_node_transaction(1, recipientAddress=ALIAS_ADDRESS)]}
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
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [create_node_transaction(1, recipientAddress=ALIAS_ADDRESS)]}
			},
			address_resolutions_by_height={
				1: [create_resolution_statement(1, ALIAS_ADDRESS, [
					_resolution_entry(2, 0, RESOLVED_ADDRESS),
					_resolution_entry(5, 6, RESOLVED_ADDRESS)
				])]
			})

		# Act + Assert:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			f'entry at height 1.*{ALIAS_ADDRESS}')

	def test_sync_block_headers_rejects_mosaic_resolution_without_applicable_entry_and_writes_nothing(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [create_node_transaction(
					1,
					mosaics=[{'id': ALIAS_MOSAIC_ID, 'amount': '123'}])]}
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
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [create_embedded_node_transaction(
					1,
					'A' * 64,
					0,
					recipientAddress=ALIAS_ADDRESS)]}
			},
			address_resolutions_by_height={
				1: [create_resolution_statement(1, ALIAS_ADDRESS, [_resolution_entry(1, 1, RESOLVED_ADDRESS)])]
			})

		# Act + Assert:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Missing aggregate transaction.*height 1')

	def test_sync_block_headers_rejects_malformed_address_resolution_page(self):
		# Arrange:
		connector = MalformedResolutionConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [create_node_transaction(1, recipientAddress=ALIAS_ADDRESS)]}
			})

		# Act + Assert:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Malformed Symbol address resolution page response')

	def test_sync_block_headers_rejects_non_dict_address_resolution_page(self):
		# Arrange:
		connector = NonDictResolutionConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [create_node_transaction(1, recipientAddress=ALIAS_ADDRESS)]}
			})

		# Act + Assert:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Malformed Symbol address resolution page response')

	def test_sync_block_headers_rejects_malformed_mosaic_resolution_page(self):
		# Arrange:
		connector = MalformedResolutionConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [create_node_transaction(
					1,
					mosaics=[{'id': ALIAS_MOSAIC_ID, 'amount': '123'}])]}
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
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {'data': [create_node_transaction(
					1,
					mosaics=[{'id': ALIAS_MOSAIC_ID, 'amount': '123'}])]}
			},
			resolution_kind='mosaic')

		# Act:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Malformed Symbol mosaic resolution page response')

		# Assert:
		self.assertEqual([resolution_path('mosaic', 1)], self._resolution_paths(connector))
