# pylint: disable=too-many-lines  # PostgreSQL detail scenarios share one task-exclusive fixture contract.

import asyncio
from contextlib import contextmanager
from threading import Event, Thread
from unittest import TestCase

from common.symbol.NativeMosaic import NativeMosaicInfo
from psycopg2 import Error as PsycopgError
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Network

from rest.db.SymbolDatabase import SymbolDatabase, SymbolDataUnavailable
from rest.db.SymbolTransactionDetail import TransactionHashLockRecord
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.facade.SymbolTransactionNodeBacking import SymbolTransactionNodeBacking

from ..test.SymbolBlockTestUtils import create_symbol_block, create_symbol_sync_state
from ..test.SymbolDatabaseTestUtils import PausingAfterSyncStateReadSymbolDatabase, read_during_database_snapshot, symbol_test_database
from ..test.SymbolMosaicTestUtils import create_symbol_mosaic
from ..test.SymbolTransactionTestUtils import SIGNER_ADDRESS, create_symbol_namespace, create_symbol_transaction

NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)


class PendingNodeConfig:
	def __init__(self):
		self.base_url = 'http://node.test'
		self.timeout_seconds = 10

	@staticmethod
	def assert_request_allowed(_url):
		pass


class PendingTransport:
	def __init__(self, transaction_hash, request_started=None, resume_request=None):
		self.paths = []
		self.request_started = request_started
		self.resume_request = resume_request
		self.responses = {
			f'transactionStatus/{transaction_hash}': {'group': 'unconfirmed', 'hash': transaction_hash},
			f'transactions/unconfirmed/{transaction_hash}': {
				'meta': {'hash': transaction_hash},
				'transaction': {
					'network': Network.TESTNET.identifier, 'type': TransactionType.TRANSFER.value, 'version': 1,
					'signerPublicKey': '01' * 32, 'signature': 'CD' * 64, 'size': 1, 'maxFee': '100',
					'deadline': '1000', 'recipientAddress': '98' + '02' * 23, 'mosaics': []}}
		}

	async def get_json(self, path):
		self.paths.append(path)
		if self.request_started and path.startswith('transactionStatus/'):
			self.request_started.set()
			if not await asyncio.to_thread(self.resume_request.wait, 5):
				raise RuntimeError('Timed out waiting for Node request release')
		return self.responses[path]


def _complete_transaction(height, number, **overrides):
	"""Creates a detail fixture with the stored body and raw payload fields required by R1."""

	transaction = {
		'body': {'network': Network.TESTNET.identifier, 'version': 1, 'transactionNumber': number},
		'raw_payload': {'transaction': {'network': Network.TESTNET.identifier, 'version': 1, 'signature': 'CD' * 64}}
	}
	transaction.update(overrides)
	if isinstance(transaction.get('body'), dict):
		transaction['body'] = {'network': Network.TESTNET.identifier, **transaction['body']}
	if isinstance(transaction.get('raw_payload'), dict) and isinstance(transaction['raw_payload'].get('transaction'), dict):
		raw_transaction = transaction['raw_payload']['transaction']
		transaction['raw_payload']['transaction'] = {'network': Network.TESTNET.identifier, **raw_transaction}
	return create_symbol_transaction(height, number, **transaction)


def _pending_detail_record(transaction_hash, **updates):
	transaction = {
		'network': Network.TESTNET.identifier,
		'type': TransactionType.TRANSFER.value,
		'version': 1,
		'signerPublicKey': '01' * 32,
		'signature': 'CD' * 64,
		'size': 1,
		'maxFee': '100',
		'deadline': '1000',
		'recipientAddress': '98' + '02' * 23,
		'mosaics': []
	}
	transaction.update(updates)
	payload = {'meta': {'hash': transaction_hash}, 'transaction': transaction}
	backing = SymbolTransactionNodeBacking(PendingNodeConfig(), Network.TESTNET)
	return backing.to_detail_record(payload, 'unconfirmed', transaction_hash)


def _assert_transaction_detail_error(test_case, transactions, transaction_hash):
	"""Reads seeded rows through the public Symbol REST DB method and returns its application error message."""

	# Arrange:
	with symbol_test_database(
		create_symbol_sync_state(last_synced_height=4, finalized_height=3),
		[create_symbol_block(4)]) as (db_config, puller_database):
		puller_database.upsert_transactions_for_height(4, transactions)
		with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
			# Act:
			with test_case.assertRaises(SymbolDataUnavailable) as error:
				database.get_transaction_detail(transaction_hash)

	# Assert:
	return str(error.exception)


class PausingAfterSyncStateReadDetailDatabase(PausingAfterSyncStateReadSymbolDatabase):
	def __init__(self, db_config):
		super().__init__(db_config)
		self.native_mosaic_info = NATIVE_MOSAIC_INFO


class TrackingDetailDatabase(SymbolDatabase):
	def __init__(self, db_config):
		super().__init__(db_config, NATIVE_MOSAIC_INFO)
		self.active_connections = 0

	@contextmanager
	def connection(self):
		with super().connection() as connection:
			self.active_connections += 1
			try:
				yield connection
			finally:
				self.active_connections -= 1


