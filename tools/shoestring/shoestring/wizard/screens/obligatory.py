from functools import partial
from pathlib import Path

from prompt_toolkit.buffer import ValidationState
from prompt_toolkit.filters import Always, Condition, Never
from prompt_toolkit.layout.containers import ConditionalContainer, HSplit, VSplit
from prompt_toolkit.validation import DynamicValidator, Validator
from prompt_toolkit.widgets import Box, Button, Label
from symbolchain.CryptoTypes import PrivateKey
from symbolchain.PrivateKeyStorage import PrivateKeyStorage

from shoestring.wizard.Screen import ScreenDialog
from shoestring.wizard.TabbedView import TabList, Tabs
from shoestring.wizard.ValidatingTextBox import (
	ValidatingTextBox,
	does_not_exist,
	is_directory_path,
	is_file_path,
	is_hex_private_key_string
)


class ObligatorySettings:
	def __init__(self, destination_directory, ca_pem_path):
		self._destination_directory = destination_directory
		self._ca_pem_path = ca_pem_path
		self.is_main_private_key_required = True

	@property
	def destination_directory(self):
		return self._destination_directory.input.text

	@property
	def ca_pem_path(self):
		return self._ca_pem_path.input.text

	@property
	def tokens(self):
		tokens = [(_('wizard-obligatory-token-destination-directory'), self.destination_directory)]
		if self.is_main_private_key_required:
			tokens.append((_('wizard-obligatory-token-ca-pem-path'), self.ca_pem_path))

		return tokens

	def __repr__(self):
		return f'(destination_directory=\'{self.destination_directory}\', ca_pem_path=\'{self.ca_pem_path}\')'


def is_path_to_non_existing_pem_file(value):
	return does_not_exist(value) and value.lower().endswith('.pem')


# this is needed to create single DynamicValidator for ca_pem_path input box
def create_validator_selector(tab_list, messages):
	def get_validator():
		# TODO: hardcoded
		if 0 == tab_list.current_value:
			return Validator.from_callable(is_file_path, messages[0])

		return Validator.from_callable(is_path_to_non_existing_pem_file, messages[tab_list.current_value])

	return get_validator


# this is needed, cause we need to reset validation state when changing tabs
def revalidate_ca_pem_path(ca_pem_path):
	ca_pem_path.input.buffer.validation_state = ValidationState.UNKNOWN
	return ca_pem_path.input.buffer.validate()


def generate_handler(screens, ca_pem_path, on_close_callback):
	if not ca_pem_path.is_valid:
		return

	filepath = Path(ca_pem_path.input.text)
	storage = PrivateKeyStorage(filepath.parent.absolute())

	if filepath.suffix == '.pem':
		storage.save(filepath.stem, PrivateKey.random())

	screens.message_box(
		title=_('wizard-dialog-message-generation-title'),
		text=_('wizard-dialog-message-generation-text'),
		on_close_callback=on_close_callback)


def import_handler(screens, ca_pem_path, on_close_callback, private_key_hex):
	if not ca_pem_path.is_valid or not private_key_hex.is_valid:
		return

	filepath = Path(ca_pem_path.input.text)
	storage = PrivateKeyStorage(filepath.parent.absolute())

	if filepath.suffix == '.pem':
		storage.save(filepath.stem, PrivateKey(private_key_hex.input.text))

	screens.message_box(
		title=_('wizard-dialog-message-import-title'),
		text=_('wizard-dialog-message-import-text'),
		on_close_callback=on_close_callback)


def create(screens):
	destination_directory = ValidatingTextBox(
		_('wizard-obligatory-destination-directory-label'),
		is_directory_path,
		_('wizard-obligatory-destination-directory-error-text'),
		str(Path.home().absolute() / 'symbol'))

	ca_key_tab_list = TabList([
		(0, _('wizard-obligatory-priv-ca')),
		(1, _('wizard-obligatory-priv-import-hex')),
		(2, _('wizard-obligatory-priv-generate-new'))
	])

	dynamic_validator = DynamicValidator(
		create_validator_selector(
			ca_key_tab_list,
			[
				_('wizard-obligatory-ca-pem-path-error-text'),
				_('wizard-obligatory-ca-pem-path-error-text-not-exist'),
				_('wizard-obligatory-ca-pem-path-error-text-not-exist')
			]))

	ca_pem_path = ValidatingTextBox(
		_('wizard-obligatory-ca-pem-path-label'),
		dynamic_validator,
		_('wizard-obligatory-ca-pem-path-error-text'),
		'ca.key.pem')

	private_key_hex = ValidatingTextBox(
		_('wizard-obligatory-private-key-hex-label'),
		is_hex_private_key_string,
		_('wizard-obligatory-private-key-hex-error-text'))

	# note: deliberately wrapped in condition to allow swap later
	show_private_key_tabs = Condition(Always())

	button_import = Button(_('wizard-obligatory-import-button'))
	button_generate = Button(_('wizard-obligatory-generate-button'))

	main_private_key_tabs = Tabs(ca_key_tab_list, [
		HSplit([
			Label(_('wizard-obligatory-private-key-ca-pem-path-description'))
		], style='class:tab-list'),
		HSplit([
			Label(_('wizard-obligatory-private-key-hex-description')),
			VSplit([
				HSplit([private_key_hex.label], width=40),
				HSplit([private_key_hex.input]),
			]),
			Box(button_import)
		], style='class:tab-list'),
		HSplit([
			Label(_('wizard-obligatory-private-key-generate-description')),
			Box(button_generate)
		], style='class:tab-list'),
	], [
		lambda: True,
		lambda: private_key_hex.is_valid,
		lambda: True,
	])

	def switch_to_first_tab():
		ca_key_tab_list.current_value = 0

	button_generate.handler = partial(generate_handler, screens, ca_pem_path, switch_to_first_tab)
	button_import.handler = partial(import_handler, screens, ca_pem_path, switch_to_first_tab, private_key_hex)

	dialog = ScreenDialog(
		screen_id='obligatory',
		title=_('wizard-obligatory-title'),
		body=Box(
			HSplit([
				VSplit([
					HSplit([destination_directory.label], width=40),
					HSplit([destination_directory.input])
				]),
				ConditionalContainer(
					VSplit([
						HSplit([ca_pem_path.label], width=40),
						HSplit([ca_pem_path.input])
					]),
					filter=show_private_key_tabs
				),
				ConditionalContainer(main_private_key_tabs, filter=show_private_key_tabs)
			], width=200),
			padding=1
		),

		accessor=ObligatorySettings(destination_directory, ca_pem_path),
		is_valid=lambda: destination_directory.is_valid and (
			not dialog.accessor.is_main_private_key_required or (
				revalidate_ca_pem_path(ca_pem_path) and main_private_key_tabs.is_valid
			)
		)
	)

	def require_main_private_key(require):
		show_private_key_tabs.func = Always() if require else Never()
		dialog.accessor.is_main_private_key_required = require

	dialog.require_main_private_key = require_main_private_key
	return dialog
