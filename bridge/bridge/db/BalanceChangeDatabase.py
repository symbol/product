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
			amount integer
		)''')

		cursor.execute('CREATE INDEX IF NOT EXISTS transfer_height ON transfer(height)')
		cursor.execute('CREATE INDEX IF NOT EXISTS transfer_currency ON transfer(currency)')

	def add_transfer(self, height, currency, amount):
		"""Adds a transfer to the transfer table."""

		cursor = self.connection.cursor()
		cursor.execute('''INSERT INTO transfer VALUES (?, ?, ?)''', (height, currency, amount))
		self.connection.commit()

	def add_transfers_filtered_by_address(self, height, balance_changes, target_address):
		"""Adds multiple transfers to the transfer table, filtered by address."""

		cursor = self.connection.cursor()

		count = 0
		for balance_change in balance_changes:
			if str(target_address) == balance_change.address:
				cursor.execute('''INSERT INTO transfer VALUES (?, ?, ?)''', (height, balance_change.currency_id, balance_change.amount))
				count += 1

		self.connection.commit()
		return count

	def balance_at(self, height, currency):
		"""Calculates the balance for a currency at a height."""

		max_processed_height = self.max_processed_height()
		if height > max_processed_height:
			raise ValueError(f'requested balance at {height} beyond current database height {max_processed_height}')

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