class SymbolTransactionDetailDatabaseTest(TestCase):
	def test_supplement_rejects_requested_hash_that_does_not_match_node_record(self):
		# Arrange:
		transaction_hash = 'AB' * 32
		record = _pending_detail_record(transaction_hash)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[create_symbol_block(1)]) as (db_config, _):
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable) as error:
					database.supplement_transaction_detail(bytes.fromhex('CD' * 32), record)

		# Assert:
		self.assertEqual(
			'Symbol transaction detail data is unavailable: Node detail hash mismatch',
			str(error.exception))

	def test_supplement_rejects_unreadable_sync_state(self):
		# Arrange:
		transaction_hash = 'AB' * 32
		record = _pending_detail_record(transaction_hash)

		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1, status='unhealthy'),
			[create_symbol_block(1)]) as (db_config, _):
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable):
					database.supplement_transaction_detail(bytes.fromhex(transaction_hash), record)

	def test_supplement_requires_native_mosaic_information(self):
		# Arrange:
		transaction_hash = 'AB' * 32
		record = _pending_detail_record(transaction_hash)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[create_symbol_block(1)]) as (db_config, _):
			with SymbolDatabase(db_config) as database:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable):
					database.supplement_transaction_detail(bytes.fromhex(transaction_hash), record)

	def test_supplement_rejects_dirty_current_mosaic_metadata(self):
		# Arrange:
		transaction_hash = 'AC' * 32
		nonnative_record = _pending_detail_record(
			transaction_hash, mosaics=[{'id': '1234567890ABCDEF', 'amount': '1'}])
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3, dirty_state_from_height=5),
			[create_symbol_block(1)]) as (db_config, _):
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable):
					database.supplement_transaction_detail(bytes.fromhex(transaction_hash), nonnative_record)

	def test_supplement_rejects_node_row_above_dirty_watermark(self):
		# Arrange:
		unsafe_transaction = _complete_transaction(5, 77)
		transaction_hash = unsafe_transaction['hash'].hex().upper()
		unsafe_record = _pending_detail_record(transaction_hash)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3, dirty_state_from_height=5),
			[create_symbol_block(1), create_symbol_block(4), create_symbol_block(5)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(5, [unsafe_transaction])
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable):
					database.supplement_transaction_detail(bytes.fromhex(transaction_hash), unsafe_record)

	def test_supplement_rejects_a_hash_that_selects_an_embedded_row(self):
		# Arrange:
		transaction_hash = bytes.fromhex('DD' * 32)
		embedded = _complete_transaction(
			4, 78, is_embedded=True, hash=transaction_hash, aggregate_hash=bytes.fromhex('EE' * 32), embedded_index=0)
		record = _pending_detail_record(transaction_hash.hex().upper())
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, [embedded])
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable):
					database.supplement_transaction_detail(transaction_hash, record)

	def test_supplement_rejects_hash_lock_updated_above_the_snapshot(self):
		# Arrange:
		transaction_hash = 'AE' * 32
		child = {
			'network': Network.TESTNET.identifier,
			'type': TransactionType.TRANSFER.value,
			'version': 1,
			'signerPublicKey': '02' * 32,
			'signature': 'EF' * 64,
			'size': 1,
			'maxFee': '100',
			'deadline': '1000',
			'recipientAddress': '98' + '03' * 23,
			'mosaics': []
		}
		payload = {
			'meta': {'hash': transaction_hash},
			'transaction': {
				'network': Network.TESTNET.identifier,
				'type': TransactionType.AGGREGATE_BONDED.value,
				'version': 1,
				'signerPublicKey': '01' * 32,
				'signature': 'CD' * 64,
				'size': 1,
				'maxFee': '100',
				'deadline': '1000',
				'transactionsHash': 'AB' * 32,
				'cosignatures': [],
				'mosaics': [],
				'transactions': [{'meta': {'aggregateHash': transaction_hash, 'index': 0}, 'transaction': child}]
			}
		}
		record = SymbolTransactionNodeBacking(PendingNodeConfig(), Network.TESTNET).to_detail_record(
			payload, 'unconfirmed', transaction_hash)
		record = record._replace(hash_lock=TransactionHashLockRecord(
			bytes.fromhex(transaction_hash), SIGNER_ADDRESS, NATIVE_MOSAIC_INFO.id, 100, 20, 'unused', None, None, 2))
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[create_symbol_block(1)]) as (db_config, puller_database):
			puller_database.upsert_hash_lock({
				'hash': bytes.fromhex(transaction_hash), 'owner_address': SIGNER_ADDRESS,
				'mosaic_id': NATIVE_MOSAIC_INFO.id, 'amount': 100, 'end_height': 20,
				'status': 'unused', 'raw_payload': {}, 'updated_at_height': 2})
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable):
					database.supplement_transaction_detail(bytes.fromhex(transaction_hash), record)

	def test_facade_releases_confirmed_lag_before_pending_node_fetch_and_supplement(self):  # pylint: disable=too-many-locals
		# Arrange:
		transaction = _complete_transaction(4, 1)
		transaction_hash = transaction['hash'].hex().upper()
		request_started = Event()
		resume_request = Event()
		transport = PendingTransport(transaction_hash, request_started, resume_request)
		node_backing = SymbolTransactionNodeBacking(
			PendingNodeConfig(), Network.TESTNET, transport=transport)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[create_symbol_block(1), create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, [transaction])

			with TrackingDetailDatabase(db_config) as database:
				facade = SymbolRestFacade(
					database, PendingNodeConfig(), NATIVE_MOSAIC_INFO, Network.TESTNET, node_backing=node_backing)

				# Act + Assert:
				results = []
				errors = []

				def fetch_detail():
					try:
						results.append(asyncio.run(facade.get_transaction_detail(transaction_hash)))
					except Exception as error:  # pylint: disable=broad-exception-caught
						errors.append(error)
				thread = Thread(target=fetch_detail)
				thread.start()
				self.assertTrue(request_started.wait(timeout=5))
				self.assertEqual(0, database.active_connections)
				resume_request.set()
				thread.join(timeout=5)
				self.assertFalse(thread.is_alive())
				if errors:
					raise errors[0]
				result = results[0]

		# Assert:
		self.assertEqual('unconfirmed', result['group'])
		self.assertIsNone(result['info']['height'])
		self.assertEqual([
			f'transactionStatus/{transaction_hash}',
			f'transactions/unconfirmed/{transaction_hash}'
		], transport.paths)

	def test_supplement_pending_node_detail_allows_missing_or_present_current_hash_lock(self):
		# Arrange:
		hash_value = 'AB' * 32
		payload = {
			'meta': {'hash': hash_value},
			'transaction': {
				'network': Network.TESTNET.identifier, 'type': TransactionType.TRANSFER.value, 'version': 1,
				'signerPublicKey': '01' * 32, 'signature': 'CD' * 64, 'size': 120, 'maxFee': '1000',
				'deadline': '1000', 'recipientAddress': '98' + '02' * 23, 'mosaics': []}}
		backing = SymbolTransactionNodeBacking(type('NodeConfig', (), {'base_url': 'http://node.test'})(), Network.TESTNET)
		record = backing.to_detail_record(payload, 'unconfirmed', hash_value)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[create_symbol_block(1)]) as (db_config, puller_database):
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				lock_record = record._replace(hash_lock=TransactionHashLockRecord(
					bytes.fromhex(hash_value), SIGNER_ADDRESS, NATIVE_MOSAIC_INFO.id, 100, 20, 'unused', None, None, 1))
				# Act: preserve a validated Node lock when current DB state has no row.
				missing = database.supplement_transaction_detail(bytes.fromhex(hash_value), lock_record)
				self.assertEqual(lock_record.hash_lock.hash, missing.hash_lock.hash)
				puller_database.upsert_hash_lock({
					'hash': bytes.fromhex(hash_value), 'owner_address': SIGNER_ADDRESS,
					'mosaic_id': NATIVE_MOSAIC_INFO.id, 'amount': 100, 'end_height': 20,
					'status': 'unused', 'raw_payload': {}, 'updated_at_height': 1})
				present = database.supplement_transaction_detail(bytes.fromhex(hash_value), lock_record)

		# Assert:
		self.assertEqual(record.transaction.hash, missing.transaction.hash)
		self.assertEqual(lock_record.hash_lock.hash, present.hash_lock.hash)

	def test_supplement_pending_node_detail_uses_one_snapshot_for_mosaic_and_namespace_state(self):
		# Arrange:
		hash_value = 'AC' * 32
		mosaic_id = '1234567890ABCDEF'
		namespace_id = '887E5DB6BB0B21F5'
		payload = {
			'meta': {'hash': hash_value},
			'transaction': {
				'network': Network.TESTNET.identifier, 'type': TransactionType.TRANSFER.value, 'version': 1,
				'signerPublicKey': '01' * 32, 'signature': 'CD' * 64, 'size': 120, 'maxFee': '1000',
				'deadline': '1000', 'recipientAddress': '98' + '02' * 23, 'namespaceId': namespace_id,
				'mosaics': [{'id': mosaic_id, 'amount': '100'}]}}
		backing = SymbolTransactionNodeBacking(PendingNodeConfig(), Network.TESTNET)
		record = backing.to_detail_record(payload, 'unconfirmed', hash_value)
		initial_namespace = create_symbol_namespace(namespace_id=namespace_id, full_name='before.name')
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[create_symbol_block(1)], [create_symbol_mosaic(mosaic_id, 2)]) as (db_config, puller_database):
			puller_database.upsert_namespace(initial_namespace, [])
			database = PausingAfterSyncStateReadDetailDatabase(db_config)
			try:
				# Act + Assert:
				result = read_during_database_snapshot(
					database,
					lambda: database.supplement_transaction_detail(bytes.fromhex(hash_value), record),
					lambda: _update_pending_supplement_snapshot(puller_database, initial_namespace, mosaic_id))
			finally:
				database.close()

		# Assert:
		self.assertEqual(2, result.transaction.mosaics[0].divisibility)
		self.assertEqual({'887E5DB6BB0B21F5': 'before.name'}, result.namespace_names)

	def test_get_transaction_detail_returns_parent_block_and_stored_relations(self):
		# Arrange:
		transaction = _complete_transaction(4, 1)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, [transaction])

			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				result = database.get_transaction_detail(transaction['hash'])

		# Assert:
		self.assertEqual('hit', result.status)
		self.assertEqual(4, result.last_synced_height)
		self.assertEqual(4, result.readable_height)
		self.assertEqual(transaction['hash'], result.record.transaction.hash)
		self.assertFalse(result.record.transaction.is_embedded)
		self.assertEqual(4, result.record.transaction.height)
		self.assertEqual(4, result.record.block.height)
		self.assertEqual(bytes([4]) * 32, result.record.block.hash)
		self.assertEqual((), result.record.children)
		self.assertEqual((), result.record.cosignatures)
		self.assertIsNone(result.record.hash_lock)

	def test_get_transaction_detail_reads_aggregate_children_in_embedded_index_order_and_uses_parent_hash_for_lock(self):
		# Arrange:
		parent_hash = (9).to_bytes(32, 'big')
		parent = _complete_transaction(
			4,
			9,
			type=TransactionType.AGGREGATE_BONDED.value,
			body={'version': 1, 'transactionsHash': 'AB' * 32, 'cosignatures': []},
			raw_payload={'transaction': {'version': 1, 'signature': 'EF' * 64}})
		child_one = _complete_transaction(4, 1, is_embedded=True, aggregate_hash=parent_hash, embedded_index=1)
		child_zero = _complete_transaction(4, 0, is_embedded=True, aggregate_hash=parent_hash, embedded_index=0)
		lock = {
			'hash': parent_hash,
			'owner_address': SIGNER_ADDRESS,
			'mosaic_id': NATIVE_MOSAIC_INFO.id,
			'amount': 100,
			'end_height': 12,
			'status': 'unused',
			'raw_payload': {},
			'updated_at_height': 4
		}
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, [parent, child_one, child_zero])
			puller_database.upsert_hash_lock(lock)

			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				result = database.get_transaction_detail(parent_hash)

		# Assert:
		self.assertEqual([0, 1], [child.embedded_index for child in result.record.children])
		self.assertEqual(parent_hash, result.record.hash_lock.hash)
		self.assertEqual(SIGNER_ADDRESS, bytes(result.record.hash_lock.owner_address))
		self.assertEqual(NATIVE_MOSAIC_INFO.id, result.record.hash_lock.mosaic_id)

	def test_get_transaction_detail_rejects_aggregate_revocation_child_without_sender_relation(self):
		# Arrange:
		parent = _complete_transaction(
			4, 9,
			type=TransactionType.AGGREGATE_COMPLETE.value,
			body={'version': 1, 'transactionsHash': 'AB' * 32, 'cosignatures': []},
			raw_payload={'transaction': {'version': 1, 'signature': 'EF' * 64}})
		child = _complete_transaction(
			4, 0,
			is_embedded=True,
			aggregate_hash=parent['hash'],
			embedded_index=0,
			type=TransactionType.MOSAIC_SUPPLY_REVOCATION.value,
			mosaic_rows=[{'mosaic_id': NATIVE_MOSAIC_INFO.id, 'amount': 1, 'role': 'revocation', 'position': 0}],
			address_rows=[{'address': SIGNER_ADDRESS, 'role': 'signer'}])
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, [parent, child])

			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable):
					database.get_transaction_detail(parent['hash'])


