import asyncio

import pytest
import workflow_test_utils

from puller.workflows.symbol import main


def _base_arguments(command):
	return [
		command,
		'--symbol-node', 'http://localhost:7890',
		'--network', 'testnet',
		'--db-config', 'test_config.ini'
	]


def test_help_lists_symbol_commands(capsys):
	# Act + Assert:
	with pytest.raises(SystemExit) as exception:
		asyncio.run(main(['--help']))

	# Assert:
	assert exception.value.code == 0
	output = capsys.readouterr().out
	assert 'sync-block' in output
	assert 'refresh-accounts' in output


def test_no_command_prints_help(capsys):
	# Act + Assert:
	with pytest.raises(SystemExit) as exception:
		asyncio.run(main([]))

	# Assert:
	assert exception.value.code == 0
	output = capsys.readouterr().out
	assert 'Run a Symbol puller workflow.' in output
	assert 'sync-block' in output
	assert 'refresh-accounts' in output


def test_unknown_command_is_rejected(capsys):
	# Act + Assert:
	with pytest.raises(SystemExit) as exception:
		asyncio.run(main(['unknown']))

	# Assert:
	assert exception.value.code == 2
	assert 'invalid choice' in capsys.readouterr().err


@pytest.mark.parametrize(
	'missing_option',
	['--symbol-node', '--network', '--db-config'],
	ids=['symbol-node', 'network', 'db-config'])
def test_common_argument_required(missing_option, capsys):
	# Arrange:
	arguments = _base_arguments('sync-block')
	option_index = arguments.index(missing_option)
	del arguments[option_index:option_index + 2]

	# Act + Assert:
	with pytest.raises(SystemExit) as exception:
		asyncio.run(main(arguments))

	# Assert:
	assert exception.value.code == 2
	assert missing_option in capsys.readouterr().err


def test_invalid_network_is_rejected(capsys):
	# Act + Assert:
	with pytest.raises(SystemExit) as exception:
		asyncio.run(main([
			'sync-block',
			'--symbol-node', 'http://localhost:7890',
			'--network', 'main',
			'--db-config', 'test_config.ini'
		]))

	# Assert:
	assert exception.value.code == 2
	assert 'invalid choice' in capsys.readouterr().err


@pytest.mark.parametrize(
	'option',
	['--max-height', '--max-requests-per-second'],
	ids=['max-height', 'max-requests-per-second'])
def test_sync_limit_rejected(option, capsys):
	# Arrange:
	arguments = _base_arguments('sync-block')

	# Act + Assert:
	with pytest.raises(SystemExit) as exception:
		asyncio.run(main(arguments + [option, '0']))

	# Assert:
	assert exception.value.code == 2
	assert 'must be greater than or equal to 1' in capsys.readouterr().err


@pytest.mark.parametrize(
	('command', 'expected_text'),
	[('sync-block', '--max-height'), ('refresh-accounts', '--symbol-node')],
	ids=['sync-block', 'refresh-accounts'])
def test_command_help(command, expected_text, capsys):
	# Act + Assert:
	with pytest.raises(SystemExit) as exception:
		asyncio.run(main([command, '--help']))

	# Assert:
	assert exception.value.code == 0
	assert expected_text in capsys.readouterr().out


def test_sync_dispatch_forwards_args():
	# Arrange:
	puller_factory = workflow_test_utils.RecordingSymbolPullerFactory()
	argv = _base_arguments('sync-block') + ['--max-height', '3000', '--max-requests-per-second', '25']
	environment = workflow_test_utils.create_symbol_environment('9')

	# Act:
	asyncio.run(main(argv, puller_factory, environment))

	# Assert:
	puller = puller_factory.puller
	assert puller.constructor_kwargs == {'max_requests_per_second': 25}
	assert puller.symbol_db.create_tables_call_count == 1
	assert puller.synced_max_heights == [3000]
	assert puller.constructor_args[:3] == ('http://localhost:7890', 'test_config.ini', 'testnet')
	assert puller.constructor_args[3].base_url == 'http://localhost:7890'


def test_sync_dispatch_defaults():
	# Arrange:
	puller_factory = workflow_test_utils.RecordingSymbolPullerFactory()

	# Act:
	asyncio.run(main(_base_arguments('sync-block'), puller_factory, workflow_test_utils.create_symbol_environment()))

	# Assert:
	assert not puller_factory.puller.constructor_kwargs
	assert puller_factory.puller.synced_max_heights == [None]


def test_refresh_dispatches(caplog):
	# Arrange:
	puller_factory = workflow_test_utils.RecordingSymbolPullerFactory()
	caplog.set_level('INFO')

	# Act:
	asyncio.run(main(_base_arguments('refresh-accounts'), puller_factory, workflow_test_utils.create_symbol_environment()))

	# Assert:
	puller = puller_factory.puller
	assert puller.refresh_accounts_call_count == 1
	assert puller.symbol_db.create_tables_call_count == 1
	assert puller.constructor_args[:3] == ('http://localhost:7890', 'test_config.ini', 'testnet')
	assert ['Account refresh completed'] == caplog.messages


def test_refresh_failure_no_log(caplog):
	# Arrange:
	puller_factory = workflow_test_utils.FailingRefreshSymbolPullerFactory()
	caplog.set_level('INFO')

	# Act + Assert:
	with pytest.raises(RuntimeError, match='refresh failed'):
		asyncio.run(main(_base_arguments('refresh-accounts'), puller_factory, workflow_test_utils.create_symbol_environment()))

	# Assert:
	assert [] == caplog.messages
