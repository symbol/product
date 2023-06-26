from pathlib import Path

from prompt_toolkit.layout.containers import HSplit, VSplit
from prompt_toolkit.widgets import Box

from shoestring.wizard.Screen import ScreenDialog
from shoestring.wizard.ValidatingTextBox import ValidatingTextBox, is_directory_path, is_file_path


class ObligatorySettings:
	def __init__(self, destination_directory, ca_pem_path):
		self._destination_directory = destination_directory
		self._ca_pem_path = ca_pem_path

	@property
	def destination_directory(self):
		return self._destination_directory.input.text

	@property
	def ca_pem_path(self):
		return self._ca_pem_path.input.text

	def __repr__(self):
		return f'(destination_directory=\'{self.destination_directory}\', ca_pem_path=\'{self.ca_pem_path}\')'


def create(_screens):
	destination_directory = ValidatingTextBox(
		'Configuration destination directory',
		is_directory_path,
		'destination directory must be a valid directory',
		str(Path.home().absolute() / 'symbol'))

	ca_pem_path = ValidatingTextBox(
		'CA PEM file path (main account)',
		is_file_path,
		'ca pem file path must be a valid file',
		'ca.key.pem')

	return ScreenDialog(
		screen_id='obligatory',
		title='Obligatory settings',
		body=Box(
			HSplit([
				VSplit([
					HSplit([
						destination_directory.label,
						ca_pem_path.label
					], width=40),
					HSplit([
						destination_directory.input,
						ca_pem_path.input
					]),
				])
			]),
			padding=1
		),

		accessor=ObligatorySettings(destination_directory, ca_pem_path),
		is_valid=lambda: destination_directory.is_valid and ca_pem_path.is_valid
	)
