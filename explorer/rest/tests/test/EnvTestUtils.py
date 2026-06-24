import os
from contextlib import contextmanager


@contextmanager
def temporary_env_values(values):
	"""Temporarily sets or removes environment variables for a test."""

	previous_values = {
		name: os.environ.get(name)
		for name in values
	}

	try:
		for name, value in values.items():
			if value is None:
				os.environ.pop(name, None)
			else:
				os.environ[name] = value

		yield
	finally:
		for name, previous_value in previous_values.items():
			if previous_value is None:
				os.environ.pop(name, None)
			else:
				os.environ[name] = previous_value
