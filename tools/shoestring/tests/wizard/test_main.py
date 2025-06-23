import sys

import shoestring.wizard.__main__


def test_entry_point_runs(monkeypatch):
	async def dummy_run_async():
		return None
	monkeypatch.setattr(
		'shoestring.wizard.__main__.Application.run_async',
		dummy_run_async
	)
	monkeypatch.setattr(sys, 'argv', ['shoestring-wizard'])
	shoestring.wizard.__main__.entry_point()
