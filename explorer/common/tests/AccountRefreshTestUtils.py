"""Test-only fixtures for seeding account refresh state directly."""
import time

from psycopg2 import sql


def seed_account_refresh_state(database, refresh_state):
	"""Seed raw singleton state for tests that do not exercise the refresh workflow."""

	columns = list(refresh_state)
	with database.connection.cursor() as cursor:
		cursor.execute(sql.SQL('''
			INSERT INTO symbol_account_refresh_state (id, {}, updated_at)
			VALUES (1, {}, CURRENT_TIMESTAMP)
			ON CONFLICT (id) DO UPDATE SET {}, updated_at = CURRENT_TIMESTAMP
		''').format(
			sql.SQL(', ').join(map(sql.Identifier, columns)),
			sql.SQL(', ').join(map(sql.Placeholder, columns)),
			sql.SQL(', ').join(sql.SQL('{} = EXCLUDED.{}').format(sql.Identifier(column), sql.Identifier(column)) for column in columns)),
			refresh_state)

	database.connection.commit()


def wait_for_backend_exit(database, backend_pid):
	"""Wait for a closed session to disappear before reusing its advisory lock."""

	deadline = time.monotonic() + 5
	with database.connection.cursor() as cursor:
		while time.monotonic() < deadline:
			cursor.execute('SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid = %s)', (backend_pid,))
			is_active = cursor.fetchone()[0]
			database.connection.commit()
			if not is_active:
				return

			time.sleep(0.01)

	raise AssertionError('closed PostgreSQL backend did not exit')
