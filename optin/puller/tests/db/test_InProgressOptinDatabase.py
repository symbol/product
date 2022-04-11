import sqlite3
import unittest

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nem.Network import Address, Network

from puller.db.InProgressOptinDatabase import InProgressOptinDatabase, OptinRequestStatus

from ..test.DatabaseTestUtils import get_all_table_names
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
		payout_transaction_hash.bytes if payout_transaction_hash else None)

# endregion


class InProgressOptinDatabaseTest(unittest.TestCase):
	# pylint: disable=too-many-public-methods

	# region create

	def test_can_create_tables(self):
		# Act:
		table_names = get_all_table_names(InProgressOptinDatabase)

		# Assert:
		self.assertEqual(set(['optin_error', 'optin_request']), table_names)

	# endregion

	# region add_error

	@staticmethod
	def _query_all_requests(cursor):
		cursor.execute('''SELECT * FROM optin_request ORDER BY optin_transaction_hash DESC''')
		return cursor.fetchall()

	def _assert_can_insert_rows(self, seed_errors, seed_requests, expected_errors, expected_requests, post_insert_action):
		# pylint: disable=too-many-arguments

		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = InProgressOptinDatabase(connection)
			database.create_tables()

			# Act:
			for error in seed_errors:
				database.add_error(error)

			for request in seed_requests:
				add_result = database.add_request(request)

				# Sanity:
				self.assertEqual(OptinRequestStatus.UNPROCESSED, add_result)

			if post_insert_action:
				post_insert_action(database)

			# Assert:
			cursor = connection.cursor()
			cursor.execute('''SELECT * FROM optin_error ORDER BY optin_transaction_hash DESC''')
			actual_errors = cursor.fetchall()

			actual_requests = self._query_all_requests(cursor)

			self.assertEqual(expected_errors, actual_errors)
			self.assertEqual(expected_requests, actual_requests)

	def _assert_can_insert_errors(self, seed_errors, expected_errors):
		self._assert_can_insert_rows(seed_errors, [], expected_errors, [], None)

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
			database = InProgressOptinDatabase(connection)
			database.create_tables()

			database.add_error(make_request_error(0, 'this is an error message'))
			database.add_error(make_request_error(1, 'this is another error message'))

			# Act:
			with self.assertRaises(sqlite3.IntegrityError):
				database.add_error(make_request_error(2, 'error message', hash_index=0))

	# endregion

	# region add_request

	def _assert_can_insert_requests(self, seed_requests, expected_requests, post_insert_action=None):
		self._assert_can_insert_rows([], seed_requests, [], expected_requests, post_insert_action)

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
			database = InProgressOptinDatabase(connection)
			database.create_tables()

			database.add_request(make_request(0, {'type': 100, 'destination': PUBLIC_KEYS[0]}))
			database.add_request(make_request(1, {'type': 100, 'destination': PUBLIC_KEYS[1]}))

			# Act:
			with self.assertRaises(sqlite3.IntegrityError):
				database.add_request(make_request(2, {'type': 100, 'destination': PUBLIC_KEYS[2]}, hash_index=0))

	@staticmethod
	def _prepare_database_for_add_request_duplicate_test(connection, existing_status):
		database = InProgressOptinDatabase(connection)
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
			database = InProgressOptinDatabase(connection)
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
			database = InProgressOptinDatabase(connection)
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
			database = InProgressOptinDatabase(connection)
			database.create_tables()

			# Act:
			max_processed_height = database.max_processed_height()

			# Assert:
			self.assertEqual(0, max_processed_height)

	def _assert_max_processed_height(self, max_error_height, max_request_height, expected_max_processed_height):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = InProgressOptinDatabase(connection)
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
		], post_insert_action=post_insert_action)

	def test_can_unset_request_payout_transaction_hash(self):
		# Arrange:
		seed_requests = [
			make_request(0, {'type': 100, 'destination': PUBLIC_KEYS[0]}),
			make_request(1, {'type': 100, 'destination': PUBLIC_KEYS[1]}),
			make_request(2, {'type': 101, 'destination': PUBLIC_KEYS[2], 'origin': PUBLIC_KEYS[4]}),
			make_request(3, {'type': 100, 'destination': PUBLIC_KEYS[3]})
		]

		def post_insert_action(database):
			database.set_request_status(seed_requests[1], OptinRequestStatus.SENT, None)
			database.set_request_status(seed_requests[2], OptinRequestStatus.SENT, None)

		# Act + Assert:
		self._assert_can_insert_requests(seed_requests, [
			make_request_tuple(0),
			make_request_tuple(1, status_id=1, payout_transaction_hash=None),
			make_request_tuple(2, status_id=1, multisig_public_key_index=4, payout_transaction_hash=None),
			make_request_tuple(3)
		], post_insert_action=post_insert_action)

	# endregion

	# region get_requests_by_status

	def test_can_get_all_requests_with_specified_status(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = InProgressOptinDatabase(connection)
			database.create_tables()

			payout_transaction_hash = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
			seed_requests = [
				make_request(0, {'type': 100, 'destination': PUBLIC_KEYS[0]}),
				make_request(1, {'type': 100, 'destination': PUBLIC_KEYS[1]}),
				make_request(2, {'type': 100, 'destination': PUBLIC_KEYS[2]})
			]

			for request in seed_requests:
				database.add_request(request)

			database.set_request_status(seed_requests[1], OptinRequestStatus.SENT, payout_transaction_hash)

			# Act:
			requests = database.get_requests_by_status(OptinRequestStatus.UNPROCESSED)

			# Assert: height sorted (ascending)
			self.assertEqual(2, len(requests))
			assert_equal_request(self, seed_requests[2], requests[1])
			assert_equal_request(self, seed_requests[0], requests[0])

	# endregion
