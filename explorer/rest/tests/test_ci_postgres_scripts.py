import os
import subprocess
import sys
import time
from pathlib import Path

import pytest

SCRIPT_DIRECTORY = Path(__file__).resolve().parents[1] / 'scripts' / 'ci'
CONFIGURATION_NAMES = ('HOST', 'PORT', 'DATABASE', 'USER')


@pytest.fixture(name='script_environment')
def fixture_script_environment(tmp_path):
	bin_path = tmp_path / 'bin'
	bin_path.mkdir()
	log_path = tmp_path / 'commands'
	for name in ('initdb', 'pg_ctl', 'createdb', 'psql', 'python3'):
		command = bin_path / name
		command.write_text(
			'#!/bin/bash\nprintf "%s\\n" "$(basename "$0") $*" >> "$COMMAND_LOG"\n'
			'if [ "$(basename "$0")" = python3 ]; then\n'
			'  printf "config %s %s %s %s\\n" "${EXPLORER_TEST_POSTGRES_HOST:-}" "${EXPLORER_TEST_POSTGRES_PORT:-}" '
			'"${EXPLORER_TEST_POSTGRES_DATABASE:-}" "${EXPLORER_TEST_POSTGRES_USER:-}" >> "$COMMAND_LOG"\nfi\n'
			'if [ "$(basename "$0")" = psql ]; then\n'
			'  if [ "${PSQL_IGNORE_TERM:-}" = 1 ]; then trap "" TERM; exec /bin/sleep 5; fi\n'
			'  if [ "${PSQL_HANG:-}" = 1 ]; then sleep 5; fi\n'
			'  exit "${PSQL_STATUS:-0}"\nfi\n', encoding='utf8')
		command.chmod(0o755)
	timeout = bin_path / 'timeout'
	timeout.write_text(
		'#!/bin/bash\n[ "$1 $2 $3" = "-k 2s 30s" ] || exit 1\nshift 3\n'
		'exec /usr/bin/timeout -k 0.2s 0.2s "$@"\n', encoding='utf8')
	timeout.chmod(0o755)
	environment = {key: value for key, value in os.environ.items() if not key.startswith('EXPLORER_TEST_POSTGRES_')}
	environment.update(PATH=f'{bin_path}:{os.environ["PATH"]}', COMMAND_LOG=str(log_path), JENKINS_HOME='/jenkins')
	return environment, log_path


def _run_script(name, environment):
	return subprocess.run(['bash', str(SCRIPT_DIRECTORY / name), 'test'], env=environment, capture_output=True, text=True, check=False)


def test_jenkins_defaults(script_environment):
	# Arrange:
	environment, log_path = script_environment

	# Act:
	setup = _run_script('setup_test.sh', environment)
	test = _run_script('test.sh', environment)

	# Assert:
	assert 0 == setup.returncode
	assert 0 == test.returncode
	commands = log_path.read_text(encoding='utf8').splitlines()
	assert commands[3] == 'psql -w -h 127.0.0.1 -p 5432 -U postgres --command CREATE USER ubuntu WITH SUPERUSER PASSWORD \'ubuntu\';'
	assert commands[4] == 'createdb -w -h 127.0.0.1 -p 5432 -U postgres explorer_rest_test'
	assert commands[5] == 'psql -w -h 127.0.0.1 -p 5432 -U postgres -d explorer_rest_test -v ON_ERROR_STOP=1 -c SELECT 1'
	assert commands[6].startswith('python3 -m pytest ')
	assert commands[7] == 'config 127.0.0.1 5432 explorer_rest_test postgres'


