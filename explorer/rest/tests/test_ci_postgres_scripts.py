import os
import subprocess
from pathlib import Path

import pytest

SCRIPT_DIRECTORY = Path(__file__).resolve().parents[1] / 'scripts' / 'ci'
CONFIGURATION_NAMES = ('HOST', 'PORT', 'DATABASE', 'USER')
DEFAULTS = ('127.0.0.1', '5432', 'explorer_rest_test', 'postgres', '/var/lib/postgresql/data/pgdata')


@pytest.fixture(name='script_environment')
def fixture_script_environment(tmp_path):
	bin_path = tmp_path / 'bin'
	bin_path.mkdir()
	log_path = tmp_path / 'commands'
	for name in ('initdb', 'pg_ctl', 'createdb', 'psql', 'python3', 'coverage'):
		command = bin_path / name
		command.write_text(
			'#!/bin/bash\nname=$(basename "$0")\nprintf "%s\\n" "$name $*" >> "$COMMAND_LOG"\n'
			'if [ "$name" = psql ] && [ "${*: -1}" = "SELECT 1" ]; then\n'
			'  printf "check-env %s|%s\\n" "${PGCONNECT_TIMEOUT:-}" "${PGOPTIONS:-}" >> "$COMMAND_LOG"\n'
			'  exit "${PSQL_STATUS:-0}"\nfi\n'
			'if [ "$name" = python3 ] || [ "$name" = coverage ]; then\n'
			'  printf "config %s|%s|%s|%s|%s\\n" "$EXPLORER_TEST_POSTGRES_HOST" "$EXPLORER_TEST_POSTGRES_PORT" '
			'"$EXPLORER_TEST_POSTGRES_DATABASE" "$EXPLORER_TEST_POSTGRES_USER" "$PGDATA" >> "$COMMAND_LOG"\nfi\n'
			'if [ "$name" = "${FAIL_COMMAND:-}" ]; then exit 7; fi\n', encoding='utf8')
		command.chmod(0o755)
	environment = {
		key: value for key, value in os.environ.items()
		if not key.startswith('EXPLORER_TEST_POSTGRES_') and key not in ('PGDATA', 'JENKINS_HOME', 'PGOPTIONS', 'PGCONNECT_TIMEOUT')
	}
	environment.update(PATH=f'{bin_path}:{os.environ["PATH"]}', COMMAND_LOG=str(log_path))
	return environment, log_path


def _run_script(name, environment, argument='test'):
	return subprocess.run(
		['/bin/bash', str(SCRIPT_DIRECTORY / name), argument], env=environment, capture_output=True, text=True, check=False)


def _set_configuration(environment, settings):
	for name, value in settings.items():
		environment[f'EXPLORER_TEST_POSTGRES_{name}'] = value


@pytest.mark.parametrize('jenkins', [False, True], ids=['local', 'jenkins'])
@pytest.mark.parametrize(('settings', 'pgdata', 'expected'), [
	pytest.param({}, None, DEFAULTS, id='unset'),
	pytest.param({}, '/var/lib/postgresql/data', DEFAULTS, id='image-default'),
	pytest.param(dict.fromkeys(CONFIGURATION_NAMES, ''), '', DEFAULTS, id='empty'),
	pytest.param(
		{'HOST': 'db.example', 'PORT': '6543', 'DATABASE': 'custom', 'USER': 'tester'},
		'/tmp/custom', ('db.example', '6543', 'custom', 'tester', '/tmp/custom'), id='explicit'),
	pytest.param(
		{'HOST': '', 'PORT': '6543', 'DATABASE': '', 'USER': 'tester'}, '',
		('127.0.0.1', '6543', 'explorer_rest_test', 'tester', DEFAULTS[4]), id='mixed'),
])
def test_scripts_share_configuration(script_environment, jenkins, settings, pgdata, expected):
	# Arrange: setup and test are separate processes with the same original environment.
	environment, log_path = script_environment
	environment['EXPLORER_TEST_POSTGRES_SKIP_INIT'] = '1'
	if jenkins:
		environment['JENKINS_HOME'] = '/jenkins'
	if pgdata is not None:
		environment['PGDATA'] = pgdata
	_set_configuration(environment, settings)
	host, port, database, user, _ = expected

	# Act:
	setup = _run_script('setup_test.sh', environment)
	test = _run_script('test.sh', environment)

	# Assert: no initialization or role/database creation occurs in skip mode.
	assert 0 == setup.returncode
	assert 0 == test.returncode
	assert log_path.read_text(encoding='utf8').splitlines() == [
		f'psql -w -h {host} -p {port} -U {user} -d {database} -v ON_ERROR_STOP=1 -c SELECT 1',
		'check-env 3|-c statement_timeout=5000',
		'python3 -m pytest --asyncio-mode=auto -v tests ../common/tests',
		'config ' + '|'.join(expected),
	]


