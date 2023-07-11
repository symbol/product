from prompt_toolkit.widgets import Label

from shoestring.wizard.screen_loader import load_screens
from shoestring.wizard.Screens import Screens
from shoestring.wizard.TitleBar import TitleBar

# pylint: disable=invalid-name


async def test_can_create_title_bar():
	# Act:
	title_bar = TitleBar(Label(''))

	# Assert:
	assert 'HTML(\'<b>Welcome, pick operation</b>\')' == str(title_bar.text)


async def test_can_set_text():
	# Arrange:
	title_bar = TitleBar(Label(''))

	# Act:
	title_bar.text = 'hello world!'

	# Assert:
	assert 'HTML(\'hello world!\')' == str(title_bar.text)


async def test_can_reset_text():
	# Arrange:
	title_bar = TitleBar(Label(''))
	title_bar.text = 'hello world!'

	# Act:
	title_bar.reset()

	# Assert:
	assert 'HTML(\'<b>Welcome, pick operation</b>\')' == str(title_bar.text)


async def test_can_display_screen_based_navigation():
	# Arrange:
	title_bar = TitleBar(Label(''))

	screens = Screens(None)
	load_screens(screens)

	# Sanity:
	assert 'root-check' == screens.ordered[1].screen_id
	screens.ordered[1].should_show = lambda: False

	screens.next()

	# Act:
	title_bar.update_navigation(screens)

	# Assert:
	expected_text = 'Welcome -&gt; <b>Basic settings</b> -&gt; Harvesting -&gt; Voting -&gt; Node settings -&gt; Certificates -&gt; 🎉'
	assert f'HTML(\'{expected_text}\')' == str(title_bar.text)
