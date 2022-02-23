from enum import Enum

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nem.Network import Address

from puller.models.OptinRequest import OptinRequest


class OptinRequestStatus(Enum):
	"""Status of an opt-in request."""
	UNPROCESSED = 0
	SENT = 1
	CONFIRMED = 2
	DUPLICATE = 3
	ERROR = 4


class InProgressOptinDatabase:
	"""Database containing in progress optin information and errors."""

	def __init__(self, connection):
		"""Creates a database around a database connection."""

		self.connection = connection

	def create_tables(self):
		"""Creates optin database tables."""

		cursor = self.connection.cursor()
		cursor.execute('''CREATE TABLE IF NOT EXISTS optin_error (
			transaction_height integer,
			transaction_hash blob UNIQUE,
			address blob,
			message text
		)''')
		cursor.execute('''CREATE TABLE IF NOT EXISTS optin_request (
			transaction_height integer,
			transaction_hash blob UNIQUE,
			address blob,
			destination_public_key blob,
			multisig_public_key blob,
			status integer,
			status_hash blob
		)''')

	def add_error(self, error):
		"""Adds an error to the error table."""

		cursor = self.connection.cursor()
		cursor.execute('''INSERT INTO optin_error VALUES (?, ?, ?, ?)''', (
			error.transaction_height,
			error.transaction_hash.bytes,
			error.address.bytes,
			error.message))

	def add_request(self, request):
		"""Adds a request to the request table."""

		cursor = self.connection.cursor()
		cursor.execute('''INSERT INTO optin_request VALUES (?, ?, ?, ?, ?, ?, ?)''', (
			request.transaction_height,
			request.transaction_hash.bytes,
			request.address.bytes,
			request.destination_public_key.bytes,
			request.multisig_public_key.bytes if request.multisig_public_key else None,
			OptinRequestStatus.UNPROCESSED.value,
			None))

	def max_processed_height(self):
		"""Gets maximum record height."""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT MAX(transaction_height) FROM optin_error''')
		max_error_height = cursor.fetchone()[0]

		cursor.execute('''SELECT MAX(transaction_height) FROM optin_request''')
		max_request_height = cursor.fetchone()[0]
		return max(max_error_height or 0, max_request_height or 0)

	@staticmethod
	def _to_request(request_tuple):
		return OptinRequest(Address(request_tuple[2]), request_tuple[0], Hash256(request_tuple[1]), {
			'type': 101 if request_tuple[4] else 100,
			'destination': str(PublicKey(request_tuple[3])),
			'origin': str(PublicKey(request_tuple[4])) if request_tuple[4] else None
		})

	@property
	def requests(self):
		"""Returns requests."""
		cursor = self.connection.cursor()
		cursor.execute('''SELECT * FROM optin_request ORDER BY transaction_height''')
		for row in cursor:
			yield self._to_request(row)

	def set_request_status(self, request, new_status, status_hash):
		"""Sets the status for a request."""

		cursor = self.connection.cursor()
		if request.multisig_public_key:
			cursor.execute(
				'''UPDATE optin_request SET status = ?, status_hash = ? WHERE address = ? AND multisig_public_key = ?''',
				(new_status.value, status_hash.bytes, request.address.bytes, request.multisig_public_key.bytes))
		else:
			cursor.execute(
				'''UPDATE optin_request SET status = ?, status_hash = ? WHERE address = ? AND multisig_public_key IS NULL''',
				(new_status.value, status_hash.bytes, request.address.bytes))

	def get_requests_by_status(self, status):
		"""Gets all requests with the desired status."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''SELECT * FROM optin_request WHERE status = ? ORDER BY transaction_height ASC''',
			(status.value,))
		return list(map(self._to_request, cursor))
