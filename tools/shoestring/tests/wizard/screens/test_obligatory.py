import tempfile
from pathlib import Path

from shoestring.wizard.screens.obligatory import create

# pylint: disable=invalid-name


def test_can_create_screen():
	# Act:
	screen = create(None)

	# Assert: check id
	assert 'obligatory' == screen.screen_id

	# - check defaults
	assert str(Path.home().absolute() / 'symbol') == screen.accessor.destination_directory
	assert 'ca.key.pem' == screen.accessor.ca_pem_path

	# - defaults are not valid
	assert not screen.is_valid()


async def test_can_enter_valid_input():  # must be async to assign input.text
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		temp_file = Path(temp_directory) / 'foo.txt'
		with open(temp_file, 'wt', encoding='utf8') as outfile:
			outfile.write('hello world')

		screen = create(None)

		# Act:
		screen.accessor._destination_directory.input.text = temp_directory  # pylint: disable=protected-access
		screen.accessor._ca_pem_path.input.text = str(temp_file)  # pylint: disable=protected-access

		# Assert: check entered values
		assert temp_directory == screen.accessor.destination_directory
		assert str(temp_file) == screen.accessor.ca_pem_path

		# - inputs are valid
		assert screen.is_valid()


async def test_can_enter_valid_input_ca_pem_path_not_required():  # must be async to assign input.text
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		screen = create(None)
		screen.require_main_private_key(False)

		# Act:
		screen.accessor._destination_directory.input.text = temp_directory  # pylint: disable=protected-access
		screen.accessor._ca_pem_path.input.text = ''  # pylint: disable=protected-access

		# Assert: check entered values
		assert temp_directory == screen.accessor.destination_directory
		assert '' == screen.accessor.ca_pem_path

		# - inputs are valid
		assert screen.is_valid()


def test_can_generate_diagnostic_accessor_representation():
	# Arrange:
	screen = create(None)

	# Act + Assert:
	assert f'(destination_directory=\'{Path.home().absolute() / "symbol"}\', ca_pem_path=\'ca.key.pem\')' == repr(screen.accessor)
	assert [
		('destination directory', str(Path.home().absolute() / 'symbol')),
		('ca pem path', 'ca.key.pem')
	] == screen.accessor.tokens


def test_can_generate_diagnostic_accessor_representation_main_private_key_not_required():
	# Arrange:
	screen = create(None)
	screen.require_main_private_key(False)

	# Act + Assert:
	assert f'(destination_directory=\'{Path.home().absolute() / "symbol"}\', ca_pem_path=\'ca.key.pem\')' == repr(screen.accessor)
	assert [
		('destination directory', str(Path.home().absolute() / 'symbol'))
	] == screen.accessor.tokens
