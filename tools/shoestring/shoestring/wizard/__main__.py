import asyncio
import gettext
import os
from functools import partial

from prompt_toolkit import Application
from prompt_toolkit.filters.base import Condition
from prompt_toolkit.formatted_text import HTML
from prompt_toolkit.layout.containers import ConditionalContainer, FloatContainer, HSplit, Window
from prompt_toolkit.layout.controls import FormattedTextControl
from prompt_toolkit.layout.layout import Layout
from prompt_toolkit.widgets import Label
from prompt_toolkit.widgets.toolbars import ValidationToolbar
from zenlog import log

from shoestring.__main__ import main as shoestring_main
from shoestring.wizard.screens.modal import create as create_message_box_float
from shoestring.wizard.screens.modal import show as show_message_box
from shoestring.wizard.ShoestringOperation import requires_ca_key_path

from . import keybindings, navigation, styles
from .buttons import create_next_clicked_handler, create_prev_clicked_handler
from .screen_loader import load_screens, lookup_screens_list_for_operation
from .Screens import Screens
from .shoestring_dispatcher import dispatch_shoestring_command
from .TitleBar import TitleBar


async def main():  # pylint: disable=too-many-locals, too-many-statements
	lang = gettext.translation('messages', localedir='lang', languages=(os.environ.get('LC_MESSAGES', 'en'), 'en'))
	lang.install()

	key_bindings = keybindings.initialize()
	app_styles = styles.initialize()
	navbar = navigation.initialize()

	screens = Screens(navbar)
	load_screens(screens)
	message_box_float = create_message_box_float()
	screens.message_box = partial(show_message_box, message_box_float)

	main_container = screens.current
	root_container = HSplit([
		# note: we can use this titlebar to show where are we in the wizard
		Label(style='class:titlebar', text=HTML('')),
		Window(height=1, char='-'),

		main_container,
		ValidationToolbar(),

		ConditionalContainer(
			Window(
				FormattedTextControl('one or more inputs have errors that need fixing'),
				height=1,
				style='class:validation-toolbar'
			),
			filter=Condition(lambda: not screens.current.is_valid()),
		),

		ConditionalContainer(
			navbar.container,
			filter=Condition(lambda: not screens.current.hide_navbar),
		),
	])
	navbar.next.state_filter = Condition(lambda: not screens.current.is_valid())

	title_bar = TitleBar(root_container.children[0].content)

	root_with_dialog_box = FloatContainer(
		content=root_container,
		floats=[message_box_float],
		modal=True
	)
	layout = Layout(root_with_dialog_box, focused_element=navbar.next)

	app = Application(layout, key_bindings=key_bindings, style=app_styles, full_screen=True)

	layout.focus(root_container.children[2])

	# set navigation bar button handlers

	def activate_screen(screen):
		root_container.children[2] = screen

		if 'end-screen' != screen.screen_id:  # cannot be focused because it has no input controls
			layout.focus(screen)

	next_clicked = create_next_clicked_handler(screens, activate_screen, title_bar, navbar.next, app.exit)
	navbar.next.handler = next_clicked
	navbar.prev.handler = create_prev_clicked_handler(screens, activate_screen, title_bar, navbar.next, next_clicked)

	# set welcome screen button handlers
	def create_button_handler(button):
		def button_handler():
			allowed_screens_list = lookup_screens_list_for_operation(screens, button.operation)
			screens.set_list(allowed_screens_list)
			next_clicked()

			screens.current.require_main_private_key(requires_ca_key_path(button.operation))
			screens.get('welcome').select(button)

		return button_handler

	for button in screens.get('welcome').buttons:
		button.handler = create_button_handler(button)

	result = await app.run_async()

	# second condition is temporarily added, to break processing when ctrl-q or ctrl-c is pressed
	if result or navbar.next.text != _('wizard-button-finish'):
		return

	# TODO: temporary here, move up
	await dispatch_shoestring_command(screens, shoestring_main)

	log.info(_('wizard-main-done'))


if '__main__' == __name__:
	asyncio.run(main())
