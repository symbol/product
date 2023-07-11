import shutil
import tempfile
from pathlib import Path

from shoestring.wizard.setup_file_generator import prepare_overrides_file, prepare_shoestring_files, try_prepare_node_metadata_file
from shoestring.wizard.ShoestringOperation import ShoestringOperation, build_shoestring_command


async def dispatch_shoestring_command(screens, executor):
	"""Dispatches a shoestring command specified by screens to a specified (async) executor."""

	obligatory_settings = screens.get('obligatory')
	destination_directory = Path(obligatory_settings.destination_directory)
	shoestring_directory = destination_directory / 'shoestring'

	operation = screens.get('welcome').operation
	package = screens.get('network-type').current_value

	if ShoestringOperation.SETUP == operation:
		with tempfile.TemporaryDirectory() as temp_directory:
			has_custom_node_metadata = try_prepare_node_metadata_file(screens, Path(temp_directory) / 'node_metadata.json')
			prepare_overrides_file(screens, Path(temp_directory) / 'overrides.ini')
			await prepare_shoestring_files(screens, Path(temp_directory))

			shoestring_args = build_shoestring_command(
				operation,
				destination_directory,
				temp_directory,
				obligatory_settings.ca_pem_path,
				package,
				has_custom_node_metadata)
			await executor(shoestring_args)

			shoestring_directory.mkdir()
			for filename in ('shoestring.ini', 'overrides.ini', 'node_metadata.json'):
				source_path = Path(temp_directory) / filename
				if source_path.exists():
					shutil.copy(source_path, shoestring_directory)
	else:
		shoestring_args = build_shoestring_command(
			operation,
			destination_directory,
			shoestring_directory,
			obligatory_settings.ca_pem_path,
			package)
		await executor(shoestring_args)
