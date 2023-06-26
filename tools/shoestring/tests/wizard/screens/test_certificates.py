from shoestring.wizard.screens.certificates import create

# pylint: disable=invalid-name


def test_can_create_screen():
	# Act:
	screen = create(None)

	# Assert: check id
	assert 'certificates' == screen.screen_id

	# - check defaults
	assert '' == screen.accessor.ca_common_name
	assert '' == screen.accessor.node_common_name

	# - defaults are not valid
	assert not screen.is_valid()


async def test_can_enter_valid_input():  # must be async to assign input.text
	# Arrange:
	screen = create(None)

	# Act:
	screen.accessor._ca_common_name.input.text = 'my ca common name'  # pylint: disable=protected-access
	screen.accessor._node_common_name.input.text = 'my node common name'  # pylint: disable=protected-access

	# Assert: check entered values
	assert 'my ca common name' == screen.accessor.ca_common_name
	assert 'my node common name' == screen.accessor.node_common_name

	# - inputs are valid
	assert screen.is_valid()


async def test_can_generate_diagnostic_accessor_representation():
	# Arrange:
	screen = create(None)
	screen.accessor._ca_common_name.input.text = 'my ca common name'  # pylint: disable=protected-access
	screen.accessor._node_common_name.input.text = 'my node common name'  # pylint: disable=protected-access

	# Assert:
	assert '(ca_common_name=\'my ca common name\', node_common_name=\'my node common name\')' == repr(screen.accessor)
