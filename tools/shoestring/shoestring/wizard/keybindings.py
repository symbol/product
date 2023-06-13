from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.key_binding.bindings.focus import focus_next, focus_previous


def initialize():
	kb = KeyBindings()  # pylint: disable=invalid-name

	kb.add('tab')(focus_next)
	kb.add('s-tab')(focus_previous)

	@kb.add('c-c')
	@kb.add('c-q')
	def _(event):
		event.app.exit()

	return kb
