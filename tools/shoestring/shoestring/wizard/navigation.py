from prompt_toolkit.filters import Condition
from prompt_toolkit.layout.containers import ConditionalContainer, VSplit
from prompt_toolkit.widgets import Box, Button, Shadow


class Navigation:
	def __init__(self, container, prev_button, next_button):
		self.container = container
		self.prev = prev_button
		self.next = next_button


def initialize():
	navigation = Navigation(
		None,
		Button(text='Back'),
		Button(text='Next')
	)

	navigation.container = Box(
		height=4,
		body=VSplit(
			[
				ConditionalContainer(
					Shadow(body=navigation.prev),
					filter=Condition(lambda: navigation.prev)
				),
				navigation.next
			],
			align='CENTER',
			padding=3),
		style='class:navigation'
	)

	return navigation
