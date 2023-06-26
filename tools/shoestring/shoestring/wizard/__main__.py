import asyncio
import gettext
import importlib
import tempfile
from collections import namedtuple
from pathlib import Path

from prompt_toolkit import Application
from prompt_toolkit.formatted_text import HTML
from prompt_toolkit.layout.containers import HSplit, Window
from prompt_toolkit.layout.layout import Layout
from prompt_toolkit.widgets import Label

from shoestring.commands.setup import run_main as run_setup
from shoestring.wizard.SetupFiles import prepare_overrides_file, prepare_shoestring_files

from . import keybindings, navigation, styles
from .Screens import Screens

from prompt_toolkit.filters.base import Condition
from prompt_toolkit.layout.containers import ConditionalContainer, Window
from prompt_toolkit.layout.controls import FormattedTextControl
from prompt_toolkit.widgets.toolbars import ValidationToolbar


SetupArgs = namedtuple('SetupArgs', ['config', 'package', 'directory', 'overrides', 'ca_key_path'])
ScreenGroup = namedtuple('ScreenGroup', ['group_name', 'screen_names'])


def prepare_screens(screens):
	screen_setup = [
		ScreenGroup('Welcome', ['welcome', 'root_check']),
		ScreenGroup('Basic settings', ['obligatory', 'network_type', 'node_type']),

		ScreenGroup('Certificates', ['certificates']),
		ScreenGroup('Harvesting', ['harvesting']),
		ScreenGroup('Voting', ['voting']),

		ScreenGroup('Node settings', ['node_settings']),

		ScreenGroup('🎉', ['end_screen'])
	]

	for group in screen_setup:
		for name in group.screen_names:
			module = importlib.import_module(f'shoestring.wizard.screens.{name.replace("-", "_")}')
			screen = module.create(screens)
			screens.add(group.group_name, screen)


def update_titlebar(root_container, screens):
	current_group = screens.group_name[screens.current_id]
	elements = [f'<b>{name}</b>' if current_group == name else name for name in screens.ordered_group_names]
	root_container.children[0].content.text = HTML(' -&gt; '.join(elements))


async def main():
	lang = gettext.translation('messages', localedir='lang', languages=('ja', 'en'))  # TODO: how should we detect language?
	lang.install()

	key_bindings = keybindings.initialize()
	app_styles = styles.initialize()
	navbar = navigation.initialize()

	screens = Screens(navbar)
	prepare_screens(screens)

	main_container = screens.current
	root_container = HSplit([
		# note: we can use this titlebar to show where are we in the wizard
		Label(style='class:titlebar', text=HTML('')),
		Window(height=1, char='-'),

		main_container,
		ValidationToolbar(),

		ConditionalContainer(
			Window(
				FormattedTextControl('one or more inputs have errors that need fixing'),
				height=1,
				style='class:validation-toolbar'
			),
			filter=Condition(lambda: not screens.current.is_valid()),
		),

		navbar.container
	])
	update_titlebar(root_container, screens)

	layout = Layout(root_container, focused_element=navbar.next)

	app = Application(layout, key_bindings=key_bindings, style=app_styles, full_screen=True)


	def prev_clicked():
		root_container.children[2] = screens.previous()
		update_titlebar(root_container, screens)

	def next_clicked():
		root_container.children[2] = screens.next()
		update_titlebar(root_container, screens)

		if 'end-screen' != screens.ordered[screens.current_id].screen_id:
			layout.focus(root_container.children[2])
		else:

			# generate_settings() will go here

			navbar.next.text = 'Finish!'
			navbar.next.handler = app.exit

	navbar.prev.handler = prev_clicked
	navbar.next.handler = next_clicked

	result = await app.run_async()

	# second condition is temporarily added, to break processing when ctrl-q or ctrl-c is pressed
	if result or navbar.next.text != 'Finish!':
		return

	# TODO: temporary here, move up
	with tempfile.TemporaryDirectory() as temp_directory:
		prepare_overrides_file(screens, Path(temp_directory) / 'overrides.ini')
		await prepare_shoestring_files(screens, Path(temp_directory))

		obligatory_settings = screens.get('obligatory')
		destination_directory = Path(obligatory_settings.destination_directory)

		await run_setup(SetupArgs(
			config=Path(temp_directory) / 'shoestring.ini',
			package=screens.get('network-type').current_value,
			directory=destination_directory.absolute(),
			overrides=Path(temp_directory) / 'overrides.ini',
			ca_key_path=Path(obligatory_settings.ca_pem_path)
		))

	print('Done 👋')


if '__main__' == __name__:
	asyncio.run(main())
