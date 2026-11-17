"""Symbol workflow startup and explicit account refresh migration."""
import asyncio
import os
import subprocess
import sys
import threading
import time
from contextlib import ExitStack

import psycopg2
import pytest
from common.tests.AccountRefreshTestUtils import seed_account_refresh_state
from psycopg2 import errorcodes

from puller.db.SymbolDatabase import SymbolDatabase
from puller.facade.SymbolPuller import SymbolPuller
from puller.workflows import migrate_account_refresh
from puller.workflows.symbol import main
from tests.test.SymbolDatabaseTestUtils import assert_database_connections_closed

from .puller_test_utils import FakeConnector, create_db_config, create_node_block, set_symbol_connector


class WorkflowConnector(FakeConnector):
	async def open(self):
		pass

	async def close(self):
		pass


class PausingPreparationDatabase(SymbolDatabase):
	def __init__(self, config, prepared, resume):
		super().__init__(config)
		self.prepared = prepared
		self.resume = resume
		self.is_preparing = False

	def create_tables(self):
		self.is_preparing = True
		try:
			super().create_tables()
		finally:
			self.is_preparing = False

	def _commit(self):
		if self.is_preparing:
			self.prepared.set()
			if not self.resume.wait(20):
				raise RuntimeError('Preparation gate was not released')

		super()._commit()


class FailingPreparationDatabase(SymbolDatabase):
	def __init__(self, config, error):
		super().__init__(config)
		self.error = error

	def create_tables(self):
		with self.connection.cursor() as cursor:
			cursor.execute('ALTER TABLE symbol_account_refresh_state ADD COLUMN preparation_probe int')

		raise self.error


def _seed_publication(database):
	database.create_tables()
	seed_account_refresh_state(database, {'last_successful_run_id': 'published', 'status': 'healthy'})
	with database.connection.cursor() as cursor:
		cursor.execute(
			"INSERT INTO symbol_account_list_ranks (refresh_run_id, rank_scope, rank, address) VALUES ('published', 'ID', 0, %s)",
			(bytes([1]) * 24,))

	database.connection.commit()


def _arguments(command, config_path):
	return [command, '--symbol-node', 'http://localhost:7890', '--network', 'testnet', '--db-config', str(config_path)]


def _environment():
	return {
		**os.environ, 'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:7890',
		'SYMBOL_NODE_ALLOW_LOOPBACK': 'true', 'SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS': '1'
	}


def _factory(database_factory):
	def create(*args, **kwargs):
		puller = SymbolPuller(*args, **kwargs)
		puller.symbol_db = database_factory(puller.symbol_db.db_config)
		set_symbol_connector(puller, WorkflowConnector(1, {0: [create_node_block(1)]}, account_pages={1: []}))
		return puller

	return create


