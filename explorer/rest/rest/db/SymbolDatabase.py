from .DatabaseConnection import DatabaseConnectionPool


class SymbolDatabase(DatabaseConnectionPool):
	"""Database access for Symbol Explorer data."""

	def check_connection(self):
		"""Checks whether the configured Symbol database is reachable."""

		with self.connection() as connection:
			with connection.cursor() as cursor:
				cursor.execute('SELECT 1')
				return 1 == cursor.fetchone()[0]
