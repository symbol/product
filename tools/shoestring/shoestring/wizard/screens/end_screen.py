
from prompt_toolkit.layout.containers import HSplit, VSplit, to_container
from prompt_toolkit.widgets import Box, Label

from shoestring.wizard.Screen import ScreenDialog


def create(_screens):
	label_container = HSplit([], width=30)
	value_container = HSplit([])

	dialog = ScreenDialog(
		screen_id='end-screen',
		title='writing configuration',
		body=Box(VSplit([
			label_container,
			value_container
		]))
	)

	def add_setting(name, value):
		label_container.children.append(to_container(Label(name)))
		value_container.children.append(to_container(Label(str(value))))

	def clear():
		label_container.children.clear()
		value_container.children.clear()

	dialog.add_setting = add_setting
	dialog.clear = clear
	return dialog
