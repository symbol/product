from symbolchain.CryptoTypes import Hash256

from .MaxProcessedHeightMixin import MaxProcessedHeightMixin


class BalanceChangeDatabase(MaxProcessedHeightMixin):
	"""Database containing balance changes."""

	def create_tables(self):
		"""Creates balance change database tables."""

		super().create_tables()

		cursor = self.connection.cursor()
		cursor.execute('''CREATE TABLE IF NOT EXISTS transfer (
			height integer,
			currency text,
			amount integer,
			transaction_hash blob
		)''')

		cursor.execute('CREATE INDEX IF NOT EXISTS transfer_height ON transfer(height)')
		cursor.execute('CREATE INDEX IF NOT EXISTS transfer_currency ON transfer(currency)')
		cursor.execute('CREATE INDEX IF NOT EXISTS transfer_transaction_hash ON transfer(transaction_hash)')

	def add_transfer(self, height, currency, amount, transaction_hash):
		"""Adds a transfer to the transfer table."""

		cursor = self.connection.cursor()
		cursor.execute('''INSERT INTO transfer VALUES (?, ?, ?, ?)''', (height, currency, amount, transaction_hash.bytes))
		self.connection.commit()

	def add_transfers_filtered_by_address(self, height, balance_changes, target_address):
		"""Adds multiple transfers to the transfer table, filtered by address."""

		cursor = self.connection.cursor()

		count = 0
		for balance_change in balance_changes:
			if str(target_address) == balance_change.address:
				cursor.execute(
					'''INSERT INTO transfer VALUES (?, ?, ?, ?)''',
					(height, balance_change.currency_id, balance_change.amount, balance_change.transaction_hash.bytes))
				count += 1

		self.connection.commit()
		return count

	def is_synced_at_height(self, height):
		"""Determines if the database is synced through a height."""

		return height <= self.max_processed_height()

	def balance_at(self, height, currency):
		"""Calculates the balance for a currency at a height."""

		if not self.is_synced_at_height(height):
			raise ValueError(f'requested balance at {height} beyond current database height {self.max_processed_height()}')

		cursor = self.connection.cursor()
		cursor.execute(
			'''
				SELECT SUM(amount)
				FROM transfer
				WHERE currency IS ? AND height <= ?
			''',
			(currency, height))

		sum_amount = cursor.fetchone()[0]
		return sum_amount or 0

	def partial_balance_at(self, height, currency, transaction_hashes, batch_size=100):
		"""Sums the balance changes contained in the specified transactions."""

		balance = 0
		cursor = self.connection.cursor()

		start_index = 0
		while start_index < len(transaction_hashes):
			transaction_hashes_batch = transaction_hashes[start_index:start_index + batch_size]

			in_query = ','.join(['?'] * len(transaction_hashes_batch))
			cursor.execute(
				f'''
					SELECT SUM(amount)
					FROM transfer
					WHERE currency IS ? AND height <= ? AND transaction_hash IN ({in_query})
				''',
				(currency, height, *(transaction_hash.bytes for transaction_hash in transaction_hashes_batch)))

			sum_amount = cursor.fetchone()[0]
			balance += sum_amount or 0
			start_index += batch_size

		return balance

	def filter_transactions_if_present(self, height, currency, transaction_hashes, batch_size=100):
		"""Selects the subset of transactions that are present in this database."""

		cursor = self.connection.cursor()

		start_index = 0
		while start_index < len(transaction_hashes):
			transaction_hashes_batch = transaction_hashes[start_index:start_index + batch_size]

			in_query = ','.join(['?'] * len(transaction_hashes_batch))
			cursor.execute(
				f'''
					SELECT transaction_hash
					FROM transfer
					WHERE currency IS ? AND height <= ? AND transaction_hash IN ({in_query})
				''',
				(currency, height, *(transaction_hash.bytes for transaction_hash in transaction_hashes_batch)))
			for row in cursor:
				yield Hash256(row[0])

			start_index += batch_size

	def reset(self):
		"""Deletes all transfer entries with heights above the max processed height."""

		max_processed_height = self.max_processed_height()

		cursor = self.connection.cursor()
		cursor.execute(
			'''
				DELETE FROM transfer
				WHERE height > ?
			''',
			(max_processed_height,))
		self.connection.commit()
