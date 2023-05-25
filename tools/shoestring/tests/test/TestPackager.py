import shutil
from pathlib import Path


def prepare_testnet_package(output_directory, package_name='configuration-package.zip'):
	"""Prepares a testnet package in the specified directory."""

	destination_file = Path(output_directory) / package_name
	shutil.copy('./tests/resources/sai.zip', destination_file)
	return destination_file
