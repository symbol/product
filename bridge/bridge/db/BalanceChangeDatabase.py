import logging
import sqlite3
from symbolchain.CryptoTypes import Hash256

from .MaxProcessedHeightMixin import MaxProcessedHeightMixin


class BalanceChangeDatabase(MaxProcessedHeightMixin):
	"""Database containing balance changes."""

	def __init__(self, connection):
		"""Creates a balance change database."""

		super().__init__(connection)
		self._logger = logging.getLogger(__name__)

	def create_tables(self):
		"""Creates balance change database tables."""

		super().create_tables()
		self.execscript("""
CREATE TABLE IF NOT EXISTS transfer (
	height INTEGER NOT NULL,
	currency TEXT NOT NULL,
	amount INTEGER NOT NULL,
	transaction_hash BLOB NOT NULL PRIMARY KEY
);

CREATE INDEX IF NOT EXISTS transfer_height ON transfer(height);
CREATE INDEX IF NOT EXISTS transfer_currency ON transfer(currency);
""")

	def add_transfer(self, height, currency, amount, transaction_hash) -> int:
		"""Adds a transfer to the transfer table."""
		try:
			res = self.exec(
			    """INSERT INTO transfer(height, currency, amount, transaction_hash) VALUES (?, ?, ?, ?)""",
			    (height, currency, amount, transaction_hash.bytes),
			)
			self.commit()
			return res
		except sqlite3.DatabaseError as ex:
			self._logger.warning(
			    "Failed to add transaction_hash [%s]: %s",
			    transaction_hash.bytes.hex(),
			    ex,
			)
			return 0

	def add_transfers_filtered_by_address(self, height, balance_changes, target_address) -> int:
		"""Adds multiple transfers to the transfer table, filtered by address."""

		count = 0
		for balance_change in balance_changes:
			if str(target_address) == balance_change.address:
				count += self.add_transfer(
				    height,
				    balance_change.currency_id,
				    balance_change.amount,
				    balance_change.transaction_hash.bytes,
				)

		self.commit()
		return count

	def is_synced_at_height(self, height):
		"""Determines if the database is synced through a height."""

		return height <= self.max_processed_height()

	def balance_at(self, height, currency):
		"""Calculates the balance for a currency at a height."""

		if not self.is_synced_at_height(height):
			raise ValueError(f"requested balance at {height} beyond current database height {self.max_processed_height()}")

		res = self.exec(
		    """
				SELECT SUM(amount)
				FROM transfer
				WHERE currency IS ? AND height <= ?
			""",
		    (currency, height),
		)

		return res[0][0] if res else 0

	def partial_balance_at(self, height, currency, transaction_hashes, batch_size=100):
		"""Sums the balance changes contained in the specified transactions."""

		balance = 0
		start_index = 0
		while start_index < len(transaction_hashes):
			transaction_hashes_batch = transaction_hashes[start_index:start_index + batch_size]

			in_query = ",".join(["?"] * len(transaction_hashes_batch))
			res = self.exec(
			    f"""
					SELECT SUM(amount)
					FROM transfer
					WHERE currency IS ? AND height <= ? AND transaction_hash IN ({in_query})
				""",
			    (
			        currency,
			        height,
			        *(transaction_hash.bytes for transaction_hash in transaction_hashes_batch),
			    ),
			)

			balance += res[0][0] if res else 0
			start_index += batch_size

		return balance

	def filter_transactions_if_present(self, height, currency, transaction_hashes, batch_size=100):
		"""Selects the subset of transactions that are present in this database."""

		start_index = 0
		while start_index < len(transaction_hashes):
			transaction_hashes_batch = transaction_hashes[start_index:start_index + batch_size]

			in_query = ",".join(["?"] * len(transaction_hashes_batch))
			res = self.exec(
			    f"""
					SELECT transaction_hash
					FROM transfer
					WHERE currency IS ? AND height <= ? AND transaction_hash IN ({in_query})
				""",
			    (
			        currency,
			        height,
			        *(transaction_hash.bytes for transaction_hash in transaction_hashes_batch),
			    ),
			)
			for row in res:
				yield Hash256(row[0])

			start_index += batch_size

	def reset(self):
		"""Deletes all transfer entries with heights above the max processed height."""

		res = self.exec("""
				DELETE FROM transfer
				WHERE height > (
                    SELECT height FROM max_processed_height WHERE marker = 1
                )
			""")
		self.commit()
		return res
