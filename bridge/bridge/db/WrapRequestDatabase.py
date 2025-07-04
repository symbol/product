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
			request_transaction_height integer,
			request_transaction_hash blob,
			request_transaction_subindex integer,
			address blob,
			message text,
			PRIMARY KEY (request_transaction_hash, request_transaction_subindex)
		)''')
		cursor.execute('''CREATE TABLE IF NOT EXISTS wrap_request (
			request_transaction_height integer,
			request_transaction_hash blob,
			request_transaction_subindex integer,
			address blob,
			amount integer,
			destination_address blob,
			payout_status integer,
			payout_transaction_hash blob,
			PRIMARY KEY (request_transaction_hash, request_transaction_subindex)
		)''')
		cursor.execute('''CREATE TABLE IF NOT EXISTS payout_transaction (
			transaction_hash blob UNIQUE PRIMARY KEY,
			height integer,
			timestamp integer
		)''')

		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_error_request_transaction_height_idx on wrap_error(request_transaction_height)')
		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_error_address_idx on wrap_error(address)')

		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_request_request_transaction_height_idx on wrap_request(request_transaction_height)')
		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_request_request_transaction_hash_idx on wrap_request(request_transaction_hash)')
		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_request_address_idx on wrap_request(address)')
		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_request_status_idx on wrap_request(payout_status)')

	def add_error(self, error):
		"""Adds an error to the error table."""

		cursor = self.connection.cursor()
		cursor.execute('''INSERT INTO wrap_error VALUES (?, ?, ?, ?, ?)''', (
			error.transaction_height,
			error.transaction_hash.bytes,
			error.transaction_subindex,
			error.sender_address.bytes,
			error.message))
		self.connection.commit()

	def add_request(self, request):
		"""Adds a request to the request table."""

		cursor = self.connection.cursor()
		cursor.execute('''INSERT INTO wrap_request VALUES (?, ?, ?, ?, ?, ?, ?, ?)''', (
			request.transaction_height,
			request.transaction_hash.bytes,
			request.transaction_subindex,
			request.sender_address.bytes,
			request.amount,
			request.destination_address,
			WrapRequestStatus.UNPROCESSED.value,
			None))
		self.connection.commit()

	def _to_request(self, request_tuple):
		return WrapRequest(
			request_tuple[0],
			Hash256(request_tuple[1]),
			request_tuple[2],
			self.network_facade.make_address(request_tuple[3]),
			request_tuple[4],
			request_tuple[5])

	def requests(self):
		"""Returns requests."""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT * FROM wrap_request ORDER BY request_transaction_height''')
		for row in cursor:
			yield self._to_request(row)

	def max_processed_height(self):
		"""Gets maximum record height."""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT MAX(request_transaction_height) FROM wrap_error''')
		max_error_height = cursor.fetchone()[0]

		cursor.execute('''SELECT MAX(request_transaction_height) FROM wrap_request''')
		max_request_height = cursor.fetchone()[0]
		return max(max_error_height or 0, max_request_height or 0)

	def total_wrapped_amount(self):
		"""Gets sum of all valid wrap request amounts."""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT SUM(amount) FROM wrap_request''')
		sum_amount = cursor.fetchone()[0]
		return sum_amount or 0

	def set_request_status(self, request, new_status, payout_transaction_hash=None):
		"""Sets the status for a request."""

		cursor = self.connection.cursor()
		payout_transaction_hash_bytes = payout_transaction_hash.bytes if payout_transaction_hash else None
		cursor.execute(
			'''
				UPDATE wrap_request
				SET payout_status = ?, payout_transaction_hash = ?
				WHERE request_transaction_hash IS ? AND request_transaction_subindex is ?
			''',
			(
				new_status.value,
				payout_transaction_hash_bytes,
				request.transaction_hash.bytes,
				request.transaction_subindex
			))

		if payout_transaction_hash_bytes:
			cursor.execute(
				'''INSERT OR IGNORE INTO payout_transaction VALUES (?, ?, ?)''',
				(payout_transaction_hash_bytes, 0, 0))

		self.connection.commit()

	def requests_by_status(self, status):
		"""Gets all requests with the desired status."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''SELECT * FROM wrap_request WHERE payout_status = ? ORDER BY request_transaction_height DESC''',
			(status.value,))
		return list(map(self._to_request, cursor))

	def unconfirmed_payout_transaction_hashes(self):  # pylint: disable=invalid-name
		"""Gets hashes of all unconfirmed payout transactions."""

		cursor = self.connection.cursor()
		rows = cursor.execute('''SELECT transaction_hash FROM payout_transaction WHERE height = ? ORDER BY transaction_hash''', (0,))
		return [Hash256(row[0]) for row in rows]

	def set_payout_transaction_metadata(self, payout_transaction_hash, height, timestamp):
		"""Sets metadata associated with a payout transaction."""

		unix_timestamp = self.network_facade.network.to_datetime(timestamp).timestamp()

		cursor = self.connection.cursor()
		cursor.execute(
			'''UPDATE payout_transaction SET height = ?, timestamp = ?
				WHERE transaction_hash = ?''',
			(height, unix_timestamp, payout_transaction_hash.bytes))
		self.connection.commit()
