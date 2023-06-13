from prompt_toolkit.layout import FormattedTextControl
from prompt_toolkit.layout.containers import HSplit, Window, WindowAlign
from prompt_toolkit.widgets import Box, Shadow, TextArea

from shoestring.wizard.Screen import Screen


def create(_screens):
	return Screen(
		'welcome',
		Box(Shadow(
			HSplit([
				Window(
					FormattedTextControl(_('wizard-welcome-title')),
					align=WindowAlign.CENTER
				),
				TextArea(
					text=_('wizard-welcome-steps'),
					read_only=True
				)
			])
		))
	)
