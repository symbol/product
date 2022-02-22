import sqlite3
import unittest

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nem.Network import Address

from puller.db.InProgressOptinDatabase import InProgressOptinDatabase
from puller.models.OptinRequest import OptinRequest, OptinRequestError

from ..test.DatabaseTestUtils import get_all_table_names

HASHES = [  # sorted
	'FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA', 'C16CF93C5A1B6620F3D4C7A7EAAE1990D9C2678775FBC18EAE577A78C8D52B25',
	'7D7EB08675D6F78FAB8E7D703994390DD95C6A9E8ADD18A9CF13CE4C632F8F01'
]


PUBLIC_KEYS = [
	'138F8ECE0F01DC7CCD196F2C6249CBB78CF2822D23376C96C949DF859D5A0FC5', '1BB7ACCACE4C2527F425B2156C676105DF013404F7FA1F169377CA05393AECBE',
	'C0EB403A0EF1949D656EA775FCC7BFA6D8288E70AC831847686D56E6BB3D445C', '55C3979A27EBF358496E673BE7C39257894B754BE92ED6456314DE9FAA2D447D',
	'A52DF1C5AD709689EDF75650CD292B55678ACBCE3F17D300D16B680CEB648D41'
]


NEM_ADDRESSES = [
	'NBMUCRGBBF7LIVQWS2AHYOEAM7NMSDHJX7SQ54GJ', 'NBUPC3R7PU23FTDD53KNJAFVAOXJPXEHTSHG7TBX', 'ND4RNHKOOWJGRTC6PJWDTYR7MPPKCTKVJWQETKGR'
]


