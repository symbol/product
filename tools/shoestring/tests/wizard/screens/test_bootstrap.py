import tempfile
from pathlib import Path

from shoestring.wizard.screens.bootstrap import create

# pylint: disable=invalid-name


def test_can_create_screen():
	# Act:
	screen = create(None)

	# Assert: check id
	assert 'bootstrap' == screen.screen_id

	# - check defaults
	assert screen.accessor.include_node_key
	assert '' == screen.accessor.path


async def test_can_enter_valid_input_bootstrap_path():
	# Arrange:
	with tempfile.TemporaryDirectory() as bootstrap_path:
		(Path(bootstrap_path) / 'nodes/node').mkdir(parents=True)
		screen = create(None)

		# Act:
		screen.accessor._path.input.text = bootstrap_path  # pylint: disable=protected-access
		screen.accessor._path.input.buffer.validate()  # pylint: disable=protected-access

		# Assert: check entered values
		assert screen.accessor.include_node_key
		assert bootstrap_path == screen.accessor.path

		# - inputs are valid
		assert screen.is_valid()


async def test_can_disable_include_node_key():
	# Arrange:
	with tempfile.TemporaryDirectory() as bootstrap_path:
		(Path(bootstrap_path) / 'nodes/node').mkdir(parents=True)
		screen = create(None)

		# Act:
		screen.accessor._include_node_key_flag.current_values = []  # pylint: disable=protected-access
		screen.accessor._path.input.text = bootstrap_path  # pylint: disable=protected-access
		screen.accessor._path.input.buffer.validate()  # pylint: disable=protected-access

		# Assert: check entered values
		assert not screen.accessor.include_node_key
		assert bootstrap_path == screen.accessor.path

		# - inputs are valid
		assert screen.is_valid()


async def test_fails_validation_when_entered_bootstrap_path_is_invalid():
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		invalid_bootstrap_path = Path(output_directory) / 'invalid_path'
		invalid_bootstrap_path.mkdir(parents=True)
		invalid_input_path = str(invalid_bootstrap_path)
		screen = create(None)

		# Act:
		screen.accessor._path.input.text = invalid_input_path  # pylint: disable=protected-access
		screen.accessor._path.input.buffer.validate()  # pylint: disable=protected-access

		# Assert: check entered values
		assert screen.accessor.include_node_key
		assert invalid_input_path == screen.accessor.path

		# - path is not valid
		assert not screen.is_valid()


async def test_can_generate_diagnostic_accessor_representation_when_include_node_key_enabled():
	# Arrange:
	with tempfile.TemporaryDirectory() as bootstrap_path:
		(Path(bootstrap_path) / 'nodes/node').mkdir(parents=True)

		screen = create(None)
		screen.accessor._include_node_key_flag.current_values = [()]  # pylint: disable=protected-access
		screen.accessor._path.input.text = bootstrap_path  # pylint: disable=protected-access
		screen.accessor._path.input.buffer.validate()  # pylint: disable=protected-access

		# Assert: check entered values
		assert (
			f'(include_node_key=True, path=\'{bootstrap_path}\')'
		) == repr(screen.accessor)
		assert [
			('include node key', 'enabled'),
			('bootstrap target directory', bootstrap_path)
		] == screen.accessor.tokens


async def test_can_generate_diagnostic_accessor_representation_when_include_node_key_disabled():
	# Arrange:
	with tempfile.TemporaryDirectory() as bootstrap_path:
		(Path(bootstrap_path) / 'nodes/node').mkdir(parents=True)

		screen = create(None)
		screen.accessor._include_node_key_flag.current_values = []  # pylint: disable=protected-access
		screen.accessor._path.input.text = bootstrap_path  # pylint: disable=protected-access
		screen.accessor._path.input.buffer.validate()  # pylint: disable=protected-access

		# Assert: check entered values
		assert (
			f'(include_node_key=False, path=\'{bootstrap_path}\')'
		) == repr(screen.accessor)
		assert [
			('include node key', 'disabled'),
			('bootstrap target directory', bootstrap_path)
		] == screen.accessor.tokens
