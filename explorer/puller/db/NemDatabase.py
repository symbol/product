from db.DatabaseConnection import DatabaseConnection


class NemDatabase(DatabaseConnection):
	"""Database containing Nem blockchain data."""

	def create_tables(self):
		"""Creates blocks database tables."""

		cursor = self.connection.cursor()
		cursor.execute('''CREATE TABLE IF NOT EXISTS blocks (
			height bigint NOT NULL PRIMARY KEY,
			timestamp timestamp NOT NULL,
			totalFees bigint DEFAULT 0,
			totalTransactions bigint DEFAULT 0,
			difficulty bigInt NOT NULL,
			hash bytea NOT NULL,
			harvester bytea NOT NULL,
			signature bytea NOT NULL
		)''')

		self.connection.commit()

	def insert_block(self, cursor, block):  # pylint: disable=no-self-use
		"""Adds block height into table."""

		cursor.execute('''INSERT INTO blocks VALUES (%s, %s, %s, %s, %s, %s, %s, %s)''', (
			block.height,
			block.timestamp,
			block.total_fees,
			block.total_transactions,
			block.difficulty,
			bytes.fromhex(block.block_hash),
			bytes.fromhex(block.signer),
			bytes.fromhex(block.signature)
		))

	def get_current_height(self):
		"""Gets current height from database"""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT MAX(height) FROM blocks''')
		results = cursor.fetchone()
		return 0 if results[0] is None else results[0]