class SymbolTransactionDetailReadDatabaseTest(TestCase):
	def test_get_transaction_detail_rejects_a_missing_row_while_state_is_dirty(self):
		# Arrange:
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3, dirty_state_from_height=4),
			[create_symbol_block(4)]) as (db_config, _):
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable):
					database.get_transaction_detail(bytes.fromhex('AA' * 32))

	def test_get_transaction_detail_returns_clean_miss_with_snapshot_watermarks(self):
		# Arrange:
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(4)]) as (db_config, _):
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				result = database.get_transaction_detail(bytes.fromhex('AA' * 32))

		# Assert:
		self.assertEqual('miss', result.status)
		self.assertIsNone(result.record)
		self.assertEqual(4, result.last_synced_height)
		self.assertEqual(4, result.readable_height)

	def test_get_transaction_detail_returns_confirmed_lag_without_serializing_the_row(self):
		# Arrange:
		transaction = _complete_transaction(5, 1, body='malformed body')
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(4), create_symbol_block(5)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(5, [transaction])

			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				result = database.get_transaction_detail(transaction['hash'])

		# Assert:
		self.assertEqual('confirmed_lag', result.status)
		self.assertIsNone(result.record)
		self.assertEqual(4, result.last_synced_height)
		self.assertEqual(4, result.readable_height)

	def test_public_detail_read_recovers_its_pooled_connection_after_sql_error(self):
		# Arrange:
		transaction_hash = bytes.fromhex('AD' * 32)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[create_symbol_block(1)]) as (db_config, puller_database):
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				with database.connection() as connection:
					with connection.cursor() as cursor:
						cursor.execute('SELECT pg_backend_pid()')
						backend_pid = cursor.fetchone()[0]

				with puller_database.connection.cursor() as cursor:
					cursor.execute('DROP TABLE symbol_sync_state')
				puller_database.connection.commit()

				# Act + Assert:
				with self.assertRaises(PsycopgError):
					database.get_transaction_detail(transaction_hash)

				# Restore the test schema after the real SELECT failure.
				puller_database.create_tables()
				puller_database.upsert_sync_state(create_symbol_sync_state(last_synced_height=1, finalized_height=1))
				result = database.get_transaction_detail(transaction_hash)
				with database.connection() as connection:
					with connection.cursor() as cursor:
						cursor.execute('SELECT pg_backend_pid()')
						recovered_backend_pid = cursor.fetchone()[0]

		# Assert:
		self.assertEqual('miss', result.status)
		self.assertEqual(backend_pid, recovered_backend_pid)

	def test_facade_uses_confirmed_database_row_before_cached_pending_detail(self):
		# Arrange:
		transaction_hash = 'D4' * 32
		transport = PendingTransport(transaction_hash)
		pending_path = f'transactions/unconfirmed/{transaction_hash}'
		transport.responses[pending_path]['transaction']['maxFee'] = '9000000'
		fixed_time = 100.0
		node_backing = SymbolTransactionNodeBacking(
			PendingNodeConfig(), Network.TESTNET, transport=transport, clock=lambda: fixed_time)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(1), create_symbol_block(4)]) as (db_config, puller_database):
			with TrackingDetailDatabase(db_config) as database:
				facade = SymbolRestFacade(
					database, PendingNodeConfig(), NATIVE_MOSAIC_INFO, Network.TESTNET, node_backing=node_backing)

				# Act:
				pending_result = asyncio.run(facade.get_transaction_detail(transaction_hash))

				# Assert:
				self.assertEqual('unconfirmed', pending_result['group'])
				self.assertEqual(9.0, pending_result['info']['maxFee'])
				self.assertEqual([
					f'transactionStatus/{transaction_hash}', pending_path], transport.paths)
				pending_cache_entry = node_backing.caches['unconfirmed'].entries[
					('unconfirmed', transaction_hash)]
				self.assertEqual(fixed_time, pending_cache_entry[0])
				self.assertLess(
					node_backing.clock() - pending_cache_entry[0], node_backing.CACHE_TTL_SECONDS)

				# Arrange confirmed database row:
				confirmed = _complete_transaction(
					4, 81, hash=bytes.fromhex(transaction_hash), max_fee=7, effective_fee=3)
				puller_database.upsert_transactions_for_height(4, [confirmed])

				# Act:
				confirmed_result = asyncio.run(facade.get_transaction_detail(transaction_hash))

		# Assert:
		self.assertEqual('confirmed', confirmed_result['group'])
		self.assertEqual(4, confirmed_result['info']['height'])
		self.assertEqual(0.000007, confirmed_result['info']['maxFee'])
		self.assertEqual([
			f'transactionStatus/{transaction_hash}', f'transactions/unconfirmed/{transaction_hash}'], transport.paths)

	def test_get_transaction_detail_rejects_non_object_body(self):
		# Arrange:
		transaction = _complete_transaction(4, 1, body='malformed body')

		# Act + Assert:
		message = _assert_transaction_detail_error(self, [transaction], transaction['hash'])

		# Assert:
		self.assertEqual('Symbol transaction detail data is unavailable: missing body', message)

	def test_get_transaction_detail_rejects_non_object_raw_transaction_payload(self):
		# Arrange:
		transaction = _complete_transaction(4, 2, raw_payload={'transaction': 'malformed raw transaction'})

		# Act + Assert:
		message = _assert_transaction_detail_error(self, [transaction], transaction['hash'])

		# Assert:
		self.assertEqual('Symbol transaction detail data is unavailable: rawPayload.transaction is malformed', message)


