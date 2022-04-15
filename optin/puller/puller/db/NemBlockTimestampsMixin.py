import sqlite3


class NemBlockTimestampsMixin:
	"""Database mixin for storing NEM block timestamps."""

	def __init__(self, connection):
		"""Creates a mixin around a database connection."""

		self.connection = connection

	def create_tables(self):
		"""Creates NEM block timestamps table."""

		cursor = self.connection.cursor()
		cursor.execute('''CREATE TABLE IF NOT EXISTS nem_block_timestamps (
			height integer PRIMARY KEY,
			timestamp integer
		)''')

	def insert_nem_block_timestamps(self, height_timestamp_dict):
		"""Adds NEM height to timestamp mapping to the database."""

		cursor = self.connection.cursor()
		try:
			cursor.executemany('''INSERT INTO nem_block_timestamps VALUES (?, ?)''', list(height_timestamp_dict.items()))
			self.connection.commit()
		except sqlite3.IntegrityError:
			self.connection.rollback()
			raise

	def nem_block_timestamps(self):
		"""Gets NEM block timestamps."""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT * FROM nem_block_timestamps ORDER BY height DESC''')
		return cursor.fetchall()
