import tempfile
from pathlib import Path

from symbolchain.CryptoTypes import PrivateKey
from symbolchain.PrivateKeyStorage import PrivateKeyStorage

from shoestring.wizard.screens.obligatory import create

# pylint: disable=invalid-name


def create_screen(value):
	screen = create(value)
	# wrapper to avoid `pylint disable protected-access`` in this file
	screen.get_element = screen._get_element  # pylint: disable=protected-access
	return screen


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

		screen = create_screen(None)

		# Act:
		screen.get_element('destination-directory').input.text = temp_directory
		screen.get_element('ca-pem-path').input.text = str(temp_file)

		# Assert: check entered values
		assert temp_directory == screen.accessor.destination_directory
		assert str(temp_file) == screen.accessor.ca_pem_path

		# - inputs are valid
		assert screen.is_valid()


async def test_can_enter_valid_input_ca_pem_path_not_required():  # must be async to assign input.text
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		screen = create_screen(None)
		screen.require_main_private_key(False)

		# Act:
		screen.get_element('destination-directory').input.text = temp_directory
		screen.get_element('ca-pem-path').input.text = ''

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


def no_mutation(value):
	return value


def mutate_last_char(value):
	return value[:-1] + 'x'


async def run_import_key_test(temp_directory, mutate_key, mutate_path, screens=None, private_key=None):
	private_key = PrivateKey.random() if not private_key else private_key
	screen = create_screen(screens)
	screen.switch_to_tab(1)

	# Act: set paths
	screen.get_element('destination-directory').input.text = temp_directory
	screen.get_element('ca-pem-path').input.text = mutate_path(str(Path(temp_directory) / 'key.pem'))
	screen.get_element('private-key-text').input.text = mutate_key(str(private_key))

	# force validation as it seems async thread is not doing it in time prior to call to screen.is_valid
	screen.get_element('private-key-text').input.buffer.validate()

	return screen


async def test_can_enter_valid_import_key():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		# Act:
		screen = await run_import_key_test(temp_directory, no_mutation, no_mutation)

		# Assert:
		assert screen.is_valid()


async def test_dialog_is_invalid_if_private_key_is_invalid():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		# Act:
		screen = await run_import_key_test(temp_directory, mutate_key=mutate_last_char, mutate_path=no_mutation)

		# Assert:
		assert not screen.is_valid()


async def test_dialog_is_invalid_if_pem_path_is_invalid():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		# Act:
		screen = await run_import_key_test(temp_directory, mutate_key=no_mutation, mutate_path=mutate_last_char)

		# Assert:
		assert not screen.is_valid()


class MockScreens:
	def __init__(self):
		self.message_box_shown = False

	def message_box(self, title, text, on_close_callback):
		del title
		del text
		self.message_box_shown = True
		on_close_callback()


async def test_can_import_valid_key():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		private_key = PrivateKey.random()
		mock_screens = MockScreens()
		screen = await run_import_key_test(temp_directory, no_mutation, no_mutation, screens=mock_screens, private_key=private_key)

		# Act: simulate button click
		screen.get_element('import-button').handler()

		# Assert: message box was shown, tab is switched
		assert mock_screens.message_box_shown
		assert 0 == screen.get_element('tab-list').current_value
		assert screen.is_valid()

		# - try to read imported key
		file_path = Path(screen.accessor.ca_pem_path)
		storage = PrivateKeyStorage(file_path.parent)
		key = storage.load(file_path.stem)
		assert key == private_key


async def test_import_is_noop_when_dialog_is_invalid():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		private_key = PrivateKey.random()
		mock_screens = MockScreens()
		screen = await run_import_key_test(temp_directory, mutate_last_char, no_mutation, screens=mock_screens, private_key=private_key)

		# Act: simulate button click
		screen.get_element('import-button').handler()

		# Assert: message box not shown, tab not switched
		assert not mock_screens.message_box_shown
		assert 1 == screen.get_element('tab-list').current_value
		assert not screen.is_valid()


async def test_can_generate_valid_key():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		mock_screens = MockScreens()
		screen = create_screen(mock_screens)
		screen.switch_to_tab(2)

		# Act: set paths
		screen.get_element('destination-directory').input.text = temp_directory
		screen.get_element('ca-pem-path').input.text = str(Path(temp_directory) / 'key.pem')

		# Sanity:
		assert screen.is_valid()

		# Act: simulate button click
		screen.get_element('generate-button').handler()

		# Assert: message box was shown, tab is switched
		assert mock_screens.message_box_shown
		assert 0 == screen.get_element('tab-list').current_value
		assert screen.is_valid()

		# - try to read generated key
		file_path = Path(screen.accessor.ca_pem_path)
		storage = PrivateKeyStorage(file_path.parent)
		storage.load(file_path.stem)


async def test_generate_is_noop_when_dialog_is_invalid():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		mock_screens = MockScreens()
		screen = create_screen(mock_screens)
		screen.switch_to_tab(2)

		# Act: set paths
		screen.get_element('destination-directory').input.text = temp_directory
		screen.get_element('ca-pem-path').input.text = str(Path(temp_directory) / 'key.pe')

		# force validation as it seems async thread is not doing it in time prior to call to screen.is_valid
		screen.get_element('ca-pem-path').input.buffer.validate()

		screen.get_element('generate-button').handler()

		# Assert: message box not shown, tab not switched
		assert not mock_screens.message_box_shown
		assert 2 == screen.get_element('tab-list').current_value
		assert not screen.is_valid()
