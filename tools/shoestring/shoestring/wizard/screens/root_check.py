import os

from prompt_toolkit.application.current import get_app
from prompt_toolkit.layout import FormattedTextControl
from prompt_toolkit.layout.containers import HSplit, Window, WindowAlign
from prompt_toolkit.widgets import Box, Shadow, TextArea

from shoestring.wizard.Screen import Screen


def is_running_as_root(screens):
	if os.getuid() != 0:
		return False

	screens.navbar.prev = None
	screens.navbar.next.text = 'QUIT'
	screens.navbar.next.handler = lambda: get_app().exit(1)
	return True


def create(screens):
	return Screen(
		'root-check',
		Box(Shadow(
			HSplit([
				Window(
					FormattedTextControl('root check'),
					align=WindowAlign.CENTER
				),
				TextArea(
					text=(
						'Wizard detected it is running as ROOT user, shoestring does not support such setup.\n'
						'Please create a user account with access to \'docker\'.'
					),
					read_only=True
				)
			])
		)),

		should_show=lambda: is_running_as_root(screens)
	)