@pytest.mark.parametrize('skip_init', [None, '', '0', 'true'])
@pytest.mark.parametrize(('user', 'database', 'expected'), [
	('tester', 'custom', [
		'initdb -U tester -D /tmp/data',
		'pg_ctl -o -c listen_addresses=127.0.0.1 -p 5432 start --wait',
		'pg_ctl status',
		"psql -w -h 127.0.0.1 -p 5432 -U tester -d postgres --command CREATE USER ubuntu WITH SUPERUSER PASSWORD 'ubuntu';",
		'createdb -w -h 127.0.0.1 -p 5432 -U tester custom',
		'psql -w -h 127.0.0.1 -p 5432 -U tester -d custom -v ON_ERROR_STOP=1 -c SELECT 1',
		'check-env 3|-c statement_timeout=5000',
	]),
	('ubuntu', 'custom', [
		'initdb -U ubuntu -D /tmp/data',
		'pg_ctl -o -c listen_addresses=127.0.0.1 -p 5432 start --wait',
		'pg_ctl status',
		'createdb -w -h 127.0.0.1 -p 5432 -U ubuntu custom',
		'psql -w -h 127.0.0.1 -p 5432 -U ubuntu -d custom -v ON_ERROR_STOP=1 -c SELECT 1',
		'check-env 3|-c statement_timeout=5000',
	]),
	('tester', 'postgres', [
		'initdb -U tester -D /tmp/data',
		'pg_ctl -o -c listen_addresses=127.0.0.1 -p 5432 start --wait',
		'pg_ctl status',
		"psql -w -h 127.0.0.1 -p 5432 -U tester -d postgres --command CREATE USER ubuntu WITH SUPERUSER PASSWORD 'ubuntu';",
		'psql -w -h 127.0.0.1 -p 5432 -U tester -d postgres -v ON_ERROR_STOP=1 -c SELECT 1',
		'check-env 3|-c statement_timeout=5000',
	]),
	('ubuntu', 'postgres', [
		'initdb -U ubuntu -D /tmp/data',
		'pg_ctl -o -c listen_addresses=127.0.0.1 -p 5432 start --wait',
		'pg_ctl status',
		'psql -w -h 127.0.0.1 -p 5432 -U ubuntu -d postgres -v ON_ERROR_STOP=1 -c SELECT 1',
		'check-env 3|-c statement_timeout=5000',
	]),
])
def test_new_database_setup(script_environment, skip_init, user, database, expected):
	# Arrange:
	environment, log_path = script_environment
	if skip_init is not None:
		environment['EXPLORER_TEST_POSTGRES_SKIP_INIT'] = skip_init
	environment.update(EXPLORER_TEST_POSTGRES_DATABASE=database, EXPLORER_TEST_POSTGRES_USER=user, PGDATA='/tmp/data')

	# Act:
	result = _run_script('setup_test.sh', environment)

	# Assert:
	assert 0 == result.returncode
	assert expected == log_path.read_text(encoding='utf8').splitlines()


@pytest.mark.parametrize(('name', 'value'), [('HOST', 'db.example'), ('PORT', '6543')])
def test_reject_remote_before_initdb(script_environment, name, value):
	# Arrange:
	environment, log_path = script_environment
	_set_configuration(environment, {name: value})

	# Act:
	result = _run_script('setup_test.sh', environment)

	# Assert:
	assert 0 != result.returncode
	assert 'EXPLORER_TEST_POSTGRES_SKIP_INIT=1' in result.stderr
	assert not log_path.exists()


