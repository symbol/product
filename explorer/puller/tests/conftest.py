from contextlib import closing
from uuid import uuid4

import psycopg2
import pytest
from common.tests.PostgresTestUtils import PostgresTestDatabase
from psycopg2 import sql


@pytest.fixture(scope='session', name='postgresql_server')
def shared_postgresql_server():
	"""Creates a unique test database and keeps a connection for table cleanup."""

	with PostgresTestDatabase() as server_configuration:
		with closing(psycopg2.connect(**server_configuration._asdict())) as admin:
			admin.autocommit = True
			database_name = f'explorer_puller_test_{uuid4().hex}'
			with admin.cursor() as cursor:
				cursor.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(database_name)))

			try:
				with admin.cursor() as cursor:
					cursor.execute(sql.SQL("ALTER DATABASE {} SET timezone = 'UTC'").format(sql.Identifier(database_name)))

				configuration = server_configuration._replace(database=database_name)
				with closing(psycopg2.connect(**configuration._asdict())) as connection:
					connection.autocommit = True
					yield configuration, connection
			finally:
				with admin.cursor() as cursor:
					cursor.execute(sql.SQL('DROP DATABASE {} WITH (FORCE)').format(sql.Identifier(database_name)))


@pytest.fixture
def database_config(request, postgresql_server):
	"""Provides the shared database and clears its schema after each database test."""

	configuration, connection = postgresql_server
	if request.instance is not None:
		request.instance.db_config = configuration
	try:
		yield configuration
	finally:
		with connection.cursor() as cursor:
			# Reset tables, sequences and enum types after test connections have closed.
			cursor.execute("SET lock_timeout = '5s'")
			cursor.execute('DROP SCHEMA public CASCADE')
			cursor.execute('CREATE SCHEMA public')