def test_prepared_database_overrides(script_environment):
	# Arrange:
	environment, log_path = script_environment
	environment.update(
		EXPLORER_TEST_POSTGRES_HOST='db.example', EXPLORER_TEST_POSTGRES_PORT='6543',
		EXPLORER_TEST_POSTGRES_DATABASE='dedicated', EXPLORER_TEST_POSTGRES_USER='tester')

	# Act:
	setup = _run_script('setup_test.sh', environment)
	test = _run_script('test.sh', environment)

	# Assert:
	assert 0 == setup.returncode
	assert 0 == test.returncode
	commands = log_path.read_text(encoding='utf8').splitlines()
	assert commands[0] == 'psql -w -h db.example -p 6543 -U tester -d dedicated -v ON_ERROR_STOP=1 -c SELECT 1'
	assert commands[1].startswith('python3 -m pytest ')
	assert commands[2] == 'config db.example 6543 dedicated tester'


def test_partial_override_uses_defaults(script_environment):
	# Arrange:
	environment, log_path = script_environment
	environment['EXPLORER_TEST_POSTGRES_PORT'] = '6543'

	# Act:
	setup = _run_script('setup_test.sh', environment)
	test = _run_script('test.sh', environment)

	# Assert:
	assert 0 == setup.returncode
	assert 0 == test.returncode
	assert log_path.read_text(encoding='utf8').splitlines() == [
		'psql -w -h 127.0.0.1 -p 6543 -U postgres -d explorer_rest_test -v ON_ERROR_STOP=1 -c SELECT 1',
		'python3 -m pytest --asyncio-mode=auto -v tests ../common/tests', 'config 127.0.0.1 6543 explorer_rest_test postgres']


@pytest.mark.parametrize('name', CONFIGURATION_NAMES)
def test_empty_setting_is_rejected(script_environment, name):
	# Arrange:
	environment, log_path = script_environment
	environment[f'EXPLORER_TEST_POSTGRES_{name}'] = ''

	# Act:
	setup = _run_script('setup_test.sh', environment)
	test = _run_script('test.sh', environment)

	# Assert:
	assert 0 != setup.returncode
	assert 0 != test.returncode
	assert not log_path.exists()


def test_connection_failure(script_environment):
	# Arrange:
	environment, log_path = script_environment
	environment.update(EXPLORER_TEST_POSTGRES_HOST='db.example', PSQL_STATUS='2')

	# Act:
	result = _run_script('test.sh', environment)

	# Assert:
	assert 2 == result.returncode
	assert all(not line.startswith('python3 ') for line in log_path.read_text(encoding='utf8').splitlines())


def test_test_times_out_hung_query(script_environment):
	# Arrange:
	environment, log_path = script_environment
	environment.update(EXPLORER_TEST_POSTGRES_HOST='db.example', PSQL_HANG='1')

	# Act:
	result = _run_script('test.sh', environment)

	# Assert:
	assert 124 == result.returncode
	assert all(not line.startswith('python3 ') for line in log_path.read_text(encoding='utf8').splitlines())


def test_timeout_kills_stuck_process(script_environment):
	# Arrange:
	environment, log_path = script_environment
	environment.update(EXPLORER_TEST_POSTGRES_HOST='db.example', PSQL_IGNORE_TERM='1')

	# Act:
	result = _run_script('test.sh', environment)

	# Assert:
	assert 0 != result.returncode
	assert all(not line.startswith('python3 ') for line in log_path.read_text(encoding='utf8').splitlines())


@pytest.mark.parametrize(('settings', 'expected_config'), [
	({}, 'config    '),
	({'PORT': '6543'}, 'config  6543  '),
	({'DATABASE': 'custom'}, 'config   custom '),
	({'USER': 'tester'}, 'config    tester'),
	({'HOST': 'db.example'}, 'config db.example 5432 postgres postgres'),
	({'HOST': 'db.example', 'PORT': '6543', 'DATABASE': 'custom', 'USER': 'tester'}, 'config db.example 6543 custom tester')
])
def test_local_selection(script_environment, settings, expected_config):
	# Arrange:
	environment, log_path = script_environment
	del environment['JENKINS_HOME']
	for name, value in settings.items():
		environment[f'EXPLORER_TEST_POSTGRES_{name}'] = value

	# Act: both processes receive the original environment independently.
	setup = _run_script('setup_test.sh', environment)
	test = _run_script('test.sh', environment)

	# Assert:
	assert 0 == setup.returncode
	assert 0 == test.returncode
	commands = log_path.read_text(encoding='utf8').splitlines()
	assert commands[-1] == expected_config
	assert sum(line.startswith('python3 -m pytest ') for line in commands) == 1
	if 'HOST' not in settings:
		assert not any(line.startswith(('psql ', 'initdb ', 'createdb ')) for line in commands)
	else:
		assert all('db.example' in line for line in commands if line.startswith('psql '))


