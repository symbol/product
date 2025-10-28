from prompt_toolkit.utils import get_cwidth
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
		# Adjust indentation for multibyte strings
		def pad(key, width):
			key_width = get_cwidth(key)
			return key + ' ' * (width - key_width)
		max_width = max((get_cwidth(key) for key, _ in lines), default=0)
		return '\n'.join([f'{pad(key, max_width)} {value}' for key, value in lines])

	def add_setting(name, value):
		lines.append((name, str(value)))
		text_area.text = render_lines()

	def clear():
		lines.clear()
		text_area.text = ''

	dialog.add_setting = add_setting
	dialog.clear = clear
	return dialog
