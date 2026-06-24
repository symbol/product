from .DatabaseConnection import DatabaseConnection


class SymbolDatabase(DatabaseConnection):
	"""Database containing Symbol blockchain data."""

	def create_tables(self):
		"""Creates Symbol core foundation tables."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''
			DO $$
			BEGIN
				CREATE TYPE symbol_sync_state_status AS ENUM (
					'initialized',
					'healthy',
					'repairing',
					'unhealthy'
				);
			EXCEPTION
				WHEN duplicate_object THEN NULL;
			END
			$$
			'''
		)
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS symbol_sync_state (
				id int PRIMARY KEY DEFAULT 1,
				status symbol_sync_state_status NOT NULL,
				chain_height bigint,
				finalized_height bigint,
				finalized_hash bytea,
				last_synced_height bigint,
				last_synced_block_hash bytea,
				updated_at timestamp DEFAULT CURRENT_TIMESTAMP,
				CONSTRAINT symbol_sync_state_singleton CHECK (id = 1)
			)
			'''
		)
		self.connection.commit()

	def check_connection(self):
		"""Checks whether the configured Symbol database is reachable."""

		cursor = self.connection.cursor()
		cursor.execute('SELECT 1')
		return 1 == cursor.fetchone()[0]
