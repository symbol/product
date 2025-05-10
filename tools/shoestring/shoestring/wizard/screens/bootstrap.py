from pathlib import Path

from prompt_toolkit.filters import Condition
from prompt_toolkit.layout.containers import ConditionalContainer, HSplit, VSplit
from prompt_toolkit.widgets import CheckboxList

from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.wizard.Screen import ScreenDialog
from shoestring.wizard.styles import to_enabled_string
from shoestring.wizard.ValidatingTextBox import ValidatingTextBox


class BootstrapImportSettings:
	def __init__(
		self,
		flag,
		include_node_key_flag,
		path,
	):
		self._flag = flag
		self._include_node_key_flag = include_node_key_flag
		self._path = path

	@property
	def active(self):
		return bool(self._flag.current_values)

	@property
	def include_node_key(self):
		return bool(self._include_node_key_flag.current_values)

	@property
	def path(self):
		return self._path.input.text

	@property
	def tokens(self):
		tokens = [(_('wizard-bootstrap-token-active'), to_enabled_string(self.active))]
		if self.active:
			tokens.extend([
				(_('wizard-bootstrap-token-include-node-key'), to_enabled_string(self.include_node_key)),
				(_('wizard-bootstrap-token-bootstrap-path'), self.path)
			])

		return tokens

	def __repr__(self):
		return (
			f'(active={self.active}, '
			f'include_node_key={self.include_node_key}, '
			f'path=\'{self.path}\')'
		)


def create(screens):
	bootstrap_import_flag = CheckboxList(values=[
		('bootstrap-bool', _('wizard-bootstrap-active'))
	])

	include_node_key_flag = CheckboxList(values=[
		('bootstrap-node-key-bool', _('wizard-bootstrap-node-key'))
	], default_values=['bootstrap-node-key-bool'])

	def _update_node_settings(node_path):
		if not screens:
			return

		node_settings = screens.get('node-settings')
		if node_settings:
			bootstrap_configuration_manager = ConfigurationManager(Path(node_path) / 'server-config/resources')
			values = bootstrap_configuration_manager.lookup('config-node.properties', [
				('localnode', key) for key in ['host', 'friendlyName']
			])
			node_settings._domain_name.input.text = values[0]  # pylint: disable=protected-access
			node_settings._friendly_name.text = values[1]  # pylint: disable=protected-access

	def path_validator(value):
		if not value:
			return False

		node_path = Path(value) / 'nodes/node'
		if node_path.exists() and node_path.is_dir():
			_update_node_settings(node_path)
			return True

		return False

	path = ValidatingTextBox(
		_('wizard-bootstrap-path-label'),
		path_validator,
		_('wizard-bootstrap-path-error-text')
	)

	settings = BootstrapImportSettings(
		bootstrap_import_flag,
		include_node_key_flag,
		path
	)

	def is_valid():
		return not settings.active or path.is_valid

	return ScreenDialog(
		screen_id='bootstrap',
		title=_('wizard-bootstrap-title'),
		body=HSplit([
			bootstrap_import_flag,

			# display more elements here when checked...
			ConditionalContainer(
				HSplit([
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
				filter=Condition(lambda: settings.active)
			)
		]),

		accessor=settings,
		is_valid=is_valid
	)
