from shoestring.wizard.screens.network_type import create

# pylint: disable=invalid-name


def test_can_create_screen():
	# Act:
	screen = create(None)

	# Assert: check id
	assert 'network-type' == screen.screen_id
