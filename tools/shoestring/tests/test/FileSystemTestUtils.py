from pathlib import Path


def assert_expected_files_and_permissions(output_directory, expected_output_files):  # pylint: disable=invalid-name
	"""Checks all expected output files are created with correct permissions."""

	# check all expected output files are created
	output_files = sorted(str(path.relative_to(output_directory)) for path in Path(output_directory).glob('**/*'))
	assert sorted(expected_output_files.keys()) == output_files

	# check permissions
	for name, expected_permissions in expected_output_files.items():
		assert expected_permissions == (Path(output_directory) / name).stat().st_mode & 0o777, f'checking permissions of {name}'
