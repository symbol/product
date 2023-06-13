from prompt_toolkit.layout.containers import HSplit
from prompt_toolkit.widgets import Box, Frame, Shadow


class Screen(HSplit):
	"""Class for organizing subsequent configuration screens."""

	def __init__(self, screen_id, child, **kwargs):
		super().__init__(children=[child])

		self.screen_id = screen_id
		self.accessor = kwargs.pop('accessor', None)
		self.should_show = kwargs.pop('should_show', lambda: True)


class ScreenDialog(Screen):
	def __init__(self, screen_id, **kwargs):
		accessor = kwargs.pop('accessor', None)
		should_show = kwargs.pop('should_show', lambda: True)

		super().__init__(
			screen_id,
			Box(Shadow(Frame(style='class:dialog.body', **kwargs))),
			accessor=accessor,
			should_show=should_show)
