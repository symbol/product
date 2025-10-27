class MaxProcessedHeightMixin:
	"""Mixin that adds a max processed height table."""

	def __init__(self, connection):
		"""Creates a max processed height mixin."""

		self.connection = connection
		self.connection.execute('PRAGMA foreign_keys = ON')

	def create_tables(self):
		"""Creates max processed height database tables."""

		cursor = self.connection.cursor()
		cursor.execute('''CREATE TABLE IF NOT EXISTS max_processed_height (
			height integer,
			marker integer UNIQUE
		)''')

	def set_max_processed_height(self, height):
		"""Sets max processed height."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''
				INSERT INTO max_processed_height VALUES (?, ?)
				ON CONFLICT(marker)
				DO UPDATE SET height=excluded.height
			''',
			(height, 1))
		self.connection.commit()

	def max_processed_height(self):
		"""Gets max processed height."""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT height FROM max_processed_height LIMIT 1''')

		row = cursor.fetchone()
		return row[0] if row else 0
