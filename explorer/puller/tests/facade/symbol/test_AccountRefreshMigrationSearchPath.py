"""Search-path behavior of the explicit account refresh migration."""
import pytest
from psycopg2 import sql

from puller.db.SymbolDatabase import SymbolDatabase
from puller.workflows import migrate_account_refresh
from tests.test.SymbolDatabaseTestUtils import assert_database_connections_closed

from .puller_test_utils import create_db_config


@pytest.fixture(name='schema_database')
def create_schema_database(database_config):
	with SymbolDatabase(database_config) as database:
		database.create_tables()
		with database.connection.cursor() as cursor:
			cursor.execute('CREATE SCHEMA app')
		database.connection.commit()
		try:
			yield database
		finally:
			database.connection.rollback()
			with database.connection.cursor() as cursor:
				cursor.execute('DROP SCHEMA app CASCADE')
			database.connection.commit()


def _config_path(tmp_path, database_config, search_path):
	config_path = create_db_config(tmp_path, database_config)
	with config_path.open('a', encoding='utf8') as config_file:
		config_file.write(f'options = -c search_path={search_path} -c lock_timeout=250ms\n')
		config_file.write('application_name = search_path_migration_test\n')
	return config_path


def _seed_snapshot(database, schema, run_id, height):
	with database.connection.cursor() as cursor:
		cursor.execute(sql.SQL('''
			INSERT INTO {}.symbol_account_refresh_state
			(id, status, last_successful_run_id, previous_successful_run_id, running_run_id,
			is_retention_ready, valid_run_id, height_ready_run_id)
			VALUES (1, 'healthy', %s, %s, %s, true, %s, %s)
		''').format(sql.Identifier(schema)), (run_id, f'{run_id}-previous', f'{run_id}-running', run_id, run_id))
		cursor.execute(sql.SQL('''
			INSERT INTO {}.symbol_account_refresh_accounts
			(refresh_run_id, address, address_text, account_search_order, importance, snapshot_height, snapshot_at, address_height)
			VALUES (%s, %s, %s, 0, 7, 99, '2026-01-01', %s)
		''').format(sql.Identifier(schema)), (run_id, bytes([height]) * 24, f'{schema}-address', height))
	database.connection.commit()


def _drop_validity_columns(database, schema):
	with database.connection.cursor() as cursor:
		cursor.execute(
			sql.SQL('ALTER TABLE {}.symbol_account_refresh_state DROP COLUMN valid_run_id, DROP COLUMN height_ready_run_id')
			.format(sql.Identifier(schema)))
		cursor.execute(sql.SQL('ALTER TABLE {}.symbol_account_refresh_accounts DROP COLUMN address_height').format(sql.Identifier(schema)))
	database.connection.commit()


def _columns(database, schema):
	with database.connection.cursor() as cursor:
		cursor.execute('''
			SELECT table_name, column_name, data_type, is_nullable, column_default
			FROM information_schema.columns
			WHERE table_schema = %s AND table_name IN ('symbol_account_refresh_state', 'symbol_account_refresh_accounts')
		''', (schema,))
		return {tuple(row) for row in cursor.fetchall()}


def _snapshot(database, schema):
	with database.connection.cursor() as cursor:
		cursor.execute(sql.SQL('''
			SELECT last_successful_run_id, previous_successful_run_id, running_run_id,
				is_retention_ready, valid_run_id, height_ready_run_id
			FROM {}.symbol_account_refresh_state
		''').format(sql.Identifier(schema)))
		state = cursor.fetchall()
		cursor.execute(sql.SQL('''
			SELECT refresh_run_id, address_text, importance, snapshot_height, address_height
			FROM {}.symbol_account_refresh_accounts
		''').format(sql.Identifier(schema)))
		return state, cursor.fetchall()


def _expected_snapshot(schema, run_id, height):
	marker = run_id if height is not None else None
	return (
		[(run_id, f'{run_id}-previous', f'{run_id}-running', True, marker, marker)],
		[(run_id, f'{schema}-address', 7, 99, height)]
	)


def test_search_path_complete_no_ddl(schema_database, database_config, tmp_path):
	# Arrange: app is empty; readers hold locks on both complete public tables.
	_seed_snapshot(schema_database, 'public', 'published', 17)
	config_path = _config_path(tmp_path, database_config, 'app,public')
	assert _snapshot(schema_database, 'public') == _expected_snapshot('public', 'published', 17)

	# Act: an unnecessary ALTER would time out while the reader transaction remains open.
	migrate_account_refresh.main(['--db-config', str(config_path)])
	migrate_account_refresh.main(['--db-config', str(config_path)])

	# Assert: data and markers remain intact, and both tool connections were released.
	assert _snapshot(schema_database, 'public') == _expected_snapshot('public', 'published', 17)
	assert_database_connections_closed(schema_database.connection, 'search_path_migration_test')