class SymbolTransactionDetailValidationDatabaseTest(TestCase):
	def test_get_transaction_detail_rejects_unhealthy_sync_state(self):
		# Arrange:
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3, status='unhealthy'),
			[create_symbol_block(4)]) as (db_config, _):
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaisesRegex(
					SymbolDataUnavailable,
					'Symbol transaction detail data is unavailable: sync state is unreadable'
				):
					database.get_transaction_detail(bytes.fromhex('AA' * 32))

	def test_get_transaction_detail_rejects_missing_sync_state(self):
		# Arrange:
		with symbol_test_database(
			create_symbol_sync_state(0, 0),
			[]) as (db_config, _):
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaisesRegex(
					SymbolDataUnavailable,
					'Symbol transaction detail data is unavailable: sync state is unreadable'
				):
					database.get_transaction_detail(bytes.fromhex('BB' * 32))

	def test_get_transaction_detail_rejects_invalid_dirty_watermark(self):
		# Arrange:
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3, dirty_state_from_height=0),
			[]) as (db_config, _):
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaisesRegex(
					SymbolDataUnavailable,
					'Symbol transaction detail data is unavailable: sync state is unreadable'
				):
					database.get_transaction_detail(bytes.fromhex('CC' * 32))

	def test_get_transaction_detail_rejects_row_above_dirty_watermark(self):
		# Arrange:
		lagged = _complete_transaction(5, 1)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3, dirty_state_from_height=4),
			[create_symbol_block(4), create_symbol_block(5)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(5, [lagged])
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaisesRegex(
					SymbolDataUnavailable,
					'Symbol transaction detail data is unavailable: unsafe transaction row'
				):
					database.get_transaction_detail(lagged['hash'])

	def test_get_transaction_detail_rejects_embedded_hash(self):
		# Arrange:
		embedded_hash = bytes.fromhex('DD' * 32)
		embedded = _complete_transaction(
			4, 1, is_embedded=True, hash=embedded_hash, aggregate_hash=bytes.fromhex('AA' * 32), embedded_index=0)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, [embedded])
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaisesRegex(
					SymbolDataUnavailable,
					'Symbol transaction detail data is unavailable: hash selected an embedded row'
				):
					database.get_transaction_detail(embedded_hash)

	def test_get_transaction_detail_rejects_transaction_without_block(self):
		# Arrange:
		transaction = _complete_transaction(4, 2)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, [transaction])
			with puller_database.connection.cursor() as cursor:
				cursor.execute('SET session_replication_role = replica')
				cursor.execute('DELETE FROM symbol_blocks WHERE height = 4')
				cursor.execute('SET session_replication_role = origin')
			puller_database.connection.commit()
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaises(SymbolDataUnavailable):
					database.get_transaction_detail(transaction['hash'])

	def test_get_transaction_detail_rejects_misindexed_aggregate_child(self):
		# Arrange:
		parent_hash = (9).to_bytes(32, 'big')
		parent = _complete_transaction(
			4, 9, type=TransactionType.AGGREGATE_COMPLETE.value,
			body={'version': 1, 'transactionsHash': 'AB' * 32, 'cosignatures': []})
		invalid_child = _complete_transaction(4, 1, is_embedded=True, aggregate_hash=parent_hash, embedded_index=1)

		# Act + Assert:
		message = _assert_transaction_detail_error(self, [parent, invalid_child], parent_hash)

		# Assert:
		self.assertEqual('Symbol transaction detail data is unavailable: aggregate children are invalid', message)

	def test_get_transaction_detail_rejects_children_on_nonaggregate_parent(self):
		# Arrange:
		parent = _complete_transaction(4, 2)
		child = _complete_transaction(4, 3, is_embedded=True, aggregate_hash=parent['hash'], embedded_index=0)

		# Act + Assert:
		message = _assert_transaction_detail_error(self, [parent, child], parent['hash'])

		# Assert:
		self.assertEqual('Symbol transaction detail data is unavailable: non-aggregate has children', message)

	def test_get_transaction_detail_rejects_top_level_child_in_aggregate(self):
		# Arrange:
		parent_hash = (11).to_bytes(32, 'big')
		parent = _complete_transaction(
			4, 11, type=TransactionType.AGGREGATE_COMPLETE.value,
			body={'version': 1, 'transactionsHash': 'AB' * 32, 'cosignatures': []})
		malformed_child = _complete_transaction(4, 12, aggregate_hash=parent_hash, embedded_index=0)

		# Act + Assert:
		message = _assert_transaction_detail_error(self, [parent, malformed_child], parent_hash)

		# Assert:
		self.assertEqual('Symbol transaction detail data is unavailable: embedded identity is invalid', message)

	def test_get_transaction_detail_rejects_nested_aggregate_child(self):
		# Arrange:
		parent = _complete_transaction(
			4, 13, type=TransactionType.AGGREGATE_COMPLETE.value,
			body={'version': 1, 'transactionsHash': 'AB' * 32, 'cosignatures': []})
		nested_child = _complete_transaction(
			4, 14, is_embedded=True, aggregate_hash=parent['hash'], embedded_index=0,
			type=TransactionType.AGGREGATE_COMPLETE.value,
			body={'version': 1, 'transactionsHash': 'CD' * 32, 'cosignatures': []})
		# Act + Assert:
		message = _assert_transaction_detail_error(self, [parent, nested_child], parent['hash'])

		# Assert:
		self.assertEqual('Symbol transaction detail data is unavailable: nested aggregate child', message)

	def test_get_transaction_detail_rejects_malformed_cosignature_list(self):
		# Arrange:
		parent = _complete_transaction(
			4, 4, type=TransactionType.AGGREGATE_COMPLETE.value,
			body={'version': 1, 'transactionsHash': 'AB' * 32, 'cosignatures': 'malformed'})
		child = _complete_transaction(4, 5, is_embedded=True, aggregate_hash=parent['hash'], embedded_index=0)

		# Act + Assert:
		message = _assert_transaction_detail_error(self, [parent, child], parent['hash'])

		# Assert:
		self.assertEqual('Symbol transaction detail data is unavailable: aggregate cosignatures are invalid', message)

	def test_get_transaction_detail_rejects_revocation_without_source_relation(self):
		# Arrange:
		revocation = _complete_transaction(
			4, 3, type=TransactionType.MOSAIC_SUPPLY_REVOCATION.value,
			mosaic_rows=[{'mosaic_id': NATIVE_MOSAIC_INFO.id, 'amount': 1, 'role': 'revocation', 'position': 0}],
			address_rows=[])

		# Act + Assert:
		message = _assert_transaction_detail_error(self, [revocation], revocation['hash'])

		# Assert:
		self.assertEqual('Symbol transaction detail data is unavailable: revocation source is missing', message)

	def test_get_transaction_detail_rejects_signer_only_revocation_relation(self):
		# Arrange:
		revocation_signer_only = _complete_transaction(
			4, 4, type=TransactionType.MOSAIC_SUPPLY_REVOCATION.value,
			mosaic_rows=[{'mosaic_id': NATIVE_MOSAIC_INFO.id, 'amount': 1, 'role': 'revocation', 'position': 0}],
			address_rows=[{'address': SIGNER_ADDRESS, 'role': 'signer'}])

		# Act + Assert:
		message = _assert_transaction_detail_error(self, [revocation_signer_only], revocation_signer_only['hash'])

		# Assert:
		self.assertEqual('Symbol transaction detail data is unavailable: revocation source is missing', message)