class InProgressOptinDatabaseTest(unittest.TestCase):
	# region create

	def test_can_create_tables(self):
		# Act:
		table_names = get_all_table_names(InProgressOptinDatabase)

		# Assert:
		self.assertEqual(set(['optin_error', 'optin_request']), table_names)

	# endregion

	# region add_error

	def _assert_can_insert_rows(self, seed_errors, seed_requests, expected_errors, expected_requests):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = InProgressOptinDatabase(connection)
			database.create_tables()

			# Act:
			for error in seed_errors:
				database.add_error(error)

			for request in seed_requests:
				database.add_request(request)

			# Assert:
			cursor = connection.cursor()
			cursor.execute('''SELECT * FROM optin_error ORDER BY transaction_hash DESC''')
			actual_errors = cursor.fetchall()

			cursor.execute('''SELECT * FROM optin_request ORDER BY transaction_hash DESC''')
			actual_requests = cursor.fetchall()

			self.assertEqual(expected_errors, actual_errors)
			self.assertEqual(expected_requests, actual_requests)

	def _assert_can_insert_errors(self, seed_errors, expected_errors):
		self._assert_can_insert_rows(seed_errors, [], expected_errors, [])

	def test_can_add_errors(self):
		self._assert_can_insert_errors([
			OptinRequestError(Address(NEM_ADDRESSES[0]), Hash256(HASHES[0]), 'this is an error message'),
			OptinRequestError(Address(NEM_ADDRESSES[1]), Hash256(HASHES[1]), 'this is another error message'),
			OptinRequestError(Address(NEM_ADDRESSES[2]), Hash256(HASHES[2]), 'error message')
		], [
			(Hash256(HASHES[0]).bytes, Address(NEM_ADDRESSES[0]).bytes, 'this is an error message'),
			(Hash256(HASHES[1]).bytes, Address(NEM_ADDRESSES[1]).bytes, 'this is another error message'),
			(Hash256(HASHES[2]).bytes, Address(NEM_ADDRESSES[2]).bytes, 'error message')
		])

	def test_can_add_multiple_errors_with_same_address(self):
		self._assert_can_insert_errors([
			OptinRequestError(Address(NEM_ADDRESSES[0]), Hash256(HASHES[0]), 'this is an error message'),
			OptinRequestError(Address(NEM_ADDRESSES[1]), Hash256(HASHES[1]), 'this is another error message'),
			OptinRequestError(Address(NEM_ADDRESSES[0]), Hash256(HASHES[2]), 'error message')
		], [
			(Hash256(HASHES[0]).bytes, Address(NEM_ADDRESSES[0]).bytes, 'this is an error message'),
			(Hash256(HASHES[1]).bytes, Address(NEM_ADDRESSES[1]).bytes, 'this is another error message'),
			(Hash256(HASHES[2]).bytes, Address(NEM_ADDRESSES[0]).bytes, 'error message')
		])

	def test_cannot_add_multiple_errors_with_same_transaction_hash(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = InProgressOptinDatabase(connection)
			database.create_tables()

			database.add_error(OptinRequestError(Address(NEM_ADDRESSES[0]), Hash256(HASHES[0]), 'this is an error message'))
			database.add_error(OptinRequestError(Address(NEM_ADDRESSES[1]), Hash256(HASHES[1]), 'this is another error message'))

			# Act:
			with self.assertRaises(sqlite3.IntegrityError):
				database.add_error(OptinRequestError(Address(NEM_ADDRESSES[2]), Hash256(HASHES[0]), 'error message'))

	# endregion

	# region add_request

	def _assert_can_insert_requests(self, seed_requests, expected_requests):
		self._assert_can_insert_rows([], seed_requests, [], expected_requests)

	def test_can_add_requests_regular(self):
		self._assert_can_insert_requests([
			OptinRequest(Address(NEM_ADDRESSES[0]), Hash256(HASHES[0]), {'type': 100, 'destination': PUBLIC_KEYS[0]}),
			OptinRequest(Address(NEM_ADDRESSES[1]), Hash256(HASHES[1]), {'type': 100, 'destination': PUBLIC_KEYS[1]}),
			OptinRequest(Address(NEM_ADDRESSES[2]), Hash256(HASHES[2]), {'type': 100, 'destination': PUBLIC_KEYS[2]})
		], [
			(Hash256(HASHES[0]).bytes, Address(NEM_ADDRESSES[0]).bytes, PublicKey(PUBLIC_KEYS[0]).bytes, None),
			(Hash256(HASHES[1]).bytes, Address(NEM_ADDRESSES[1]).bytes, PublicKey(PUBLIC_KEYS[1]).bytes, None),
			(Hash256(HASHES[2]).bytes, Address(NEM_ADDRESSES[2]).bytes, PublicKey(PUBLIC_KEYS[2]).bytes, None)
		])

	def test_can_add_requests_multisig(self):
		self._assert_can_insert_requests([
			OptinRequest(Address(NEM_ADDRESSES[0]), Hash256(HASHES[0]), {
				'type': 101, 'destination': PUBLIC_KEYS[0], 'origin': PUBLIC_KEYS[3]
			}),
			OptinRequest(Address(NEM_ADDRESSES[1]), Hash256(HASHES[1]), {
				'type': 101, 'destination': PUBLIC_KEYS[1], 'origin': PUBLIC_KEYS[4]
			}),
			OptinRequest(Address(NEM_ADDRESSES[2]), Hash256(HASHES[2]), {
				'type': 101, 'destination': PUBLIC_KEYS[2], 'origin': PUBLIC_KEYS[3]
			}),
		], [
			(Hash256(HASHES[0]).bytes, Address(NEM_ADDRESSES[0]).bytes, PublicKey(PUBLIC_KEYS[0]).bytes, PublicKey(PUBLIC_KEYS[3]).bytes),
			(Hash256(HASHES[1]).bytes, Address(NEM_ADDRESSES[1]).bytes, PublicKey(PUBLIC_KEYS[1]).bytes, PublicKey(PUBLIC_KEYS[4]).bytes),
			(Hash256(HASHES[2]).bytes, Address(NEM_ADDRESSES[2]).bytes, PublicKey(PUBLIC_KEYS[2]).bytes, PublicKey(PUBLIC_KEYS[3]).bytes)
		])

	def test_cannot_add_multiple_requests_with_same_transaction_hash(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = InProgressOptinDatabase(connection)
			database.create_tables()

			database.add_request(OptinRequest(Address(NEM_ADDRESSES[0]), Hash256(HASHES[0]), {'type': 100, 'destination': PUBLIC_KEYS[0]}))
			database.add_request(OptinRequest(Address(NEM_ADDRESSES[1]), Hash256(HASHES[1]), {'type': 100, 'destination': PUBLIC_KEYS[1]}))

			# Act:
			with self.assertRaises(sqlite3.IntegrityError):
				database.add_request(OptinRequest(Address(NEM_ADDRESSES[2]), Hash256(HASHES[0]), {
					'type': 100, 'destination': PUBLIC_KEYS[2]
				}))

	# endregion
