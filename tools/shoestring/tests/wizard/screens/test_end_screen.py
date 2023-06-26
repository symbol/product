from shoestring.wizard.screens.end_screen import create

# pylint: disable=invalid-name


def test_can_create_screen():
	# Act:
	screen = create(None)

	# Assert: check id
	assert 'end-screen' == screen.screen_id