@pytest.mark.parametrize(('failure', 'expected'), [
	('initdb', ['initdb -U postgres -D /var/lib/postgresql/data/pgdata']),
	('pg_ctl', ['initdb -U postgres -D /var/lib/postgresql/data/pgdata',
		'pg_ctl -o -c listen_addresses=127.0.0.1 -p 5432 start --wait']),
	('psql', [
		'initdb -U postgres -D /var/lib/postgresql/data/pgdata',
		'pg_ctl -o -c listen_addresses=127.0.0.1 -p 5432 start --wait',
		'pg_ctl status',
		"psql -w -h 127.0.0.1 -p 5432 -U postgres -d postgres --command CREATE USER ubuntu WITH SUPERUSER PASSWORD 'ubuntu';",
	]),
	('createdb', [
		'initdb -U postgres -D /var/lib/postgresql/data/pgdata',
		'pg_ctl -o -c listen_addresses=127.0.0.1 -p 5432 start --wait',
		'pg_ctl status',
		"psql -w -h 127.0.0.1 -p 5432 -U postgres -d postgres --command CREATE USER ubuntu WITH SUPERUSER PASSWORD 'ubuntu';",
		'createdb -w -h 127.0.0.1 -p 5432 -U postgres explorer_rest_test',
	]),
])
def test_init_failure_stops_setup(script_environment, failure, expected):
	# Arrange:
	environment, log_path = script_environment
	environment['FAIL_COMMAND'] = failure

	# Act:
	result = _run_script('setup_test.sh', environment)

	# Assert:
	assert 7 == result.returncode
	assert expected == log_path.read_text(encoding='utf8').splitlines()


def test_connection_failure_stops_setup(script_environment):
	# Arrange:
	environment, log_path = script_environment
	environment.update(EXPLORER_TEST_POSTGRES_SKIP_INIT='1', PSQL_STATUS='2')

	# Act:
	result = _run_script('setup_test.sh', environment)

	# Assert:
	assert 2 == result.returncode
	assert log_path.read_text(encoding='utf8').splitlines() == [
		'psql -w -h 127.0.0.1 -p 5432 -U postgres -d explorer_rest_test -v ON_ERROR_STOP=1 -c SELECT 1',
		'check-env 3|-c statement_timeout=5000',
	]


def test_coverage_runner(script_environment):
	# Arrange:
	environment, log_path = script_environment

	# Act:
	result = _run_script('test.sh', environment, 'code-coverage')

	# Assert:
	assert 0 == result.returncode
	assert log_path.read_text(encoding='utf8').splitlines() == [
		'coverage run --append --source=rest,../common/symbol -m pytest --asyncio-mode=auto -v tests ../common/tests',
		'config ' + '|'.join(DEFAULTS),
	]


@pytest.mark.parametrize(('pgdata', 'expected'), [
	(None, '/var/lib/postgresql/data/pgdata'),
	('', '/var/lib/postgresql/data/pgdata'),
	('/var/lib/postgresql/data', '/var/lib/postgresql/data/pgdata'),
	('/tmp/custom', '/tmp/custom'),
])
def test_initdb_uses_effective_pgdata(script_environment, pgdata, expected):
	# Arrange: stop at initdb so the recorded directory is the setup entrypoint's actual choice.
	environment, log_path = script_environment
	environment['FAIL_COMMAND'] = 'initdb'
	if pgdata is not None:
		environment['PGDATA'] = pgdata

	# Act:
	result = _run_script('setup_test.sh', environment)

	# Assert:
	assert 7 == result.returncode
	assert [f'initdb -U postgres -D {expected}'] == log_path.read_text(encoding='utf8').splitlines()


