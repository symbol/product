from pathlib import Path

from prompt_toolkit.layout.containers import HSplit, VSplit
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


def create(_screens):
	# needs new certificates?

	destination_directory = TextArea(str(Path.home().absolute()), multiline=False)
	ca_pem_path = TextArea('ca.key.pem', multiline=False)

	return ScreenDialog(
		screen_id='obligatory',
		title='Obligatory settings',
		body=Box(
			VSplit([
				HSplit([
					Label('Configuration destination directory'),
					Label('CA PEM file path (main accout key)'),
				], width=40),
				HSplit([
					destination_directory,
					ca_pem_path,
				]),
			]),
			padding=1,
		),

		accessor=ObligatorySettings(destination_directory, ca_pem_path)
	)
