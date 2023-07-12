from collections import namedtuple

from prompt_toolkit.widgets import Label

from shoestring.wizard.buttons import create_next_clicked_handler, create_prev_clicked_handler
from shoestring.wizard.Screens import Screens
from shoestring.wizard.ShoestringOperation import ShoestringOperation
from shoestring.wizard.TitleBar import TitleBar

ChildScreen = namedtuple('ChildScreen', ['screen_id', 'accessor', 'should_show'], defaults=[None, None, lambda: True])


# region ButtonTestContext


class MockButton:
	def __init__(self):
		self.handler = None
		self.text = None


class StartScreen:
	def __init__(self):
		self.screen_id = 'welcome'
		self.accessor = self
		self.should_show = lambda: True

		self.operation = ShoestringOperation.RESET_DATA


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

	@property
	def tokens(self):
		return [('mid-token-1', 123), ('mid-token-2', 'abc')]

	def reset(self):
		self.reset_count += 1


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
		screens = Screens(None)
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
