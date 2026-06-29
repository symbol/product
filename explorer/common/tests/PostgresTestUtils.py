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
