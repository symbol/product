from shoestring.wizard.screens.node_type import create

# pylint: disable=invalid-name


def test_can_create_screen():
	# Act:
	screen = create(None)

	# Assert: check id
	assert 'node-type' == screen.screen_id
