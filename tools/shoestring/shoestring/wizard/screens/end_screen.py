from prompt_toolkit.widgets import TextArea

from shoestring.wizard.Screen import ScreenDialog


def create(_screens):
	lines = []

	text_area = TextArea(
		text='',
		focusable=True,
		scrollbar=True,
		read_only=True,
		height=16,
	)

	dialog = ScreenDialog(
		screen_id='end-screen',
		title=_('wizard-end-title'),
		body=text_area
	)

	def render_lines():
		return '\n'.join([f'{key:30} {value}' for key, value in lines])

	def add_setting(name, value):
		lines.append((name, str(value)))
		text_area.text = render_lines()

	def clear():
		lines.clear()
		text_area.text = ''

	dialog.add_setting = add_setting
	dialog.clear = clear
	return dialog
