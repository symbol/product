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
	screens.navbar.next.text = _('wizard-button-quit')
	screens.navbar.next.handler = lambda: get_app().exit(1)
	return True


def create(screens):
	return Screen(
		'root-check',
		Box(Shadow(
			HSplit([
				Window(FormattedTextControl(_('wizard-root-check-title')), align=WindowAlign.CENTER),
				TextArea(text=(_('wizard-root-check-error-text')), read_only=True)
			])
		)),

		should_show=lambda: is_running_as_root(screens)
	)
