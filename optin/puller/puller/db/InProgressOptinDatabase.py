from enum import Enum

from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nem.Network import Address

from puller.models.OptinRequest import OptinRequest

from .NemBlockTimestampsMixin import NemBlockTimestampsMixin


class OptinRequestStatus(Enum):
	"""Status of an opt-in request."""
	UNPROCESSED = 0
	SENT = 1
	COMPLETED = 2
	DUPLICATE = 3
	ERROR = 4
	ERROR_ZERO = 5


class InProgressOptinDatabase(NemBlockTimestampsMixin):
	"""Database containing in progress optin information and errors."""

	def create_tables(self):
		"""Creates optin database tables."""

		super().create_tables()

		cursor = self.connection.cursor()
		cursor.execute('''CREATE TABLE IF NOT EXISTS optin_error (
			optin_transaction_height integer,
			optin_transaction_hash blob UNIQUE,
			address blob,
			message text
		)''')
		cursor.execute('''CREATE TABLE IF NOT EXISTS optin_request (
			optin_transaction_height integer,
			optin_transaction_hash blob UNIQUE,
			address blob,
			destination_public_key blob,
			multisig_public_key blob,
			payout_status integer,
			payout_transaction_hash blob
		)''')
		cursor.execute('''CREATE TABLE IF NOT EXISTS payout_transaction (
			transaction_hash blob UNIQUE PRIMARY KEY,
			height integer,
			timestamp integer
		)''')

	def add_error(self, error):
		"""Adds an error to the error table."""

		cursor = self.connection.cursor()
		cursor.execute('''INSERT INTO optin_error VALUES (?, ?, ?, ?)''', (
			error.optin_transaction_height,
			error.optin_transaction_hash.bytes,
			error.address.bytes,
			error.message))
		self.connection.commit()

	def add_request(self, request):
		"""Adds a request to the request table."""

		# this assumes that requests are inserted from newest to oldest

		cursor = self.connection.cursor()

		# find similar optin requests for same address and multisig
		multisig_public_key = request.multisig_public_key.bytes if request.multisig_public_key else None
		cursor.execute(
			'''SELECT payout_status FROM optin_request WHERE address = ? AND multisig_public_key IS ?
				ORDER BY optin_transaction_height''',
			(request.address.bytes, multisig_public_key))

		# if pending or successfully completed requests are present, this new request is a duplicate
		is_duplicate = any(
			row[0] in (OptinRequestStatus.UNPROCESSED.value, OptinRequestStatus.SENT.value, OptinRequestStatus.COMPLETED.value)
			for row in cursor
		)

		# insert the new request
		new_status = OptinRequestStatus.DUPLICATE if is_duplicate else OptinRequestStatus.UNPROCESSED
		cursor.execute('''INSERT INTO optin_request VALUES (?, ?, ?, ?, ?, ?, ?)''', (
			request.optin_transaction_height,
			request.optin_transaction_hash.bytes,
			request.address.bytes,
			request.destination_public_key.bytes,
			request.multisig_public_key.bytes if request.multisig_public_key else None,
			new_status.value,
			request.payout_transaction_hash.bytes if request.payout_transaction_hash else None))

		self.connection.commit()
		return new_status

	def max_processed_height(self):
		"""Gets maximum record height."""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT MAX(optin_transaction_height) FROM optin_error''')
		max_error_height = cursor.fetchone()[0]

		cursor.execute('''SELECT MAX(optin_transaction_height) FROM optin_request''')
		max_request_height = cursor.fetchone()[0]
		return max(max_error_height or 0, max_request_height or 0)

	@staticmethod
	def _to_request(request_tuple):
		return OptinRequest(
			Address(request_tuple[2]),
			request_tuple[0],
			Hash256(request_tuple[1]),
			Hash256(request_tuple[6]) if request_tuple[6] else None,
			{
				'type': 101 if request_tuple[4] else 100,
				'destination': str(PublicKey(request_tuple[3])),
				'origin': str(PublicKey(request_tuple[4])) if request_tuple[4] else None
			})

	def requests(self):
		"""Returns requests."""
		cursor = self.connection.cursor()
		cursor.execute('''SELECT * FROM optin_request ORDER BY optin_transaction_height''')
		for row in cursor:
			yield self._to_request(row)

	def nem_source_addresses(self, network):
		"""Returns unique source addresses."""
		addresses = [
			network.public_key_to_address(request.multisig_public_key) if request.multisig_public_key else request.address
			for request in self.requests()
		]

		return set(addresses)

	def set_request_status(self, request, new_status, payout_transaction_hash):
		"""Sets the status for a request."""

		cursor = self.connection.cursor()
		payout_transaction_hash_bytes = payout_transaction_hash.bytes if payout_transaction_hash else None
		multisig_public_key = request.multisig_public_key.bytes if request.multisig_public_key else None
		cursor.execute(
			'''UPDATE optin_request SET payout_status = ?, payout_transaction_hash = ?
				WHERE address = ? AND multisig_public_key IS ? AND optin_transaction_hash IS ?''',
			(
				new_status.value,
				payout_transaction_hash_bytes,
				request.address.bytes,
				multisig_public_key,
				request.optin_transaction_hash.bytes
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
			'''SELECT * FROM optin_request WHERE payout_status = ? ORDER BY optin_transaction_height DESC''',
			(status.value,))
		return list(map(self._to_request, cursor))

	def unconfirmed_payout_transaction_hashes(self):  # pylint: disable=invalid-name
		"""Gets hashes of all unconfirmed payout transactions."""

		cursor = self.connection.cursor()
		rows = cursor.execute('''SELECT transaction_hash FROM payout_transaction WHERE height = ? ORDER BY transaction_hash''', (0,))
		return [Hash256(row[0]) for row in rows]

	def set_payout_transaction_metadata(self, payout_transaction_hash, height, timestamp):
		cursor = self.connection.cursor()
		cursor.execute(
			'''UPDATE payout_transaction SET height = ?, timestamp = ?
				WHERE transaction_hash = ?''',
			(height, self.time_converter.symbol_to_unix(timestamp), payout_transaction_hash.bytes))
		self.connection.commit()

	def optin_transaction_heights(self):
		"""Gets list of optin transaction heights."""

		cursor = self.connection.cursor()
		error_heights = [row[0] for row in cursor.execute('''SELECT optin_transaction_height FROM optin_error''')]
		request_heights = [row[0] for row in cursor.execute('''SELECT optin_transaction_height FROM optin_request''')]
		return set(error_heights + request_heights)
