from common.tests.PostgresTestUtils import PostgresTestDatabase

from rest.model.common import DatabaseConfig

from .test.EnvTestUtils import temporary_env_values


class FakePostgresql:
	def __init__(self):
		self.stopped = False

	@staticmethod
	def dsn():
		return {
			'database': 'generated',
			'user': 'postgres',
			'host': '127.0.0.1',
			'port': '5432'
		}

	def stop(self):
		self.stopped = True


def test_external_postgres_config():
	# Arrange:
	postgres_env = {
		'EXPLORER_TEST_POSTGRES_HOST': 'postgres.example',
		'EXPLORER_TEST_POSTGRES_DATABASE': 'symbol_test',
		'EXPLORER_TEST_POSTGRES_USER': 'symbol_user',
		'EXPLORER_TEST_POSTGRES_PORT': '15432',
		'EXPLORER_TEST_POSTGRES_CREATE_DATABASE': 'false'
	}

	# Act:
	with temporary_env_values(postgres_env):
		with PostgresTestDatabase() as db_config:
			result = db_config

	# Assert:
	assert DatabaseConfig(
		'symbol_test',
		'symbol_user',
		'',
		'postgres.example',
		'15432') == result


def test_testing_postgresql_fallback():
	# Arrange:
	fake_postgresql = FakePostgresql()

	# Act:
	with temporary_env_values({'EXPLORER_TEST_POSTGRES_HOST': None}):
		with PostgresTestDatabase(
			postgresql_factory=lambda: fake_postgresql
		) as db_config:
			result = db_config

	# Assert:
	assert DatabaseConfig(
		'generated',
		'postgres',
		'',
		'127.0.0.1',
		'5432') == result
	assert fake_postgresql.stopped
