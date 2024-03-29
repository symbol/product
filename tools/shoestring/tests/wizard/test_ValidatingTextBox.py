import tempfile
from pathlib import Path

from shoestring.wizard.ValidatingTextBox import (
	ValidatingTextBox,
	is_directory_path,
	is_file_path,
	is_hex_private_key_string,
	is_hostname,
	is_integer,
	is_ip_address,
	is_json,
	is_not_empty
)

# pylint: disable=invalid-name


# region validators

def test_is_not_empty_returns_true_when_value_is_not_empty():
	assert is_not_empty('A')
	assert is_not_empty('ABCDEF012345')
	assert not is_not_empty('')


def test_is_file_path_returns_true_only_for_valid_file_paths():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		temp_file = Path(temp_directory) / 'foo.txt'
		with open(temp_file, 'wt', encoding='utf8') as outfile:
			outfile.write('hello world')

		# Act + Assert:
		assert is_file_path(temp_file)  # file
		assert not is_file_path(temp_directory)  # directory
		assert not is_file_path(Path(temp_directory) / 'bar.txt')  # does not exist


def test_is_directory_path_returns_true_only_for_valid_directory_paths():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		temp_file = Path(temp_directory) / 'foo.txt'
		with open(temp_file, 'wt', encoding='utf8') as outfile:
			outfile.write('hello world')

		# Act + Assert:
		assert not is_directory_path(temp_file)  # file
		assert is_directory_path(temp_directory)  # directory
		assert not is_directory_path(Path(temp_directory) / 'bar.txt')  # does not exist


def test_is_integer_returns_true_only_for_valid_integer():
	assert is_integer('123')  # valid
	assert is_integer('0')
	assert not is_integer('+123')
	assert not is_integer('-123')
	assert not is_integer('ABC')
	assert not is_integer('1B4')
	assert not is_integer('')


def test_is_hex_private_key_string_returns_true_only_for_valid_hex_private_key_strings():
	assert is_hex_private_key_string('AA912E32BEE88EACA1E88294A7CE9E4F15F3BB4B65D6F7C5017A954E3DED0636')  # valid
	assert not is_hex_private_key_string('AA912E32BEE88EACA1E88294A7CE9E4F15F3BB4B65D6F7C5017A954E3DED0G36')  # invalid digit
	assert not is_hex_private_key_string('AA912E32BEE88EACA1E88294A7CE9E4F15F3BB4B65D6F7C5017A954E3DED063')  # too short
	assert not is_hex_private_key_string('AA912E32BEE88EACA1E88294A7CE9E4F15F3BB4B65D6F7C5017A954E3DED06366')  # too long


def test_is_ip_address_returns_true_only_for_valid_ip_address():
	assert is_ip_address('127.0.0.1')
	assert not is_ip_address('127.0.0')
	assert not is_ip_address('')


def test_is_hostname_returns_true_only_for_valid_hostname():
	assert is_hostname('localhost')
	assert not is_hostname('foo')
	assert not is_hostname('')


def test_is_json_returns_true_only_for_valid_json():
	assert is_json('{"animal": "wolf"}')
	assert not is_json('{"animal": wolf}')  # value not quoted
	assert is_json('')

# endregion


# region ValidatingTextBox

def _is_foo(value):
	return value == 'foo'


def test_can_create_validating_text_box_with_default_value():
	# Act:
	text_box = ValidatingTextBox('my input label', _is_foo, 'value is not foo', 'bar')

	# Assert:
	assert 'my input label' == text_box.label.text
	assert 'class:label,error' == text_box.label.window.style()

	assert 'bar' == text_box.input.text
	assert 'value is not foo' == text_box.input.buffer.validation_error.message
	assert not text_box.is_valid


async def test_can_validate_text_box_contents_valid():  # must be async to assign input.text
	# Act:
	text_box = ValidatingTextBox('my input label', _is_foo, 'value is not foo')
	text_box.input.text = 'foo'
	text_box.input.buffer.validate()

	# Assert:
	assert 'my input label' == text_box.label.text
	assert 'class:label' == text_box.label.window.style()

	assert 'foo' == text_box.input.text
	assert not text_box.input.buffer.validation_error
	assert text_box.is_valid


async def test_can_validate_text_box_contents_invalid():  # must be async to assign input.text
	# Act:
	text_box = ValidatingTextBox('my input label', _is_foo, 'value is not foo')
	text_box.input.text = 'baz'
	text_box.input.buffer.validate()

	# Assert:
	assert 'my input label' == text_box.label.text
	assert 'class:label,error' == text_box.label.window.style()

	assert 'baz' == text_box.input.text
	assert 'value is not foo' == text_box.input.buffer.validation_error.message
	assert not text_box.is_valid

# endregion
