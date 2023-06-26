from shoestring.wizard.screens.root_check import create

# pylint: disable=invalid-name


def test_can_create_screen():
	# Act:
	screen = create(None)

	# Assert: check id
	assert 'root-check' == screen.screen_id
