from pathlib import Path

from prompt_toolkit.layout.containers import HSplit, VSplit
from prompt_toolkit.widgets import CheckboxList

from shoestring.wizard.Screen import ScreenDialog
from shoestring.wizard.styles import to_enabled_string
from shoestring.wizard.ValidatingTextBox import ValidatingTextBox


class BootstrapImportSettings:
	def __init__(self, include_node_key_flag, path):
		self._include_node_key_flag = include_node_key_flag
		self._path = path

	@property
	def include_node_key(self):
		return bool(self._include_node_key_flag.current_values)

	@property
	def path(self):
		return self._path.input.text

	@property
	def tokens(self):
		return [
			(_('wizard-bootstrap-token-include-node-key'), to_enabled_string(self.include_node_key)),
			(_('wizard-bootstrap-token-bootstrap-path'), self.path)
		]

	def __repr__(self):
		return (
			f'(include_node_key={self.include_node_key}, '
			f'path=\'{self.path}\')'
		)


def create(_screens):
	include_node_key_flag = CheckboxList(values=[
		('bootstrap-node-key-bool', _('wizard-bootstrap-node-key'))
	], default_values=['bootstrap-node-key-bool'])

	def path_validator(value):
		if not value:
			return False

		node_path = Path(value) / 'nodes/node'
		return node_path.exists() and node_path.is_dir()

	path = ValidatingTextBox(
		_('wizard-bootstrap-path-label'),
		path_validator,
		_('wizard-bootstrap-path-error-text')
	)

	settings = BootstrapImportSettings(
		include_node_key_flag,
		path
	)

	def is_valid():
		return path.is_valid

	return ScreenDialog(
		screen_id='bootstrap',
		title=_('wizard-bootstrap-title'),
		body=HSplit([
			include_node_key_flag,
			VSplit([
				HSplit([
					path.label
				], width=30),
				HSplit([
					path.input
				])
			])
		]),

		accessor=settings,
		is_valid=is_valid
	)
