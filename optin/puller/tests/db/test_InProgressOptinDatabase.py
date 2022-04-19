import sqlite3
import unittest

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nem.Network import Address, Network

from puller.db.InProgressOptinDatabase import InProgressOptinDatabase, OptinRequestStatus

from ..test.DatabaseTestUtils import get_all_table_names
from ..test.MockNetworkTimeConverter import MockNetworkTimeConverter
from ..test.OptinRequestTestUtils import HASHES, HEIGHTS, NEM_ADDRESSES, PUBLIC_KEYS, assert_equal_request, make_request, make_request_error

# region factories


def make_request_error_tuple(index, message, **kwargs):
	address = Address(NEM_ADDRESSES[kwargs.get('address_index', index)])
	return (HEIGHTS[index], Hash256(HASHES[index]).bytes, address.bytes, message)


def make_request_tuple(index, **kwargs):
	address = Address(NEM_ADDRESSES[kwargs.get('address_index', index)])
	destination_public_key = PublicKey(PUBLIC_KEYS[kwargs.get('destination_public_key_index', index)])
	multisig_public_key = None
	if 'multisig_public_key_index' in kwargs:
		multisig_public_key = PublicKey(PUBLIC_KEYS[kwargs['multisig_public_key_index']])

	hash_index = kwargs.get('hash_index', index)
	payout_transaction_hash = kwargs.get('payout_transaction_hash', Hash256(HASHES[(hash_index * 2) % len(HASHES)]))
	return (
		HEIGHTS[index],
		Hash256(HASHES[hash_index]).bytes,
		address.bytes,
		destination_public_key.bytes,
		multisig_public_key.bytes if multisig_public_key else None,
		kwargs.get('status_id', 0),
		payout_transaction_hash.bytes if payout_transaction_hash else None,
		kwargs.get('message', None))

# endregion