def test_check_without_timeout_command(tmp_path):
	# Arrange:
	bin_path = tmp_path / 'bin'
	bin_path.mkdir()
	(bin_path / 'python3').symlink_to(sys.executable)
	psql = bin_path / 'psql'
	psql.write_text('#!/bin/bash\nexit 2\n', encoding='utf8')
	psql.chmod(0o755)
	environment = dict(
		os.environ, PATH=str(bin_path), EXPLORER_TEST_POSTGRES_HOST='host', EXPLORER_TEST_POSTGRES_PORT='5432',
		EXPLORER_TEST_POSTGRES_DATABASE='test', EXPLORER_TEST_POSTGRES_USER='user')

	# Act:
	result = subprocess.run(
		['/bin/bash', '-c', 'source "$1"; check_test_postgres', '_', str(SCRIPT_DIRECTORY / 'test_postgres_config.sh')],
		env=environment, capture_output=True, text=True, check=False)

	# Assert:
	assert 2 == result.returncode


def test_python_timeout_stops_process(tmp_path):
	# Arrange: shorten only the observed 30-second deadline while executing the real timeout path.
	bin_path = tmp_path / 'bin'
	bin_path.mkdir()
	(bin_path / 'dirname').symlink_to('/usr/bin/dirname')
	python = bin_path / 'python3'
	python.write_text(
		f'#!/bin/bash\nif [ "$1" = -c ]; then exec "{sys.executable}" "$@"; fi\n'
		'echo pytest >> "$EVENT_LOG"\n', encoding='utf8')
	python.chmod(0o755)
	psql = bin_path / 'psql'
	psql.write_text(
		f'#!{sys.executable}\nimport os, time\n'
		'open(os.environ["PID_FILE"], "w", encoding="utf8").write(str(os.getpid()))\n'
		'time.sleep(5)\n', encoding='utf8')
	psql.chmod(0o755)
	(tmp_path / 'sitecustomize.py').write_text(
		'import os, subprocess\n'
		'original_run = subprocess.run\n'
		'def run(*args, **kwargs):\n'
		'    if kwargs.get("timeout") == 30:\n'
		'        open(os.environ["DEADLINE_FILE"], "w", encoding="utf8").write(str(kwargs["timeout"]))\n'
		'        kwargs["timeout"] = 0.2\n'
		'    return original_run(*args, **kwargs)\n'
		'subprocess.run = run\n', encoding='utf8')
	pid_file = tmp_path / 'pid'
	deadline_file = tmp_path / 'deadline'
	event_log = tmp_path / 'events'
	environment = dict(
		os.environ, PATH=str(bin_path), PYTHONPATH=str(tmp_path), EXPLORER_TEST_POSTGRES_HOST='db.example',
		JENKINS_HOME='/jenkins', PID_FILE=str(pid_file), DEADLINE_FILE=str(deadline_file), EVENT_LOG=str(event_log))

	# Act:
	started = time.monotonic()
	result = subprocess.run(
		['/bin/bash', str(SCRIPT_DIRECTORY / 'test.sh'), 'test'], env=environment,
		capture_output=True, text=True, check=False, timeout=4)
	elapsed = time.monotonic() - started

	# Assert:
	assert 124 == result.returncode
	assert elapsed < 4
	assert '30' == deadline_file.read_text(encoding='utf8')
	assert not event_log.exists()
	with pytest.raises(ProcessLookupError):
		os.kill(int(pid_file.read_text(encoding='utf8')), 0)
