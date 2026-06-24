import os
from collections import namedtuple

import testing.postgresql

DatabaseConfig = namedtuple('DatabaseConfig', ['database', 'user', 'password', 'host', 'port'])


class PostgresTestDatabase:
	"""Provides a test PostgreSQL database from Docker/env or testing.postgresql."""

	def __init__(self, postgresql_factory=testing.postgresql.Postgresql):
		self.postgresql = None
		self.postgresql_factory = postgresql_factory

	def __enter__(self):
		external_db_config = _external_db_config()
		if external_db_config:
			return external_db_config

		self.postgresql = self.postgresql_factory()
		return DatabaseConfig(**self.postgresql.dsn(), password='')

	def __exit__(self, *_):
		if self.postgresql:
			self.postgresql.stop()


def _external_db_config():
	host = os.environ.get('EXPLORER_TEST_POSTGRES_HOST')
	if not host:
		return None

	return DatabaseConfig(
		os.environ.get('EXPLORER_TEST_POSTGRES_DATABASE', 'postgres'),
		os.environ.get('EXPLORER_TEST_POSTGRES_USER', 'postgres'),
		'',
		host,
		os.environ.get('EXPLORER_TEST_POSTGRES_PORT', '5432')
	)
