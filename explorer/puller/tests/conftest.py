from contextlib import closing

import psycopg2
import pytest
import testing.postgresql
from common.tests.PostgresTestUtils import DatabaseConfiguration


@pytest.fixture(scope='session', name='postgresql_server')
def shared_postgresql_server():
	"""Starts one temporary server and keeps a connection for table cleanup."""

	with testing.postgresql.Postgresql() as server:
		with closing(psycopg2.connect(**server.dsn())) as connection:
			connection.autocommit = True
			with connection.cursor() as cursor:
				# Timestamp expectations use UTC regardless of the developer's timezone.
				cursor.execute("ALTER DATABASE test SET timezone = 'UTC'")
			yield server, connection


@pytest.fixture
def database_config(request, postgresql_server):
	"""Provides the shared database and clears its schema after each database test."""

	server, connection = postgresql_server
	configuration = DatabaseConfiguration(**server.dsn(), password='')
	if request.instance is not None:
		request.instance.db_config = configuration
	try:
		yield configuration
	finally:
		with connection.cursor() as cursor:
			# Reset tables, sequences and enum types after test connections have closed.
			cursor.execute('DROP SCHEMA public CASCADE')
			cursor.execute('CREATE SCHEMA public')
