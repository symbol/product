# pylint: disable=too-many-lines
import datetime
import sqlite3
import time
import unittest

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nem.Network import Address
from symbolchain.symbol.Network import Address as SymbolAddress

from bridge.db.WrapRequestDatabase import PayoutDetails, WrapRequestDatabase, WrapRequestErrorView, WrapRequestStatus, WrapRequestView
from bridge.models.WrapRequest import make_next_retry_wrap_request

from ..test.BridgeTestUtils import (
	HASHES,
	HEIGHTS,
	NEM_ADDRESSES,
	PUBLIC_KEYS,
	SYMBOL_ADDRESSES,
	assert_equal_request,
	assert_timestamp_within_last_second,
	make_request,
	make_request_error
)
from ..test.DatabaseTestUtils import (
	get_all_table_names,
	get_default_filtering_test_parameters,
	seed_database_with_many_errors,
	seed_database_with_many_requests,
	seed_database_with_simple_errors,
	seed_database_with_simple_requests
)
from ..test.MockNetworkFacade import MockNemNetworkFacade, MockSymbolNetworkFacade

# region factories


def make_request_error_tuple(index, message, **kwargs):
	hash_index = kwargs.get('hash_index', index)
	address = Address(NEM_ADDRESSES[kwargs.get('address_index', index)])

	return (
		kwargs.get('height', HEIGHTS[index]),
		Hash256(HASHES[hash_index]).bytes,
		kwargs.get('transaction_subindex', 0),
		address.bytes,
		message)


def make_request_tuple(index, **kwargs):
	height = kwargs.get('height', HEIGHTS[index])
	hash_index = kwargs.get('hash_index', index)
	address = Address(NEM_ADDRESSES[kwargs.get('address_index', index)])
	destination_address = PublicKey(PUBLIC_KEYS[kwargs.get('destination_address_index', index)])

	return (
		height,
		Hash256(HASHES[hash_index]).bytes,
		kwargs.get('transaction_subindex', 0),
		address.bytes,
		height % 1000,
		f'0x{destination_address}',
		kwargs.get('status_id', 0),
		kwargs.get('payout_transaction_hash', None),
		kwargs.get('is_retried', False),
		kwargs.get('payout_sent_timestamp', None))


def _make_payout_details(transaction_hash, net_amount=0, total_fee=0):
	return PayoutDetails(transaction_hash, net_amount, total_fee, 0)

# endregion


