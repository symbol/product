from prompt_toolkit.layout import FormattedTextControl
from prompt_toolkit.layout.containers import HSplit, Window, WindowAlign
from prompt_toolkit.widgets import Box, Button, Shadow

from shoestring.wizard.Screen import Screen
from shoestring.wizard.ShoestringOperation import ShoestringOperation


class ButtonWithOperation(Button):
	def __init__(self, operation, label, width=12):
		super().__init__(label, width=width)
		self.operation = operation


class WelcomeSettings:
	def __init__(self, buttons):
		self.buttons = buttons
		self.operation_label = None
		self.operation = None

	def select(self, button):
		self.operation_label = button.text
		self.operation = button.operation

	@property
	def tokens(self):
		return [('command', self.operation_label)]

	def __repr__(self):
		return f'(command=\'{self.operation_label}\')'


def create(_screens):
	values = [
		(ShoestringOperation.SETUP, 'setup'),
		(ShoestringOperation.UPGRADE, 'upgrade'),
		(ShoestringOperation.RESET_DATA, 'reset data'),
		(ShoestringOperation.RENEW_CERTIFICATES, 'renew certificates'),
		(ShoestringOperation.RENEW_VOTING_KEYS, 'renew voting keys')
	]

	max_label = max(len(label) for (_, label) in values)
	buttons = [
		ButtonWithOperation(operation, label, width=max_label + 3)
		for (operation, label) in values
	]

	return Screen(
		'welcome',
		Box(
			Shadow(
				HSplit([
					Window(
						FormattedTextControl(_('wizard-welcome-title')),
						align=WindowAlign.CENTER
					),
					Box(
						HSplit([
							Box(button, padding_top=1, padding_bottom=0) for button in buttons
						]),
						style='class:navigation'
					)
				], style='class:dialog.body')
			)
		),
		accessor=WelcomeSettings(buttons),
		hide_navbar=True
	)
