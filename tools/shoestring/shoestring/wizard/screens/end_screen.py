
from prompt_toolkit.layout.containers import HSplit
from prompt_toolkit.widgets import Label

from shoestring.wizard.Screen import ScreenDialog


def create(_screens):
	return ScreenDialog(
		screen_id='end-screen',
		title='writing configuration',
		body=HSplit([
			Label('alpha'),
			Label('beta')
		], width=30),
	)