class WrapRequestDatabaseTest(unittest.TestCase):
	# pylint: disable=too-many-public-methods

	# region shared test utils

	@staticmethod
	def _create_database(connection):
		return WrapRequestDatabase(connection, MockNemNetworkFacade(), MockSymbolNetworkFacade())

	@staticmethod
	def _nem_to_unix_timestamp(timestamp):
		return int(datetime.datetime(2015, 3, 29, 0, 6, 25, tzinfo=datetime.timezone.utc).timestamp()) + timestamp

	@staticmethod
	def _symbol_to_unix_timestamp(timestamp):
		return datetime.datetime(2022, 10, 31, 21, 7, 47, tzinfo=datetime.timezone.utc).timestamp() + timestamp / 1000

	@staticmethod
	def _query_all_errors(cursor):
		cursor.execute('''SELECT * FROM wrap_error ORDER BY request_transaction_hash DESC, request_transaction_subindex ASC''')
		return cursor.fetchall()

	@staticmethod
	def _query_all_requests(cursor):
		cursor.execute('''SELECT * FROM wrap_request ORDER BY request_transaction_hash DESC, request_transaction_subindex ASC''')
		return cursor.fetchall()

	@staticmethod
	def _query_all_payout_transactions(cursor):
		cursor.execute('''SELECT * FROM payout_transaction ORDER BY transaction_hash DESC''')
		return cursor.fetchall()

	@staticmethod
	def _query_all_block_metadatas(cursor):
		cursor.execute('''SELECT * FROM block_metadata ORDER BY height DESC''')
		return cursor.fetchall()

	@staticmethod
	def _query_all_payout_block_metadatas(cursor):
		cursor.execute('''SELECT * FROM payout_block_metadata ORDER BY height DESC''')
		return cursor.fetchall()

	def _assert_equal_requests(self, expected_requests, actual_requests):
		self.assertEqual(len(expected_requests), len(actual_requests))

		stripped_expected_requests = []
		stripped_actual_requests = []
		for i, expected_request in enumerate(expected_requests):
			actual_request = actual_requests[i]
			if expected_request[-1]:
				if expected_request[-1] is True:
					assert_timestamp_within_last_second(actual_request[8])
				else:
					self.assertEqual(expected_request[-1][0], actual_request[8])  # value is wrapped in list so it can be set by callbacks
			else:
				self.assertEqual(None, actual_request[8])

			stripped_expected_requests.append(expected_request[:-1])
			stripped_actual_requests.append((*actual_request[:8], *actual_request[9:]))

		self.assertEqual(stripped_expected_requests, stripped_actual_requests)

	def _assert_can_insert_rows(self, seed, expected, post_insert_action):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection)
			database.create_tables()

			# Act:
			for error in seed['errors']:
				database.add_error(error)

			for request in seed['requests']:
				database.add_request(request)

			if post_insert_action:
				post_insert_action(database)

			# Assert:
			cursor = connection.cursor()
			actual_errors = self._query_all_errors(cursor)
			actual_requests = self._query_all_requests(cursor)

			self.assertEqual(expected['errors'], actual_errors)
			self._assert_equal_requests(expected['requests'], actual_requests)

			actual_payout_transactions = self._query_all_payout_transactions(cursor)
			self.assertEqual(expected.get('payout_transactions') or [], actual_payout_transactions)

			actual_block_metadatas = self._query_all_block_metadatas(cursor)
			self.assertEqual(expected.get('block_metadatas') or [], actual_block_metadatas)

			actual_payout_block_metadatas = self._query_all_payout_block_metadatas(cursor)
			self.assertEqual(expected.get('payout_block_metadatas') or [], actual_payout_block_metadatas)

	def _assert_can_insert_errors(self, seed_errors, expected_errors):
		self._assert_can_insert_rows(
			{'errors': seed_errors, 'requests': []},
			{'errors': expected_errors, 'requests': []},
			None)

	def _assert_can_insert_requests(self, seed_requests, expected_requests, **kwargs):
		self._assert_can_insert_rows(
			{'errors': [], 'requests': seed_requests},
			{
				'errors': kwargs.get('expected_errors', []),
				'requests': expected_requests,
				'payout_transactions': kwargs.get('expected_payout_transactions'),
				'block_metadatas': kwargs.get('expected_block_metadatas'),
				'payout_block_metadatas': kwargs.get('expected_payout_block_metadatas')
			},
			kwargs.get('post_insert_action'))

	# endregion

	# region create

	def test_can_create_tables(self):
		# Act:
		table_names = get_all_table_names(WrapRequestDatabase, MockNemNetworkFacade(), MockSymbolNetworkFacade())

		# Assert:
		self.assertEqual(set([
			'wrap_error', 'wrap_request', 'payout_transaction', 'block_metadata', 'payout_block_metadata', 'max_processed_height'
		]), table_names)

	# endregion

	# region add_error

	def test_can_add_errors(self):
		self._assert_can_insert_errors([
			make_request_error(0, 'this is an error message'),
			make_request_error(1, 'this is another error message'),
			make_request_error(2, 'error message')
		], [
			make_request_error_tuple(0, 'this is an error message'),
			make_request_error_tuple(1, 'this is another error message'),
			make_request_error_tuple(2, 'error message')
		])

	def test_can_add_multiple_errors_with_same_transaction_hash(self):
		self._assert_can_insert_errors([
			make_request_error(0, 'this is an error message'),
			make_request_error(1, 'this is another error message'),
			make_request_error(2, 'error message', hash_index=0, transaction_subindex=2)
		], [
			make_request_error_tuple(0, 'this is an error message'),
			make_request_error_tuple(2, 'error message', hash_index=0, transaction_subindex=2),
			make_request_error_tuple(1, 'this is another error message')
		])

	def test_cannot_add_multiple_errors_with_same_transaction_hash_and_subindex(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection)
			database.create_tables()

			database.add_error(make_request_error(0, 'this is an error message'))
			database.add_error(make_request_error(1, 'this is another error message'))

			# Act + Assert:
			with self.assertRaises(sqlite3.IntegrityError):
				database.add_error(make_request_error(2, 'error message', hash_index=0))

	def test_cannot_add_multiple_errors_with_same_transaction_hash_and_subindex_simulate_file_access(self):
		# Arrange:
		with sqlite3.connect('file:mem1?mode=memory&cache=shared', uri=True) as connection:
			database = self._create_database(connection)
			database.create_tables()

			database.add_error(make_request_error(0, 'this is an error message'))

			# Act + Assert:
			with sqlite3.connect('file:mem1?mode=memory&cache=shared', uri=True) as connection2:
				with self.assertRaises(sqlite3.IntegrityError):
					database2 = self._create_database(connection2)
					database2.add_error(make_request_error(1, 'this is different error message', hash_index=0))

	# endregion

	# region add_request

	def test_can_add_requests(self):
		self._assert_can_insert_requests(
			[make_request(index) for index in [0, 1, 2]],
			[make_request_tuple(index) for index in [0, 1, 2]])

	def test_can_add_multiple_requests_with_same_transaction_hash(self):
		self._assert_can_insert_requests([
			make_request(0),
			make_request(1),
			make_request(2, hash_index=0, transaction_subindex=2)
		], [
			make_request_tuple(0),
			make_request_tuple(2, hash_index=0, transaction_subindex=2),
			make_request_tuple(1)
		])

	def test_cannot_add_multiple_requests_with_same_transaction_hash_and_subindex(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection)
			database.create_tables()

			database.add_request(make_request(0))
			database.add_request(make_request(1))

			# Act + Assert:
			with self.assertRaises(sqlite3.IntegrityError):
				database.add_request(make_request(2, hash_index=0))

	def test_cannot_add_multiple_requests_with_same_transaction_hash_and_subindex_simulate_file_access(self):
		# Arrange:
		with sqlite3.connect('file:mem1?mode=memory&cache=shared', uri=True) as connection:
			database = self._create_database(connection)
			database.create_tables()

			database.add_request(make_request(0))

			# Act + Assert:
			with sqlite3.connect('file:mem1?mode=memory&cache=shared', uri=True) as connection2:
				with self.assertRaises(sqlite3.IntegrityError):
					database2 = self._create_database(connection2)
					database2.add_request(make_request(1, hash_index=0))

	# endregion

	# region requests

	@staticmethod
	def _prepare_database_for_requests_test(database):
		database.create_tables()

		normal_request_1 = make_request(0)     # *8905
		completed_request_1 = make_request(1)  # *8901
		normal_request_2 = make_request(2)     # *8903
		completed_request_2 = make_request(3)  # *8902

		for request in [normal_request_1, completed_request_1, normal_request_2, completed_request_2]:
			database.add_request(request)

		database.mark_payout_sent(completed_request_1, _make_payout_details(Hash256(HASHES[0])))
		database.mark_payout_completed(Hash256(HASHES[0]), 1234)

		database.mark_payout_sent(completed_request_2, _make_payout_details(Hash256(HASHES[1])))
		database.mark_payout_completed(Hash256(HASHES[1]), 1234)

		return (normal_request_1, completed_request_1, normal_request_2, completed_request_2)

	def test_can_retrieve_requests(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection)
			(
				normal_request_1, completed_request_1, normal_request_2, completed_request_2
			) = self._prepare_database_for_requests_test(database)

			# Act:
			requests = list(database.requests())

			# Assert: ordered by heights
			self.assertEqual(4, len(requests))
			assert_equal_request(self, normal_request_1, requests[3])
			assert_equal_request(self, completed_request_1, requests[0])
			assert_equal_request(self, normal_request_2, requests[2])
			assert_equal_request(self, completed_request_2, requests[1])

	# endregion

	# region is_synced_at_timestamp

	@staticmethod
	def _create_database_for_is_synced_at_timestamp_tests(connection):
		database = WrapRequestDatabaseTest._create_database(connection)
		database.create_tables()

		database.add_request(make_request(0, amount=1000, height=111))
		database.add_request(make_request(1, amount=3333, height=333))
		database.add_request(make_request(2, amount=2020, height=222))
		database.add_request(make_request(3, amount=1, height=222))

		database.set_block_timestamp(111, 1000)
		database.set_block_timestamp(222, 2000)
		database.set_block_timestamp(333, 4000)
		database.set_block_timestamp(444, 5000)

		database.set_max_processed_height(444)
		return database

	def test_is_synced_at_timestamp_is_only_true_when_timestamp_is_not_greater_than_max_processed_timestamp(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database_for_is_synced_at_timestamp_tests(connection)

			# Act + Assert:
			self.assertTrue(database.is_synced_at_timestamp(self._nem_to_unix_timestamp(0)))
			self.assertTrue(database.is_synced_at_timestamp(self._nem_to_unix_timestamp(2500)))
			self.assertTrue(database.is_synced_at_timestamp(self._nem_to_unix_timestamp(4999)))
			self.assertTrue(database.is_synced_at_timestamp(self._nem_to_unix_timestamp(5000)))

			self.assertFalse(database.is_synced_at_timestamp(self._nem_to_unix_timestamp(5001)))
			self.assertFalse(database.is_synced_at_timestamp(self._nem_to_unix_timestamp(10000)))

	# endregion

	# region cumulative_gross_amount_at

	@staticmethod
	def _prepare_database_for_batch_tests_requests_only(connection):
		database = WrapRequestDatabaseTest._create_database(connection)
		database.create_tables()

		requests = [
			make_request(0, amount=1000, height=111),
			make_request(1, amount=3333, height=333),
			make_request(2, amount=2020, height=222),
			make_request(3, amount=1, height=222)
		]

		for request in requests:
			database.add_request(request)

		return (database, requests)

	@staticmethod
	def _prepare_database_for_batch_tests(connection, payout_descriptor_tuples, retry_index=2):
		(database, requests) = WrapRequestDatabaseTest._prepare_database_for_batch_tests_requests_only(connection)

		for index, extra_params in payout_descriptor_tuples:
			database.mark_payout_sent(requests[index], _make_payout_details(Hash256(HASHES[index]), **extra_params))

			if index == retry_index:
				database.mark_payout_failed_transient(requests[retry_index], 'transient failure, being retried')
				database.mark_payout_sent(
					make_next_retry_wrap_request(requests[retry_index]),
					_make_payout_details(Hash256(HASHES[-1]), **extra_params))

		database.set_block_timestamp(111, 1000)
		database.set_block_timestamp(222, 2000)
		database.set_block_timestamp(333, 4000)
		return database

	def test_cumulative_gross_amount_at_is_zero_when_empty(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection)
			database.create_tables()

			# Act:
			amount = database.cumulative_gross_amount_at(10000)

			# Assert:
			self.assertEqual(0, amount)

	def _assert_cumulative_gross_amount_at_is_calculated_correctly_at_timestamps(self, timestamp_amount_pairs):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._prepare_database_for_batch_tests(connection, [
				(0, {'net_amount': 100, 'total_fee': 43}),
				(1, {'net_amount': 300, 'total_fee': 21}),
				(2, {'net_amount': 200, 'total_fee': 32}),
				(3, {'net_amount': 400, 'total_fee': 10})
			])

			for (timestamp, expected_amount) in timestamp_amount_pairs:
				# Act:
				amount = database.cumulative_gross_amount_at(self._nem_to_unix_timestamp(timestamp))

				# Assert:
				self.assertEqual(expected_amount, amount, f'at timestamp {timestamp}')

	def test_cumulative_gross_amount_at_is_calculated_correctly_when_requests_present(self):
		self._assert_cumulative_gross_amount_at_is_calculated_correctly_at_timestamps([
			(999, 0),
			(1000, 100 + 43),
			(1001, 100 + 43),

			(1999, 100 + 43),
			(2000, 700 + 85),
			(2001, 700 + 85),

			(3999, 700 + 85),
			(4000, 1000 + 106),
			(4001, 1000 + 106)
		])

	# endregion

	# region cumulative_gross_amount_sent_since

	@staticmethod
	def _prepare_database_for_sent_since_batch_tests(connection, payout_descriptor_tuples, retry_index=2):
		(database, requests) = WrapRequestDatabaseTest._prepare_database_for_batch_tests_requests_only(connection)

		datetime_markers = []

		for index, extra_params in payout_descriptor_tuples:
			datetime_markers.append(datetime.datetime.now(datetime.timezone.utc))

			time.sleep(0.1)
			database.mark_payout_sent(requests[index], _make_payout_details(Hash256(HASHES[index]), **extra_params))
			time.sleep(0.1)

			if index == retry_index:
				database.mark_payout_failed_transient(requests[retry_index], 'transient failure, being retried')
				database.mark_payout_sent(
					make_next_retry_wrap_request(requests[retry_index]),
					_make_payout_details(Hash256(HASHES[-1]), **extra_params))

		return (database, datetime_markers)

	def test_cumulative_gross_amount_sent_since_is_zero_when_empty(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection)
			database.create_tables()

			# Act:
			amount = database.cumulative_gross_amount_sent_since(10000)

			# Assert:
			self.assertEqual(0, amount)

	def test_cumulative_gross_amount_sent_since_is_calculated_correctly_when_requests_present(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			(database, datetime_markers) = self._prepare_database_for_sent_since_batch_tests(connection, [
				(0, {'net_amount': 100, 'total_fee': 43}),
				(1, {'net_amount': 300, 'total_fee': 21}),
				(2, {'net_amount': 200, 'total_fee': 32}),
				(3, {'net_amount': 400, 'total_fee': 10})
			])

			timestamp_amount_pairs = [
				(datetime_markers[0], 1000 + 106),
				(datetime_markers[1], 900 + 63),
				(datetime_markers[2], 600 + 42),
				(datetime_markers[3], 400 + 10),
				(datetime.datetime.now(datetime.timezone.utc), 0)
			]
			for (timestamp_datetime, expected_amount) in timestamp_amount_pairs:
				# Act:
				amount = database.cumulative_gross_amount_sent_since(timestamp_datetime.timestamp())

				# Assert:
				self.assertEqual(expected_amount, amount, f'at timestamp {timestamp_datetime.timestamp()}')

	# endregion

	# region payout_transaction_hashes_at

	def test_payout_transaction_hashes_at_returns_empty_when_empty(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection)
			database.create_tables()

			# Act:
			transaction_hashes = list(database.payout_transaction_hashes_at(10000))

			# Assert:
			self.assertEqual([], transaction_hashes)

	def _assert_payout_transaction_hashes_at_is_calculated_correctly_at_timestamps(self, timestamp_hash_indexes_pairs):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._prepare_database_for_batch_tests(connection, [(index, {}) for index in range(4)], 3)

			for (timestamp, expected_transaction_hash_indexes) in timestamp_hash_indexes_pairs:
				# Act:
				transaction_hashes = list(database.payout_transaction_hashes_at(self._nem_to_unix_timestamp(timestamp)))

				# Assert:
				expected_transaction_hashes = [Hash256(HASHES[i]) for i in expected_transaction_hash_indexes]
				self.assertEqual(expected_transaction_hashes, transaction_hashes, f'at timestamp {timestamp}')

	def test_payout_transaction_hashes_at_is_calculated_correctly_when_requests_present(self):
		self._assert_payout_transaction_hashes_at_is_calculated_correctly_at_timestamps([
			(999, []),
			(1000, [0]),
			(1001, [0]),

			(1999, [0]),
			(2000, [0, 2, -1]),  # requests[3] is retried and mapped to HASHES[-1]
			(2001, [0, 2, -1]),

			(3999, [0, 2, -1]),
			(4000, [0, 1, 2, -1]),
			(4001, [0, 1, 2, -1])
		])

	def test_payout_transaction_hashes_at_skips_requests_without_payouts(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._prepare_database_for_batch_tests(connection, [(index, {}) for index in (0, 1, 3)], 1)

			# Act:
			transaction_hashes = list(database.payout_transaction_hashes_at(self._nem_to_unix_timestamp(4001)))

			# Assert: even though transaction 2 is <= timestamp, it's ignored because it doesn't have a payout transaction
			#         requests[1] is retried and mapped to HASHES[-1]
			self.assertEqual([Hash256(HASHES[i]) for i in (0, 3, -1)], transaction_hashes)

	# endregion

	# region sum_payout_transaction_amounts

	def test_sum_payout_transaction_amounts_returns_zero_when_empty(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection)
			database.create_tables()

			# Act:
			amount = database.sum_payout_transaction_amounts([Hash256(HASHES[i]) for i in range(len(HASHES))])

			# Assert:
			self.assertEqual(0, amount)

	def _assert_sum_payout_transaction_amounts_is_calculated_correctly(self, hash_indexes_amount_pairs):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._prepare_database_for_batch_tests(connection, [(index, {}) for index in range(4)])

			for (hash_indexes, expected_amount) in hash_indexes_amount_pairs:
				# Act:
				amount = database.sum_payout_transaction_amounts([Hash256(HASHES[i]) for i in hash_indexes])

				# Assert:
				self.assertEqual(expected_amount, amount)

	def test_sum_payout_transaction_amounts_is_calculated_correctly(self):
		self._assert_sum_payout_transaction_amounts_is_calculated_correctly([
			([], 0),
			([0], 1000),
			([0, 2, 3], 3021),
			([0, 1, 2, 3], 6354)
		])

	# endregion

	# region mark_payout_sent

	def test_can_mark_payout_sent_single(self):
		# Arrange:
		payout_transaction_hash = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
		seed_requests = [make_request(index) for index in range(0, 3)]

		def post_insert_action(database):
			database.mark_payout_sent(seed_requests[1], PayoutDetails(payout_transaction_hash, 1100, 300, 12))

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0),
			# should reflect status change from post_insert_action
			make_request_tuple(1, status_id=1, payout_transaction_hash=payout_transaction_hash.bytes, payout_sent_timestamp=True),
			make_request_tuple(2),
		], expected_payout_transactions=[
			(payout_transaction_hash.bytes, 1100, 300, 12, 0)
		], post_insert_action=post_insert_action)

	def test_can_mark_payout_sent_single_scoped_to_sub_index(self):
		# Arrange:
		payout_transaction_hash = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
		seed_requests = [make_request(index, hash_index=0, transaction_subindex=index) for index in range(0, 3)]

		def post_insert_action(database):
			database.mark_payout_sent(seed_requests[1], PayoutDetails(payout_transaction_hash, 1100, 300, 12))

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0, hash_index=0),
			# should reflect status change from post_insert_action
			make_request_tuple(
				1,
				hash_index=0,
				transaction_subindex=1,
				status_id=1,
				payout_transaction_hash=payout_transaction_hash.bytes,
				payout_sent_timestamp=True),
			make_request_tuple(2, hash_index=0, transaction_subindex=2)
		], expected_payout_transactions=[
			(payout_transaction_hash.bytes, 1100, 300, 12, 0)
		], post_insert_action=post_insert_action)

	def test_cannot_mark_payout_sent_multiple_with_same_payout_transaction_hash(self):
		# Arrange:
		payout_transaction_hash = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
		seed_requests = [make_request(index) for index in range(0, 3)]

		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection)
			database.create_tables()

			for seed_request in seed_requests:
				database.add_request(seed_request)

			database.mark_payout_sent(make_request(0), _make_payout_details(payout_transaction_hash))

			# Act + Assert:
			with self.assertRaises(sqlite3.IntegrityError):
				database.mark_payout_sent(make_request(2), _make_payout_details(payout_transaction_hash))

	# endregion

	# region mark_payout_failed

	def test_can_mark_payout_failed_before_send_single(self):
		# Arrange:
		seed_requests = [make_request(index) for index in range(0, 3)]

		def post_insert_action(database):
			database.mark_payout_failed(seed_requests[1], 'failed to send payout')

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0),
			# should reflect status change from post_insert_action
			make_request_tuple(1, status_id=3),
			make_request_tuple(2),
		], expected_errors=[
			make_request_error_tuple(1, 'failed to send payout')
		], post_insert_action=post_insert_action)

	def test_can_mark_payout_failed_after_send_single(self):
		# Arrange:
		payout_transaction_hash = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
		seed_requests = [make_request(index) for index in range(0, 3)]

		def post_insert_action(database):
			database.mark_payout_sent(seed_requests[1], PayoutDetails(payout_transaction_hash, 1100, 300, 12))
			database.mark_payout_failed(seed_requests[1], 'failed to send payout')

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0),
			# should reflect status change from post_insert_action
			make_request_tuple(1, status_id=3, payout_transaction_hash=payout_transaction_hash.bytes, payout_sent_timestamp=True),
			make_request_tuple(2),
		], expected_errors=[
			make_request_error_tuple(1, 'failed to send payout')
		], expected_payout_transactions=[
			(payout_transaction_hash.bytes, 1100, 300, 12, -1)  # height marked as -1 to indicate failure
		], post_insert_action=post_insert_action)

	def test_can_mark_payout_failed_single_scoped_to_sub_index(self):
		# Arrange:
		seed_requests = [make_request(index, hash_index=0, transaction_subindex=index) for index in range(0, 3)]

		def post_insert_action(database):
			database.mark_payout_failed(seed_requests[1], 'failed to send payout')

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0, hash_index=0),
			# should reflect status change from post_insert_action
			make_request_tuple(1, hash_index=0, transaction_subindex=1, status_id=3),
			make_request_tuple(2, hash_index=0, transaction_subindex=2)
		], expected_errors=[
			make_request_error_tuple(1, 'failed to send payout', hash_index=0, transaction_subindex=1)
		], post_insert_action=post_insert_action)

	# endregion

	# region mark_payout_failed_transient

	def test_can_mark_payout_failed_before_send_transient(self):
		# Arrange:
		seed_requests = [make_request(index) for index in range(0, 3)]

		def post_insert_action(database):
			database.mark_payout_failed_transient(seed_requests[1], 'failed to send payout (transient)')

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0),
			# should reflect status change from post_insert_action
			make_request_tuple(1, status_id=3, is_retried=True),
			# unprocessed request added with different subindex
			make_request_tuple(1, transaction_subindex=0x00010000),
			make_request_tuple(2),
		], expected_errors=[
			make_request_error_tuple(1, 'failed to send payout (transient)')
		], post_insert_action=post_insert_action)

	def test_can_mark_payout_failed_after_send_transient(self):
		# Arrange:
		payout_transaction_hash = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
		seed_requests = [make_request(index) for index in range(0, 3)]

		original_payout_sent_timestamp = []  # wrap in a list so it can be set by callback

		def post_insert_action(database):
			database.mark_payout_sent(seed_requests[1], PayoutDetails(payout_transaction_hash, 1100, 300, 12))
			original_payout_sent_timestamp.append(database.payout_sent_timestamp_for_request(seed_requests[1]))

			time.sleep(0.25)  # simulate a delay before request is marked as failed (transient)
			database.mark_payout_failed_transient(seed_requests[1], 'failed to send payout (transient)')

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0),
			# should reflect status change from post_insert_action
			make_request_tuple(
				1,
				status_id=3,
				payout_transaction_hash=payout_transaction_hash.bytes,
				is_retried=True,
				payout_sent_timestamp=original_payout_sent_timestamp),
			# unprocessed request added with different subindex
			make_request_tuple(
				1,
				transaction_subindex=0x00010000,
				payout_sent_timestamp=original_payout_sent_timestamp),  # payout_sent_timestamp should be carried over
			make_request_tuple(2),
		], expected_errors=[
			make_request_error_tuple(1, 'failed to send payout (transient)')
		], expected_payout_transactions=[
			(payout_transaction_hash.bytes, 1100, 300, 12, -1)  # height marked as -1 to indicate failure
		], post_insert_action=post_insert_action)

	def test_can_resend_payout_after_original_send_failed_transient(self):
		# Arrange:
		payout_transaction_hash = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
		payout_transaction_hash_2 = Hash256('F4BD97BA18C3E03C1D6B4494C2C9B665E46815C153BA56BD4217E24C7938F917')
		seed_requests = [make_request(index) for index in range(0, 3)]

		original_payout_sent_timestamp = []  # wrap in a list so it can be set by callback

		def post_insert_action(database):
			database.mark_payout_sent(seed_requests[1], PayoutDetails(payout_transaction_hash, 1100, 300, 12))
			original_payout_sent_timestamp.append(database.payout_sent_timestamp_for_request(seed_requests[1]))

			time.sleep(0.25)  # simulate a delay before request is marked as failed (transient) and resent
			database.mark_payout_failed_transient(seed_requests[1], 'failed to send payout (transient)')
			database.mark_payout_sent(
				make_next_retry_wrap_request(seed_requests[1]),
				PayoutDetails(payout_transaction_hash_2, 1000, 400, 20))

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0),
			# should reflect status change from post_insert_action
			make_request_tuple(
				1,
				status_id=3,
				payout_transaction_hash=payout_transaction_hash.bytes,
				is_retried=True,
				payout_sent_timestamp=original_payout_sent_timestamp),
			# unprocessed request added with different subindex
			make_request_tuple(
				1,
				status_id=1,
				transaction_subindex=0x00010000,
				payout_transaction_hash=payout_transaction_hash_2.bytes,
				payout_sent_timestamp=original_payout_sent_timestamp),  # payout_sent_timestamp should be carried over
			make_request_tuple(2),
		], expected_errors=[
			make_request_error_tuple(1, 'failed to send payout (transient)')
		], expected_payout_transactions=[
			(payout_transaction_hash_2.bytes, 1000, 400, 20, 0),
			(payout_transaction_hash.bytes, 1100, 300, 12, -1),  # height marked as -1 to indicate failure
		], post_insert_action=post_insert_action)

	def test_can_mark_payout_failed_transient_single_scoped_to_sub_index(self):
		# Arrange:
		seed_requests = [make_request(index, hash_index=0, transaction_subindex=index) for index in range(0, 3)]

		def post_insert_action(database):
			database.mark_payout_failed_transient(seed_requests[1], 'failed to send payout (transient)')

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0, hash_index=0),
			# should reflect status change from post_insert_action
			make_request_tuple(1, hash_index=0, transaction_subindex=1, status_id=3, is_retried=True),
			make_request_tuple(2, hash_index=0, transaction_subindex=2),
			# unprocessed request added with different subindex
			make_request_tuple(1, hash_index=0, transaction_subindex=0x00010001),
		], expected_errors=[
			make_request_error_tuple(1, 'failed to send payout (transient)', hash_index=0, transaction_subindex=1)
		], post_insert_action=post_insert_action)

	# endregion

	# region mark_payout_completed

	def test_can_mark_payout_completed_single(self):
		# Arrange:
		payout_transaction_hash = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
		seed_requests = [make_request(index) for index in range(0, 3)]

		def post_insert_action(database):
			database.mark_payout_sent(seed_requests[1], PayoutDetails(payout_transaction_hash, 1100, 300, 12))
			database.mark_payout_completed(payout_transaction_hash, 1122)

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0),
			# should reflect status change from post_insert_action
			make_request_tuple(1, status_id=2, payout_transaction_hash=payout_transaction_hash.bytes, payout_sent_timestamp=True),
			make_request_tuple(2),
		], expected_payout_transactions=[
			(payout_transaction_hash.bytes, 1100, 300, 12, 1122)
		], expected_payout_block_metadatas=[
			(1122, 0)
		], post_insert_action=post_insert_action)

	def test_can_mark_payout_completed_single_scoped_to_sub_index(self):
		# Arrange:
		payout_transaction_hash = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
		seed_requests = [make_request(index, hash_index=0, transaction_subindex=index) for index in range(0, 3)]

		def post_insert_action(database):
			database.mark_payout_sent(seed_requests[1], PayoutDetails(payout_transaction_hash, 1100, 300, 1.2))
			database.mark_payout_completed(payout_transaction_hash, 1122)

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0, hash_index=0),
			# should reflect status change from post_insert_action
			make_request_tuple(
				1,
				hash_index=0,
				transaction_subindex=1,
				status_id=2,
				payout_transaction_hash=payout_transaction_hash.bytes,
				payout_sent_timestamp=True),
			make_request_tuple(2, hash_index=0, transaction_subindex=2)
		], expected_payout_transactions=[
			(payout_transaction_hash.bytes, 1100, 300, 1.2, 1122)
		], expected_payout_block_metadatas=[
			(1122, 0)
		], post_insert_action=post_insert_action)

	def test_can_mark_payout_completed_single_does_not_overwrite_block_timestamp(self):
		# Arrange:
		payout_transaction_hash = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
		seed_requests = [make_request(index, hash_index=0, transaction_subindex=index) for index in range(0, 3)]

		def post_insert_action(database):
			database.set_payout_block_timestamp(1122, 98765)
			database.mark_payout_sent(seed_requests[1], PayoutDetails(payout_transaction_hash, 1100, 300, 12))
			database.mark_payout_completed(payout_transaction_hash, 1122)

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0, hash_index=0),
			# should reflect status change from post_insert_action
			make_request_tuple(
				1,
				hash_index=0,
				transaction_subindex=1,
				status_id=2,
				payout_transaction_hash=payout_transaction_hash.bytes,
				payout_sent_timestamp=True),
			make_request_tuple(2, hash_index=0, transaction_subindex=2)
		], expected_payout_transactions=[
			(payout_transaction_hash.bytes, 1100, 300, 12, 1122)
		], expected_payout_block_metadatas=[
			# timestamp is not overwritten
			(1122, self._symbol_to_unix_timestamp(98765))
		], post_insert_action=post_insert_action)

	# endregion

	# region reset

	def _assert_reset(self, max_processed_height, expected_errors, expected_requests):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection)
			database.create_tables()

			if expected_errors:
				for (index, height) in [(0, 12345678902), (1, 12345678907), (2, 12345678904)]:
					database.add_error(make_request_error(index, 'error message', height=height))

			if expected_requests:
				for (index, height) in [(0, 12345678903), (1, 12345678909), (2, 12345678902)]:
					database.add_request(make_request(index, height=height))

			database.set_max_processed_height(max_processed_height)

			# Act:
			database.reset()

			# Assert:
			cursor = connection.cursor()
			actual_errors = self._query_all_errors(cursor)
			actual_requests = self._query_all_requests(cursor)

			self.assertEqual(
				[make_request_error_tuple(index, 'error message', height=height) for (index, height) in expected_errors],
				actual_errors)
			self._assert_equal_requests(
				[make_request_tuple(index, height=height) for (index, height) in expected_requests],
				actual_requests)

	def test_reset_deletes_rows_when_errors_are_present(self):
		self._assert_reset(12345678904, [(0, 12345678902), (2, 12345678904)], [])

	def test_reset_deletes_rows_when_requests_are_present(self):
		self._assert_reset(12345678903, [], [(0, 12345678903), (2, 12345678902)])

	def test_reset_deletes_rows_when_errors_and_requests_are_present(self):
		self._assert_reset(12345678903, [(0, 12345678902)], [(0, 12345678903), (2, 12345678902)])

	# endregion

	# region set_block_timestamp / lookup_block_timestamp / lookup_block_height

	def test_can_set_block_timestamp(self):
		# Arrange:
		def post_insert_action(database):
			database.set_block_timestamp(1122, 98765)

		# Act + Assert:
		self._assert_can_insert_requests([], [], expected_block_metadatas=[
			(1122, self._nem_to_unix_timestamp(98765))
		], post_insert_action=post_insert_action)

	def test_can_overrwrite_block_timestamp(self):
		# Arrange:
		def post_insert_action(database):
			database.set_block_timestamp(1122, 98765)
			database.set_block_timestamp(1122, 77553)

		# Act + Assert:
		self._assert_can_insert_requests([], [], expected_block_metadatas=[
			(1122, self._nem_to_unix_timestamp(77553))
		], post_insert_action=post_insert_action)

	@staticmethod
	def _create_database_for_block_metadata_lookup_tests(connection):
		database = WrapRequestDatabaseTest._create_database(connection)
		database.create_tables()

		database.set_block_timestamp(111, 1000)
		database.set_block_timestamp(222, 2000)
		database.set_block_timestamp(333, 4000)
		return database

	def _assert_lookup_block_timestamp(self, height, expected_timestamp):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database_for_block_metadata_lookup_tests(connection)

			# Act:
			timestamp = database.lookup_block_timestamp(height)

			# Assert:
			self.assertEqual(expected_timestamp, timestamp)

	def test_cannot_lookup_block_timestamp_when_not_present(self):
		self._assert_lookup_block_timestamp(300, None)

	def test_can_lookup_block_timestamp_when_present(self):
		self._assert_lookup_block_timestamp(222, self._nem_to_unix_timestamp(2000))

	def _assert_lookup_block_heights(self, timestamp_height_pairs):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database_for_block_metadata_lookup_tests(connection)

			for (timestamp, expected_height) in timestamp_height_pairs:
				# Act:
				height = database.lookup_block_height(self._nem_to_unix_timestamp(timestamp))

				# Assert:
				self.assertEqual(expected_height, height, f'at timestamp {timestamp}')

	def test_cannot_lookup_block_height_when_no_matching_block_present(self):
		self._assert_lookup_block_heights([(900, 0)])

	def test_can_lookup_block_height_when_present(self):
		self._assert_lookup_block_heights([
			(999, 0),
			(1000, 111),
			(1001, 111),

			(1999, 111),
			(2000, 222),
			(2001, 222),

			(3999, 222),
			(4000, 333),
			(4001, 333)
		])

	# endregion

	# region set_payout_block_metadata

	def test_can_set_payout_block_timestamp(self):
		# Arrange:
		def post_insert_action(database):
			database.set_payout_block_timestamp(1122, 98765)

		# Act + Assert:
		self._assert_can_insert_requests([], [], expected_payout_block_metadatas=[
			(1122, self._symbol_to_unix_timestamp(98765))
		], post_insert_action=post_insert_action)

	def test_can_overrwrite_payout_block_timestamp(self):
		# Arrange:
		def post_insert_action(database):
			database.set_payout_block_timestamp(1122, 98765)
			database.set_payout_block_timestamp(1122, 77553)

		# Act + Assert:
		self._assert_can_insert_requests([], [], expected_payout_block_metadatas=[
			(1122, self._symbol_to_unix_timestamp(77553))
		], post_insert_action=post_insert_action)

	# endregion

	# region requests_by_status

	@staticmethod
	def _prepare_database_for_grouping_tests(connection):
		database = WrapRequestDatabaseTest._create_database(connection)
		database.create_tables()

		seed_requests = [make_request(index) for index in range(5)]

		for request in seed_requests:
			database.add_request(request)

		payout_transaction_hashes = [
			Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D'),
			Hash256('7B055CD0A0A6C0F8BA9677076288A15F2BC6BEF42CEB5A6789EF9E4A8146E79F'),
			Hash256('DFB984176817C3C2F001F6DEF3E46096EC52C33A1A63759A8FB9E1B46859C098'),
			Hash256('92D42E9C4CA9F3255BFB68AA3F205EF134EAC1F2FA22EA3E4C22FE6FFF46AE0A')
		]
		database.mark_payout_sent(seed_requests[0], _make_payout_details(payout_transaction_hashes[0]))  # *8905
		database.mark_payout_sent(seed_requests[1], _make_payout_details(payout_transaction_hashes[1]))  # *8901
		database.mark_payout_completed(payout_transaction_hashes[1], 1234)
		database.mark_payout_sent(seed_requests[3], _make_payout_details(payout_transaction_hashes[2]))  # *8902

		database.mark_payout_sent(seed_requests[4], _make_payout_details(payout_transaction_hashes[3]))  # *8999
		database.mark_payout_failed(seed_requests[4], 'failed request')

		return (database, seed_requests, payout_transaction_hashes)

	def test_can_get_all_requests_with_specified_status(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			(database, seed_requests, _) = self._prepare_database_for_grouping_tests(connection)

			# Act:
			requests = database.requests_by_status(WrapRequestStatus.SENT)

			# Assert: height sorted (ascending)
			self.assertEqual(2, len(requests))
			assert_equal_request(self, seed_requests[3], requests[0])
			assert_equal_request(self, seed_requests[0], requests[1])

	# endregion

	# region unconfirmed_payout_transaction_hashes

	def test_can_get_unconfirmed_payout_transaction_hashes(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			(database, _, payout_transaction_hashes) = self._prepare_database_for_grouping_tests(connection)

			# Act:
			hashes = database.unconfirmed_payout_transaction_hashes()

			# Assert:
			self.assertEqual([payout_transaction_hashes[i] for i in (0, 2)], hashes)

	# endregion

	# region payout_transaction_hash_for_request

	def test_can_get_payout_transaction_hash_for_request_for_request_in_sent_state(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			(database, seed_requests, payout_transaction_hashes) = self._prepare_database_for_grouping_tests(connection)

			# Act:
			payout_transaction_hash = database.payout_transaction_hash_for_request(seed_requests[3])

			# Assert:
			self.assertEqual(payout_transaction_hashes[2], payout_transaction_hash)

	def test_can_get_payout_transaction_hash_for_request_for_request_in_pre_sent_state(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			(database, seed_requests, _) = self._prepare_database_for_grouping_tests(connection)

			# Act:
			payout_transaction_hash = database.payout_transaction_hash_for_request(seed_requests[2])

			# Assert:
			self.assertEqual(None, payout_transaction_hash)

	def test_can_get_payout_transaction_hash_for_request_for_unknown_request(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			(database, _, _) = self._prepare_database_for_grouping_tests(connection)

			# Act:
			payout_transaction_hash = database.payout_transaction_hash_for_request(make_request(5))

			# Assert:
			self.assertEqual(None, payout_transaction_hash)

	# endregion

	# region payout_sent_timestamp_for_request

	def test_can_get_payout_sent_timestamp_for_request_for_request_in_sent_state(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			(database, seed_requests, _) = self._prepare_database_for_grouping_tests(connection)

			# Act:
			timestamp = database.payout_sent_timestamp_for_request(seed_requests[3])

			# Assert:
			assert_timestamp_within_last_second(timestamp)

	def test_can_get_payout_sent_timestamp_for_request_for_request_in_pre_sent_state(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			(database, seed_requests, _) = self._prepare_database_for_grouping_tests(connection)

			# Act:
			timestamp = database.payout_sent_timestamp_for_request(seed_requests[2])

			# Assert:
			self.assertEqual(None, timestamp)

	def test_can_get_payout_sent_timestamp_for_request_for_unknown_request(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			(database, _, _) = self._prepare_database_for_grouping_tests(connection)

			# Act:
			timestamp = database.payout_sent_timestamp_for_request(make_request(5))

			# Assert:
			self.assertEqual(None, timestamp)

	# endregion

	# region find_errors - single lookup

	def _assert_can_find_errors_simple(self, address, expected_view):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection)
			database.create_tables()
			seed_database_with_simple_errors(database)

			# Act:
			views = list(database.find_errors(address))

			# Assert:
			if not expected_view:
				self.assertEqual(0, len(views))
			else:
				self.assertEqual(1, len(views))
				self.assertEqual(expected_view, views[0])

	def test_can_find_error_by_address(self):
		expected_view = WrapRequestErrorView(
			222,
			Hash256(HASHES[1]),
			0,
			Address(NEM_ADDRESSES[1]),
			'this is another error message',
			self._nem_to_unix_timestamp(3040))
		self._assert_can_find_errors_simple(Address(NEM_ADDRESSES[1]), expected_view)

	def test_cannot_find_error_by_address_with_no_matches(self):
		self._assert_can_find_errors_simple(Address(NEM_ADDRESSES[4]), None)

	# endregion

	# region find_errors - filtering

	def _assert_can_find_errors_filtering(self, find_errors_params, expected_heights):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection)
			database.create_tables()
			seed_database_with_many_errors(database)

			# Act:
			views = list(database.find_errors(*find_errors_params))
			heights = [view.request_transaction_height for view in views]

			# Assert:
			self.assertEqual(expected_heights, heights)

	def test_can_find_all_errors(self):
		test_params = get_default_filtering_test_parameters()
		self._assert_can_find_errors_filtering([], test_params.expected_all)

	def test_can_find_errors_by_address(self):
		test_params = get_default_filtering_test_parameters()
		self._assert_can_find_errors_filtering([Address(NEM_ADDRESSES[test_params.address_index])], test_params.expected_address_filter)

	def test_can_find_errors_by_transaction_hash(self):
		test_params = get_default_filtering_test_parameters()
		self._assert_can_find_errors_filtering([
			None,
			Hash256(HASHES[test_params.hash_index])
		], test_params.expected_hash_filter)

	def test_can_find_errors_by_address_and_transaction_hash(self):
		test_params = get_default_filtering_test_parameters()
		self._assert_can_find_errors_filtering([
			Address(NEM_ADDRESSES[test_params.address_index]),
			Hash256(HASHES[test_params.hash_index])
		], test_params.expected_hash_filter)

	def test_can_find_errors_with_custom_offset_and_limit(self):
		test_params = get_default_filtering_test_parameters()
		self._assert_can_find_errors_filtering([
			Address(NEM_ADDRESSES[test_params.address_index]),
			None,
			test_params.offset,
			test_params.limit
		], test_params.expected_custom_offset_and_limit)

	def test_can_find_errors_with_custom_offset_and_limit_and_custom_sort(self):
		test_params = get_default_filtering_test_parameters()
		self._assert_can_find_errors_filtering([
			Address(NEM_ADDRESSES[test_params.address_index]),
			None,
			test_params.offset,
			test_params.limit,
			False
		], test_params.expected_custom_offset_and_limit_desc)

	# endregion

	# region find_requests - single lookup

	def _assert_can_find_requests_simple(self, address, expected_view):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection)
			database.create_tables()
			seed_database_with_simple_requests(database)

			# Act:
			views = list(database.find_requests(address))

			# Assert:
			if not expected_view:
				self.assertEqual(0, len(views))
			else:
				self.assertEqual(1, len(views))

				if expected_view.payout_sent_timestamp:
					# if True, validate timestamp is within range
					assert_timestamp_within_last_second(views[0].payout_sent_timestamp)
					expected_view = expected_view._replace(payout_sent_timestamp=views[0].payout_sent_timestamp)

				self.assertEqual(expected_view, views[0])

	def test_can_find_request_by_hash_exists_unprocessed(self):
		expected_view = WrapRequestView(
			111,
			Hash256(HASHES[0]),
			0,
			Address(NEM_ADDRESSES[0]),
			5554,
			SymbolAddress(SYMBOL_ADDRESSES[0]),
			0,
			None,
			None,
			self._nem_to_unix_timestamp(1020),
			*([None] * 6))
		self._assert_can_find_requests_simple(Address(NEM_ADDRESSES[0]), expected_view)

	def test_can_find_request_by_hash_exists_sent(self):
		expected_view = WrapRequestView(
			222,
			Hash256(HASHES[1]),
			0,
			Address(NEM_ADDRESSES[1]),
			8865,
			SymbolAddress(SYMBOL_ADDRESSES[1]),
			1,
			Hash256('066E5BF4B539230E12DD736D44CEFB5274FACBABC22735F2264A40F72AFB0124'),
			True,
			self._nem_to_unix_timestamp(3040),
			0,
			2200,
			450,
			156,
			None,
			None)
		self._assert_can_find_requests_simple(Address(NEM_ADDRESSES[1]), expected_view)

	def test_can_find_request_by_hash_exists_completed(self):
		expected_view = WrapRequestView(
			333,
			Hash256(HASHES[2]),
			0,
			Address(NEM_ADDRESSES[2]),
			8889,
			SymbolAddress(SYMBOL_ADDRESSES[2]),
			2,
			Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D'),
			True,
			self._nem_to_unix_timestamp(4050),
			1122,
			1100,
			300,
			121,
			self._symbol_to_unix_timestamp(3333),
			None)
		self._assert_can_find_requests_simple(Address(NEM_ADDRESSES[2]), expected_view)

	def test_can_find_request_by_hash_exists_failed(self):
		expected_view = WrapRequestView(
			444,
			Hash256(HASHES[3]),
			2,
			Address(NEM_ADDRESSES[3]),
			1234,
			SymbolAddress(SYMBOL_ADDRESSES[3]),
			3,
			None,
			None,
			self._nem_to_unix_timestamp(5060),
			*([None] * 5),
			'failed to send payout 2')
		self._assert_can_find_requests_simple(Address(NEM_ADDRESSES[3]), expected_view)

	def test_cannot_find_request_by_address_with_no_matches(self):
		self._assert_can_find_requests_simple(Address(NEM_ADDRESSES[4]), None)

	# endregion

	# region find_requests - filtering

	def _assert_can_find_requests_filtering(self, find_requests_params, expected_heights):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database(connection)
			database.create_tables()
			seed_database_with_many_requests(database)

			# Act:
			views = list(database.find_requests(*find_requests_params))
			heights = [view.request_transaction_height for view in views]

			# Assert:
			self.assertEqual(expected_heights, heights)

	def test_can_find_all_requests(self):
		test_params = get_default_filtering_test_parameters()
		self._assert_can_find_requests_filtering([], test_params.expected_all)

	def test_can_find_requests_by_address(self):
		test_params = get_default_filtering_test_parameters()
		self._assert_can_find_requests_filtering([Address(NEM_ADDRESSES[test_params.address_index])], test_params.expected_address_filter)

	def test_can_find_requests_by_address_destination(self):
		test_params = get_default_filtering_test_parameters()
		self._assert_can_find_requests_filtering([
			SYMBOL_ADDRESSES[test_params.address_index]
		], test_params.expected_destination_address_filter)

	def test_can_find_requests_by_transaction_hash(self):
		test_params = get_default_filtering_test_parameters()
		self._assert_can_find_requests_filtering([
			None,
			Hash256(HASHES[test_params.hash_index])
		], test_params.expected_hash_filter)

	def test_can_find_requests_by_transaction_hash_payout(self):
		test_params = get_default_filtering_test_parameters()
		self._assert_can_find_requests_filtering([
			None,
			test_params.payout_transaction_hash,
		], test_params.expected_payout_hash_filter)

	def test_can_find_requests_by_address_and_transaction_hash(self):
		test_params = get_default_filtering_test_parameters()
		self._assert_can_find_requests_filtering([
			Address(NEM_ADDRESSES[test_params.address_index]),
			Hash256(HASHES[test_params.hash_index])
		], test_params.expected_hash_filter)

	def test_can_find_requests_by_payout_status(self):
		test_params = get_default_filtering_test_parameters()
		self._assert_can_find_requests_filtering([
			None,
			None,
			0,
			25,
			True,
			test_params.payout_status
		], test_params.expected_payout_status_filter)

	def test_can_find_requests_with_custom_offset_and_limit(self):
		test_params = get_default_filtering_test_parameters()
		self._assert_can_find_requests_filtering([
			Address(NEM_ADDRESSES[test_params.address_index]),
			None,
			test_params.offset,
			test_params.limit
		], test_params.expected_custom_offset_and_limit)

	def test_can_find_requests_with_custom_offset_and_limit_and_custom_sort(self):
		test_params = get_default_filtering_test_parameters()
		self._assert_can_find_requests_filtering([
			Address(NEM_ADDRESSES[test_params.address_index]),
			None,
			test_params.offset,
			test_params.limit,
			False
		], test_params.expected_custom_offset_and_limit_desc)

	# endregion
