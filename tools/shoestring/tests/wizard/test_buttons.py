from collections import namedtuple

from prompt_toolkit.widgets import Label

from shoestring.wizard.buttons import create_next_clicked_handler, create_operation_button_handler, create_prev_clicked_handler
from shoestring.wizard.ScreenContainer import ScreenContainer
from shoestring.wizard.ShoestringOperation import ShoestringOperation
from shoestring.wizard.TitleBar import TitleBar

ChildScreen = namedtuple('ChildScreen', ['screen_id', 'accessor', 'should_show'], defaults=[None, None, lambda: True])


# region ButtonTestContext


class MockButton:
	def __init__(self):
		self.handler = None
		self.text = None


class MockOperationButton:
	def __init__(self, operation):
		self.operation = operation


class StartScreen:
	def __init__(self):
		self.screen_id = 'welcome'
		self.accessor = self
		self.should_show = lambda: True

		self.operation = ShoestringOperation.RESET_DATA
		self.selected_buttons = []

	def select(self, button):
		self.selected_buttons.append(button)


class SkippedScreen:
	def __init__(self):
		self.screen_id = 'skipped'
		self.accessor = self
		self.should_show = lambda: True

	@property
	def tokens(self):
		return [('skipped-token-1', 256), ('skipped-token-2', 'def')]


class MidScreen:
	def __init__(self):
		self.screen_id = 'obligatory'
		self.accessor = self
		self.should_show = lambda: True

		self.reset_count = 0
		self.require_main_private_key_trace = []

	@property
	def tokens(self):
		return [('mid-token-1', 123), ('mid-token-2', 'abc')]

	def reset(self):
		self.reset_count += 1

	def require_main_private_key(self, value):
		self.require_main_private_key_trace.append(value)


class EndScreen:
	def __init__(self):
		self.screen_id = 'end-screen'
		self.accessor = self
		self.should_show = lambda: True

		self.tokens = []

	def clear(self):
		self.tokens.append('clear')

	def add_setting(self, key, value):
		self.tokens.append((key, value))


class ButtonTestContext:
	def __init__(self):
		self.activated_screen = None

		self.screens = self._create_screens()
		self.title_bar = TitleBar(Label(''))
		self.next_button = MockButton()
		self.next_handler = lambda: True

	@staticmethod
	def _create_screens():
		screens = ScreenContainer(None)
		screens.add('start', StartScreen())
		screens.add('skipped', SkippedScreen())
		screens.add('middle', MidScreen())
		screens.add('end', EndScreen())
		return screens

	def activate_screen(self, screen):
		self.activated_screen = screen

# endregion


# pylint: disable=invalid-name


# region create_next_clicked_handler

def test_can_move_to_next_screen_without_reset():
	# Arrange:
	context = ButtonTestContext()
	handler = create_next_clicked_handler(
		context.screens,
		context.activate_screen,
		context.title_bar,
		context.next_button,
		context.next_handler)

	# Act:
	handler()

	# Assert:
	assert 'skipped' == context.activated_screen.screen_id
	assert 'HTML(\'start -&gt; <b>skipped</b> -&gt; middle -&gt; end\')' == str(context.title_bar.text)
	assert not context.next_button.handler
	assert not context.next_button.text


def test_can_move_to_next_screen_with_reset():
	# Arrange:
	context = ButtonTestContext()
	handler = create_next_clicked_handler(
		context.screens,
		context.activate_screen,
		context.title_bar,
		context.next_button,
		context.next_handler)

	context.screens.next()

	# Act:
	handler()

	# Assert:
	assert 'obligatory' == context.activated_screen.screen_id
	assert 'HTML(\'start -&gt; skipped -&gt; <b>middle</b> -&gt; end\')' == str(context.title_bar.text)
	assert not context.next_button.handler
	assert not context.next_button.text

	assert 1 == context.activated_screen.reset_count


def test_can_move_to_end_screen():
	# Arrange:
	context = ButtonTestContext()
	handler = create_next_clicked_handler(
		context.screens,
		context.activate_screen,
		context.title_bar,
		context.next_button,
		context.next_handler)

	context.screens.next()
	context.screens.next()

	# Act:
	handler()

	# Assert:
	assert 'end-screen' == context.activated_screen.screen_id
	assert 'HTML(\'start -&gt; skipped -&gt; middle -&gt; <b>end</b>\')' == str(context.title_bar.text)
	assert context.next_handler == context.next_button.handler
	assert 'Finish!' == context.next_button.text

	# - notice skipped tokens are excluded
	assert [
		'clear',
		('mid-token-1', 123),
		('mid-token-2', 'abc')
	] == context.activated_screen.tokens

# endregion


# region create_prev_clicked_handler

def test_can_move_to_previous_screen_when_previous_screen_exists():
	# Arrange:
	context = ButtonTestContext()
	handler = create_prev_clicked_handler(
		context.screens,
		context.activate_screen,
		context.title_bar,
		context.next_button,
		context.next_handler)

	context.screens.next()

	# Act:
	handler()

	# Assert:
	assert 'welcome' == context.activated_screen.screen_id
	assert 'HTML(\'<b>start</b> -&gt; skipped -&gt; middle -&gt; end\')' == str(context.title_bar.text)
	assert context.next_handler == context.next_button.handler
	assert 'Next' == context.next_button.text


def test_can_move_to_previous_screen_when_no_previous_screen_exists():
	# Arrange:
	context = ButtonTestContext()
	handler = create_prev_clicked_handler(
		context.screens,
		context.activate_screen,
		context.title_bar,
		context.next_button,
		context.next_handler)

	# Act:
	handler()

	# Assert:
	assert not context.activated_screen
	assert 'HTML(\'<b>Welcome, pick operation</b>\')' == str(context.title_bar.text)
	assert context.next_handler == context.next_button.handler
	assert 'Next' == context.next_button.text

# endregion


# region create_operation_button_handler

class OperationButtonTestContext:
	def __init__(self, operation):
		self.screens = ButtonTestContext().screens
		self.button = MockOperationButton(operation)

		self.next_call_count = 0

	def next(self):
		self.next_call_count += 1


def test_can_select_operation_requiring_main_public_key():
	# Arrange:
	context = OperationButtonTestContext(ShoestringOperation.SETUP)
	handler = create_operation_button_handler(context.screens, context.button, context.next)

	# Act:
	handler()

	# Assert:
	assert ['welcome', 'skipped', 'obligatory', 'end-screen'] == context.screens.allowed_list
	assert 1 == context.next_call_count
	assert [context.button] == context.screens.get('welcome').selected_buttons

	# Sanity:
	assert not hasattr(context.screens.current, 'require_main_private_key')


def test_can_select_operation_not_requiring_main_public_key():
	# Arrange:
	context = OperationButtonTestContext(ShoestringOperation.UPGRADE)
	handler = create_operation_button_handler(context.screens, context.button, context.next)

	context.screens.next()
	context.screens.next()  # move to obligatory screen with require_main_private_key

	# Act:
	handler()

	# Assert:
	assert ['welcome', 'obligatory', 'network-type', 'end-screen'] == context.screens.allowed_list
	assert 1 == context.next_call_count
	assert [context.button] == context.screens.get('welcome').selected_buttons

	assert [False] == context.screens.current.require_main_private_key_trace

	# Sanity:
	assert hasattr(context.screens.current, 'require_main_private_key')

# endregion
