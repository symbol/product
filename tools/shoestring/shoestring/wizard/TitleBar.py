from prompt_toolkit.formatted_text import HTML


class TitleBar:
	"""Represents a title bar."""

	def __init__(self, label):
		"""Creates a title bar around a label control."""

		self._label = label
		self.reset()

	@property
	def text(self):
		"""HTML text currently displayed in the title bar."""

		return self._label.text

	@text.setter
	def text(self, value):
		self._label.text = HTML(value)

	def reset(self):
		"""Resets title bar to contain default text."""

		self.text = _('wizard-main-initial-title')

	def update_navigation(self, screens):
		"""Updates the title bar to emphasize the current screen in the navigation bar."""

		current_group = screens.group_name[screens.current_id]
		elements = [f'<b>{name}</b>' if current_group == name else name for name in screens.ordered_group_names]
		self.text = ' -&gt; '.join(elements)
