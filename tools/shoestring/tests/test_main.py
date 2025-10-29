import sys

import pytest

import shoestring.__main__


def test_entry_point_runs(monkeypatch):
	monkeypatch.setattr(sys, 'argv', ['shoestring', '--help'])
	with pytest.raises(SystemExit):
		shoestring.__main__.entry_point()
