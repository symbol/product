"""Schema preparation and CLI workflows share one session-level exclusion boundary."""
import asyncio
import os
import subprocess
import sys
import threading
import time
from contextlib import ExitStack

import pytest
from common.tests.AccountRefreshTestUtils import seed_account_refresh_state

from puller.db.SymbolDatabase import SymbolDatabase
from puller.facade.SymbolPuller import SymbolPuller
from puller.workflows.symbol import main

from .puller_test_utils import FakeConnector, create_db_config, create_node_block, set_symbol_connector


class WorkflowConnector(FakeConnector):
	async def open(self):
		pass

	async def close(self):
		pass


class PausingMigrationDatabase(SymbolDatabase):
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
				raise RuntimeError('Migration gate was not released')

		super()._commit()


class FailingMigrationDatabase(SymbolDatabase):
	def __init__(self, config, error):
		super().__init__(config)
		self.error = error

	def create_tables(self):
		with self.connection.cursor() as cursor:
			cursor.execute('ALTER TABLE symbol_account_refresh_state ADD COLUMN migration_probe int')

		raise self.error


def _seed_old_publication(database):
	database.create_tables()
	seed_account_refresh_state(database, {'last_successful_run_id': 'published', 'status': 'healthy'})
	with database.connection.cursor() as cursor:
		cursor.execute(
			"INSERT INTO symbol_account_list_ranks (refresh_run_id, rank_scope, rank, address) VALUES ('published', 'ID', 0, %s)",
			(bytes([1]) * 24,))
		cursor.execute(
			'ALTER TABLE symbol_account_refresh_state DROP COLUMN previous_successful_run_id, '
			'DROP COLUMN running_run_id, DROP COLUMN is_retention_ready')

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
def test_cli_rejects_migration_overlap(database_config, tmp_path, command):  # pylint: disable=too-many-locals,too-many-statements
	# Arrange: keep an existing publication and its data in the pre-retention schema.
	config_path = create_db_config(tmp_path, database_config)
	with SymbolDatabase(database_config) as observer, ExitStack() as processes:
		_seed_old_publication(observer)
		prepared = threading.Event()
		resume = threading.Event()
		owners = []
		errors = []

		def database_factory(config):
			database = PausingMigrationDatabase(config, prepared, resume)
			owners.append(database)
			return database

		def migrate():
			try:
				asyncio.run(main(_arguments('refresh-accounts', config_path), _factory(database_factory), _environment()))
			except BaseException as error:
				errors.append(error)

		worker = threading.Thread(target=migrate, daemon=True)
		child = None
		try:
			# Act: hold the real migration immediately before its DDL transaction commits.
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

		# Assert: migration completes, publishes atomically and retains the former publication.
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
def test_schema_failure_keeps_state(database_config, tmp_path, command, error_type):
	# Arrange: a partial migration fails before any workflow may update the old publication.
	config_path = create_db_config(tmp_path, database_config)
	error = error_type('migration failed')
	with SymbolDatabase(database_config) as observer:
		_seed_old_publication(observer)

		# Act: the real workflow entrypoint must preserve its primary failure and undo the partial DDL.
		with pytest.raises(error_type) as context:
			asyncio.run(main(
				_arguments(command, config_path), _factory(lambda config: FailingMigrationDatabase(config, error)), _environment()))

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
					"AND column_name IN ('migration_probe', 'previous_successful_run_id', 'running_run_id', 'is_retention_ready')")
				assert cursor.fetchall() == []

		# Act: restart with the real schema preparer and complete the first successful publication.
		asyncio.run(main(_arguments('refresh-accounts', config_path), _factory(SymbolDatabase), _environment()))

		# Assert: the old publication becomes the protected previous generation only after success.
		state = observer.get_account_refresh_state()
		assert state['previous_successful_run_id'] == 'published'
		assert state['running_run_id'] is None
		assert state['is_retention_ready'] is True
