from prompt_toolkit.filters import Condition
from prompt_toolkit.layout.containers import ConditionalContainer, VSplit
from prompt_toolkit.widgets import Box, Button, Shadow


class Navigation:
	def __init__(self, container, prev_button, next_button):
		self.container = container
		self.prev = prev_button
		self.next = next_button


class ExtendedButton(Button):
	def __init__(self, text):
		super().__init__(text)

		self._handler = None
		self.state_filter = lambda: False

		self._previous_style = self.window.style
		self.window.style = self.conditional_style

	def conditional_style(self):
		original_style = self._previous_style()
		return original_style + ('.inactive' if self.state_filter() else '')

	@property
	def handler(self):
		return self._handler if not self.state_filter() else None

	@handler.setter
	def handler(self, handler):
		self._handler = handler


def initialize():
	navigation = Navigation(
		None,
		Button(text='Back'),
		ExtendedButton(text='Next')
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
