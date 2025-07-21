import datetime
import sqlite3
import unittest

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nem.Network import Address

from bridge.db.WrapRequestDatabase import PayoutDetails, WrapRequestDatabase, WrapRequestStatus

from ..test.BridgeTestUtils import HASHES, HEIGHTS, NEM_ADDRESSES, PUBLIC_KEYS, assert_equal_request, make_request, make_request_error
from ..test.DatabaseTestUtils import get_all_table_names
from ..test.MockNetworkFacade import MockNetworkFacade

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
		kwargs.get('payout_transaction_hash', None))


def _make_payout_details(transaction_hash, total_fee=0):
	return PayoutDetails(transaction_hash, 0, total_fee, 0)

# endregion


class WrapRequestDatabaseTest(unittest.TestCase):
	# pylint: disable=too-many-public-methods

	# region shared test utils

	@staticmethod
	def _nem_to_unix_timestamp(timestamp):
		return int(datetime.datetime(2015, 3, 29, 0, 6, 25, tzinfo=datetime.timezone.utc).timestamp()) + timestamp

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

	def _assert_can_insert_rows(self, seed, expected, post_insert_action):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = WrapRequestDatabase(connection, MockNetworkFacade())
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
			self.assertEqual(expected['requests'], actual_requests)

			actual_payout_transactions = self._query_all_payout_transactions(cursor)
			self.assertEqual(expected.get('payout_transactions') or [], actual_payout_transactions)

			actual_block_metadatas = self._query_all_block_metadatas(cursor)
			self.assertEqual(expected.get('block_metadatas') or [], actual_block_metadatas)

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
			},
			kwargs.get('post_insert_action'))

	# endregion

	# region create

	def test_can_create_tables(self):
		# Act:
		table_names = get_all_table_names(WrapRequestDatabase, MockNetworkFacade())

		# Assert:
		self.assertEqual(set(['wrap_error', 'wrap_request', 'payout_transaction', 'block_metadata', 'max_processed_height']), table_names)

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
			database = WrapRequestDatabase(connection, MockNetworkFacade())
			database.create_tables()

			database.add_error(make_request_error(0, 'this is an error message'))
			database.add_error(make_request_error(1, 'this is another error message'))

			# Act + Assert:
			with self.assertRaises(sqlite3.IntegrityError):
				database.add_error(make_request_error(2, 'error message', hash_index=0))

	def test_cannot_add_multiple_errors_with_same_transaction_hash_and_subindex_simulate_file_access(self):
		# Arrange:
		with sqlite3.connect('file:mem1?mode=memory&cache=shared', uri=True) as connection:
			database = WrapRequestDatabase(connection, MockNetworkFacade())
			database.create_tables()

			database.add_error(make_request_error(0, 'this is an error message'))

			# Act + Assert:
			with sqlite3.connect('file:mem1?mode=memory&cache=shared', uri=True) as connection2:
				with self.assertRaises(sqlite3.IntegrityError):
					database2 = WrapRequestDatabase(connection2, MockNetworkFacade())
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
			database = WrapRequestDatabase(connection, MockNetworkFacade())
			database.create_tables()

			database.add_request(make_request(0))
			database.add_request(make_request(1))

			# Act + Assert:
			with self.assertRaises(sqlite3.IntegrityError):
				database.add_request(make_request(2, hash_index=0))

	def test_cannot_add_multiple_requests_with_same_transaction_hash_and_subindex_simulate_file_access(self):
		# Arrange:
		with sqlite3.connect('file:mem1?mode=memory&cache=shared', uri=True) as connection:
			database = WrapRequestDatabase(connection, MockNetworkFacade())
			database.create_tables()

			database.add_request(make_request(0))

			# Act + Assert:
			with sqlite3.connect('file:mem1?mode=memory&cache=shared', uri=True) as connection2:
				with self.assertRaises(sqlite3.IntegrityError):
					database2 = WrapRequestDatabase(connection2, MockNetworkFacade())
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
			database = WrapRequestDatabase(connection, MockNetworkFacade())
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

	# region is_synced_at_timestamp / cumulative_wrapped_amount_at

	@staticmethod
	def _create_database_for_cumulative_wrapped_amount_at_tests(connection):
		database = WrapRequestDatabase(connection, MockNetworkFacade())
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
			database = self._create_database_for_cumulative_wrapped_amount_at_tests(connection)

			# Act + Assert:
			self.assertTrue(database.is_synced_at_timestamp(self._nem_to_unix_timestamp(0)))
			self.assertTrue(database.is_synced_at_timestamp(self._nem_to_unix_timestamp(2500)))
			self.assertTrue(database.is_synced_at_timestamp(self._nem_to_unix_timestamp(4999)))
			self.assertTrue(database.is_synced_at_timestamp(self._nem_to_unix_timestamp(5000)))

			self.assertFalse(database.is_synced_at_timestamp(self._nem_to_unix_timestamp(5001)))
			self.assertFalse(database.is_synced_at_timestamp(self._nem_to_unix_timestamp(10000)))

	def _assert_cumulative_wrapped_amount_at_is_calculated_correctly_at_timestamps(
		self,
		timestamp_amount_pairs,
		relative_block_adjustment=0
	):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database_for_cumulative_wrapped_amount_at_tests(connection)

			for (timestamp, expected_amount) in timestamp_amount_pairs:
				# Act:
				amount = database.cumulative_wrapped_amount_at(self._nem_to_unix_timestamp(timestamp), relative_block_adjustment)

				# Assert:
				self.assertEqual(expected_amount, amount, f'at timestamp {timestamp}')

	def test_cumulative_wrapped_amount_at_fails_when_empty(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = WrapRequestDatabase(connection, MockNetworkFacade())
			database.create_tables()

			# Act + Assert:
			with self.assertRaisesRegex(ValueError, 'requested wrapped amount at 2000 beyond current database timestamp 0'):
				database.cumulative_wrapped_amount_at(2000)

	def test_cumulative_wrapped_amount_at_fails_with_positive_block_adjustment(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database_for_cumulative_wrapped_amount_at_tests(connection)

			# Act + Assert:
			with self.assertRaisesRegex(ValueError, 'relative_block_adjustment must not be positive'):
				database.cumulative_wrapped_amount_at(2000, 1)

	def test_cumulative_wrapped_amount_at_is_calculated_correctly_when_requests_present(self):
		self._assert_cumulative_wrapped_amount_at_is_calculated_correctly_at_timestamps([
			(999, 0),
			(1000, 1000),
			(1001, 1000),

			(1999, 1000),
			(2000, 3021),
			(2001, 3021),

			(3999, 3021),
			(4000, 6354),
			(5000, 6354)
		])

	def test_cumulative_wrapped_amount_at_is_calculated_correctly_when_requests_present_with_block_adjustment(self):
		self._assert_cumulative_wrapped_amount_at_is_calculated_correctly_at_timestamps([
			(999, 0),
			(1999, 0),

			(2000, 1000),
			(2001, 1000),

			(3999, 1000),
			(4000, 3021),
			(4999, 3021),

			(5000, 6354)
		], -1)

	def _assert_cumulative_wrapped_amount_at_fails_for_queries_past_max_processed_height(self, relative_block_adjustment=0):
		# Arrange:
		for raw_timestamp in [5001, 10000]:
			with sqlite3.connect(':memory:') as connection:
				database = self._create_database_for_cumulative_wrapped_amount_at_tests(connection)

				timestamp = self._nem_to_unix_timestamp(raw_timestamp)
				max_timestamp = self._nem_to_unix_timestamp(5000)

				# Act + Assert:
				expected_error_message = f'requested wrapped amount at {timestamp} beyond current database timestamp {max_timestamp}'
				with self.assertRaisesRegex(ValueError, expected_error_message):
					database.cumulative_wrapped_amount_at(timestamp, relative_block_adjustment)

	def test_cumulative_wrapped_amount_at_fails_for_queries_past_max_processed_height(self):
		self._assert_cumulative_wrapped_amount_at_fails_for_queries_past_max_processed_height()

	def test_cumulative_wrapped_amount_at_fails_for_queries_past_max_processed_height_with_block_adjustment(self):
		self._assert_cumulative_wrapped_amount_at_fails_for_queries_past_max_processed_height(-1)

	# endregion

	# region cumulative_fees_paid_at

	def test_cumulative_fees_paid_at_is_zero_when_empty(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = WrapRequestDatabase(connection, MockNetworkFacade())
			database.create_tables()

			# Act:
			amount = database.cumulative_fees_paid_at(10000)

			# Assert:
			self.assertEqual(0, amount)

	def _assert_cumulative_fees_paid_at_is_calculated_correctly_at_timestamps(self, timestamp_amount_pairs):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = WrapRequestDatabase(connection, MockNetworkFacade())
			database.create_tables()

			requests = [
				make_request(0, amount=1000, height=111),
				make_request(1, amount=3333, height=333),
				make_request(2, amount=2020, height=222),
				make_request(3, amount=1, height=222)
			]

			for request in requests:
				database.add_request(request)

			database.mark_payout_sent(requests[0], _make_payout_details(Hash256(HASHES[0]), 100))
			database.mark_payout_sent(requests[1], _make_payout_details(Hash256(HASHES[1]), 300))
			database.mark_payout_sent(requests[2], _make_payout_details(Hash256(HASHES[2]), 200))
			database.mark_payout_sent(requests[3], _make_payout_details(Hash256(HASHES[3]), 400))

			database.set_block_timestamp(111, 1000)
			database.set_block_timestamp(222, 2000)
			database.set_block_timestamp(333, 4000)

			for (timestamp, expected_amount) in timestamp_amount_pairs:
				# Act:
				amount = database.cumulative_fees_paid_at(self._nem_to_unix_timestamp(timestamp))

				# Assert:
				self.assertEqual(expected_amount, amount, f'at timestamp {timestamp}')

	def test_cumulative_fees_paid_at_is_calculated_correctly_when_requests_present(self):
		self._assert_cumulative_fees_paid_at_is_calculated_correctly_at_timestamps([
			(999, 0),
			(1000, 100),
			(1001, 100),

			(1999, 100),
			(2000, 700),
			(2001, 700),

			(3999, 700),
			(4000, 1000),
			(4001, 1000)
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
			make_request_tuple(1, status_id=1, payout_transaction_hash=payout_transaction_hash.bytes),
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
			make_request_tuple(1, hash_index=0, transaction_subindex=1, status_id=1, payout_transaction_hash=payout_transaction_hash.bytes),
			make_request_tuple(2, hash_index=0, transaction_subindex=2)
		], expected_payout_transactions=[
			(payout_transaction_hash.bytes, 1100, 300, 12, 0)
		], post_insert_action=post_insert_action)

	def test_cannot_mark_payout_sent_multiple_with_same_payout_transaction_hash(self):
		# Arrange:
		payout_transaction_hash = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
		seed_requests = [make_request(index) for index in range(0, 3)]

		with sqlite3.connect(':memory:') as connection:
			database = WrapRequestDatabase(connection, MockNetworkFacade())
			database.create_tables()

			for seed_request in seed_requests:
				database.add_request(seed_request)

			database.mark_payout_sent(make_request(0), _make_payout_details(payout_transaction_hash))

			# Act + Assert:
			with self.assertRaises(sqlite3.IntegrityError):
				database.mark_payout_sent(make_request(2), _make_payout_details(payout_transaction_hash))

	# endregion

	# region mark_payout_failed

	def test_can_mark_payout_failed_single(self):
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
			make_request_tuple(1, status_id=2, payout_transaction_hash=payout_transaction_hash.bytes),
			make_request_tuple(2),
		], expected_payout_transactions=[
			(payout_transaction_hash.bytes, 1100, 300, 12, 1122)
		], expected_block_metadatas=[
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
			make_request_tuple(1, hash_index=0, transaction_subindex=1, status_id=2, payout_transaction_hash=payout_transaction_hash.bytes),
			make_request_tuple(2, hash_index=0, transaction_subindex=2)
		], expected_payout_transactions=[
			(payout_transaction_hash.bytes, 1100, 300, 1.2, 1122)
		], expected_block_metadatas=[
			(1122, 0)
		], post_insert_action=post_insert_action)

	def test_can_mark_payout_completed_single_does_not_overwrite_block_timestamp(self):
		# Arrange:
		payout_transaction_hash = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
		seed_requests = [make_request(index, hash_index=0, transaction_subindex=index) for index in range(0, 3)]

		def post_insert_action(database):
			database.set_block_timestamp(1122, 98765)
			database.mark_payout_sent(seed_requests[1], PayoutDetails(payout_transaction_hash, 1100, 300, 12))
			database.mark_payout_completed(payout_transaction_hash, 1122)

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0, hash_index=0),
			# should reflect status change from post_insert_action
			make_request_tuple(1, hash_index=0, transaction_subindex=1, status_id=2, payout_transaction_hash=payout_transaction_hash.bytes),
			make_request_tuple(2, hash_index=0, transaction_subindex=2)
		], expected_payout_transactions=[
			(payout_transaction_hash.bytes, 1100, 300, 12, 1122)
		], expected_block_metadatas=[
			# timestamp is not overwritten
			(1122, self._nem_to_unix_timestamp(98765))
		], post_insert_action=post_insert_action)

	# endregion

	# region reset

	def _assert_reset(self, max_processed_height, expected_errors, expected_requests):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = WrapRequestDatabase(connection, MockNetworkFacade())
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
			self.assertEqual(
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
		database = WrapRequestDatabase(connection, MockNetworkFacade())
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

	# region requests_by_status

	@staticmethod
	def _prepare_database_for_grouping_tests(connection):
		database = WrapRequestDatabase(connection, MockNetworkFacade())
		database.create_tables()

		seed_requests = [make_request(index) for index in range(0, 4)]

		for request in seed_requests:
			database.add_request(request)

		payout_transaction_hashes = [
			Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D'),
			Hash256('7B055CD0A0A6C0F8BA9677076288A15F2BC6BEF42CEB5A6789EF9E4A8146E79F'),
			Hash256('DFB984176817C3C2F001F6DEF3E46096EC52C33A1A63759A8FB9E1B46859C098')
		]
		database.mark_payout_sent(seed_requests[0], _make_payout_details(payout_transaction_hashes[0]))  # *8905
		database.mark_payout_sent(seed_requests[1], _make_payout_details(payout_transaction_hashes[1]))  # *8901
		database.mark_payout_completed(payout_transaction_hashes[1], 1234)
		database.mark_payout_sent(seed_requests[3], _make_payout_details(payout_transaction_hashes[2]))  # *8902

		return (database, seed_requests, payout_transaction_hashes)

	def test_can_get_all_requests_with_specified_status(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			(database, seed_requests, _) = self._prepare_database_for_grouping_tests(connection)

			# Act:
			requests = database.requests_by_status(WrapRequestStatus.SENT)

			# Assert: height sorted (descending)
			self.assertEqual(2, len(requests))
			assert_equal_request(self, seed_requests[0], requests[0])
			assert_equal_request(self, seed_requests[3], requests[1])

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
