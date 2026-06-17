import os

import testing.postgresql

from rest.model.common import DatabaseConfig


class PostgresTestDatabase:
	"""Provides a test PostgreSQL database from Docker/env or testing.postgresql."""

	def __init__(self):
		self.postgresql = None

	def __enter__(self):
		external_db_config = _external_db_config()
		if external_db_config:
			return external_db_config

		self.postgresql = testing.postgresql.Postgresql()
		return DatabaseConfig(**self.postgresql.dsn(), password='')

	def __exit__(self, *_):
		if self.postgresql:
			self.postgresql.stop()


def create_unreachable_db_config():
	"""Creates a DB config that should fail at connection-pool initialization."""

	return DatabaseConfig('symbol', 'postgres', '', '127.0.0.1', '1')


def _external_db_config():
	host = os.environ.get('EXPLORER_TEST_POSTGRES_HOST')
	if not host:
		return None

	return DatabaseConfig(
		os.environ.get('EXPLORER_TEST_POSTGRES_DATABASE', 'postgres'),
		os.environ.get('EXPLORER_TEST_POSTGRES_USER', 'postgres'),
		os.environ.get('EXPLORER_TEST_POSTGRES_PASSWORD', ''),
		host,
		os.environ.get('EXPLORER_TEST_POSTGRES_PORT', '5432')
	)