def test_search_path_partial_upgrade(schema_database, database_config, tmp_path):
	# Arrange: app is empty; public retains its three retention columns and old generation.
	_seed_snapshot(schema_database, 'public', 'published', 17)
	_drop_validity_columns(schema_database, 'public')
	before_columns = _columns(schema_database, 'public')
	schema_database.connection.commit()
	config_path = _config_path(tmp_path, database_config, 'app,public')

	# Act: upgrade the public tables through the normal CLI entrypoint, twice.
	migrate_account_refresh.main(['--db-config', str(config_path)])
	migrate_account_refresh.main(['--db-config', str(config_path)])

	# Assert: only the three missing columns were added; old data was not promoted or backfilled.
	assert _columns(schema_database, 'public') == before_columns | {
		('symbol_account_refresh_state', 'valid_run_id', 'character varying', 'YES', None),
		('symbol_account_refresh_state', 'height_ready_run_id', 'character varying', 'YES', None),
		('symbol_account_refresh_accounts', 'address_height', 'bigint', 'YES', None)
	}
	assert _snapshot(schema_database, 'public') == _expected_snapshot('public', 'published', None)


@pytest.mark.parametrize('selected', ['app', 'public'])
def test_search_path_selects_first(schema_database, database_config, tmp_path, selected):
	# Arrange: both schemas contain distinct data; only the first table pair is missing columns.
	other = 'public' if selected == 'app' else 'app'
	search_path = f'{selected},{other}'
	with schema_database.connection.cursor() as cursor:
		cursor.execute('CREATE TABLE app.symbol_account_refresh_state (LIKE public.symbol_account_refresh_state INCLUDING ALL)')
		cursor.execute('CREATE TABLE app.symbol_account_refresh_accounts (LIKE public.symbol_account_refresh_accounts INCLUDING ALL)')
	schema_database.connection.commit()
	_seed_snapshot(schema_database, 'app', 'app-run', 17)
	_seed_snapshot(schema_database, 'public', 'public-run', 23)
	_drop_validity_columns(schema_database, selected)
	selected_columns = _columns(schema_database, selected)
	other_columns = _columns(schema_database, other)
	other_snapshot = _snapshot(schema_database, other)
	schema_database.connection.commit()
	config_path = _config_path(tmp_path, database_config, search_path)

	# Act:
	migrate_account_refresh.main(['--db-config', str(config_path)])

	# Assert: the selected schema alone gained columns; the other schema and its values are unchanged.
	assert _columns(schema_database, selected) == selected_columns | {
		('symbol_account_refresh_state', 'valid_run_id', 'character varying', 'YES', None),
		('symbol_account_refresh_state', 'height_ready_run_id', 'character varying', 'YES', None),
		('symbol_account_refresh_accounts', 'address_height', 'bigint', 'YES', None)
	}
	assert _snapshot(schema_database, selected) == _expected_snapshot(selected, f'{selected}-run', None)
	assert _columns(schema_database, other) == other_columns
	assert other_snapshot == _expected_snapshot(other, f'{other}-run', 17 if other == 'app' else 23)
	assert _snapshot(schema_database, other) == other_snapshot


def test_search_path_resolves_each_table(schema_database, database_config, tmp_path):
	# Arrange: the first visible state table is in app, but the accounts table is only in public.
	with schema_database.connection.cursor() as cursor:
		cursor.execute('CREATE TABLE app.symbol_account_refresh_state (LIKE public.symbol_account_refresh_state INCLUDING ALL)')
		cursor.execute('CREATE TABLE app.symbol_account_refresh_accounts (LIKE public.symbol_account_refresh_accounts INCLUDING ALL)')
	schema_database.connection.commit()
	_seed_snapshot(schema_database, 'public', 'public-run', 23)
	_seed_snapshot(schema_database, 'app', 'app-run', 17)
	_drop_validity_columns(schema_database, 'app')
	with schema_database.connection.cursor() as cursor:
		cursor.execute('DROP TABLE app.symbol_account_refresh_accounts')
		cursor.execute('ALTER TABLE public.symbol_account_refresh_accounts DROP COLUMN address_height')
	schema_database.connection.commit()
	config_path = _config_path(tmp_path, database_config, 'app,public')

	# Act:
	migrate_account_refresh.main(['--db-config', str(config_path)])

	# Assert: each schema's selected table was upgraded and the other state table kept its markers.
	with schema_database.connection.cursor() as cursor:
		cursor.execute('SELECT last_successful_run_id, valid_run_id, height_ready_run_id FROM app.symbol_account_refresh_state')
		assert cursor.fetchall() == [('app-run', None, None)]
		cursor.execute('SELECT last_successful_run_id, valid_run_id, height_ready_run_id FROM public.symbol_account_refresh_state')
		assert cursor.fetchall() == [('public-run', 'public-run', 'public-run')]
		cursor.execute('SELECT refresh_run_id, address_text, address_height FROM public.symbol_account_refresh_accounts')
		assert cursor.fetchall() == [('public-run', 'public-address', None)]
