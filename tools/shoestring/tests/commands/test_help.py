import pytest

from shoestring.__main__ import main

# pylint: disable=invalid-name


async def test_can_run_help(capsys):
	# Act + Assert:
	with pytest.raises(SystemExit):
		await main(['--help'])

	# Assert: spot check a few expected strings
	out = capsys.readouterr().out
	assert '\nShoestring Tool\n' in out
	assert '\nsubcommands:\n' in out
