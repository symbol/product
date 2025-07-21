from collections import namedtuple
from enum import Enum

from symbolchain.CryptoTypes import Hash256

from ..models.WrapRequest import WrapRequest, make_wrap_error_result
from .MaxProcessedHeightMixin import MaxProcessedHeightMixin

PayoutDetails = namedtuple('PayoutDetails', ['transaction_hash', 'net_amount', 'total_fee', 'conversion_rate'])


class WrapRequestStatus(Enum):
	"""Status of a wrap request."""

	UNPROCESSED = 0
	SENT = 1
	COMPLETED = 2
	FAILED = 3


class WrapRequestDatabase(MaxProcessedHeightMixin):
	"""Database containing wrap requests and errors."""

	def __init__(self, connection, network_facade):
		"""Creates a wrap request database."""

		super().__init__(connection)

		self.network_facade = network_facade

	def create_tables(self):
		"""Creates wrap request database tables."""

		super().create_tables()

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
			payout_transaction_hash blob UNIQUE,
			PRIMARY KEY (request_transaction_hash, request_transaction_subindex)
		)''')
		cursor.execute('''CREATE TABLE IF NOT EXISTS payout_transaction (
			transaction_hash blob UNIQUE PRIMARY KEY,
			net_amount integer,
			total_fee integer,
			conversion_rate integer,
			height integer
		)''')
		cursor.execute('''CREATE TABLE IF NOT EXISTS block_metadata (
			height integer UNIQUE PRIMARY KEY,
			timestamp timestamp
		)''')

		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_error_request_transaction_height_idx ON wrap_error(request_transaction_height)')
		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_error_address_idx ON wrap_error(address)')

		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_request_request_transaction_height_idx ON wrap_request(request_transaction_height)')
		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_request_request_transaction_hash_idx ON wrap_request(request_transaction_hash)')
		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_request_destination_address_idx ON wrap_request(destination_address)')
		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_request_payout_status_idx ON wrap_request(payout_status)')
		cursor.execute('CREATE INDEX IF NOT EXISTS wrap_request_payout_transaction_hash_idx ON wrap_request(payout_transaction_hash)')

	@staticmethod
	def _add_error_with_cursor(cursor, error):
		cursor.execute('''INSERT INTO wrap_error VALUES (?, ?, ?, ?, ?)''', (
			error.transaction_height,
			error.transaction_hash.bytes,
			error.transaction_subindex,
			error.sender_address.bytes,
			error.message))

	def add_error(self, error):
		"""Adds an error to the error table."""

		cursor = self.connection.cursor()
		self._add_error_with_cursor(cursor, error)
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

	def _max_processed_timestamp(self):
		max_processed_height = self.max_processed_height()
		return self._lookup_block_timestamp_closest(max_processed_height) or 0

	def is_synced_at_timestamp(self, timestamp):
		"""Determines if the database is synced through a timestamp."""

		return timestamp <= self._max_processed_timestamp()

	def cumulative_wrapped_amount_at(self, timestamp, relative_block_adjustment=0):
		"""Gets cumulative amount of wrapped tokens issued at or before timestamp."""

		if relative_block_adjustment > 0:
			raise ValueError('relative_block_adjustment must not be positive')

		if not self.is_synced_at_timestamp(timestamp):
			raise ValueError(f'requested wrapped amount at {timestamp} beyond current database timestamp {self._max_processed_timestamp()}')

		if relative_block_adjustment:
			height = self.lookup_block_height(timestamp)
			timestamp = self._lookup_block_timestamp_closest(height + relative_block_adjustment)

		cursor = self.connection.cursor()
		cursor.execute('''
			SELECT SUM(wrap_request.amount)
			FROM wrap_request
			LEFT JOIN block_metadata ON wrap_request.request_transaction_height = block_metadata.height
			WHERE block_metadata.timestamp <= ?
		''', (timestamp,))
		sum_amount = cursor.fetchone()[0]
		return sum_amount or 0

	def cumulative_net_amount_at(self, timestamp):
		"""Gets cumulative amount of wrapped tokens issued at or before timestamp."""

		cursor = self.connection.cursor()
		cursor.execute('''
			SELECT SUM(payout_transaction.net_amount)
			FROM wrap_request
			LEFT JOIN block_metadata ON wrap_request.request_transaction_height = block_metadata.height
			LEFT JOIN payout_transaction ON wrap_request.payout_transaction_hash = payout_transaction.transaction_hash
			WHERE block_metadata.timestamp <= ?
		''', (timestamp,))
		sum_amount = cursor.fetchone()[0]
		return sum_amount or 0

	def cumulative_fees_paid_at(self, timestamp):
		"""Gets cumulative amount of fees paid at or before timestamp."""

		cursor = self.connection.cursor()
		cursor.execute('''
			SELECT SUM(payout_transaction.total_fee)
			FROM wrap_request
			LEFT JOIN block_metadata ON wrap_request.request_transaction_height = block_metadata.height
			LEFT JOIN payout_transaction ON wrap_request.payout_transaction_hash = payout_transaction.transaction_hash
			WHERE block_metadata.timestamp <= ?
		''', (timestamp,))
		sum_amount = cursor.fetchone()[0]
		return sum_amount or 0

	def payout_transaction_hashes_at(self, timestamp):
		"""Gets all payout transaction hashes at or before timestamp."""

		cursor = self.connection.cursor()
		cursor.execute('''
			SELECT payout_transaction.transaction_hash
			FROM wrap_request
			LEFT JOIN block_metadata ON wrap_request.request_transaction_height = block_metadata.height
			LEFT JOIN payout_transaction ON wrap_request.payout_transaction_hash = payout_transaction.transaction_hash
			WHERE block_metadata.timestamp <= ?
		''', (timestamp,))
		for row in cursor:
			yield Hash256(row[0])

	def sum_payout_transaction_amounts(self, payout_transaction_hashes, batch_size=100):
		"""Sums the wrapped tokens affected by the specified payout transactions."""

		balance = 0
		cursor = self.connection.cursor()

		start_index = 0
		while start_index < len(payout_transaction_hashes):
			transaction_hashes_batch = payout_transaction_hashes[start_index:start_index + batch_size]

			in_query = ','.join(['?'] * len(transaction_hashes_batch))
			cursor.execute(
				f'''
					SELECT SUM(amount)
					FROM wrap_request
					WHERE payout_transaction_hash IN ({in_query})
				''',
				tuple(transaction_hash.bytes for transaction_hash in transaction_hashes_batch))

			sum_amount = cursor.fetchone()[0]
			balance += sum_amount or 0
			start_index += batch_size

		return balance

	def mark_payout_sent(self, request, payout_details):
		"""Marks a payout as sent with the transaction hash of the payout."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''
				UPDATE wrap_request
				SET payout_status = ?, payout_transaction_hash = ?
				WHERE request_transaction_hash IS ? AND request_transaction_subindex IS ?
			''',
			(
				WrapRequestStatus.SENT.value,
				payout_details.transaction_hash.bytes,
				request.transaction_hash.bytes,
				request.transaction_subindex
			))

		cursor.execute(
			'''INSERT INTO payout_transaction VALUES (?, ?, ?, ?, ?)''',
			(
				payout_details.transaction_hash.bytes,
				payout_details.net_amount,
				payout_details.total_fee,
				payout_details.conversion_rate,
				0
			))

		self.connection.commit()

	def mark_payout_failed(self, request, message):
		"""Marks a payout as failed with a message."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''
				UPDATE wrap_request
				SET payout_status = ?
				WHERE request_transaction_hash IS ? AND request_transaction_subindex IS ?
			''',
			(
				WrapRequestStatus.FAILED.value,
				request.transaction_hash.bytes,
				request.transaction_subindex
			))

		self._add_error_with_cursor(cursor, make_wrap_error_result(request, message).error)
		self.connection.commit()

	def mark_payout_completed(self, payout_transaction_hash, height):
		"""Marks a payout complete at a height."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''UPDATE wrap_request SET payout_status = ? WHERE payout_transaction_hash IS ?''',
			(WrapRequestStatus.COMPLETED.value, payout_transaction_hash.bytes))

		cursor.execute(
			'''UPDATE payout_transaction SET height = ? WHERE transaction_hash IS ?''',
			(height, payout_transaction_hash.bytes))

		cursor.execute(
			'''INSERT OR IGNORE INTO block_metadata VALUES (?, ?)''',
			(height, 0))

		self.connection.commit()

	def reset(self):
		"""Deletes all request and error entries with request transaction heights above the max processed height."""

		max_processed_height = self.max_processed_height()

		cursor = self.connection.cursor()
		cursor.execute(
			'''
				DELETE FROM wrap_request
				WHERE request_transaction_height > ?
			''',
			(max_processed_height,))
		cursor.execute(
			'''
				DELETE FROM wrap_error
				WHERE request_transaction_height > ?
			''',
			(max_processed_height,))
		self.connection.commit()

	def set_block_timestamp(self, height, raw_timestamp):
		"""Sets a block timestamp."""

		unix_timestamp = self.network_facade.network.to_datetime(
			self.network_facade.network.network_timestamp_class(raw_timestamp)
		).timestamp()

		cursor = self.connection.cursor()
		cursor.execute(
			'''
				INSERT INTO block_metadata VALUES (?, ?)
				ON CONFLICT(height)
				DO UPDATE SET timestamp=?
			''',
			(height, unix_timestamp, unix_timestamp))
		self.connection.commit()

	def lookup_block_timestamp(self, height):
		"""Looks up the timestamp of a block height."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''SELECT timestamp FROM block_metadata WHERE height = ?''',
			(height,))
		fetch_result = cursor.fetchone()
		return fetch_result[0] if fetch_result else None

	def _lookup_block_timestamp_closest(self, height):
		cursor = self.connection.cursor()
		cursor.execute(
			'''SELECT MAX(timestamp) FROM block_metadata WHERE height <= ?''',
			(height,))
		fetch_result = cursor.fetchone()
		return fetch_result[0] if fetch_result else None

	def lookup_block_height(self, timestamp):
		"""Looks up the height of the last block with a timestamp no greater than provided."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''SELECT max(height) FROM block_metadata WHERE timestamp <= ?''',
			(timestamp,))
		return cursor.fetchone()[0] or 0

	def requests_by_status(self, status):
		"""Gets all requests with the desired status."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''SELECT * FROM wrap_request WHERE payout_status = ? ORDER BY request_transaction_height ASC''',
			(status.value,))
		return list(map(self._to_request, cursor))

	def unconfirmed_payout_transaction_hashes(self):  # pylint: disable=invalid-name
		"""Gets hashes of all unconfirmed payout transactions."""

		cursor = self.connection.cursor()
		rows = cursor.execute('''SELECT transaction_hash FROM payout_transaction WHERE height = ? ORDER BY transaction_hash''', (0,))
		return [Hash256(row[0]) for row in rows]