@pytest.mark.parametrize('command', ['sync-block', 'refresh-accounts'])
def test_cli_rejects_overlap_on_prepare(database_config, tmp_path, command):  # pylint: disable=too-many-locals,too-many-statements
	# Arrange: keep an existing publication and its data in the current schema.
	config_path = create_db_config(tmp_path, database_config)
	with SymbolDatabase(database_config) as observer, ExitStack() as processes:
		_seed_publication(observer)
		prepared = threading.Event()
		resume = threading.Event()
		owners = []
		errors = []

		def database_factory(config):
			database = PausingPreparationDatabase(config, prepared, resume)
			owners.append(database)
			return database

		def run_refresh():
			try:
				asyncio.run(main(_arguments('refresh-accounts', config_path), _factory(database_factory), _environment()))
			except BaseException as error:
				errors.append(error)

		worker = threading.Thread(target=run_refresh, daemon=True)
		child = None
		try:
			# Act: hold schema preparation immediately before its transaction commits.
			worker.start()
			assert prepared.wait(10), errors
			child = processes.enter_context(subprocess.Popen(
				[sys.executable, '-m', 'puller.workflows.symbol', *_arguments(command, config_path)],
				env=_environment(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True))
			blocked = []
			deadline = time.monotonic() + 10
			while child.poll() is None and time.monotonic() < deadline:
				with observer.connection.cursor() as cursor:
					cursor.execute(
						'SELECT pid, wait_event, left(query, 160), pg_blocking_pids(pid) FROM pg_stat_activity '
						"WHERE datname = current_database() AND pid <> pg_backend_pid() AND pid <> %s AND wait_event_type = 'Lock'",
						(owners[0].connection.get_backend_pid(),))
					blocked = cursor.fetchall()

				observer.connection.commit()
				if blocked:
					break

				threading.Event().wait(0.01)

			# Assert: the contender exits nonzero without entering a relation/DDL wait.
			assert not blocked, f'contender blocked before workflow exclusion: {blocked}'
			stdout, stderr = child.communicate(timeout=5)
			assert child.returncode == 1, (stdout, stderr)
			assert 'Another Symbol workflow is running' in stderr
			with owners[0].connection.cursor() as cursor:
				cursor.execute(
					'SELECT last_successful_run_id, previous_successful_run_id, running_run_id, is_retention_ready '
					'FROM symbol_account_refresh_state')
				assert cursor.fetchone() == ('published', None, None, False)
				cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'published'")
				assert cursor.fetchone() == (1,)
		finally:
			if child is not None and child.poll() is None:
				child.terminate()
				child.communicate(timeout=5)

			resume.set()
			worker.join(10)
			if worker.is_alive() and owners:
				owners[0].connection.cancel()
				worker.join(5)

		# Assert: schema preparation completes, refresh publishes atomically and retains the former publication.
		assert not worker.is_alive()
		assert not errors
		state = observer.get_account_refresh_state()
		assert state['previous_successful_run_id'] == 'published'
		assert state['running_run_id'] is None
		assert state['is_retention_ready'] is True
		with observer.connection.cursor() as cursor:
			cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'published'")
			assert cursor.fetchone() == (1,)

		observer.connection.commit()

		# Act: another invocation can acquire the released lock and initialize again.
		asyncio.run(main(_arguments(command, config_path), _factory(SymbolDatabase), _environment()))

		# Assert: no session lock remains after either workflow.
		with observer.workflow_lock():
			assert observer.get_account_refresh_state()['running_run_id'] is None


@pytest.mark.parametrize('command', ['sync-block', 'refresh-accounts'])
@pytest.mark.parametrize('error_type', [ValueError, asyncio.CancelledError, KeyboardInterrupt])
def test_prepare_failure_keeps_state(database_config, tmp_path, command, error_type):
	# Arrange: schema preparation fails before any workflow may update the old publication.
	config_path = create_db_config(tmp_path, database_config)
	error = error_type('schema preparation failed')
	with SymbolDatabase(database_config) as observer:
		_seed_publication(observer)

		# Act: the workflow entrypoint preserves its primary failure and undoes the partial DDL.
		with pytest.raises(error_type) as context:
			asyncio.run(main(
				_arguments(command, config_path), _factory(lambda config: FailingPreparationDatabase(config, error)), _environment()))

		# Assert: a separate connection acquires the lock and sees the intact old schema and publication.
		assert context.value is error
		with observer.workflow_lock():
			with observer.connection.cursor() as cursor:
				cursor.execute('SELECT last_successful_run_id, status FROM symbol_account_refresh_state')
				assert cursor.fetchone() == ('published', 'healthy')
				cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'published'")
				assert cursor.fetchone() == (1,)
				cursor.execute(
					"SELECT column_name FROM information_schema.columns WHERE table_name = 'symbol_account_refresh_state' "
					"AND column_name = 'preparation_probe'")
				assert cursor.fetchall() == []

		# Act: restart with the real schema preparer and complete the first successful publication.
		asyncio.run(main(_arguments('refresh-accounts', config_path), _factory(SymbolDatabase), _environment()))

		# Assert: the old publication becomes the protected previous generation only after success.
		state = observer.get_account_refresh_state()
		assert state['previous_successful_run_id'] == 'published'
		assert state['running_run_id'] is None
		assert state['is_retention_ready'] is True


def test_migration_rolls_back_ddl(database_config, tmp_path):
	# Arrange: both tables need DDL; the trigger fails only after the first ALTER is visible.
	config_path = create_db_config(tmp_path, database_config)
	with open(config_path, 'a', encoding='utf8') as config_file:
		config_file.write('application_name = account_migration_failure_test\n')
	with SymbolDatabase(database_config) as database:
		_seed_publication(database)
		with database.connection.cursor() as cursor:
			cursor.execute('ALTER TABLE symbol_account_refresh_state DROP COLUMN valid_run_id')
			cursor.execute('ALTER TABLE symbol_account_refresh_accounts DROP COLUMN address_height')
			cursor.execute("""
				CREATE FUNCTION fail_second_account_alter() RETURNS event_trigger LANGUAGE plpgsql AS $$
				BEGIN
					IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema()
						AND table_name = 'symbol_account_refresh_state' AND column_name = 'valid_run_id') THEN
						RAISE EXCEPTION 'first alter was visible';
					END IF;
				END $$
			""")
			cursor.execute('''
				CREATE EVENT TRIGGER fail_second_account_alter ON ddl_command_start
				WHEN TAG IN ('ALTER TABLE') EXECUTE FUNCTION fail_second_account_alter()
			''')
		database.connection.commit()

		# Act: PostgreSQL rejects the second DDL only after observing the first addition.
		with pytest.raises(psycopg2.Error, match='first alter was visible') as error:
			migrate_account_refresh.main(['--db-config', str(config_path)])

		assert error.value.pgcode == errorcodes.RAISE_EXCEPTION

		# Assert: both schemas and the existing publication and rank are intact.
		with database.connection.cursor() as cursor:
			cursor.execute(
				"SELECT column_name FROM information_schema.columns WHERE table_name = 'symbol_account_refresh_state' "
				"AND column_name = 'valid_run_id'")
			assert cursor.fetchall() == []
			cursor.execute(
				"SELECT column_name FROM information_schema.columns WHERE table_name = 'symbol_account_refresh_accounts' "
				"AND column_name = 'address_height'")
			assert cursor.fetchall() == []
			cursor.execute('SELECT last_successful_run_id, status FROM symbol_account_refresh_state')
			assert cursor.fetchone() == ('published', 'healthy')
			cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'published'")
			assert cursor.fetchone() == (1,)
			assert_database_connections_closed(database.connection, 'account_migration_failure_test')
			cursor.execute('DROP EVENT TRIGGER fail_second_account_alter')
		database.connection.commit()


def test_startup_then_upgrade_refresh(database_config, tmp_path):
	# Arrange: remove all six columns from an existing schema.
	config_path = create_db_config(tmp_path, database_config)
	with SymbolDatabase(database_config) as database:
		database.create_tables()
		with database.connection.cursor() as cursor:
			cursor.execute(
				'ALTER TABLE symbol_account_refresh_state DROP COLUMN previous_successful_run_id, '
				'DROP COLUMN running_run_id, DROP COLUMN is_retention_ready, DROP COLUMN valid_run_id, DROP COLUMN height_ready_run_id')
			cursor.execute('ALTER TABLE symbol_account_refresh_accounts DROP COLUMN address_height')
		database.connection.commit()

		# Act: ordinary startup cannot refresh before the explicit upgrade.
		with pytest.raises(psycopg2.Error) as error:
			asyncio.run(main(_arguments('refresh-accounts', config_path), _factory(SymbolDatabase), _environment()))

		# Assert: startup failed on a missing column and did not add any of the six columns.
		assert error.value.pgcode == errorcodes.UNDEFINED_COLUMN
		with database.connection.cursor() as cursor:
			cursor.execute(
				"SELECT column_name FROM information_schema.columns WHERE table_name = 'symbol_account_refresh_state' "
				"AND column_name IN ('previous_successful_run_id', 'running_run_id', 'is_retention_ready', "
				"'valid_run_id', 'height_ready_run_id')")
			assert cursor.fetchall() == []
			cursor.execute(
				"SELECT column_name FROM information_schema.columns WHERE table_name = 'symbol_account_refresh_accounts' "
				"AND column_name = 'address_height'")
			assert cursor.fetchall() == []
		database.connection.commit()

		# Act: upgrade explicitly, then execute the real refresh entrypoint.
		migrate_account_refresh.main(['--db-config', str(config_path)])
		asyncio.run(main(_arguments('refresh-accounts', config_path), _factory(SymbolDatabase), _environment()))

		# Assert: a new generation is published with both markers.
		state = database.get_account_refresh_state()
		assert state['last_successful_run_id']
		assert state['valid_run_id'] == state['last_successful_run_id']
		assert state['height_ready_run_id'] == state['last_successful_run_id']

		# Act: rollback through the public database entrypoint invalidates that generation.
		database.delete_blocks_from_height(state['last_completed_height'])

		# Assert: the published generation is no longer valid.
		state = database.get_account_refresh_state()
		assert state['status'] == 'stale'
		assert state['valid_run_id'] is None


def test_repeat_upgrade_avoids_ddl(database_config, tmp_path):
	# Arrange: readers retain locks that would block ALTER TABLE.
	config_path = create_db_config(tmp_path, database_config)
	with open(config_path, 'a', encoding='utf8') as config_file:
		config_file.write('options = -c lock_timeout=250ms\napplication_name = account_migration_test\n')
	with SymbolDatabase(database_config) as reader:
		reader.create_tables()
		with reader.connection.cursor() as cursor:
			cursor.execute('SELECT * FROM symbol_account_refresh_state')
			cursor.fetchall()
			cursor.execute('SELECT * FROM symbol_account_refresh_accounts')
			cursor.fetchall()

		# Act: repeated upgrades must finish despite the reader's locks.
		migrate_account_refresh.main(['--db-config', str(config_path)])
		migrate_account_refresh.main(['--db-config', str(config_path)])

		# Assert: the tool closed its connections, leaving the reader intact.
		assert_database_connections_closed(reader.connection, 'account_migration_test')


def test_upgrade_cli_help(capsys):
	# Arrange:
	arguments = ['--help']
	steps = [
		'Stop all scheduled and manual Puller runs',
		'Run this tool and confirm success',
		'start the new Puller',
		'a successful refresh published a valid height-ready generation',
		'deploy REST PR #2808'
	]

	# Act:
	with pytest.raises(SystemExit) as context:
		migrate_account_refresh.main(arguments)

	# Assert:
	assert context.value.code == 0
	help_text = ' '.join(capsys.readouterr().out.split())
	assert '--db-config' in help_text
	positions = [help_text.index(step) for step in steps]
	assert positions == sorted(positions)


def test_upgrade_requires_config_arg(capsys):
	# Arrange:
	arguments = []

	# Act:
	with pytest.raises(SystemExit) as context:
		migrate_account_refresh.main(arguments)

	# Assert:
	assert context.value.code == 2
	assert '--db-config' in capsys.readouterr().err


def test_upgrade_requires_db_section(tmp_path):
	# Arrange: the file exists but contains no symbol_db section.
	config_path = tmp_path / 'config.ini'
	config_path.write_text('[other]\nkey = value\n', encoding='utf8')

	# Act:
	with pytest.raises(KeyError) as context:
		migrate_account_refresh.main(['--db-config', str(config_path)])

	# Assert:
	assert context.value.args == ('symbol_db',)


@pytest.mark.parametrize('missing_key', ['database', 'user', 'password', 'host', 'port'])
def test_upgrade_requires_each_db_key(tmp_path, monkeypatch, missing_key):
	# Arrange: an INI default and libpq environment both offer fallback values.
	values = {'database': 'db', 'user': 'user', 'password': 'private-value', 'host': 'host', 'port': '1234'}
	values.pop(missing_key)
	config_path = tmp_path / 'config.ini'
	config_text = f'[DEFAULT]\n{missing_key} = fallback\n[symbol_db]\n'
	config_text += ''.join(f'{key} = {value}\n' for key, value in values.items())
	config_path.write_text(config_text, encoding='utf8')
	for name in ('PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGHOST', 'PGPORT'):
		monkeypatch.setenv(name, 'fallback')
	connection_calls = []

	def connection_factory(**kwargs):
		connection_calls.append(kwargs)
		raise AssertionError('unexpected connection attempt')

	# Act:
	with pytest.raises(ValueError) as context:
		migrate_account_refresh.main(['--db-config', str(config_path)], connection_factory)

	# Assert: the named key is missing and no connection attempt can use fallback values.
	assert str(context.value) == f'Missing required [symbol_db] connection settings: {missing_key}'
	assert not connection_calls


def test_upgrade_keeps_extra_db_options(tmp_path):
	# Arrange: optional INI defaults still pass through, and an empty password is permitted.
	config_path = tmp_path / 'config.ini'
	config_path.write_text(
		'[DEFAULT]\napplication_name = inherited\n[symbol_db]\ndatabase = db\nuser = user\n'
		'password =\nhost = host\nport = 1234\noptions = -c lock_timeout=250ms\n', encoding='utf8')
	connection_calls = []

	def connection_factory(**kwargs):
		connection_calls.append(kwargs)
		raise RuntimeError('connection attempted')

	# Act:
	with pytest.raises(RuntimeError) as context:
		migrate_account_refresh.main(['--db-config', str(config_path)], connection_factory)

	# Assert:
	assert str(context.value) == 'connection attempted'
	assert connection_calls == [{
		'database': 'db', 'user': 'user', 'password': '', 'host': 'host', 'port': '1234',
		'options': '-c lock_timeout=250ms', 'application_name': 'inherited'
	}]


def test_upgrade_connection_failure(database_config, tmp_path):
	# Arrange: port 1 cannot serve the dedicated test database.
	config_path = create_db_config(tmp_path, database_config._replace(port=1))

	# Act / Assert: connection failure is not reported as a successful upgrade.
	with pytest.raises(psycopg2.OperationalError):
		migrate_account_refresh.main(['--db-config', str(config_path)])


def test_upgrade_keeps_markers(database_config, tmp_path):
	# Arrange: both marker columns already contain a published generation.
	config_path = create_db_config(tmp_path, database_config)
	with SymbolDatabase(database_config) as database:
		database.create_tables()
		seed_account_refresh_state(database, {
			'last_successful_run_id': 'published', 'valid_run_id': 'published', 'height_ready_run_id': 'published'
		})
		with database.connection.cursor() as cursor:
			cursor.execute('ALTER TABLE symbol_account_refresh_state DROP COLUMN is_retention_ready')
		database.connection.commit()

		# Act: add only the missing retention column.
		migrate_account_refresh.main(['--db-config', str(config_path)])

		# Assert: neither existing marker is cleared or replaced.
		state = database.get_account_refresh_state()
		assert (state['last_successful_run_id'], state['valid_run_id'], state['height_ready_run_id']) == (
			'published', 'published', 'published')
		assert state['is_retention_ready'] is False


def test_upgrade_requires_both_tables(database_config, tmp_path):
	# Arrange: retain the state table but remove the other target from its expected name.
	config_path = create_db_config(tmp_path, database_config)
	with SymbolDatabase(database_config) as database:
		database.create_tables()
		with database.connection.cursor() as cursor:
			cursor.execute('ALTER TABLE symbol_account_refresh_accounts RENAME TO saved_refresh_accounts')
		database.connection.commit()

		# Act / Assert: the missing target produces a real DDL error.
		with pytest.raises(psycopg2.Error) as error:
			migrate_account_refresh.main(['--db-config', str(config_path)])

		assert error.value.pgcode == errorcodes.UNDEFINED_TABLE
