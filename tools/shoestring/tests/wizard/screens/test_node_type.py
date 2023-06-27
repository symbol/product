from shoestring.wizard.screens.node_type import create

# pylint: disable=invalid-name


def test_can_create_screen():
	# Act:
	screen = create(None)

	# Assert: check id
	assert 'node-type' == screen.screen_id


def test_can_generate_diagnostic_accessor_representation():
	# Arrange:
	screen = create(None)

	# Act + Assert:
	assert '(node_type=\'peer\')' == repr(screen.accessor)
	assert [('node type', 'peer')] == screen.accessor.tokens
