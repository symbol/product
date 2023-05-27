from db.DatabaseConnection import DatabaseConnection


class NemDatabase(DatabaseConnection):
	"""Database containing Nem blockchain data."""

	def create_tables(self):
		"""Creates blocks database tables."""

		cursor = self.connection.cursor()
		cursor.execute('''CREATE TABLE IF NOT EXISTS blocks (
			height integer NOT NULL,
			timestamp timestamp NOT NULL,
			totalFees integer DEFAULT 0,
			totalTransactions integer DEFAULT 0,
			difficulty bigInt NOT NULL,
			hash VARCHAR(64) NOT NULL,
			harvester VARCHAR(40) NOT NULL
		)''')

		self.connection.commit()

	def insert_block(self, block):
		"""Adds block height into table."""

		cursor = self.connection.cursor()
		cursor.execute('''INSERT INTO blocks VALUES (%s, %s, %s, %s, %s, %s, %s)''', (
			block['height'],
			block['timestamp'],
			block['totalFees'],
			block['totalTransactions'],
			block['difficulty'],
			block['hash'],
			block['signer']
		))
		self.connection.commit()

	def get_current_height(self):
		"""Gets current height from database"""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT MAX(height) FROM blocks''')
		results = cursor.fetchone()
		return 0 if results[0] is None else results[0]
