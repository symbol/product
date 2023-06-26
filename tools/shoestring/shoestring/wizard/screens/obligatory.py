from pathlib import Path

from prompt_toolkit.filters import Always
from prompt_toolkit.layout.containers import HSplit, VSplit
from prompt_toolkit.validation import Validator
from prompt_toolkit.widgets import Box, Label, TextArea

from shoestring.wizard.Screen import ScreenDialog


class ObligatorySettings:
	def __init__(self, destination_directory, ca_pem_path):
		self._destination_directory = destination_directory
		self._ca_pem_path = ca_pem_path

	@property
	def destination_directory(self):
		return self._destination_directory.text

	@property
	def ca_pem_path(self):
		return self._ca_pem_path.text

	def __repr__(self):
		return f'(destination_directory=\'{self.destination_directory}\', ca_pem_path=\'{self.ca_pem_path}\')'


def non_empty_input(x):
	return bool(x)


def create(_screens):
	# needs new certificates?

	destination_directory = TextArea(
		str(Path.home().absolute()),
		multiline=False,
		validator=Validator.from_callable(non_empty_input, 'Input cannot be empty'))

	# window is already created, and Label's style is only expected to be a string, so we need to modify
	# underlying window's style directly
	destination_directory_label = Label('Configuration destination directory')
	destination_directory_label.window.style = lambda: 'class:label,error' if destination_directory.buffer.validation_error else 'class:label'

	destination_directory.buffer.validate_while_typing = Always()

	ca_pem_path = TextArea(
		'ca.key.pem',
		multiline=False,
		validator=Validator.from_callable(non_empty_input, 'Input cannot be empty'))

	ca_pem_path_label = Label('CA PEM file path (main accout key)')
	ca_pem_path_label.window.style = lambda: 'class:label,error' if ca_pem_path.buffer.validation_error else 'class:label'

	ca_pem_path.buffer.validate_while_typing = Always()

	return ScreenDialog(
		screen_id='obligatory',
		title='Obligatory settings',
		body=Box(
			HSplit([
				VSplit([
					HSplit([
						destination_directory_label,
						ca_pem_path_label,
					], width=40),
					HSplit([
						destination_directory,
						ca_pem_path,
					]),
				])
			]),
			padding=1,
		),

		accessor=ObligatorySettings(destination_directory, ca_pem_path),
		is_valid=lambda: not (destination_directory.buffer.validation_error or ca_pem_path.buffer.validation_error)
	)
