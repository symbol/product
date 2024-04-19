import tempfile
from pathlib import Path

import pytest
from cryptography.exceptions import InvalidTag
from symbolchain.CryptoTypes import PrivateKey, PublicKey
from symbolchain.PrivateKeyStorage import PrivateKeyStorage
from symbolchain.symbol.KeyPair import KeyPair

from shoestring.__main__ import main
from shoestring.internal.NodeFeatures import NodeFeatures

from ..test.ConfigurationTestUtils import prepare_shoestring_configuration
from ..test.LogTestUtils import assert_all_messages_are_logged

# key used to decrypt './tests/resources/harvesters.dat'
ORIGINAL_PUBLIC_KEY = PublicKey('148C8ADE25845040BDB95A0293EB5BD5DB483C606748470B607DCB179FECE4C4')
ORIGINAL_PRIVATE_KEY = PrivateKey('9DD63D277F1DC004FDB849CDD0262AB9FE7BFAF70AB13709DA3D5B1DB01710B2')

# contents of './tests/resources/harvesters.dat'
HARVESTER_ENTRY_ADDRESSES = [
	'TBDSKUDXUIOYNVQEORWRO2P4TAQMEX5Q36XZD2Q',
	'TB5Y7SWKDDQWRKIFXLLXF4KCMN7KCCZMBI32WXI',
	'TDBNBF5MXGLQIP3AFO4F2BOCMJJHWE5MOZAJOWA',
	'TDT6756NRFDIFJSNWMLOQDAGIXW5EI5AZ3BX47Y'
]


# pylint: disable=invalid-name

async def test_can_decrypt_harvester_entries_with_correct_in_pem(caplog):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		config_filepath = prepare_shoestring_configuration(output_directory, NodeFeatures.PEER)

		# - save private key
		storage = PrivateKeyStorage(output_directory, None)
		storage.save('original', ORIGINAL_PRIVATE_KEY)

		# Act:
		await main([
			'import-harvesters',
			'--config', str(config_filepath),
			'--in-harvesters', './tests/resources/harvesters.dat',
			'--in-pem', str(Path(output_directory) / 'original.pem')
		])

		# Assert: all harvester addresses are extracted
		expected_log_lines = [
			f'listing harvesters in ./tests/resources/harvesters.dat using public key {ORIGINAL_PUBLIC_KEY}'
		] + HARVESTER_ENTRY_ADDRESSES
		assert_all_messages_are_logged(expected_log_lines, caplog)


async def test_cannot_decrypt_harvester_entries_with_incorrect_in_pem():
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		config_filepath = prepare_shoestring_configuration(output_directory, NodeFeatures.PEER)

		# - save private key
		storage = PrivateKeyStorage(output_directory, None)
		storage.save('original', PrivateKey.random())

		# Act + Assert: decryption fails
		with pytest.raises(InvalidTag):
			await main([
				'import-harvesters',
				'--config', str(config_filepath),
				'--in-harvesters', './tests/resources/harvesters.dat',
				'--in-pem', str(Path(output_directory) / 'original.pem')
			])


async def test_can_encrypt_harvester_entries_with_out_pem(caplog):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		config_filepath = prepare_shoestring_configuration(output_directory, NodeFeatures.PEER)

		new_key_pair = KeyPair(PrivateKey.random())
		out_harvesters_filepath = Path(output_directory) / 'out_harvesters.dat'

		# - save private keys
		storage = PrivateKeyStorage(output_directory, None)
		storage.save('original', ORIGINAL_PRIVATE_KEY)
		storage.save('new', new_key_pair.private_key)

		# Act:
		await main([
			'import-harvesters',
			'--config', str(config_filepath),
			'--in-harvesters', './tests/resources/harvesters.dat',
			'--in-pem', str(Path(output_directory) / 'original.pem'),
			'--out-harvesters', str(out_harvesters_filepath),
			'--out-pem', str(Path(output_directory) / 'new.pem')
		])

		# Assert: all harvester addresses are extracted and re-encrypted
		expected_log_lines = [
			f'listing harvesters in ./tests/resources/harvesters.dat using public key {ORIGINAL_PUBLIC_KEY}'
		] + HARVESTER_ENTRY_ADDRESSES + [
			f'listing harvesters in {out_harvesters_filepath} using public key {new_key_pair.public_key}'
		] + HARVESTER_ENTRY_ADDRESSES
		assert_all_messages_are_logged(expected_log_lines, caplog)

		# - new harvesters file exists and is read-write
		assert out_harvesters_filepath.exists()
		assert 0o600 == out_harvesters_filepath.stat().st_mode & 0o777


async def test_cannot_encrypt_harvester_entries_with_equal_in_harvesters_and_out_harvesters():
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		config_filepath = prepare_shoestring_configuration(output_directory, NodeFeatures.PEER)

		new_key_pair = KeyPair(PrivateKey.random())

		# - save private keys
		storage = PrivateKeyStorage(output_directory, None)
		storage.save('original', ORIGINAL_PRIVATE_KEY)
		storage.save('new', new_key_pair.private_key)

		# Act + Assert:
		with pytest.raises(SystemExit) as ex_info:
			await main([
				'import-harvesters',
				'--config', str(config_filepath),
				'--in-harvesters', './tests/resources/harvesters.dat',
				'--in-pem', str(Path(output_directory) / 'original.pem'),
				'--out-harvesters', './tests/resources/harvesters.dat',
				'--out-pem', str(Path(output_directory) / 'new.pem')
			])

			assert 1 == ex_info.value.code
