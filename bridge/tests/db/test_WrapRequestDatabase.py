import sqlite3
import unittest

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nem.Network import Address

from bridge.db.WrapRequestDatabase import WrapRequestDatabase, WrapRequestStatus

from ..test.BridgeTestUtils import HASHES, HEIGHTS, NEM_ADDRESSES, PUBLIC_KEYS, assert_equal_request, make_request, make_request_error
from ..test.DatabaseTestUtils import get_all_table_names
from ..test.MockNetworkFacade import MockNetworkFacade

# region factories


def make_request_error_tuple(index, message, **kwargs):
	address = Address(NEM_ADDRESSES[kwargs.get('address_index', index)])
	hash_index = kwargs.get('hash_index', index)

	return (
		HEIGHTS[index],
		Hash256(HASHES[hash_index]).bytes,
		kwargs.get('transaction_subindex', 0),
		address.bytes,
		message)


def make_request_tuple(index, **kwargs):
	hash_index = kwargs.get('hash_index', index)
	address = Address(NEM_ADDRESSES[kwargs.get('address_index', index)])
	destination_address = PublicKey(PUBLIC_KEYS[kwargs.get('destination_address_index', index)])

	return (
		HEIGHTS[index],
		Hash256(HASHES[hash_index]).bytes,
		kwargs.get('transaction_subindex', 0),
		address.bytes,
		HEIGHTS[index] % 1000,
		f'0x{destination_address}',
		kwargs.get('status_id', 0))

# endregion


class WrapRequestDatabaseTest(unittest.TestCase):
	# pylint: disable=too-many-public-methods

	# region shared test utils

	@staticmethod
	def _query_all_errors(cursor):
		cursor.execute('''SELECT * FROM wrap_error ORDER BY wrap_transaction_hash DESC, wrap_transaction_subindex ASC''')
		return cursor.fetchall()

	@staticmethod
	def _query_all_requests(cursor):
		cursor.execute('''SELECT * FROM wrap_request ORDER BY wrap_transaction_hash DESC, wrap_transaction_subindex ASC''')
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

	def _assert_can_insert_errors(self, seed_errors, expected_errors):
		self._assert_can_insert_rows({'errors': seed_errors, 'requests': []}, {'errors': expected_errors, 'requests': []}, None)

	def _assert_can_insert_requests(self, seed_requests, expected_requests, post_insert_action=None):
		self._assert_can_insert_rows(
			{'errors': [], 'requests': seed_requests},
			{'errors': [], 'requests': expected_requests},
			post_insert_action)

	# endregion

	# region create

	def test_can_create_tables(self):
		# Act:
		table_names = get_all_table_names(WrapRequestDatabase, MockNetworkFacade())

		# Assert:
		self.assertEqual(set(['wrap_error', 'wrap_request']), table_names)

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

		database.set_request_status(completed_request_1, WrapRequestStatus.COMPLETED)
		database.set_request_status(completed_request_2, WrapRequestStatus.COMPLETED)

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

	# region max_processed_height

	def test_max_processed_height_is_zero_when_empty(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = WrapRequestDatabase(connection, MockNetworkFacade())
			database.create_tables()

			# Act:
			max_processed_height = database.max_processed_height()

			# Assert:
			self.assertEqual(0, max_processed_height)

	def _assert_max_processed_height(self, max_error_height, max_request_height, expected_max_processed_height):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = WrapRequestDatabase(connection, MockNetworkFacade())
			database.create_tables()

			if max_error_height:
				for (index, height) in [(0, 12345678902), (1, max_error_height), (2, 12345678904)]:
					database.add_error(make_request_error(index, 'error message', height=height))

			if max_request_height:
				for (index, height) in [(0, 12345678903), (1, max_request_height), (2, 12345678902)]:
					database.add_request(make_request(index, height=height))

			# Act:
			max_processed_height = database.max_processed_height()

			# Assert:
			self.assertEqual(expected_max_processed_height, max_processed_height)

	def test_max_processed_height_is_max_error_height_when_only_errors_are_present(self):
		self._assert_max_processed_height(12345678907, None, 12345678907)

	def test_max_processed_height_is_max_request_height_when_only_requests_are_present(self):
		self._assert_max_processed_height(None, 12345678907, 12345678907)

	def test_max_processed_height_is_max_request_or_error_height_when_both_are_present(self):
		self._assert_max_processed_height(12345678909, 12345678907, 12345678909)
		self._assert_max_processed_height(12345678907, 12345678909, 12345678909)

	# endregion

	# region total_wrapped_amount

	def test_total_wrapped_amount_amount_is_zero_when_empty(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = WrapRequestDatabase(connection, MockNetworkFacade())
			database.create_tables()

			# Act:
			total_wrapped_amount = database.total_wrapped_amount()

			# Assert:
			self.assertEqual(0, total_wrapped_amount)

	def test_total_wrapped_amount_is_calculated_correctly_when_requests_present(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = WrapRequestDatabase(connection, MockNetworkFacade())
			database.create_tables()

			database.add_request(make_request(1, amount=1000))
			database.add_request(make_request(2, amount=3333))
			database.add_request(make_request(3, amount=2020))

			# Act:
			total_wrapped_amount = database.total_wrapped_amount()

			# Assert:
			self.assertEqual(6353, total_wrapped_amount)

	# endregion

	# region set_request_status

	def test_can_update_single_request_status(self):
		# Arrange:
		seed_requests = [make_request(index) for index in range(0, 3)]

		def post_insert_action(database):
			database.set_request_status(seed_requests[1], WrapRequestStatus.SENT)

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0),
			make_request_tuple(1, status_id=1),  # should reflect status change from post_insert_action
			make_request_tuple(2)
		], post_insert_action=post_insert_action)

	def test_can_update_single_request_status_scoped_to_subindex(self):
		# Arrange:
		seed_requests = [make_request(index, hash_index=0, transaction_subindex=index) for index in range(0, 3)]

		def post_insert_action(database):
			database.set_request_status(seed_requests[1], WrapRequestStatus.SENT)

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0, hash_index=0),
			make_request_tuple(1, hash_index=0, transaction_subindex=1, status_id=1),  # should reflect status change from post_insert_action
			make_request_tuple(2, hash_index=0, transaction_subindex=2)
		], post_insert_action=post_insert_action)

	# endregion

	# region requests_by_status

	@staticmethod
	def _prepare_database_for_grouping_tests(connection):
		database = WrapRequestDatabase(connection, MockNetworkFacade())
		database.create_tables()

		seed_requests = [make_request(index) for index in range(0, 4)]

		for request in seed_requests:
			database.add_request(request)

		database.set_request_status(seed_requests[0], WrapRequestStatus.SENT)       # *8905
		database.set_request_status(seed_requests[1], WrapRequestStatus.COMPLETED)
		database.set_request_status(seed_requests[3], WrapRequestStatus.SENT)       # *8902

		return (database, seed_requests)

	def test_can_get_all_requests_with_specified_status(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			(database, seed_requests) = self._prepare_database_for_grouping_tests(connection)

			# Act:
			requests = database.requests_by_status(WrapRequestStatus.SENT)

			# Assert: height sorted (descending)
			self.assertEqual(2, len(requests))
			assert_equal_request(self, seed_requests[0], requests[0])
			assert_equal_request(self, seed_requests[3], requests[1])

	# endregion
