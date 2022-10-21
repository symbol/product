from pathlib import Path
from zipfile import ZipFile


def prepare_mainnet_package(output_directory, package_name='configuration-package.zip', additional_prefix=None):
	"""Prepares a mainnet package in the specified directory."""

	def prefix():
		return additional_prefix or Path('')

	directory_prefix = prefix() / Path('resources')

	with ZipFile(Path(output_directory) / package_name, 'w') as archive:
		for path in Path('./templates/mainnet/resources').iterdir():
			archive.write(str(path), directory_prefix / path.name)

		for path in Path('./templates/resources').iterdir():
			archive.write(str(path), directory_prefix / path.name)

		archive.writestr(str(prefix() / 'seed' / 'index.dat'), (0).to_bytes(8, byteorder='little'))
		archive.writestr(str(prefix() / 'mongo' / 'mongoDbPrepare.js'), '{}')

	return Path(output_directory) / package_name
