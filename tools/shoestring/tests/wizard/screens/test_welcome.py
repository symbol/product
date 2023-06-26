from shoestring.wizard.screens.welcome import create

# pylint: disable=invalid-name


def test_can_create_screen():
	# Act:
	screen = create(None)

	# Assert: check id
	assert 'welcome' == screen.screen_id
