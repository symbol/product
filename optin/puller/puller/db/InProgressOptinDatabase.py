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
			multisig_public_key blob
		)''')

	def add_error(self, error):
		"""Adds an error to the error table."""

		cursor = self.connection.cursor()
		cursor.execute('''INSERT INTO optin_error VALUES (?, ?, ?, ?)''', (
			error.transaction_height,
			error.transaction_hash.bytes,
			error.address.bytes,
			error.message
		))

	def add_request(self, request):
		"""Adds a request to the request table."""

		cursor = self.connection.cursor()
		cursor.execute('''INSERT INTO optin_request VALUES (?, ?, ?, ?, ?)''', (
			request.transaction_height,
			request.transaction_hash.bytes,
			request.address.bytes,
			request.destination_public_key.bytes,
			request.multisig_public_key.bytes if request.multisig_public_key else None
		))

	def max_processed_height(self):
		"""Gets maximum record height."""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT MAX(transaction_height) FROM optin_error''')
		max_error_height = cursor.fetchone()[0]

		cursor.execute('''SELECT MAX(transaction_height) FROM optin_request''')
		max_request_height = cursor.fetchone()[0]
		return max(max_error_height or 0, max_request_height or 0)
