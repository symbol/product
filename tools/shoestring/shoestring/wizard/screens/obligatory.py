from pathlib import Path

from prompt_toolkit.filters import Always, Condition, Never
from prompt_toolkit.layout.containers import ConditionalContainer, HSplit, VSplit
from prompt_toolkit.widgets import Box

from shoestring.wizard.Screen import ScreenDialog
from shoestring.wizard.ValidatingTextBox import ValidatingTextBox, is_directory_path, is_file_path


class ObligatorySettings:
	def __init__(self, destination_directory, ca_pem_path):
		self._destination_directory = destination_directory
		self._ca_pem_path = ca_pem_path
		self.is_ca_pem_path_required = True

	@property
	def destination_directory(self):
		return self._destination_directory.input.text

	@property
	def ca_pem_path(self):
		return self._ca_pem_path.input.text

	@property
	def tokens(self):
		tokens = [(_('wizard-obligatory-token-destination-directory'), self.destination_directory)]
		if self.is_ca_pem_path_required:
			tokens.append((_('wizard-obligatory-token-ca-pem-path'), self.ca_pem_path))

		return tokens

	def __repr__(self):
		return f'(destination_directory=\'{self.destination_directory}\', ca_pem_path=\'{self.ca_pem_path}\')'


def create(_screens):
	destination_directory = ValidatingTextBox(
		_('wizard-obligatory-destination-directory-label'),
		is_directory_path,
		_('wizard-obligatory-destination-directory-error-text'),
		str(Path.home().absolute() / 'symbol'))

	ca_pem_path = ValidatingTextBox(
		_('wizard-obligatory-ca-pem-path-label'),
		is_file_path,
		_('wizard-obligatory-ca-pem-path-error-text'),
		'ca.key.pem')

	# note: deliberately wrapped in condition to allow swap later
	show_ca_pem_path = Condition(Always())
	dialog = ScreenDialog(
		screen_id='obligatory',
		title=_('wizard-obligatory-title'),
		body=Box(
			HSplit([
				VSplit([
					HSplit([
						destination_directory.label,
						ConditionalContainer(ca_pem_path.label, filter=show_ca_pem_path)
					], width=40),
					HSplit([
						destination_directory.input,
						ConditionalContainer(ca_pem_path.input, filter=show_ca_pem_path)
					]),
				])
			]),
			padding=1
		),

		accessor=ObligatorySettings(destination_directory, ca_pem_path),
		is_valid=lambda: destination_directory.is_valid and (not dialog.accessor.is_ca_pem_path_required or ca_pem_path.is_valid)
	)

	def require_ca_pem_path(require):
		show_ca_pem_path.func = Always() if require else Never()
		dialog.accessor.is_ca_pem_path_required = require

	dialog.require_ca_pem_path = require_ca_pem_path
	return dialog
