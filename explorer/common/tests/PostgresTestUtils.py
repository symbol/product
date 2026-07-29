import os
from collections import namedtuple

import testing.postgresql

DatabaseConfiguration = namedtuple('DatabaseConfiguration', ['database', 'user', 'password', 'host', 'port'])


class PostgresTestDatabase:
	"""Provides a test PostgreSQL database from Docker/env or testing.postgresql."""

	def __init__(self, postgresql_factory=testing.postgresql.Postgresql):
		self.postgresql = None
		self.postgresql_factory = postgresql_factory

	def __enter__(self):
		external_db_configuration = _external_db_configuration()
		if external_db_configuration:
			return external_db_configuration

		self.postgresql = self.postgresql_factory()
		return DatabaseConfiguration(**self.postgresql.dsn(), password='')

	def __exit__(self, *_):
		if self.postgresql:
			self.postgresql.stop()


def create_unreachable_db_configuration():
	"""Creates a DB configuration that should fail at connection-pool initialization."""

	return DatabaseConfiguration('symbol', 'postgres', '', '127.0.0.1', '1')


def drop_symbol_block_tables_if_present(database):
	"""Drops Symbol block synchronization tables from a test database."""

	database.connection.rollback()
	cursor = database.connection.cursor()
	cursor.execute('DROP TABLE IF EXISTS symbol_mosaics')
	cursor.execute('DROP TABLE IF EXISTS symbol_metadata')
	cursor.execute('DROP TABLE IF EXISTS symbol_alias_names')
	cursor.execute('DROP TABLE IF EXISTS symbol_namespaces')
	cursor.execute('DROP TABLE IF EXISTS symbol_transaction_mosaics')
	cursor.execute('DROP TABLE IF EXISTS symbol_transaction_addresses')
	cursor.execute('DROP TABLE IF EXISTS symbol_transactions')
	cursor.execute('DROP TABLE IF EXISTS symbol_receipts')
	cursor.execute('DROP TABLE IF EXISTS symbol_account_list_ranks')
	cursor.execute('DROP TABLE IF EXISTS symbol_account_refresh_mosaics')
	cursor.execute('DROP TABLE IF EXISTS symbol_account_refresh_accounts')
	cursor.execute('DROP TABLE IF EXISTS symbol_multisig')
	cursor.execute('DROP TABLE IF EXISTS symbol_account_mosaics')
	cursor.execute('DROP TABLE IF EXISTS symbol_accounts')
	cursor.execute('DROP TABLE IF EXISTS symbol_account_refresh_state')
	cursor.execute('DROP TABLE IF EXISTS symbol_blocks')
	cursor.execute('DROP TABLE IF EXISTS symbol_sync_state')
	cursor.execute('DROP SEQUENCE IF EXISTS symbol_transaction_list_sequence_seq')
	cursor.execute('DROP TYPE IF EXISTS symbol_account_refresh_state_status')
	cursor.execute('DROP TYPE IF EXISTS symbol_sync_state_status')
	cursor.execute('DROP TYPE IF EXISTS symbol_block_type')
	cursor.execute('DROP TYPE IF EXISTS symbol_account_type')
	cursor.execute('DROP TYPE IF EXISTS symbol_namespace_registration_type')
	cursor.execute('DROP TYPE IF EXISTS symbol_namespace_alias_type')
	cursor.execute('DROP TYPE IF EXISTS symbol_alias_artifact_type')
	cursor.execute('DROP TYPE IF EXISTS symbol_metadata_type')
	database.connection.commit()


def _external_db_configuration():
	host = os.environ.get('EXPLORER_TEST_POSTGRES_HOST')
	if not host:
		return None

	return DatabaseConfiguration(
		os.environ.get('EXPLORER_TEST_POSTGRES_DATABASE', 'postgres'),
		os.environ.get('EXPLORER_TEST_POSTGRES_USER', 'postgres'),
		'',
		host,
		os.environ.get('EXPLORER_TEST_POSTGRES_PORT', '5432')
	)
