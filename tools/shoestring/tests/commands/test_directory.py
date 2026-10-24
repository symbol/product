from pathlib import Path

import pytest

from shoestring.__main__ import parse_args

# pylint: disable=invalid-name

COMMANDS = ['setup', 'upgrade', 'health', 'renew-certificates', 'renew-voting-keys', 'reset-data']


@pytest.fixture(autouse=True)
def clear_home(monkeypatch):
	monkeypatch.delenv('HOME', raising=False)


def _args(command):
	args = [command, '--config', 'shoestring.ini']
	if command in ('setup', 'renew-certificates'):
		args.extend(['--ca-key-path', 'ca.key.pem'])
	return args


@pytest.mark.parametrize('command', COMMANDS)
@pytest.mark.parametrize('home', [None, ''])
@pytest.mark.parametrize('fallback_home', [None, ''])
def test_defaults_to_current_directory(command, home, fallback_home, monkeypatch, tmp_path):
	if fallback_home is not None:
		monkeypatch.setenv('HOME', fallback_home)
	if home is None:
		monkeypatch.delenv('SHOESTRING_HOME', raising=False)
	else:
		monkeypatch.setenv('SHOESTRING_HOME', home)
	monkeypatch.chdir(tmp_path)

	assert str(tmp_path) == parse_args(_args(command)).directory


@pytest.mark.parametrize('command', COMMANDS)
def test_environment_overrides_current_directory(command, monkeypatch, tmp_path):
	home = str(tmp_path / 'not-yet-created')
	monkeypatch.setenv('SHOESTRING_HOME', home)

	assert home == parse_args(_args(command)).directory


@pytest.mark.parametrize('command', COMMANDS)
@pytest.mark.parametrize('home', ['relative/symbol', '~/symbol', '$HOME/symbol'])
def test_rejects_relative_environment_directory(command, home, monkeypatch, capsys):
	monkeypatch.setenv('SHOESTRING_HOME', home)

	with pytest.raises(SystemExit) as ex:
		parse_args(_args(command))

	assert 2 == ex.value.code
	assert f'SHOESTRING_HOME must be an absolute path: {home}' in capsys.readouterr().err


@pytest.mark.parametrize('command', COMMANDS)
@pytest.mark.parametrize('home', ['/environment/symbol', 'relative/symbol'])
@pytest.mark.parametrize('directory', ['/explicit/symbol', 'relative/explicit', '~/explicit', '$HOME/explicit'])
def test_explicit_directory_overrides_environment(command, home, directory, monkeypatch):
	monkeypatch.setenv('SHOESTRING_HOME', home)

	assert directory == parse_args(_args(command) + ['--directory', directory]).directory


@pytest.mark.parametrize('command', COMMANDS)
@pytest.mark.parametrize('home', [None, '', '/environment/symbol'])
def test_help_displays_default_directory(command, home, monkeypatch, capsys):
	if home is None:
		monkeypatch.delenv('SHOESTRING_HOME', raising=False)
	else:
		monkeypatch.setenv('SHOESTRING_HOME', home)

	with pytest.raises(SystemExit) as ex:
		parse_args([command, '--help'])

	assert 0 == ex.value.code
	assert f'default: {home or Path.cwd()}' in ' '.join(capsys.readouterr().out.split())


def test_directory_default_is_evaluated_for_each_invocation(monkeypatch, tmp_path):
	monkeypatch.setenv('SHOESTRING_HOME', str(tmp_path / 'first'))
	assert str(tmp_path / 'first') == parse_args(_args('health')).directory

	monkeypatch.setenv('SHOESTRING_HOME', str(tmp_path / 'second'))
	assert str(tmp_path / 'second') == parse_args(_args('health')).directory

	monkeypatch.delenv('SHOESTRING_HOME')
	monkeypatch.chdir(tmp_path)
	assert str(tmp_path) == parse_args(_args('health')).directory

	(tmp_path / 'current').mkdir()
	monkeypatch.chdir(tmp_path / 'current')
	assert str(tmp_path / 'current') == parse_args(_args('health')).directory


def test_environment_does_not_affect_commands_without_directory(monkeypatch):
	monkeypatch.setenv('SHOESTRING_HOME', 'relative/symbol')

	assert 'shoestring.ini' == parse_args(['init', 'shoestring.ini']).config


@pytest.fixture(name='percent_directory', params=['environment', 'home', 'current'])
def fixture_percent_directory(request, monkeypatch, tmp_path):
	directory = tmp_path / '100%_%(prog)s_%%'
	if 'current' != request.param:
		variable = 'SHOESTRING_HOME' if 'environment' == request.param else 'HOME'
		monkeypatch.setenv(variable, str(directory))
		if 'home' == request.param:
			monkeypatch.delenv('SHOESTRING_HOME', raising=False)
	else:
		monkeypatch.delenv('SHOESTRING_HOME', raising=False)
		directory.mkdir()
		monkeypatch.chdir(directory)
	return str(directory)


@pytest.mark.parametrize('command', COMMANDS)
def test_percent_in_default_directory_preserves_selection(command, percent_directory):
	assert percent_directory == parse_args(_args(command)).directory
	assert 'explicit' == parse_args(_args(command) + ['--directory', 'explicit']).directory


@pytest.mark.parametrize('command', COMMANDS)
def test_help_displays_percent_in_default_directory(command, percent_directory, capsys):
	with pytest.raises(SystemExit) as ex:
		parse_args([command, '--help'])

	assert 0 == ex.value.code
	assert f'default:{percent_directory}' in ''.join(capsys.readouterr().out.split())


@pytest.mark.usefixtures('percent_directory')
def test_percent_in_default_directory_does_not_affect_other_commands():
	assert 'shoestring.ini' == parse_args(['init', 'shoestring.ini']).config


@pytest.mark.parametrize('command', COMMANDS)
@pytest.mark.parametrize('shoestring_home', [None, ''])
def test_home_overrides_current_directory(command, shoestring_home, monkeypatch, tmp_path, capsys):
	if shoestring_home is None:
		monkeypatch.delenv('SHOESTRING_HOME', raising=False)
	else:
		monkeypatch.setenv('SHOESTRING_HOME', shoestring_home)
	home = str(tmp_path / 'home')
	monkeypatch.setenv('HOME', home)
	monkeypatch.chdir(tmp_path)

	assert home == parse_args(_args(command)).directory
	assert 'explicit' == parse_args(_args(command) + ['--directory', 'explicit']).directory
	with pytest.raises(SystemExit) as ex:
		parse_args([command, '--help'])

	assert 0 == ex.value.code
	assert f'default:{home}' in ''.join(capsys.readouterr().out.split())


@pytest.mark.parametrize('command', COMMANDS)
def test_shoestring_home_overrides_home(command, monkeypatch, tmp_path):
	monkeypatch.setenv('HOME', str(tmp_path / 'home'))
	monkeypatch.setenv('SHOESTRING_HOME', str(tmp_path / 'shoestring'))

	assert str(tmp_path / 'shoestring') == parse_args(_args(command)).directory


@pytest.mark.parametrize('command', COMMANDS)
def test_invalid_shoestring_home_does_not_fall_back_to_home(command, monkeypatch, tmp_path, capsys):
	monkeypatch.setenv('HOME', str(tmp_path))
	monkeypatch.setenv('SHOESTRING_HOME', 'relative/symbol')

	with pytest.raises(SystemExit) as ex:
		parse_args(_args(command))

	assert 2 == ex.value.code
	assert 'SHOESTRING_HOME must be an absolute path' in capsys.readouterr().err
