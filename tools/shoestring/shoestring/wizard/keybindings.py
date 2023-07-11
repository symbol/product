from prompt_toolkit.filters.base import Condition
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.key_binding.bindings.focus import focus_next, focus_previous


def initialize(is_modal_visible):
	kb = KeyBindings()  # pylint: disable=invalid-name

	kb.add('tab', filter=~Condition(is_modal_visible))(focus_next)
	kb.add('s-tab', filter=~Condition(is_modal_visible))(focus_previous)

	@kb.add('c-c')
	@kb.add('c-q')
	def _(event):
		event.app.exit()

	return kb
