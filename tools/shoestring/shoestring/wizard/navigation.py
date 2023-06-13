from collections import namedtuple

from prompt_toolkit.layout.containers import VSplit
from prompt_toolkit.widgets import Box, Button, Shadow

Navigation = namedtuple('Navigation', ['container', 'prev', 'next'])


def initialize():
	prev_button = Button(text='Back')
	next_button = Button(text='Next')
	navigation = Box(
		height=4,
		body=VSplit([Shadow(body=prev_button), next_button], align='CENTER', padding=3),
		style='class:navigation'
	)

	return Navigation(navigation, prev_button, next_button)
