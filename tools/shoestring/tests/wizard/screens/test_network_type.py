from shoestring.wizard.screens.network_type import create

# pylint: disable=invalid-name


def test_can_create_screen():
	# Act:
	screen = create(None)

	# Assert: check id
	assert 'network-type' == screen.screen_id


async def test_can_generate_diagnostic_accessor_representation():
	# Arrange:
	screen = create(None)
	screen.accessor._radio_list.current_value = 'sai'  # pylint: disable=protected-access

	# Act + Assert:
	assert '(network_type=\'sai\')' == repr(screen.accessor)
	assert [('network type', 'sai')] == screen.accessor.tokens
