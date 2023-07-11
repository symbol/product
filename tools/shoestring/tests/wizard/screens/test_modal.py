from prompt_toolkit import Application
from prompt_toolkit.application.current import set_app
from prompt_toolkit.layout.containers import FloatContainer, HSplit
from prompt_toolkit.layout.layout import Layout

from shoestring.wizard.screens.modal import create, show


def test_can_create_modal():
	# Act:
	modal = create()

	# Assert:
	assert not modal.visible


def create_mock_application(modal):
	main_container = FloatContainer(
		content=HSplit([]),
		floats=[modal]
	)
	layout = Layout(container=main_container)
	return Application(layout=layout)


async def test_can_show_modal():
	# Arrange:
	modal = create()
	with set_app(create_mock_application(modal)):
		# Act:
		show(modal, 'Hello', 'World', None)

		# Assert:
		assert modal.visible
		assert 'Hello' == modal.frame.title
		assert 'World' == modal.text_control.text


async def test_can_ok_modal_window():
	# Arrange:
	on_close_called = False
	modal = create()

	def on_close_handler():
		nonlocal on_close_called
		on_close_called = True

	with set_app(create_mock_application(modal)):
		show(modal, '', '', on_close_handler)

		# Act:
		modal.ok_button.handler()

		# Assert:
		assert on_close_called
		assert not modal.visible