class InProgressOptinDatabaseTest(unittest.TestCase):
	# pylint: disable=too-many-public-methods

	# region shared test utils

	@staticmethod
	def _query_all_errors(cursor):
		cursor.execute('''SELECT * FROM optin_error ORDER BY optin_transaction_hash DESC''')
		return cursor.fetchall()

	@staticmethod
	def _query_all_requests(cursor):
		cursor.execute('''SELECT * FROM optin_request ORDER BY optin_transaction_hash DESC''')
		return cursor.fetchall()

	@staticmethod
	def _query_all_payout_transactions(cursor):
		cursor.execute('''SELECT * FROM payout_transaction ORDER BY transaction_hash DESC''')
		return cursor.fetchall()

	def _assert_can_insert_rows(self, seed, expected, post_insert_action):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = InProgressOptinDatabase(connection, MockNetworkTimeConverter())
			database.create_tables()

			# Act:
			for error in seed['errors']:
				database.add_error(error)

			for request in seed['requests']:
				add_result = database.add_request(request)

				# Sanity:
				self.assertEqual(OptinRequestStatus.UNPROCESSED, add_result)

			if post_insert_action:
				post_insert_action(database)

			# Assert:
			cursor = connection.cursor()
			actual_errors = self._query_all_errors(cursor)
			actual_requests = self._query_all_requests(cursor)

			self.assertEqual(expected['errors'], actual_errors)
			self.assertEqual(expected['requests'], actual_requests)

			if expected.get('payout_transactions', None) is not None:
				actual_payout_transactions = self._query_all_payout_transactions(cursor)
				self.assertEqual(expected['payout_transactions'], actual_payout_transactions)

	def _assert_can_insert_errors(self, seed_errors, expected_errors):
		self._assert_can_insert_rows({'errors': seed_errors, 'requests': []}, {'errors': expected_errors, 'requests': []}, None)

	def _assert_can_insert_requests(self, seed_requests, expected_requests, expected_payout_transactions=None, post_insert_action=None):
		self._assert_can_insert_rows(
			{'errors': [], 'requests': seed_requests},
			{'errors': [], 'requests': expected_requests, 'payout_transactions': expected_payout_transactions},
			post_insert_action)

	# endregion

	# region create

	def test_can_create_tables(self):
		# Act:
		table_names = get_all_table_names(InProgressOptinDatabase, MockNetworkTimeConverter())

		# Assert:
		self.assertEqual(set(['nem_block_timestamps', 'optin_error', 'optin_request', 'payout_transaction']), table_names)

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

	def test_can_add_multiple_errors_with_same_address(self):
		self._assert_can_insert_errors([
			make_request_error(0, 'this is an error message'),
			make_request_error(1, 'this is another error message'),
			make_request_error(2, 'error message', address_index=0)
		], [
			make_request_error_tuple(0, 'this is an error message'),
			make_request_error_tuple(1, 'this is another error message'),
			make_request_error_tuple(2, 'error message', address_index=0)
		])

	def test_cannot_add_multiple_errors_with_same_transaction_hash(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = InProgressOptinDatabase(connection, MockNetworkTimeConverter())
			database.create_tables()

			database.add_error(make_request_error(0, 'this is an error message'))
			database.add_error(make_request_error(1, 'this is another error message'))

			# Act + Assert:
			with self.assertRaises(sqlite3.IntegrityError):
				database.add_error(make_request_error(2, 'error message', hash_index=0))

	def test_cannot_add_multiple_errors_with_same_transaction_hash_simulate_file_access(self):
		# Arrange:
		with sqlite3.connect('file:mem1?mode=memory&cache=shared', uri=True) as connection:
			database = InProgressOptinDatabase(connection, MockNetworkTimeConverter())
			database.create_tables()

			database.add_error(make_request_error(0, 'this is an error message'))

			# Act + Assert:
			with sqlite3.connect('file:mem1?mode=memory&cache=shared', uri=True) as connection2:
				with self.assertRaises(sqlite3.IntegrityError):
					database2 = InProgressOptinDatabase(connection2, MockNetworkTimeConverter())
					database2.add_error(make_request_error(0, 'this is different error message'))

	# endregion

	# region add_request

	def test_can_add_requests_regular(self):
		self._assert_can_insert_requests([
			make_request(0, {'type': 100, 'destination': PUBLIC_KEYS[0]}),
			make_request(1, {'type': 100, 'destination': PUBLIC_KEYS[1]}),
			make_request(2, {'type': 100, 'destination': PUBLIC_KEYS[2]})
		], [
			make_request_tuple(0),
			make_request_tuple(1),
			make_request_tuple(2)
		])

	def test_can_add_requests_multisig(self):
		self._assert_can_insert_requests([
			make_request(0, {'type': 101, 'destination': PUBLIC_KEYS[0], 'origin': PUBLIC_KEYS[3]}),
			make_request(1, {'type': 101, 'destination': PUBLIC_KEYS[1], 'origin': PUBLIC_KEYS[4]}),
			make_request(2, {'type': 101, 'destination': PUBLIC_KEYS[2], 'origin': PUBLIC_KEYS[3]})
		], [
			make_request_tuple(0, multisig_public_key_index=3),
			make_request_tuple(1, multisig_public_key_index=4),
			make_request_tuple(2, multisig_public_key_index=3)
		])

	def test_cannot_add_multiple_requests_with_same_transaction_hash(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = InProgressOptinDatabase(connection, MockNetworkTimeConverter())
			database.create_tables()

			database.add_request(make_request(0, {'type': 100, 'destination': PUBLIC_KEYS[0]}))
			database.add_request(make_request(1, {'type': 100, 'destination': PUBLIC_KEYS[1]}))

			# Act + Assert:
			with self.assertRaises(sqlite3.IntegrityError):
				database.add_request(make_request(2, {'type': 100, 'destination': PUBLIC_KEYS[2]}, hash_index=0))

	@staticmethod
	def _prepare_database_for_add_request_duplicate_test(connection, existing_status):
		database = InProgressOptinDatabase(connection, MockNetworkTimeConverter())
		database.create_tables()

		processed_request = make_request(0, {'type': 101, 'destination': PUBLIC_KEYS[0], 'origin': PUBLIC_KEYS[3]})
		database.add_request(processed_request)
		database.set_request_status(processed_request, existing_status, Hash256(HASHES[0]))
		database.add_request(make_request(0, {'type': 101, 'destination': PUBLIC_KEYS[1], 'origin': PUBLIC_KEYS[4]}, hash_index=1))
		return database

	def test_add_request_allows_new_request_when_existing_matching_request_is_error(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._prepare_database_for_add_request_duplicate_test(connection, OptinRequestStatus.ERROR)

			# Act:
			add_result = database.add_request(
				make_request(0, {'type': 101, 'destination': PUBLIC_KEYS[2], 'origin': PUBLIC_KEYS[3]}, hash_index=2)
			)

			# Assert:
			actual_requests = self._query_all_requests(connection.cursor())

			self.assertEqual(OptinRequestStatus.UNPROCESSED, add_result)
			self.assertEqual([
				make_request_tuple(0, multisig_public_key_index=3, status_id=OptinRequestStatus.ERROR.value),
				make_request_tuple(0, multisig_public_key_index=4, destination_public_key_index=1, hash_index=1),
				make_request_tuple(0, multisig_public_key_index=3, destination_public_key_index=2, hash_index=2)
			], actual_requests)

	def _test_add_request_marks_new_request_as_duplicate_when_existing_matching_request_is_processed(self, existing_status):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._prepare_database_for_add_request_duplicate_test(connection, existing_status)

			# Act:
			add_result = database.add_request(
				make_request(0, {'type': 101, 'destination': PUBLIC_KEYS[2], 'origin': PUBLIC_KEYS[3]}, hash_index=2)
			)

			# Assert:
			actual_requests = self._query_all_requests(connection.cursor())

			self.assertEqual(OptinRequestStatus.DUPLICATE, add_result)
			self.assertEqual([
				make_request_tuple(0, multisig_public_key_index=3, status_id=existing_status.value),
				make_request_tuple(0, multisig_public_key_index=4, destination_public_key_index=1, hash_index=1),
				make_request_tuple(
					0,
					multisig_public_key_index=3,
					destination_public_key_index=2,
					hash_index=2,
					status_id=OptinRequestStatus.DUPLICATE.value)
			], actual_requests)

	def test_add_request_marks_new_request_as_duplicate_when_existing_matching_request_is_unprocessed(self):
		self._test_add_request_marks_new_request_as_duplicate_when_existing_matching_request_is_processed(OptinRequestStatus.UNPROCESSED)

	def test_add_request_marks_new_request_as_duplicate_when_existing_matching_request_is_sent(self):
		self._test_add_request_marks_new_request_as_duplicate_when_existing_matching_request_is_processed(OptinRequestStatus.SENT)

	def test_add_request_marks_new_request_as_duplicate_when_existing_matching_request_is_completed(self):
		self._test_add_request_marks_new_request_as_duplicate_when_existing_matching_request_is_processed(OptinRequestStatus.COMPLETED)

	# endregion

	# region requests

	@staticmethod
	def _prepare_database_for_requests_test(database):
		database.create_tables()

		normal_request = make_request(0, {'type': 100, 'destination': PUBLIC_KEYS[0]})
		normal_request.payout_transaction_hash = None

		multisig_request = make_request(1, {'type': 101, 'destination': PUBLIC_KEYS[1], 'origin': PUBLIC_KEYS[4]})
		confirmed_request = make_request(2, {'type': 100, 'destination': PUBLIC_KEYS[2]})
		multisig_request2 = make_request(3, {'type': 101, 'destination': PUBLIC_KEYS[1], 'origin': PUBLIC_KEYS[4]})

		database.add_request(normal_request)
		database.add_request(multisig_request)
		database.add_request(confirmed_request)
		database.add_request(multisig_request2)

		confirmed_request.payout_transaction_hash = Hash256.zero()
		database.set_request_status(confirmed_request, OptinRequestStatus.COMPLETED, confirmed_request.payout_transaction_hash)

		return (normal_request, multisig_request, confirmed_request, multisig_request2)

	def test_can_retrieve_requests(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = InProgressOptinDatabase(connection, MockNetworkTimeConverter())
			(normal_request, multisig_request, confirmed_request, multisig_request2) = self._prepare_database_for_requests_test(database)

			# Act:
			requests = list(database.requests())

			# Assert: ordered by heights
			self.assertEqual(4, len(requests))
			assert_equal_request(self, normal_request, requests[3])
			assert_equal_request(self, multisig_request, requests[0])
			assert_equal_request(self, confirmed_request, requests[2])
			assert_equal_request(self, multisig_request2, requests[1])

	# endregion

	# region nem_source_addresses

	def test_can_retrieve_nem_source_addresses(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = InProgressOptinDatabase(connection, MockNetworkTimeConverter())
			self._prepare_database_for_requests_test(database)

			# Act:
			addresses = database.nem_source_addresses(Network.TESTNET)

			# Assert:
			self.assertEqual(3, len(addresses))
			self.assertTrue(Address(NEM_ADDRESSES[0]) in addresses)
			self.assertTrue(Address(NEM_ADDRESSES[2]) in addresses)
			self.assertTrue(Network.TESTNET.public_key_to_address(PublicKey(PUBLIC_KEYS[4])) in addresses)

	# endregion

	# region max_processed_height

	def test_max_processed_height_is_zero_when_empty(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = InProgressOptinDatabase(connection, MockNetworkTimeConverter())
			database.create_tables()

			# Act:
			max_processed_height = database.max_processed_height()

			# Assert:
			self.assertEqual(0, max_processed_height)

	def _assert_max_processed_height(self, max_error_height, max_request_height, expected_max_processed_height):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = InProgressOptinDatabase(connection, MockNetworkTimeConverter())
			database.create_tables()

			if max_error_height:
				for (index, height) in [(0, 12345678902), (1, max_error_height), (2, 12345678904)]:
					database.add_error(make_request_error(index, 'error message', height=height))

			if max_request_height:
				for (index, height) in [(0, 12345678903), (1, max_request_height), (2, 12345678902)]:
					database.add_request(make_request(index, {'type': 100, 'destination': PUBLIC_KEYS[index]}, height=height))

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

	# region set_request_status

	def test_can_update_single_request_status(self):
		# Arrange:
		payout_transaction_hash = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
		seed_requests = [
			make_request(0, {'type': 100, 'destination': PUBLIC_KEYS[0]}),
			make_request(1, {'type': 100, 'destination': PUBLIC_KEYS[1]}),
			make_request(2, {'type': 100, 'destination': PUBLIC_KEYS[2]})
		]

		def post_insert_action(database):
			database.set_request_status(seed_requests[1], OptinRequestStatus.SENT, payout_transaction_hash)

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0),
			make_request_tuple(1, status_id=1, payout_transaction_hash=payout_transaction_hash),
			make_request_tuple(2)
		], expected_payout_transactions=[
			(payout_transaction_hash.bytes, 0, 0)
		], post_insert_action=post_insert_action)

	def test_can_update_single_request_status_with_error_message(self):
		# Arrange:
		seed_requests = [
			make_request(0, {'type': 100, 'destination': PUBLIC_KEYS[0]}),
			make_request(1, {'type': 100, 'destination': PUBLIC_KEYS[1]}),
			make_request(2, {'type': 100, 'destination': PUBLIC_KEYS[2]})
		]

		def post_insert_action(database):
			database.set_request_status(seed_requests[1], OptinRequestStatus.ERROR, None, 'custom error message')

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0),
			make_request_tuple(1, status_id=4, payout_transaction_hash=None, message='custom error message'),
			make_request_tuple(2)
		], post_insert_action=post_insert_action)

	def test_can_update_single_request_status_matching_optin_transaction_hash(self):
		# Arrange:
		payout_transaction_hash = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
		seed_requests = [
			make_request(0, {'type': 100, 'destination': PUBLIC_KEYS[0]}),
			make_request(1, {'type': 100, 'destination': PUBLIC_KEYS[1]}),
			make_request(2, {'type': 100, 'destination': PUBLIC_KEYS[2]})
		]

		def post_insert_action(database):
			database.set_request_status(seed_requests[1], OptinRequestStatus.SENT, payout_transaction_hash)
			database.set_request_status(seed_requests[1], OptinRequestStatus.COMPLETED, payout_transaction_hash)

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0),
			make_request_tuple(1, status_id=2, payout_transaction_hash=payout_transaction_hash),
			make_request_tuple(2)
		], expected_payout_transactions=[
			(payout_transaction_hash.bytes, 0, 0),
		], post_insert_action=post_insert_action)

	def test_can_update_single_request_status_matching_optin_transaction_hash_preserves_metadata(self):
		# Arrange:
		payout_transaction_hash = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
		seed_requests = [
			make_request(0, {'type': 100, 'destination': PUBLIC_KEYS[0]}),
			make_request(1, {'type': 100, 'destination': PUBLIC_KEYS[1]}),
			make_request(2, {'type': 100, 'destination': PUBLIC_KEYS[2]})
		]

		def post_insert_action(database):
			database.set_request_status(seed_requests[1], OptinRequestStatus.SENT, payout_transaction_hash)
			database.set_payout_transaction_metadata(payout_transaction_hash, 123, 987)
			database.set_request_status(seed_requests[1], OptinRequestStatus.COMPLETED, payout_transaction_hash)

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0),
			make_request_tuple(1, status_id=2, payout_transaction_hash=payout_transaction_hash),
			make_request_tuple(2)
		], expected_payout_transactions=[
			(payout_transaction_hash.bytes, 123, 987 * 3),  # time converter is used
		], post_insert_action=post_insert_action)

	def test_cannot_update_single_request_status_without_matching_optin_transaction_hash(self):
		# Arrange:
		payout_transaction_hash = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
		seed_requests = [
			make_request(0, {'type': 100, 'destination': PUBLIC_KEYS[0]}),
			make_request(1, {'type': 100, 'destination': PUBLIC_KEYS[1]}),
			make_request(2, {'type': 100, 'destination': PUBLIC_KEYS[2]})
		]

		def post_insert_action(database):
			database.set_request_status(seed_requests[1], OptinRequestStatus.SENT, payout_transaction_hash)
			seed_requests[1].optin_transaction_hash = Hash256.zero()

			database.set_request_status(seed_requests[1], OptinRequestStatus.COMPLETED, payout_transaction_hash)

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0),
			make_request_tuple(1, status_id=1, payout_transaction_hash=payout_transaction_hash),
			make_request_tuple(2)
		], expected_payout_transactions=[
			(payout_transaction_hash.bytes, 0, 0)
		], post_insert_action=post_insert_action)

	def test_can_update_mutiple_request_part_status(self):
		# Arrange:
		payout_transaction_hash = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
		seed_requests = [
			make_request(0, {'type': 101, 'destination': PUBLIC_KEYS[0], 'origin': PUBLIC_KEYS[3]}),
			make_request(1, {'type': 101, 'destination': PUBLIC_KEYS[1], 'origin': PUBLIC_KEYS[4]}, address_index=0),
			make_request(2, {'type': 101, 'destination': PUBLIC_KEYS[0], 'origin': PUBLIC_KEYS[3]})
		]

		def post_insert_action(database):
			database.set_request_status(seed_requests[0], OptinRequestStatus.SENT, payout_transaction_hash)

		# Act + Assert: even though there are multiple requests with same address,
		#               only the one with matching multisig_public_key should change
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0, multisig_public_key_index=3, status_id=1, payout_transaction_hash=payout_transaction_hash),
			make_request_tuple(1, multisig_public_key_index=4, address_index=0),
			make_request_tuple(2, destination_public_key_index=0, multisig_public_key_index=3)
		], expected_payout_transactions=[
			(payout_transaction_hash.bytes, 0, 0)
		], post_insert_action=post_insert_action)

	# endregion

	# region requests_by_status

	@staticmethod
	def _prepare_database_for_symbol_timestamp_tests(connection):
		database = InProgressOptinDatabase(connection, MockNetworkTimeConverter())
		database.create_tables()

		seed_requests = [
			make_request(0, {'type': 100, 'destination': PUBLIC_KEYS[0]}),
			make_request(1, {'type': 100, 'destination': PUBLIC_KEYS[1]}),
			make_request(2, {'type': 100, 'destination': PUBLIC_KEYS[2]}),
			make_request(3, {'type': 100, 'destination': PUBLIC_KEYS[3]})
		]

		for request in seed_requests:
			database.add_request(request)

		payout_transaction_hash_1 = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
		payout_transaction_hash_2 = Hash256('7B055CD0A0A6C0F8BA9677076288A15F2BC6BEF42CEB5A6789EF9E4A8146E79F')
		payout_transaction_hash_3 = Hash256('DFB984176817C3C2F001F6DEF3E46096EC52C33A1A63759A8FB9E1B46859C098')
		database.set_request_status(seed_requests[0], OptinRequestStatus.SENT, payout_transaction_hash_1)
		database.set_request_status(seed_requests[1], OptinRequestStatus.COMPLETED, payout_transaction_hash_2)
		database.set_request_status(seed_requests[3], OptinRequestStatus.SENT, payout_transaction_hash_3)

		return (database, seed_requests, [payout_transaction_hash_1, payout_transaction_hash_2, payout_transaction_hash_3])

	def test_can_get_all_requests_with_specified_status(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			(database, seed_requests, payout_transaction_hashes) = self._prepare_database_for_symbol_timestamp_tests(connection)
			seed_requests[0].payout_transaction_hash = payout_transaction_hashes[0]
			seed_requests[3].payout_transaction_hash = payout_transaction_hashes[2]

			# Act:
			requests = database.requests_by_status(OptinRequestStatus.SENT)

			# Assert: height sorted (ascending)
			self.assertEqual(2, len(requests))
			assert_equal_request(self, seed_requests[0], requests[0])
			assert_equal_request(self, seed_requests[3], requests[1])

	# endregion

	# region unconfirmed_payout_transaction_hashes

	def test_can_get_unconfirmed_payout_transaction_hashes(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			(database, _, payout_transaction_hashes) = self._prepare_database_for_symbol_timestamp_tests(connection)

			# Act:
			hashes = database.unconfirmed_payout_transaction_hashes()

			# Assert:
			self.assertEqual([payout_transaction_hashes[i] for i in (1, 0, 2)], hashes)

	def test_can_get_unconfirmed_payout_transaction_hashes_excluding_confirmed_transactions(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			(database, _, payout_transaction_hashes) = self._prepare_database_for_symbol_timestamp_tests(connection)
			database.set_payout_transaction_metadata(payout_transaction_hashes[0], 123, 0)

			# Act:
			hashes = database.unconfirmed_payout_transaction_hashes()

			# Assert:
			self.assertEqual([payout_transaction_hashes[i] for i in (1, 2)], hashes)

	# endregion

	# region set_payout_transaction_metadata

	def test_can_set_payout_transaction_metadata(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			(database, _, payout_transaction_hashes) = self._prepare_database_for_symbol_timestamp_tests(connection)

			# Act:
			database.set_payout_transaction_metadata(payout_transaction_hashes[0], 123, 987)
			database.set_payout_transaction_metadata(payout_transaction_hashes[2], 888, 333)

			# Assert:
			actual_payout_transactions = self._query_all_payout_transactions(connection.cursor())

			self.assertEqual([
				(payout_transaction_hashes[2].bytes, 888, 333 * 3),  # time converter is used
				(payout_transaction_hashes[0].bytes, 123, 987 * 3),
				(payout_transaction_hashes[1].bytes, 0, 0)
			], actual_payout_transactions)

	# endregion

	# region optin_transaction_heights

	def test_can_retrieve_optin_transaction_heights(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = InProgressOptinDatabase(connection, MockNetworkTimeConverter())
			database.create_tables()

			database.add_error(make_request_error(3, 'this is an error message'))
			database.add_request(make_request(1, {'type': 100, 'destination': PUBLIC_KEYS[1]}))
			database.add_error(make_request_error(1, 'error message'))
			database.add_request(make_request(0, {'type': 100, 'destination': PUBLIC_KEYS[0]}))

			# Act:
			heights = database.optin_transaction_heights()

			# Assert: heights from both errors and requests are included
			self.assertEqual(set([HEIGHTS[0], HEIGHTS[1], HEIGHTS[3]]), heights)

	# endregion
