import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from symbolchain.CryptoTypes import PrivateKey
from symbolchain.PrivateKeyStorage import PrivateKeyStorage
from symbolchain.symbol.KeyPair import KeyPair
from symbolchain.symbol.Network import Network

from shoestring.__main__ import main

from ..test.LogTestUtils import assert_all_messages_are_logged


def _write_private_key_pem_file(directory, name, password=None):
	private_key = PrivateKey.random()

	storage = PrivateKeyStorage(directory, password)
	storage.save(name, private_key)

	return private_key


# pylint: disable=invalid-name


# region basic operation - success (unencrypted)

async def _assert_can_output_unencrypted_pem(caplog, network, show_private=False):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		# - prepare input pem file
		private_key = _write_private_key_pem_file(temp_directory, 'test')
		pem_filepath = Path(temp_directory) / 'test.pem'

		# Act:
		await main([
			'pemview',
			'--input', str(pem_filepath),
			'--network', network.name
		] + (['--show-private'] if show_private else []))

		# Assert:
		key_pair = KeyPair(private_key)
		assert_all_messages_are_logged([
			f'loaded {pem_filepath}',
			f'    address: {network.public_key_to_address(key_pair.public_key)}',
			f' public key: {key_pair.public_key}',
		] + ([f'private key: {key_pair.private_key}'] if show_private else []), caplog)


async def test_can_process_unencrypted_pem_mainnet(caplog):
	await _assert_can_output_unencrypted_pem(caplog, Network.MAINNET)


async def test_can_process_unencrypted_pem_testnet(caplog):
	await _assert_can_output_unencrypted_pem(caplog, Network.TESTNET)


async def test_can_process_unencrypted_pem_and_show_private_key_mainnet(caplog):
	await _assert_can_output_unencrypted_pem(caplog, Network.MAINNET, True)


async def test_can_process_unencrypted_pem_and_show_private_key_testnet(caplog):
	await _assert_can_output_unencrypted_pem(caplog, Network.TESTNET, True)

# endregion


# region basic operation - success (encrypted)

async def _assert_can_output_encrypted_pem(caplog, getpass, network, show_private=False):
	# Arrange:
	getpass.return_value = 'foobar'

	with tempfile.TemporaryDirectory() as temp_directory:
		# - prepare input pem file
		private_key = _write_private_key_pem_file(temp_directory, 'test', 'foobar')
		pem_filepath = Path(temp_directory) / 'test.pem'

		# Act:
		await main([
			'pemview',
			'--input', str(pem_filepath),
			'--network', network.name,
			'--ask-pass'
		] + (['--show-private'] if show_private else []))

		# Assert:
		key_pair = KeyPair(private_key)
		assert_all_messages_are_logged([
			f'loaded {pem_filepath}',
			f'    address: {network.public_key_to_address(key_pair.public_key)}',
			f' public key: {key_pair.public_key}',
		] + ([f'private key: {key_pair.private_key}'] if show_private else []), caplog)


@patch('getpass.getpass')
async def test_can_process_encrypted_pem_mainnet(getpass, caplog):
	await _assert_can_output_encrypted_pem(caplog, getpass, Network.MAINNET)


@patch('getpass.getpass')
async def test_can_process_encrypted_pem_testnet(getpass, caplog):
	await _assert_can_output_encrypted_pem(caplog, getpass, Network.TESTNET)


@patch('getpass.getpass')
async def test_can_process_encrypted_pem_and_show_private_key_mainnet(getpass, caplog):
	await _assert_can_output_encrypted_pem(caplog, getpass, Network.MAINNET, True)


@patch('getpass.getpass')
async def test_can_process_encrypted_pem_and_show_private_key_testnet(getpass, caplog):
	await _assert_can_output_encrypted_pem(caplog, getpass, Network.TESTNET, True)

# endregion


# region basic operation - failure

async def test_cannot_output_pem_with_invalid_extension():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		pem_filepath = Path(temp_directory) / 'test.foo'

		# Act + Assert:
		with pytest.raises(ValueError, match=f'{pem_filepath}.*does not have .pem extension'):
			await main([
				'pemview',
				'--input', str(pem_filepath),
				'--network', 'mainnet',
			])


async def test_cannot_output_pem_that_does_not_exist():
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		pem_filepath = Path(temp_directory) / 'test.pem'

		# Act + Assert:
		with pytest.raises(FileNotFoundError, match=f'{pem_filepath}.*does not exist'):
			await main([
				'pemview',
				'--input', str(pem_filepath),
				'--network', 'mainnet',
			])

# endregion
