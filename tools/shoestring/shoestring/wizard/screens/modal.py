from functools import partial

from prompt_toolkit.application import get_app
from prompt_toolkit.filters.base import Condition
from prompt_toolkit.layout.containers import ConditionalContainer, Float, HSplit, VSplit, Window
from prompt_toolkit.layout.controls import FormattedTextControl
from prompt_toolkit.layout.dimension import Dimension as D
from prompt_toolkit.widgets import Box, Button, Frame, Shadow


def _hide_me(message_box_float):
	message_box_float.visible = False
	message_box_float.on_close()


def show(message_box_float, title=None, text=None, on_close_callback=None):
	message_box_float.frame.title = title
	message_box_float.text_control.text = text
	message_box_float.visible = True
	message_box_float.on_close = on_close_callback

	get_app().layout.focus(message_box_float.ok_button)


def create():
	button = Button(text=_('wizard-modal-button-ok'))
	text_control = FormattedTextControl('')
	frame = Frame(
		HSplit([
			Box(
				body=Window(text_control, width=60, height=3),
				padding=D(preferred=1, max=1),
				padding_bottom=0,
			),
			Box(
				body=VSplit([button], padding=1),  # key_bindings=new_buttons_keybindings
				height=D(min=1, max=3, preferred=3),
			),
		]),
		style='class:dialog.body',
		title='hi, hello'
	)

	message_box_float = Float(
		ConditionalContainer(
			Shadow(frame),
			filter=Condition(lambda: message_box_float.visible)
		)
	)

	message_box_float.visible = False
	message_box_float.ok_button = button
	message_box_float.frame = frame
	message_box_float.text_control = text_control

	button.handler = partial(_hide_me, message_box_float)

	return message_box_float
