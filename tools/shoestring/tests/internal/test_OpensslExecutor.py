import os
import re

import pytest

from shoestring.internal.OpensslExecutor import OpensslExecutor


def _create_executor():
	return OpensslExecutor(os.environ.get('OPENSSL_EXECUTABLE', 'openssl'))


# pylint: disable=invalid-name


def test_can_retrieve_openssl_version():
	# Arrange:
	executor = _create_executor()

	# Act:
	version = executor.version()

	# Assert:
	assert re.match(r'3\.[0-1]\.*|1\.1\.1', version)


def test_can_dispatch_openssl_command_with_reflected_output(capfd):
	# Arrange:
	executor = _create_executor()

	# Act:
	output_lines = executor.dispatch(['rand', '-hex', 10])
	standard_output, standard_error = capfd.readouterr()

	# Assert:
	assert 1 == len(output_lines)
	assert re.match(r'^[a-f0-9]{20}\n$', output_lines[0])
	assert standard_output
	assert not standard_error


def test_can_dispatch_openssl_command_without_reflected_output(capfd):
	# Arrange:
	executor = _create_executor()

	# Act:
	output_lines = executor.dispatch(['rand', '-hex', 10], show_output=False)
	standard_output, standard_error = capfd.readouterr()

	# Assert:
	assert 1 == len(output_lines)
	assert re.match(r'^[a-f0-9]{20}\n$', output_lines[0])
	assert not standard_output
	assert not standard_error


def test_can_dispatch_openssl_command_with_additional_command_input(capfd):
	# Arrange:
	executor = _create_executor()

	# Act:
	output_lines = executor.dispatch(['s_client', '-connect', 'jenkins.symboldev.com:443'], command_input='Q')
	standard_output, standard_error = capfd.readouterr()

	# Assert:
	assert 0 != len(output_lines)
	assert 'subject=CN = jenkins.symboldev.com\n' in output_lines
	assert standard_output
	assert not standard_error


def test_can_propagate_dispatch_failure():
	# Arrange:
	executor = _create_executor()

	# Act + Assert: calling invalid command should result in error
	with pytest.raises(RuntimeError):
		executor.dispatch(['randy', '-hex', 10])
