from enum import Enum

from symbolchain.CryptoTypes import Hash256

from ..models.WrapRequest import WrapRequest


class WrapRequestStatus(Enum):
	"""Status of a wrap request."""
	UNPROCESSED = 0
	SENT = 1
	COMPLETED = 2
	ERROR = 3


class WrapRequestDatabase:
	"""Database containing wrap requests and errors."""

	def __init__(self, connection, network_facade):
		"""Creates a wrap request database."""

		self.connection = connection
		self.network_facade = network_facade

	def create_tables(self):
		"""Creates wrap request database tables."""

		cursor = self.connection.cursor()
		cursor.execute('''CREATE TABLE IF NOT EXISTS wrap_error (
			wrap_transaction_height integer,
			wrap_transaction_hash blob UNIQUE,
			address blob,
			message text
		)''')
		cursor.execute('''CREATE TABLE IF NOT EXISTS wrap_request (
			wrap_transaction_height integer,
			wrap_transaction_hash blob UNIQUE,
			address blob,
			amount integer,
			destination_address blob,
			wrap_status integer
		)''')

		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_error_wrap_transaction_height_idx on wrap_error(wrap_transaction_height)')
		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_error_address_idx on wrap_error(address)')

		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_request_wrap_transaction_height_idx on wrap_request(wrap_transaction_height)')
		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_request_wrap_transaction_hash_idx on wrap_request(wrap_transaction_hash)')
		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_request_address_idx on wrap_request(address)')
		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_request_status_idx on wrap_request(wrap_status)')

	def add_error(self, error):
		"""Adds an error to the error table."""

		cursor = self.connection.cursor()
		cursor.execute('''INSERT INTO wrap_error VALUES (?, ?, ?, ?)''', (
			error.transaction_height,
			error.transaction_hash.bytes,
			error.sender_address.bytes,
			error.message))
		self.connection.commit()

	def add_request(self, request):
		"""Adds a request to the request table."""

		cursor = self.connection.cursor()
		cursor.execute('''INSERT INTO wrap_request VALUES (?, ?, ?, ?, ?, ?)''', (
			request.transaction_height,
			request.transaction_hash.bytes,
			request.sender_address.bytes,
			request.amount,
			request.destination_address,
			WrapRequestStatus.UNPROCESSED.value))
		self.connection.commit()

	def _to_request(self, request_tuple):
		return WrapRequest(
			request_tuple[0],
			Hash256(request_tuple[1]),
			self.network_facade.make_address(request_tuple[2]),
			request_tuple[3],
			request_tuple[4])

	def requests(self):
		"""Returns requests."""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT * FROM wrap_request ORDER BY wrap_transaction_height''')
		for row in cursor:
			yield self._to_request(row)

	def max_processed_height(self):
		"""Gets maximum record height."""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT MAX(wrap_transaction_height) FROM wrap_error''')
		max_error_height = cursor.fetchone()[0]

		cursor.execute('''SELECT MAX(wrap_transaction_height) FROM wrap_request''')
		max_request_height = cursor.fetchone()[0]
		return max(max_error_height or 0, max_request_height or 0)

	def set_request_status(self, request, new_status):
		"""Sets the status for a request."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''UPDATE wrap_request SET wrap_status = ? WHERE wrap_transaction_hash IS ?''',
			(
				new_status.value,
				request.transaction_hash.bytes
			))

		self.connection.commit()

	def requests_by_status(self, status):
		"""Gets all requests with the desired status."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''SELECT * FROM wrap_request WHERE wrap_status = ? ORDER BY wrap_transaction_height DESC''',
			(status.value,))
		return list(map(self._to_request, cursor))
