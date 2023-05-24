import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from symbolchain.CryptoTypes import PrivateKey
from symbolchain.PrivateKeyStorage import PrivateKeyStorage

from shoestring.__main__ import main


def _write_private_key_file(filepath):
	private_key = PrivateKey.random()
	with open(filepath, 'wt', encoding='utf8') as outfile:
		outfile.write(str(private_key))

	return private_key


# pylint: disable=invalid-name


# region basic operation

async def _assert_can_output_unencrypted_pem(output_name, saved_name):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		# - prepare input private key file
		private_key_input_filepath = Path(temp_directory) / 'input.txt'
		private_key_input = _write_private_key_file(private_key_input_filepath)

		# Act:
		await main([
			'pemtool',
			'--output', str(Path(temp_directory) / output_name),
			'--input', str(private_key_input_filepath)
		])

		# Assert:
		private_key_storage = PrivateKeyStorage(temp_directory)
		private_key_from_pem = private_key_storage.load(saved_name)

		assert private_key_input == private_key_from_pem


async def test_pem_extension_is_added_to_output_file_without_extension():
	await _assert_can_output_unencrypted_pem('output', 'output')


async def test_pem_extension_is_added_to_output_file_with_other_extension():
	await _assert_can_output_unencrypted_pem('output.dat', 'output.dat')


async def test_pem_extension_is_not_added_to_output_file_with_pem_extension():
	await _assert_can_output_unencrypted_pem('output.pem', 'output')


@patch('getpass.getpass')
async def test_can_read_private_key_from_stdin(getpass):
	# Arrange:
	private_key_input = PrivateKey.random()
	getpass.return_value = str(private_key_input)

	with tempfile.TemporaryDirectory() as temp_directory:
		# Act:
		await main([
			'pemtool',
			'--output', str(Path(temp_directory) / 'output')
		])

		# Assert:
		private_key_storage = PrivateKeyStorage(temp_directory)
		private_key_from_pem = private_key_storage.load('output')

		assert private_key_input == private_key_from_pem

# endregion


# region ask-pass

@patch('getpass.getpass')
async def test_can_output_encrypted_pem(getpass):
	# Arrange:
	getpass.return_value = 'abcdef'

	with tempfile.TemporaryDirectory() as temp_directory:
		# - prepare input private key file
		private_key_input_filepath = Path(temp_directory) / 'input.txt'
		private_key_input = _write_private_key_file(private_key_input_filepath)

		# Act:
		await main([
			'pemtool',
			'--output', str(Path(temp_directory) / 'output'),
			'--input', str(private_key_input_filepath),
			'--ask-pass'
		])

		# Assert:
		private_key_storage = PrivateKeyStorage(temp_directory, 'abcdef')
		private_key_from_pem = private_key_storage.load('output')

		assert private_key_input == private_key_from_pem


async def _assert_password_failure(getpass, passwords):
	# Arrange:
	getpass.side_effect = passwords

	with tempfile.TemporaryDirectory() as temp_directory:
		# - prepare input private key file
		private_key_input_filepath = Path(temp_directory) / 'input.txt'
		_write_private_key_file(private_key_input_filepath)

		# Act + Assert:
		with pytest.raises(RuntimeError):
			await main([
				'pemtool',
				'--output', str(Path(temp_directory) / 'output'),
				'--input', str(private_key_input_filepath),
				'--ask-pass'
			])

		# - no file was created
		private_key_storage = PrivateKeyStorage(temp_directory, 'abcdef')
		with pytest.raises(FileNotFoundError):
			private_key_storage.load('output')


@patch('getpass.getpass')
async def test_cannot_output_encrypted_pem_when_passwords_do_not_match(getpass):
	await _assert_password_failure(getpass, ['abcdef', 'ghijkl'])


@patch('getpass.getpass')
async def test_cannot_output_encrypted_pem_when_password_is_too_short(getpass):
	await _assert_password_failure(getpass, ['abc', 'abc'])


@patch('getpass.getpass')
async def test_cannot_output_encrypted_pem_when_password_is_too_long(getpass):
	await _assert_password_failure(getpass, ['abc' * 350, 'abc' * 350])

# endregion


# region force flag

async def test_existing_pem_file_is_not_overwritten_without_force_flag():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		# - prepare input private key files
		private_key_input_filepath = Path(temp_directory) / 'input.txt'
		private_key_input = _write_private_key_file(private_key_input_filepath)

		private_key_input_2_filepath = Path(temp_directory) / 'input2.txt'
		_write_private_key_file(private_key_input_2_filepath)

		# - run tool
		await main([
			'pemtool',
			'--output', str(Path(temp_directory) / 'output'),
			'--input', str(private_key_input_filepath)
		])

		# Act + Assert: rerun tool
		with pytest.raises(FileExistsError):
			await main([
				'pemtool',
				'--output', str(Path(temp_directory) / 'output'),
				'--input', str(private_key_input_2_filepath)
			])

		# - pem file was not overwritten
		private_key_storage = PrivateKeyStorage(temp_directory)
		private_key_from_pem = private_key_storage.load('output')

		assert private_key_input == private_key_from_pem


async def test_existing_pem_file_is_overwritten_with_force_flag():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		# - prepare input private key files
		private_key_input_filepath = Path(temp_directory) / 'input.txt'
		_write_private_key_file(private_key_input_filepath)

		private_key_input_2_filepath = Path(temp_directory) / 'input2.txt'
		private_key_input_2 = _write_private_key_file(private_key_input_2_filepath)

		# - run tool
		await main([
			'pemtool',
			'--output', str(Path(temp_directory) / 'output'),
			'--input', str(private_key_input_filepath)
		])

		# Act + Assert: rerun tool
		await main([
			'pemtool',
			'--output', str(Path(temp_directory) / 'output'),
			'--input', str(private_key_input_2_filepath),
			'--force'
		])

		# - pem file was not overwritten
		private_key_storage = PrivateKeyStorage(temp_directory)
		private_key_from_pem = private_key_storage.load('output')

		assert private_key_input_2 == private_key_from_pem

# endregion