class SymbolTransactionDetailSnapshotSafetyDatabaseTest(TestCase):
	def test_get_transaction_detail_rejects_bonded_transaction_while_state_is_dirty(self):
		# Arrange:
		parent = _complete_transaction(
			4, 1, type=TransactionType.AGGREGATE_BONDED.value,
			body={'version': 1, 'transactionsHash': 'AB' * 32, 'cosignatures': []})
		child = _complete_transaction(4, 2, is_embedded=True, aggregate_hash=parent['hash'], embedded_index=0)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3, dirty_state_from_height=5),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, [parent, child])
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaisesRegex(
					SymbolDataUnavailable,
					'Symbol transaction detail data is unavailable: hash lock is unsafe'
				):
					database.get_transaction_detail(parent['hash'])

	def test_get_transaction_detail_rejects_hash_lock_updated_above_snapshot(self):
		# Arrange:
		parent = _complete_transaction(
			4, 1, type=TransactionType.AGGREGATE_BONDED.value,
			body={'version': 1, 'transactionsHash': 'AB' * 32, 'cosignatures': []})
		child = _complete_transaction(4, 2, is_embedded=True, aggregate_hash=parent['hash'], embedded_index=0)
		lock = {
			'hash': parent['hash'], 'owner_address': SIGNER_ADDRESS, 'mosaic_id': NATIVE_MOSAIC_INFO.id,
			'amount': 100, 'end_height': 12, 'status': 'unused', 'raw_payload': {}, 'updated_at_height': 5
		}
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3, dirty_state_from_height=5),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, [parent, child])
			puller_database.upsert_hash_lock(lock)
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaisesRegex(
					SymbolDataUnavailable,
					'Symbol transaction detail data is unavailable: hash lock is unsafe'
				):
					database.get_transaction_detail(parent['hash'])

	def test_get_transaction_detail_requires_native_mosaic_information(self):
		# Arrange:
		transaction = _complete_transaction(4, 1)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, [transaction])
			with SymbolDatabase(db_config) as database:
				# Act + Assert:
				with self.assertRaisesRegex(
					SymbolDataUnavailable,
					'Symbol transaction detail data is unavailable: native mosaic is unavailable'
				):
					database.get_transaction_detail(transaction['hash'])

	def test_get_transaction_detail_rejects_nonnative_mosaic_during_dirty_state(self):
		# Arrange:
		nonnative = _complete_transaction(
			4, 2, mosaic_rows=[{'mosaic_id': '0000000000001234', 'amount': 1, 'role': 'transfer', 'position': 0}])
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3, dirty_state_from_height=5),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, [nonnative])
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaisesRegex(
					SymbolDataUnavailable,
					'Symbol transaction detail data is unavailable: current metadata is unsafe in dirty or repairing state'
				):
					database.get_transaction_detail(nonnative['hash'])

	def test_get_transaction_detail_rejects_malformed_saved_version(self):
		# Arrange:
		transaction = _complete_transaction(4, 1, raw_payload={'transaction': {'version': 'bad', 'signature': 'CD' * 64}})
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, [transaction])
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaisesRegex(
					SymbolDataUnavailable,
					'Symbol transaction detail data is unavailable: version is malformed'
				):
					database.get_transaction_detail(transaction['hash'])

	def test_get_transaction_detail_rejects_malformed_saved_signature(self):
		# Arrange:
		transaction = _complete_transaction(4, 2, raw_payload={'transaction': {'version': 1, 'signature': 'bad'}})
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, [transaction])
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaisesRegex(
					SymbolDataUnavailable,
					'Symbol transaction detail data is unavailable: signature is malformed'
				):
					database.get_transaction_detail(transaction['hash'])

	def test_get_transaction_detail_rejects_nonhex_saved_signature(self):
		# Arrange:
		transaction = _complete_transaction(4, 3, raw_payload={'transaction': {'version': 1, 'signature': ' ' + 'CD' * 63 + 'C'}})
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, [transaction])
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				with self.assertRaisesRegex(
					SymbolDataUnavailable,
					'Symbol transaction detail data is unavailable: signature is malformed'
				):
					database.get_transaction_detail(transaction['hash'])

	def test_get_transaction_detail_rejects_missing_required_transaction_address(self):
		# Arrange:
		missing_addresses = (
			_complete_transaction(
				4, 1, type=TransactionType.TRANSFER.value, recipient_address=None,
				address_rows=[{'address': SIGNER_ADDRESS, 'role': 'signer'}]),
			_complete_transaction(
				4, 2, type=TransactionType.SECRET_LOCK.value, recipient_address=None,
				address_rows=[{'address': SIGNER_ADDRESS, 'role': 'signer'}]),
			_complete_transaction(
				4, 3, type=TransactionType.SECRET_PROOF.value, recipient_address=None,
				address_rows=[{'address': SIGNER_ADDRESS, 'role': 'signer'}]),
			_complete_transaction(4, 4, type=TransactionType.ACCOUNT_METADATA.value, target_address=None),
			_complete_transaction(4, 5, type=TransactionType.MOSAIC_METADATA.value, target_address=None),
			_complete_transaction(4, 6, type=TransactionType.NAMESPACE_METADATA.value, target_address=None),
			_complete_transaction(4, 7, type=TransactionType.MOSAIC_ADDRESS_RESTRICTION.value, target_address=None)
		)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, missing_addresses)
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				for transaction in missing_addresses:
					with self.subTest(transaction_type=transaction['type']):
						with self.assertRaisesRegex(
							SymbolDataUnavailable,
							'Symbol transaction detail data is unavailable: required address is missing'
						) as error:
							database.get_transaction_detail(transaction['hash'])
						# Assert:
						self.assertEqual(
							'Symbol transaction detail data is unavailable: required address is missing',
							str(error.exception))

	def test_get_transaction_detail_reads_revocation_source_from_sender_relation(self):
		# Arrange:
		transaction = _complete_transaction(
			4, 2,
			type=TransactionType.MOSAIC_SUPPLY_REVOCATION.value,
			mosaic_rows=[{
				'mosaic_id': NATIVE_MOSAIC_INFO.id, 'amount': 1, 'role': 'revocation', 'position': 0
			}],
			address_rows=[
				{'address': SIGNER_ADDRESS, 'role': 'signer'},
				{'address': SIGNER_ADDRESS, 'role': 'sender'}
			])
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, [transaction])
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				result = database.get_transaction_detail(transaction['hash'])

		# Assert:
		self.assertEqual(SIGNER_ADDRESS, result.record.transaction.source_address)

	def test_get_transaction_detail_rejects_malformed_message_payload(self):
		# Arrange:
		for message_payload in ('GG', 'G'):
			with self.subTest(message_payload=message_payload):
				transaction = _complete_transaction(4, 1, message_type='plain', message_payload=message_payload)
				with symbol_test_database(
					create_symbol_sync_state(last_synced_height=4, finalized_height=3),
					[create_symbol_block(4)]) as (db_config, puller_database):
					puller_database.upsert_transactions_for_height(4, [transaction])
					with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
						# Act + Assert:
						with self.assertRaises(SymbolDataUnavailable):
							database.get_transaction_detail(transaction['hash'])

	def test_get_transaction_detail_reads_namespace_and_mosaic_relations(self):
		# Arrange:
		namespace_id = '887E5DB6BB0B21F5'
		namespace = _complete_transaction(
			4, 1, type=TransactionType.NAMESPACE_REGISTRATION.value,
			body={'version': 1, 'id': namespace_id, 'name': 'leaf', 'registrationType': 'root', 'parentId': None, 'duration': 1})
		alias = _complete_transaction(
			4, 2, type=TransactionType.ADDRESS_ALIAS.value,
			body={'version': 1, 'namespaceId': namespace_id, 'aliasAction': 1, 'address': '98' + '01' * 23})
		transfer = _complete_transaction(
			4, 3, mosaic_rows=[{
				'mosaic_id': NATIVE_MOSAIC_INFO.id, 'amount': 1, 'role': 'transfer', 'position': 0
			}])
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_namespace(create_symbol_namespace(namespace_id=namespace_id), [])
			puller_database.upsert_transactions_for_height(4, [namespace, alias, transfer])

			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				namespace_result = database.get_transaction_detail(namespace['hash'])
				alias_result = database.get_transaction_detail(alias['hash'])
				transfer_result = database.get_transaction_detail(transfer['hash'])

		# Assert:
		self.assertEqual({}, namespace_result.record.namespace_names)
		self.assertEqual({'887E5DB6BB0B21F5': 'daoka.coin'}, alias_result.record.namespace_names)
		self.assertEqual(1, len(transfer_result.record.transaction.mosaics))

	def test_get_transaction_detail_rejects_missing_required_mosaic_relations(self):
		# Arrange:
		definition = _complete_transaction(
			4, 1, type=TransactionType.MOSAIC_DEFINITION.value,
			body={'version': 1, 'id': '01', 'divisibility': 0, 'duration': 1, 'nonce': 1, 'flags': 0})
		global_restriction = _complete_transaction(
			4, 2, type=TransactionType.MOSAIC_GLOBAL_RESTRICTION.value,
			body={
				'version': 1, 'mosaicId': '01', 'referenceMosaicId': '00', 'restrictionKey': '01',
				'previousRestrictionType': 0, 'previousRestrictionValue': 0,
				'newRestrictionType': 1, 'newRestrictionValue': 1
			})
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, [definition, global_restriction])
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				# Act + Assert:
				for transaction in (definition, global_restriction):
					with self.assertRaises(SymbolDataUnavailable) as error:
						database.get_transaction_detail(transaction['hash'])
						# Assert:
						self.assertIn('required mosaic relation', str(error.exception))

	def test_get_transaction_detail_uses_one_repeatable_read_snapshot_for_transaction_and_state(self):
		# Arrange:
		transaction = _complete_transaction(4, 1)
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			[create_symbol_block(4)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(4, [transaction])
			database = PausingAfterSyncStateReadDetailDatabase(db_config)
			try:
				# Act + Assert:
				result = read_during_database_snapshot(
					database,
					lambda: database.get_transaction_detail(transaction['hash']),
					lambda: _update_detail_snapshot(puller_database))
			finally:
				database.close()

		# Assert:
		self.assertEqual(4, result.record.transaction.effective_fee)


def _update_detail_snapshot(puller_database):
	with puller_database.connection.cursor() as cursor:
		cursor.execute('UPDATE symbol_transactions SET effective_fee = 999 WHERE height = 4')
	puller_database.connection.commit()


def _update_pending_supplement_snapshot(puller_database, initial_namespace, mosaic_id):
	updated_namespace = dict(initial_namespace)
	updated_namespace['full_name'] = 'after.name'
	updated_mosaic = create_symbol_mosaic(mosaic_id, 6)
	puller_database.upsert_namespace(updated_namespace, [])
	puller_database.upsert_mosaic(updated_mosaic)
