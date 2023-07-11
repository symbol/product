from io import StringIO

from prompt_toolkit import Application
from prompt_toolkit.application import create_app_session
from prompt_toolkit.input import create_pipe_input
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.keys import Keys
from prompt_toolkit.layout.containers import HSplit
from prompt_toolkit.layout.layout import Layout
from prompt_toolkit.output import create_output

from shoestring.wizard.TabbedView import TabList

# region TabList


def create_tab_list():
	values = [
		(0, 'alpha'),
		(1, 'beta'),
		(2, 'gamma'),
		(3, 'delta'),
	]
	tab_list = TabList(values)

	return values, tab_list


def test_can_create_tablist():
	# Act:
	values, tab_list = create_tab_list()

	# Assert:
	assert values == tab_list.values
	assert 0 == tab_list.current_value


class NavigationHelper:
	def __init__(self, tab_list):
		self.tab_list = tab_list
		self.key_bindings = tab_list.control.key_bindings

	def press_and_assert_current_value(self, key, expected_value):
		key_handler = self.key_bindings.get_bindings_for_keys((key, ))[-1].handler
		key_handler(None)

		enter_handler = self.key_bindings.get_bindings_for_keys((Keys.Enter, ))[-1].handler
		enter_handler(None)

		assert expected_value == self.tab_list.current_value


def assert_can_navigate_tablist(key_increase, key_decrease):
	# Arrange:
	_, tab_list = create_tab_list()

	# Act + Assert:
	kb = NavigationHelper(tab_list)    # pylint: disable=invalid-name
	kb.press_and_assert_current_value(key_increase, 1)
	kb.press_and_assert_current_value(key_increase, 2)
	kb.press_and_assert_current_value(key_increase, 3)
	kb.press_and_assert_current_value(key_increase, 3)  # no change
	kb.press_and_assert_current_value(key_increase, 3)  # no change

	kb.press_and_assert_current_value(key_decrease, 2)
	kb.press_and_assert_current_value(key_decrease, 1)
	kb.press_and_assert_current_value(key_decrease, 0)
	kb.press_and_assert_current_value(key_decrease, 0)  # no change


def test_can_navigate_between_tabs_using_up_and_down_keys():  # pylint: disable=invalid-name
	assert_can_navigate_tablist(Keys.Down, Keys.Up)


def test_can_navigate_between_tabs_using_left_and_right_keys():  # pylint: disable=invalid-name
	assert_can_navigate_tablist(Keys.Right, Keys.Left)


def create_mock_application(container):
	main_container = HSplit([container])
	kb = KeyBindings()  # pylint: disable=invalid-name

	@kb.add('c-q')
	def _(event):
		event.app.exit()

	layout = Layout(container=main_container)
	return Application(layout=layout, key_bindings=kb)


async def test_can_show_tabs():
	# Arrange:
	_, tab_list = create_tab_list()
	buffer = StringIO()   # Use to capture stdout
	with create_pipe_input() as inp:
		with create_app_session(output=create_output(stdout=buffer), input=inp):
			# Act:
			app = create_mock_application(tab_list)
			inp.send_bytes(b'\x11')  # send ctrl+q
			await app.run_async()

	buffer.seek(0)
	output = buffer.read()

	# Assert:
	assert '│ * alpha │' in output
	assert '   beta ' in output
	assert '    gamma ' in output
	assert '    delta ' in output

# endregion
