import tempfile
from pathlib import Path

from symbolchain.CryptoTypes import Hash256

from shoestring.__main__ import main
from shoestring.internal.ShoestringConfiguration import parse_shoestring_configuration

from ..test.TestPackager import prepare_testnet_package

# pylint: disable=invalid-name


async def test_can_download_configuration_file_template():
	# Arrange:
	with tempfile.TemporaryDirectory() as package_directory:
		prepare_testnet_package(package_directory, 'resources.zip')

		with tempfile.TemporaryDirectory() as temp_directory:
			config_filepath = Path(temp_directory) / 'my.shoestring.ini'

			# Sanity:
			assert not config_filepath.exists()

			# Act:
			await main([
				'init',
				'--package', f'file://{Path(package_directory) / "resources.zip"}',
				str(config_filepath)
			])

			# Assert:
			assert config_filepath.exists()

			config = parse_shoestring_configuration(config_filepath)
			assert Hash256('49D6E1CE276A85B70EAFE52349AACCA389302E7A9754BCF1221E79494FC665A4') == config.network.generation_hash_seed
