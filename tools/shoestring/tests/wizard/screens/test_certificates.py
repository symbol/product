from collections import namedtuple

from shoestring.wizard.screens.certificates import create

NodeSettingsScreen = namedtuple('NodeSettingsScreen', ['domain_name', 'friendly_name'])


# pylint: disable=invalid-name


def test_can_create_screen():
	# Act:
	screen = create({'node-settings': NodeSettingsScreen('symbol.fyi', 'node explorer')})

	# Assert: check id
	assert 'certificates' == screen.screen_id

	# - check defaults
	assert '' == screen.accessor.ca_common_name
	assert '' == screen.accessor.node_common_name

	# - defaults are not valid
	assert not screen.is_valid()


async def test_can_enter_valid_input():  # must be async to assign input.text
	# Arrange:
	screen = create({'node-settings': NodeSettingsScreen('symbol.fyi', 'node explorer')})

	# Act:
	screen.accessor._ca_common_name.input.text = 'my ca common name'  # pylint: disable=protected-access
	screen.accessor._node_common_name.input.text = 'my node common name'  # pylint: disable=protected-access

	# Assert: check entered values
	assert 'my ca common name' == screen.accessor.ca_common_name
	assert 'my node common name' == screen.accessor.node_common_name

	# - inputs are valid
	assert screen.is_valid()


async def test_can_reset_data_when_no_values_have_been_entered():
	# Arrange:
	screen = create({'node-settings': NodeSettingsScreen('symbol.fyi', 'node explorer')})

	# Act:
	screen.reset()

	# Assert:
	assert 'CA node explorer' == screen.accessor.ca_common_name
	assert 'node explorer symbol.fyi' == screen.accessor.node_common_name

	# - inputs not valid
	assert screen.is_valid()


async def test_cannot_reset_data_when_values_have_been_entered():
	# Arrange:
	screen = create({'node-settings': NodeSettingsScreen('symbol.fyi', 'node explorer')})
	screen.accessor._ca_common_name.input.text = 'my ca common name'  # pylint: disable=protected-access
	screen.accessor._node_common_name.input.text = 'my node common name'  # pylint: disable=protected-access

	# Act:
	screen.reset()

	# Assert:
	assert 'my ca common name' == screen.accessor.ca_common_name
	assert 'my node common name' == screen.accessor.node_common_name

	# - inputs are valid
	assert screen.is_valid()


async def test_can_generate_diagnostic_accessor_representation():
	# Arrange:
	screen = create({'node-settings': NodeSettingsScreen('symbol.fyi', 'node explorer')})
	screen.accessor._ca_common_name.input.text = 'my ca common name'  # pylint: disable=protected-access
	screen.accessor._node_common_name.input.text = 'my node common name'  # pylint: disable=protected-access

	# Assert:
	assert '(ca_common_name=\'my ca common name\', node_common_name=\'my node common name\')' == repr(screen.accessor)
	assert [
		('ca common name', 'my ca common name'),
		('node common name', 'my node common name')
	] == screen.accessor.tokens
