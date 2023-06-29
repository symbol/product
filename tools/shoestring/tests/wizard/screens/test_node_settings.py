from collections import namedtuple

from shoestring.wizard.screens.node_settings import create

SingleValueScreen = namedtuple('SingleValueScreen', ['current_value'])


# pylint: disable=invalid-name


def test_can_create_screen():
	# Act:
	screen = create({'node-type': SingleValueScreen('dual')})

	# Assert: check id
	assert 'node-settings' == screen.screen_id

	# - check defaults
	assert not screen.accessor.api_https
	assert '' == screen.accessor.domain_name
	assert '' == screen.accessor.friendly_name
	assert '' == screen.accessor.metadata_info

	# - defaults are not valid
	assert not screen.is_valid()


async def test_passes_validation_when_https_and_hostname():
	# Arrange:
	screen = create(None)
	screen.accessor._https_flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._domain_name.input.text = 'localhost'  # pylint: disable=protected-access
	screen.accessor._domain_name.input.buffer.validate()  # pylint: disable=protected-access

	# Act + Assert:
	assert screen.is_valid()


async def test_fails_validation_when_https_and_ip():
	# Arrange:
	screen = create(None)
	screen.accessor._https_flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._domain_name.input.text = '127.0.0.1'  # pylint: disable=protected-access
	screen.accessor._domain_name.input.buffer.validate()  # pylint: disable=protected-access

	# Act + Assert:
	assert not screen.is_valid()


async def test_passes_validation_when_not_https_and_hostname():
	# Arrange:
	screen = create(None)
	screen.accessor._https_flag.current_values = []  # pylint: disable=protected-access
	screen.accessor._domain_name.input.text = 'localhost'  # pylint: disable=protected-access
	screen.accessor._domain_name.input.buffer.validate()  # pylint: disable=protected-access

	# Act + Assert:
	assert screen.is_valid()


async def test_passes_validation_when_not_https_and_ip():
	# Arrange:
	screen = create(None)
	screen.accessor._https_flag.current_values = []  # pylint: disable=protected-access
	screen.accessor._domain_name.input.text = '127.0.0.1'  # pylint: disable=protected-access
	screen.accessor._domain_name.input.buffer.validate()  # pylint: disable=protected-access

	# Act + Assert:
	assert screen.is_valid()


async def test_can_generate_diagnostic_accessor_representation():
	# Arrange:
	screen = create({'node-type': SingleValueScreen('dual')})
	screen.accessor._https_flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._domain_name.input.text = 'symbol.fyi'  # pylint: disable=protected-access
	screen.accessor._friendly_name.text = 'explorer node'  # pylint: disable=protected-access
	screen.accessor._metadata_info.text = 'some json blob'  # pylint: disable=protected-access

	# Act + Assert:
	assert (
		'(https=True, domain_name=\'symbol.fyi\', friendly_name=\'explorer node\', '
		'metadata_info=\'some json blob\')' == repr(screen.accessor)
	)
	assert [
		('https', 'enabled'),
		('domain name', 'symbol.fyi'),
		('friendly name', 'explorer node'),
		('metadata', 'some json blob')
	] == screen.accessor.tokens
