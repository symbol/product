from io import StringIO

from prompt_toolkit import Application
from prompt_toolkit.application import create_app_session
from prompt_toolkit.input import create_pipe_input
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.layout.containers import HSplit
from prompt_toolkit.layout.layout import Layout
from prompt_toolkit.output import create_output

from shoestring.wizard.screens.end_screen import create

# pylint: disable=invalid-name


def test_can_create_screen():
	# Act:
	screen = create(None)

	# Assert: check id
	assert 'end-screen' == screen.screen_id


async def _get_screen_output(screen):
	def create_mock_application(container):
		kb = KeyBindings()  # pylint: disable=invalid-name

		@kb.add('c-q')
		def _(event):
			event.app.exit()

		layout = Layout(container=HSplit([container]))
		return Application(layout=layout, key_bindings=kb)

	buffer = StringIO()   # Use to capture stdout
	with create_pipe_input() as inp:
		with create_app_session(output=create_output(stdout=buffer), input=inp):
			app = create_mock_application(screen)
			inp.send_bytes(b'\x11')  # send ctrl+q
			await app.run_async()

	buffer.seek(0)
	return buffer.read()


async def test_can_add_settings():
	# Arrange:
	screen = create(None)

	# Act:
	screen.add_setting('foo', 'bar')
	screen.add_setting('alpha', 'omega')

	# Assert:
	output = await _get_screen_output(screen)
	assert 'foo' in output
	assert 'bar' in output
	assert 'alpha' in output
	assert 'omega' in output


async def test_can_clear_settings():
	# Arrange:
	screen = create(None)
	screen.add_setting('foo', 'bar')
	screen.add_setting('alpha', 'omega')

	# Act:
	screen.clear()

	# Assert:
	output = await _get_screen_output(screen)
	assert 'foo' not in output
	assert 'bar' not in output
	assert 'alpha' not in output
	assert 'omega' not in output