@pytest.mark.parametrize(('state', 'expected'), [
	((0, 0, 0), (0, True, ['status', 'stop'], '')),
	((0, 0, 7), (7, True, ['status', 'stop'], '')),
	((3, 0, 0), (0, True, ['status'], '')),
	((0, 124, 0), (1, False, ['status', 'stop'], 'PostgreSQL shutdown failed; preserving')),
	((3, 0, 7), (7, True, ['status'], '')),
	((0, 1, 0), (1, False, ['status', 'stop'], 'PostgreSQL shutdown failed; preserving')),
	((0, 1, 7), (7, False, ['status', 'stop'], 'PostgreSQL shutdown failed; preserving')),
	((4, 0, 0), (1, False, ['status'], 'PostgreSQL status could not be determined (exit 4); preserving')),
	((4, 0, 7), (7, False, ['status'], 'PostgreSQL status could not be determined (exit 4); preserving')),
])
def test_smoke_cleanup(tmp_path, state, expected):
	# Arrange: use a real directory and stub only the PostgreSQL control boundary.
	status, stop_status, original_status = state
	expected_status, is_removed, expected_commands, error = expected
	cluster = tmp_path / 'cluster'
	cluster.mkdir()
	(cluster / 'PG_VERSION').write_text('15', encoding='utf8')
	log_path = tmp_path / 'commands'
	pg_ctl = tmp_path / 'pg_ctl'
	pg_ctl.write_text(
		'#!/bin/bash\nprintf "%s\\n" "$3" >> "$COMMAND_LOG"\n'
		'if [ "$3" = status ]; then exit "$STATUS_RESULT"; fi\n'
		'printf "stop diagnostic\\n" >&2\nexit "$STOP_RESULT"\n', encoding='utf8')
	pg_ctl.chmod(0o755)
	environment = dict(
		os.environ, PATH=f'{tmp_path}:{os.environ["PATH"]}', COMMAND_LOG=str(log_path),
		STATUS_RESULT=str(status), STOP_RESULT=str(stop_status))

	# Act: execute the smoke script's cleanup as an EXIT trap, including primary exit status.
	result = subprocess.run(
		['/bin/bash', '-c', 'source "$1"; trap \'cleanup "$?" "$2"\' EXIT; exit "$3"', '_',
			str(SCRIPT_DIRECTORY / 'test_postgres_setup.sh'), str(cluster), str(original_status)],
		env=environment, capture_output=True, text=True, check=False)

	# Assert:
	assert expected_status == result.returncode
	assert is_removed == (not cluster.exists())
	assert expected_commands == log_path.read_text(encoding='utf8').splitlines()
	if not is_removed:
		assert '15' == (cluster / 'PG_VERSION').read_text(encoding='utf8')
	if error:
		assert f'{error} {cluster}.' in result.stderr
	if 'stop' in expected_commands:
		assert 'stop diagnostic' in result.stderr


def test_cleanup_before_init(tmp_path):
	# Arrange: initdb failed without creating the directory.
	cluster = tmp_path / 'absent'

	# Act:
	result = subprocess.run(
		['/bin/bash', '-c', 'source "$1"; trap \'cleanup "$?" "$2"\' EXIT; exit 7', '_',
			str(SCRIPT_DIRECTORY / 'test_postgres_setup.sh'), str(cluster)],
		capture_output=True, text=True, check=False)

	# Assert:
	assert 7 == result.returncode
	assert '' == result.stderr
	assert not cluster.exists()


@pytest.mark.parametrize(('original_status', 'expected_status'), [(0, 1), (7, 7)])
def test_cleanup_removal_failure(tmp_path, original_status, expected_status):
	# Arrange: PostgreSQL is stopped, but the directory cannot be removed.
	cluster = tmp_path / 'cluster'
	cluster.mkdir()
	bin_path = tmp_path / 'bin'
	bin_path.mkdir()
	for name, status in [('pg_ctl', 3), ('rm', 1)]:
		command = bin_path / name
		command.write_text(f'#!/bin/bash\nexit {status}\n', encoding='utf8')
		command.chmod(0o755)
	environment = dict(os.environ, PATH=f'{bin_path}:{os.environ["PATH"]}')

	# Act:
	result = subprocess.run(
		['/bin/bash', '-c', 'source "$1"; trap \'cleanup "$?" "$2"\' EXIT; exit "$3"', '_',
			str(SCRIPT_DIRECTORY / 'test_postgres_setup.sh'), str(cluster), str(original_status)],
		env=environment, capture_output=True, text=True, check=False)

	# Assert:
	assert expected_status == result.returncode
	assert cluster.is_dir()
	assert f'PostgreSQL cluster removal failed: {cluster}.\n' == result.stderr
