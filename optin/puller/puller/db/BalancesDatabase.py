from symbolchain.nem.Network import Address


class BalancesDatabase:
	"""Database containing snapshot account balances."""

	def __init__(self, connection):
		"""Creates a database around a database connection."""

		self.connection = connection

	def create_tables(self):
		"""Creates balances database tables."""

		cursor = self.connection.cursor()
		cursor.execute('''CREATE TABLE IF NOT EXISTS snapshot_balances (
			address blob UNIQUE,
			balance integer
		)''')

	def add_account_balance(self, address, balance):
		"""Adds an account to the balances table."""

		cursor = self.connection.cursor()
		cursor.execute('''INSERT INTO snapshot_balances VALUES (?, ?)''', (address.bytes, balance))

	def addresses(self):
		"""Gets all addresses with a balance entry."""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT address FROM snapshot_balances''')
		return [Address(tuple[0]) for tuple in cursor.fetchall()]

	def lookup_balance(self, address):
		"""Gets the balance for the specified address."""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT balance FROM snapshot_balances WHERE address = ?''', (address.bytes,))
		results = cursor.fetchone()
		return results[0] if results else 0
