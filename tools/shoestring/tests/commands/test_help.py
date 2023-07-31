import pytest

from shoestring.__main__ import main

# pylint: disable=invalid-name


async def _assert_can_run_help(capsys, args):
	# Act + Assert:
	with pytest.raises(SystemExit):
		await main(args)

	# Assert: spot check a few expected strings
	out = capsys.readouterr().out
	assert '\nShoestring Tool\n' in out
	assert '\nsubcommands:\n' in out


async def test_can_run_help_when_help_option_specified(capsys):
	await _assert_can_run_help(capsys, ['--help'])


async def test_can_run_help_when_no_command_provided(capsys):
	await _assert_can_run_help(capsys, [])
