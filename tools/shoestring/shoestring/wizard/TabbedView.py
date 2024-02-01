from functools import partial

from prompt_toolkit.filters import Condition
from prompt_toolkit.formatted_text import to_formatted_text
from prompt_toolkit.keys import Keys
from prompt_toolkit.layout.containers import ConditionalContainer, HSplit, VSplit, Window
from prompt_toolkit.mouse_events import MouseEventType
from prompt_toolkit.widgets import RadioList


# copied from prompt_toolkit widgets
class Border:
	"""Box drawing characters. (Thin)"""
	HORIZONTAL = '\u2500'
	VERTICAL = '\u2502'
	TOP_LEFT = '\u250c'
	TOP_RIGHT = '\u2510'
	BOTTOM_LEFT = '\u2514'
	BOTTOM_RIGHT = '\u2518'


class TabList(RadioList):
	"""
	List of tab buttons. Only one can be selected at the same time.

	:param values: List of (value, label) tuples.
	"""

	container_style = 'class:tab-list'  # pylint: disable=invalid-name
	default_style = 'class:tab'  # pylint: disable=invalid-name
	selected_style = 'class:tab-selected'  # pylint: disable=invalid-name
	checked_style = 'class:tab-checked'  # pylint: disable=invalid-name
	multiple_selection = False  # pylint: disable=invalid-name

	def __init__(self, values, default=None):
		super().__init__(values, default)
		self.show_scrollbar = False

		# add left + right key bindings
		# proper bindings are actually at the end of returned lists
		kb = self.control.key_bindings  # pylint: disable=invalid-name
		_up = kb.get_bindings_for_keys((Keys.Up, ))[-1]
		_down = kb.get_bindings_for_keys((Keys.Down, ))[-1]
		kb.add('left',)(_up.handler)
		kb.add('right',)(_down.handler)

	def _get_text_fragments(self):
		def create_mouse_handler(selected_index):
			def mouse_handler(mouse_event):
				"""
				Set `_selected_index` and `current_value` according to the y
				position of the mouse click event.
				"""
				if mouse_event.event_type == MouseEventType.MOUSE_UP:
					self._selected_index = selected_index
					self._handle_enter()

			return mouse_handler

		def fragments_to_items(selected_index, fragments):
			return map(lambda item: (*item, create_mouse_handler(selected_index)), fragments)

		result = []
		for i, value in enumerate(self.values):
			fragments = []
			checked = value[0] == self.current_value
			selected = i == self._selected_index

			style = self.default_style
			if checked:
				style += ' ' + self.checked_style
			if selected:
				style += ' ' + self.selected_style

			# note: the else condition relies on the fact, that values are 0-based indexes
			if checked:
				fragments.append(('', Border.VERTICAL))
			elif i - 1 != self.current_value:
				fragments.append(('', ' '))

			if checked:
				fragments.append((style, ' *'))
			else:
				fragments.append((style, '  '))

			if selected:
				fragments.append(('[SetCursorPosition]', ''))

			fragments.append((style, ' '))
			fragments.extend(to_formatted_text(value[1], style=style))
			fragments.append((style, ' '))

			if checked:
				fragments.append(('', Border.VERTICAL))

			result.extend(fragments_to_items(i, fragments))

		return result


def _create_condition(controller, index):
	return Condition(lambda: controller.current_value == index)


class Tabs(HSplit):
	def __init__(self, controller, items, validators):
		"""
		Creates tabs around controller and items. Controller needs to be
		RadioList or something that exposes `.values` (list of tuples) and `.current_value`.
		"""

		self.controller = controller
		self.items = items
		self.validators = validators

		fill = partial(Window, style='class:frame.border')

		# this builds either top of tab frame or fills with proper amount of whitespace
		# the tabs look like this (spaces are marked with '_' and :)
		#                 +-------+
		# :___xxx_:___yyy_|_*_zzz |___aaa_:___bbb_:
		#
		def frame(width, is_selected):
			return [
				ConditionalContainer(fill(width=1, height=1, char=Border.TOP_LEFT), filter=is_selected),
				ConditionalContainer(fill(width=width, char=Border.HORIZONTAL), filter=is_selected),
				ConditionalContainer(fill(width=1, height=1, char=Border.TOP_RIGHT), filter=is_selected),

				ConditionalContainer(fill(width=width + 1, height=1, char=' '), filter=~is_selected)
			]

		frame_or_space = []
		for index, item in enumerate(controller.values):
			frame_or_space.extend(frame(len(item[1]) + 4, _create_condition(controller, index)))

		tab_pages = []
		for index, item in enumerate(items):
			tab_pages.append(
				ConditionalContainer(
					VSplit([
						fill(width=1, char=Border.VERTICAL),
						item,
						fill(width=1, char=Border.VERTICAL)
					], padding=1),
					filter=_create_condition(controller, index),
				),
			)

		bottom_frame = VSplit([
			fill(width=1, height=1, char=Border.BOTTOM_LEFT),
			fill(char=Border.HORIZONTAL),
			fill(width=1, height=1, char=Border.BOTTOM_RIGHT)
		])

		tab_view = [
			VSplit(frame_or_space),
			controller
		] + tab_pages + [bottom_frame]

		super().__init__(tab_view)

	@property
	def is_valid(self):
		return self.validators[self.controller.current_value]()
